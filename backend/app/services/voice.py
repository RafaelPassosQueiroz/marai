import asyncio
import base64
import io
import wave
import httpx
from mutagen import File as AudioFile
from fastapi import HTTPException
from ..config import IS_WORKER, settings
from .dialogue import LANGUAGES
from .speechify import speechify_speech

GEMINI_INTERACTIONS = "https://generativelanguage.googleapis.com/v1beta/interactions"
VOICES = {
    "en": ("en-US-GuyNeural", "en-US-JennyNeural"),
    "es": ("es-ES-AlvaroNeural", "es-ES-ElviraNeural"),
    "fr": ("fr-FR-HenriNeural", "fr-FR-DeniseNeural"),
    "de": ("de-DE-ConradNeural", "de-DE-KatjaNeural"),
    "it": ("it-IT-DiegoNeural", "it-IT-ElsaNeural"),
    "pt": ("pt-BR-AntonioNeural", "pt-BR-FranciscaNeural"),
    "ja": ("ja-JP-KeitaNeural", "ja-JP-NanamiNeural"),
}


async def transcribe(data: bytes, filename: str, mime: str, language: str):
    if not settings.groq_api_key:
        raise HTTPException(503, "Configure GROQ_API_KEY para reconhecer o áudio.")
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            r = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={"file": (filename, data, mime)},
                data={
                    "model": settings.groq_stt_model,
                    "language": language,
                    "response_format": "verbose_json",
                    "temperature": "0",
                },
            )
        except httpx.HTTPError:
            raise HTTPException(
                503, "Falha de conexão ao transcrever. Tente novamente."
            )
    if r.status_code != 200:
        raise HTTPException(
            503, "Não foi possível transcrever o áudio. Aguarde e tente novamente."
        )
    body = r.json()
    if body.get("duration", 0) > settings.max_audio_seconds + 2:
        raise HTTPException(413, "A gravação ultrapassou o limite de duração.")
    text = body.get("text", "").strip()
    segments = body.get("segments", [])
    if not text or (
        segments and all(s.get("no_speech_prob", 0) > 0.8 for s in segments)
    ):
        raise HTTPException(
            422,
            "Não identifiquei fala nesse áudio. Grave novamente em um lugar mais silencioso.",
        )
    return text


async def edge_speech(text, language, gender, level):
    import edge_tts

    voice = VOICES[language][gender == "female"]
    rate = "-18%" if level == "A1" else "-10%" if level == "A2" else "+0%"
    audio, timings = bytearray(), []
    communicate = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            timings.append(
                {
                    "start": chunk["offset"] / 10_000_000,
                    "end": (chunk["offset"] + chunk["duration"]) / 10_000_000,
                    "text": chunk["text"],
                }
            )
    if not audio:
        raise ValueError("empty audio")
    return {
        "audio": base64.b64encode(audio).decode(),
        "mime": "audio/mpeg",
        "timings": timings,
        "provider": "edge",
        "voice": voice,
    }


def _model_output(payload):
    for step in payload["steps"]:
        if step["type"] == "model_output":
            yield from step["content"]


async def _gemini_word_timings(client: httpx.AsyncClient, encoded_audio: str):
    max_encoded_bytes = 4 * ((settings.max_audio_bytes + 2) // 3)
    if len(encoded_audio) > max_encoded_bytes:
        return []
    try:
        audio = base64.b64decode(encoded_audio, validate=True)
        if len(audio) > settings.max_audio_bytes:
            return []
        duration = audio_duration(audio, "audio/wav")
        if not duration:
            return []
        response = await client.post(
            GEMINI_INTERACTIONS,
            timeout=12,
            json={
                "model": "models/gemini-3.5-transcribe",
                "store": False,
                "input": [{"type": "audio", "mime_type": "audio/wav", "data": encoded_audio}],
                "generation_config": {
                    "transcription_config": {
                        "mode": {"type": "verbatim", "timestamp_granularities": ["word"]},
                    },
                },
            },
        )
        response.raise_for_status()
        timings = []
        previous_start = 0.0
        for part in _model_output(response.json()):
            if part["type"] != "text":
                continue
            for word in part.get("annotations") or []:
                if word["type"] != "word_info":
                    continue
                text = word["text"]
                start, end = word["start_offset"], word["end_offset"]
                if not all(isinstance(offset, str) and offset.endswith("s") for offset in (start, end)):
                    return []
                start, end = float(start[:-1]), float(end[:-1])
                if not isinstance(text, str) or not text.strip() or not previous_start <= start < end <= duration:
                    return []
                timings.append({"start": start, "end": end, "text": text})
                previous_start = start
        return timings
    except (httpx.HTTPError, HTTPException, KeyError, TypeError, ValueError):
        return []


async def gemini_speech(text, language, gender, level):
    voice = "Charon" if gender == "male" else "Kore"
    pace = {
        "A1": "slowly and clearly",
        "A2": "slightly slower than a natural conversation, with clear diction",
    }.get(level, "at a natural conversational pace")
    async with httpx.AsyncClient(
        timeout=70, headers={"x-goog-api-key": settings.gemini_api_key}
    ) as client:
        r = await client.post(
            GEMINI_INTERACTIONS,
            json={
                "model": settings.gemini_tts_model,
                "store": False,
                "input": [
                    {
                        "type": "user_input",
                        "content": [
                            {
                                "type": "text",
                                "text": text,
                                "annotations": [
                                    {
                                        "type": "speech_metadata",
                                        "style": f"Speaking {LANGUAGES[language]} {pace}.",
                                    }
                                ],
                            }
                        ],
                    }
                ],
                "response_format": {"type": "audio", "mime_type": "audio/wav"},
                "generation_config": {"speech_config": [{"voice": voice}]},
            },
        )
        r.raise_for_status()
        audio = None
        for part in _model_output(r.json()):
            if part["type"] == "audio":
                audio = part["data"]
        if not isinstance(audio, str) or not audio:
            raise ValueError("Gemini did not return WAV audio")
        timings = await _gemini_word_timings(client, audio)
    return {
        "audio": audio,
        "mime": "audio/wav",
        "timings": timings,
        "provider": "gemini",
        "voice": voice,
    }


async def synthesize(text, language, gender, level):
    if settings.tts_provider == "gemini" and settings.gemini_api_key:
        try:
            return await gemini_speech(text, language, gender, level)
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            pass
    try:
        fallback = (
            speechify_speech
            if IS_WORKER or settings.tts_provider == "speechify"
            else edge_speech
        )
        return await asyncio.wait_for(
            fallback(text, language, gender, level), timeout=60
        )
    except Exception:
        raise HTTPException(
            503,
            "A voz está indisponível. O texto foi salvo; você pode tentar ouvir novamente.",
        )


def audio_duration(data: bytes, mime: str):
    if mime in ("audio/wav", "audio/x-wav"):
        try:
            with wave.open(io.BytesIO(data)) as audio:
                return audio.getnframes() / audio.getframerate()
        except (wave.Error, EOFError):
            raise HTTPException(422, "Arquivo de áudio inválido.")
    try:
        audio = AudioFile(io.BytesIO(data))
        return audio.info.length if audio else None
    except Exception:
        return None
