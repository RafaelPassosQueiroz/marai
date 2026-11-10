import asyncio
import base64
import io
import wave
import httpx
import edge_tts
from mutagen import File as AudioFile
from fastapi import HTTPException
from ..config import settings

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


async def gemini_speech(text, language, gender, level):
    voice = "Charon" if gender == "male" else "Kore"
    pace = (
        "slowly and clearly"
        if level in ("A1", "A2")
        else "at a natural conversational pace"
    )
    async with httpx.AsyncClient(timeout=70) as client:
        r = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_tts_model}:generateContent",
            headers={"x-goog-api-key": settings.gemini_api_key},
            json={
                "contents": [
                    {
                        "parts": [
                            {
                                "text": f"Read exactly the following text {pace}. Do not add words.\n{text}"
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
                    },
                },
            },
        )
    r.raise_for_status()
    inline = r.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
    pcm = base64.b64decode(inline["data"])
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(pcm)
    return {
        "audio": base64.b64encode(output.getvalue()).decode(),
        "mime": "audio/wav",
        "timings": [],
        "provider": "gemini",
        "voice": voice,
    }


async def synthesize(text, language, gender, level):
    if settings.tts_provider == "gemini" and settings.gemini_api_key:
        try:
            return await gemini_speech(text, language, gender, level)
        except (httpx.HTTPError, KeyError, IndexError, ValueError):
            pass
    try:
        return await asyncio.wait_for(
            edge_speech(text, language, gender, level), timeout=60
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
