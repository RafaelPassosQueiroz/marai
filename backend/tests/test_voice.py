import base64
import io
import json
import wave

import httpx
import pytest
import respx

from app.services import voice


pytestmark = pytest.mark.asyncio
GEMINI_TTS = "https://generativelanguage.googleapis.com/v1beta/interactions"
TRANSCRIBE_MODEL = "models/gemini-3.5-transcribe"
GROQ_TRANSCRIPTIONS = "https://api.groq.com/openai/v1/audio/transcriptions"


@pytest.fixture
def wav_audio():
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(b"\x00\x00" * 48000)
    return output.getvalue()


def mock_gemini(wav_audio, *, alignment_status=200, annotations=()):
    def respond(request):
        if json.loads(request.content)["model"] == TRANSCRIBE_MODEL:
            return httpx.Response(
                alignment_status,
                json={
                    "steps": [
                        {
                            "type": "model_output",
                            "content": [{"type": "text", "annotations": annotations}],
                        }
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "steps": [{
                    "type": "model_output",
                    "content": [{
                        "type": "audio",
                        "mime_type": "audio/wav",
                        "data": base64.b64encode(wav_audio).decode(),
                    }],
                }]
            },
        )

    return respx.post(GEMINI_TTS).mock(side_effect=respond)


@pytest.mark.parametrize(
    ("text", "language", "gender", "level", "metadata", "voice_name"),
    [
        (
            "Você gosta de cinema?", "pt", "male", "A1",
            "Speaking Portuguese slowly and clearly.", "Charon",
        ),
        (
            "こんにちは。", "ja", "female", "A2",
            "Speaking Japanese slightly slower than a natural conversation, with clear diction.",
            "Kore",
        ),
        (
            "Tu aimes lire ?", "fr", "female", "B2",
            "Speaking French at a natural conversational pace.", "Kore",
        ),
    ],
)
@respx.mock
async def test_only_the_character_text_is_sent_as_transcript(
    monkeypatch, wav_audio, text, language, gender, level, metadata, voice_name,
):
    monkeypatch.setattr(voice.settings, "gemini_api_key", "fake-gemini")
    route = mock_gemini(wav_audio)

    speech = await voice.gemini_speech(text, language, gender, level)

    payload = json.loads(route.calls[0].request.content)
    assert payload["input"] == [
        {
            "type": "user_input",
            "content": [
                {
                    "type": "text",
                    "text": text,
                    "annotations": [{"type": "speech_metadata", "style": metadata}],
                }
            ],
        }
    ]
    assert payload["model"] == voice.settings.gemini_tts_model
    assert payload["store"] is False
    assert payload["response_format"] == {"type": "audio", "mime_type": "audio/wav"}
    assert payload["generation_config"]["speech_config"] == [{"voice": voice_name}]
    assert base64.b64decode(speech["audio"]) == wav_audio
    assert speech["mime"] == "audio/wav"
    assert speech["timings"] == []


@respx.mock
async def test_gemini_returns_offsets_from_transcription_of_the_exact_wav(monkeypatch, wav_audio):
    monkeypatch.setattr(voice.settings, "groq_api_key", "")
    monkeypatch.setattr(voice.settings, "gemini_api_key", "fake-gemini")
    words = [
        {"type": "word_info", "text": "Olá", "start_offset": "0.080s", "end_offset": "0.420s"},
        {"type": "word_info", "text": "amiga", "start_offset": "1.260s", "end_offset": "1.880s"},
    ]
    route = mock_gemini(wav_audio, annotations=words)

    speech = await voice.gemini_speech("Olá, amiga!", "pt", "female", "A2")

    assert route.call_count == 2
    request = route.calls[1].request
    assert request.headers["x-goog-api-key"] == "fake-gemini"
    assert json.loads(request.content) == {
        "model": TRANSCRIBE_MODEL,
        "store": False,
        "input": [{"type": "audio", "mime_type": "audio/wav", "data": speech["audio"]}],
        "generation_config": {
            "transcription_config": {
                "mode": {"type": "verbatim", "timestamp_granularities": ["word"]},
            },
        },
    }
    assert base64.b64decode(speech["audio"]) == wav_audio
    assert speech["timings"] == [
        {"text": "Olá", "start": 0.08, "end": 0.42},
        {"text": "amiga", "start": 1.26, "end": 1.88},
    ]


@pytest.mark.parametrize(
    ("status", "annotations"),
    [
        (429, []),
        (200, [{"type": "word_info", "text": "Hello", "start_offset": "0.1s", "end_offset": "3s"}]),
        (200, []),
    ],
)
@respx.mock
async def test_unavailable_or_unusable_alignment_keeps_the_speech(
    monkeypatch, wav_audio, status, annotations,
):
    monkeypatch.setattr(voice.settings, "gemini_api_key", "fake-gemini")
    mock_gemini(wav_audio, alignment_status=status, annotations=annotations)

    speech = await voice.gemini_speech("Hello!", "en", "female", "B1")

    assert speech["provider"] == "gemini"
    assert base64.b64decode(speech["audio"]) == wav_audio
    assert speech["timings"] == []


@respx.mock
async def test_skips_alignment_for_large_audio_without_losing_playback(monkeypatch, wav_audio):
    monkeypatch.setattr(voice.settings, "gemini_api_key", "fake-gemini")
    monkeypatch.setattr(voice.settings, "max_audio_bytes", len(wav_audio) - 3)
    route = mock_gemini(wav_audio)

    speech = await voice.gemini_speech("Hello!", "en", "female", "B1")

    assert route.call_count == 1
    assert base64.b64decode(speech["audio"]) == wav_audio
    assert speech["timings"] == []


@respx.mock
async def test_recording_transcription_does_not_request_word_alignment(monkeypatch, wav_audio):
    monkeypatch.setattr(voice.settings, "groq_api_key", "fake-groq")
    groq = respx.post(GROQ_TRANSCRIPTIONS).mock(
        return_value=httpx.Response(200, json={"text": "Hello!", "duration": 2})
    )

    assert await voice.transcribe(wav_audio, "recording.wav", "audio/wav", "en") == "Hello!"
    assert b"timestamp_granularities" not in groq.calls.last.request.content
