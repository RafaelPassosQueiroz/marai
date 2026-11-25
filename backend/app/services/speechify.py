"""HTTPS speech synthesis for Python Workers."""

import base64
import json
from html import escape, unescape

import httpx

from ..config import settings

ENDPOINT = "https://api.speechify.ai/v1/audio"
VOICES = {
    "en": ("en-US", "wyatt_32", "harper_32"),
    "es": ("es-ES", "guille", "vega"),
    "fr": ("fr-FR", "romain-agent", "isabelle-agent"),
    "de": ("de-DE", "henrik-agent", "runa-agent"),
    "it": ("it-IT", "daniele-agent", "benedetta-agent"),
    "pt": ("pt-BR", "fabio-agent", "leticia-agent"),
    "ja": ("ja-JP", "saku", "tsumugi"),
}


def word_timings(words):
    return [
        {
            "start": word["start_time"] / 1000,
            "end": word["end_time"] / 1000,
            "text": unescape(word["value"]),
        }
        for word in words
        if word.get("value")
    ]


async def stream_speech(client, payload):
    # The streaming API supports longer messages and reports absolute timings.
    audio, timings = bytearray(), []
    event = ""
    async with client.stream("POST", f"{ENDPOINT}/stream/with-timestamps", json=payload) as response:
        response.raise_for_status()
        async for line in response.aiter_lines():
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                if event == "speech.chunk":
                    chunk = json.loads(line[5:])
                    if chunk.get("audio"):
                        audio.extend(base64.b64decode(chunk["audio"], validate=True))
                    timings.extend(word_timings(chunk.get("speech_marks") or []))
                elif event == "speech.done":
                    return base64.b64encode(audio).decode("ascii"), timings
                elif event == "speech.error":
                    break
    raise ValueError("Incomplete audio stream")


async def speechify_speech(text, language, gender, level):
    if not settings.speechify_api_key:
        raise ValueError("Missing Speechify API key")
    locale, male, female = VOICES[language]
    voice = female if gender == "female" else male
    rate = "-18%" if level == "A1" else "-10%" if level == "A2" else "+0%"
    payload = {
        "input": f'<speak><prosody rate="{rate}">{escape(text, quote=False)}</prosody></speak>',
        "language": locale,
        "model": "simba-3.5",
        "voice_id": voice,
        "output_format": "mp3_24000_64",
    }
    async with httpx.AsyncClient(
        headers={"Authorization": f"Bearer {settings.speechify_api_key}"}, timeout=60
    ) as client:
        if len(text) <= 2000:
            response = await client.post(f"{ENDPOINT}/speech", json=payload)
            response.raise_for_status()
            data = response.json()
            audio = data["audio_data"]
            timings = word_timings((data.get("speech_marks") or {}).get("chunks") or [])
        else:
            audio, timings = await stream_speech(client, payload)
    if not audio:
        raise ValueError("Empty audio")
    return {
        "audio": audio,
        "mime": "audio/mpeg",
        "timings": timings,
        "provider": "speechify",
        "voice": voice,
    }
