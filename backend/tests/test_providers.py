import httpx
import pytest
import respx
from fastapi import HTTPException
from app.services.providers import Providers
from app.config import settings


@pytest.mark.asyncio
@respx.mock
async def test_quota_exhaustion_falls_back_and_cooldown_skips_gemini(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-gemini")
    monkeypatch.setattr(settings, "groq_api_key", "test-groq")
    gemini = respx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    ).mock(return_value=httpx.Response(429, json={"error": {"message": "quota"}}))
    groq = respx.post("https://api.groq.com/openai/v1/chat/completions").mock(
        return_value=httpx.Response(
            200, json={"choices": [{"message": {"content": "Hello!"}}]}
        )
    )
    provider = Providers()
    for _ in range(2):
        text, name = await provider.complete(
            "System", [{"role": "user", "content": "Hi"}]
        )
        assert text == "Hello!" and name == "groq"
    assert gemini.call_count == 1 and groq.call_count == 2
    provider.gemini_unavailable_until = 0
    await provider.complete("System", [{"role": "user", "content": "Hi"}])
    assert gemini.call_count == 2


@pytest.mark.asyncio
@respx.mock
async def test_both_providers_fail_without_fabricated_reply(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test")
    monkeypatch.setattr(settings, "groq_api_key", "test")
    respx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    ).mock(return_value=httpx.Response(503))
    respx.post("https://api.groq.com/openai/v1/chat/completions").mock(
        return_value=httpx.Response(429)
    )
    with pytest.raises(HTTPException) as error:
        await Providers().complete("System", [{"role": "user", "content": "Hi"}])
    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_malformed_moderation_fails_closed(monkeypatch):
    from app.services import safety

    async def invalid(*args, **kwargs):
        return {"blocked": "false"}, "test"

    monkeypatch.setattr(safety.providers, "json", invalid)
    with pytest.raises(HTTPException):
        await safety.is_blocked("Hi!")


def test_all_languages_have_two_fixed_voices_and_boundaries():
    from app.services.voice import VOICES
    from app.services.safety import REFUSALS

    assert set(VOICES) == {"en", "es", "fr", "de", "it", "pt", "ja"} == set(REFUSALS)
    for voices in VOICES.values():
        assert len(voices) == 2 and voices[0] != voices[1]


@pytest.mark.asyncio
@respx.mock
async def test_moderation_temperature_is_preserved_on_fallback(monkeypatch):
    import json

    monkeypatch.setattr(settings, "gemini_api_key", "test")
    monkeypatch.setattr(settings, "groq_api_key", "test")
    primary = respx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    ).mock(return_value=httpx.Response(429))
    backup = respx.post("https://api.groq.com/openai/v1/chat/completions").mock(
        return_value=httpx.Response(
            200, json={"choices": [{"message": {"content": '{"blocked": true}'}}]}
        )
    )
    result, name = await Providers().json(
        "Strict rules", [{"role": "user", "content": "Example"}], temperature=0.0
    )
    assert result["blocked"] is True and name == "groq"
    assert (
        json.loads(primary.calls[0].request.content)["generationConfig"]["temperature"]
        == 0.0
    )
    assert json.loads(backup.calls[0].request.content)["temperature"] == 0.0
