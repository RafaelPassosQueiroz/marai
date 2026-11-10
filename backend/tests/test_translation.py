import httpx
import pytest
import respx

from app.config import Settings, settings
from app.services.translation import ENDPOINT, LIMIT_MESSAGE
from app.services import providers
from conftest import register, character, conversation


def success(text="Good morning"):
    return {"responseStatus": 200, "responseData": {"translatedText": text}, "quotaFinished": False}


def test_translation_requires_login(client):
    assert client.post("/api/translate", json={"text": "bom dia", "source": "pt-BR", "target": "en"}).status_code == 401


@respx.mock
def test_translation_is_independent_and_leaves_conversation_unchanged(client, ai, monkeypatch):
    register(client)
    conv = conversation(client, character(client))
    before = client.get(f"/api/conversations/{conv['id']}").json()
    monkeypatch.setattr(settings, "mymemory_email", None)
    async def no_ai(*args, **kwargs):
        raise AssertionError("Translation must not call an AI")
    monkeypatch.setattr(providers.providers, "complete", no_ai)
    monkeypatch.setattr(providers.providers, "json", no_ai)
    upstream = respx.get(ENDPOINT).mock(return_value=httpx.Response(200, json=success()))
    response = client.post("/api/translate", json={"text": "bom dia", "source": "pt-BR", "target": "en"})
    assert response.status_code == 200
    assert response.json()["translated_text"] == "Good morning"
    assert upstream.call_count == 1
    assert dict(upstream.calls[0].request.url.params) == {"q": "bom dia", "langpair": "pt-BR|en"}
    assert client.get(f"/api/conversations/{conv['id']}").json() == before
    assert ai == []


@respx.mock
def test_optional_email_is_sent_only_to_provider(client, monkeypatch):
    register(client)
    monkeypatch.setattr(settings, "mymemory_email", "teacher@example.org")
    upstream = respx.get(ENDPOINT).mock(return_value=httpx.Response(200, json=success("I&#39;m here")))
    response = client.post("/api/translate", json={"text": "estou aqui", "source": "pt-BR", "target": "en"})
    assert response.json()["translated_text"] == "I'm here"
    assert upstream.calls[0].request.url.params["de"] == "teacher@example.org"
    assert "teacher@example.org" not in response.text
    assert "mymemory_email" not in client.get("/api/config").json()


@respx.mock
def test_exact_500_utf8_bytes_allowed_and_overflow_blocked_before_provider(client):
    register(client)
    upstream = respx.get(ENDPOINT).mock(return_value=httpx.Response(200, json=success("hello")))
    assert client.post("/api/translate", json={"text": "é" * 250, "source": "pt-BR", "target": "en"}).status_code == 200
    response = client.post("/api/translate", json={"text": "é" * 251, "source": "pt-BR", "target": "en"})
    assert response.status_code == 422
    assert "500 bytes" in response.json()["detail"]
    assert upstream.call_count == 1


@pytest.mark.parametrize("payload", [
    {"text": " ", "source": "pt-BR", "target": "en"},
    {"text": "oi", "source": "en", "target": "en"},
    {"text": "oi", "source": "invalid", "target": "en"},
    {"text": "fuck", "source": "en", "target": "pt-BR"},
])
@respx.mock
def test_invalid_or_forbidden_input_never_leaves_backend(client, payload):
    register(client)
    upstream = respx.get(ENDPOINT).mock(return_value=httpx.Response(200, json=success()))
    assert client.post("/api/translate", json=payload).status_code == 422
    assert not upstream.called


@pytest.mark.parametrize("status,payload,expected", [
    (429, {}, 429),
    (503, {}, 503),
    (200, {"responseStatus": 429, "responseData": {"translatedText": "quota"}}, 429),
    (200, {"responseStatus": 200, "quotaFinished": True}, 429),
    (200, {"responseStatus": 403, "responseDetails": "YOU USED ALL AVAILABLE FREE TRANSLATIONS"}, 429),
    (200, {"responseStatus": 400, "responseDetails": "unsupported pair"}, 422),
    (200, {"responseStatus": 200, "responseData": {}}, 502),
    (200, ["malformed response"], 502),
    (200, success("fuck"), 422),
])
@respx.mock
def test_provider_errors_have_friendly_messages(client, status, payload, expected):
    register(client)
    respx.get(ENDPOINT).mock(return_value=httpx.Response(status, json=payload))
    response = client.post("/api/translate", json={"text": "bom dia", "source": "pt-BR", "target": "en"})
    assert response.status_code == expected
    assert isinstance(response.json()["detail"], str)
    if expected == 429:
        assert response.json()["detail"] == LIMIT_MESSAGE


@pytest.mark.parametrize("error,status", [(httpx.ReadTimeout("timeout"), 504), (httpx.ConnectError("offline"), 503)])
@respx.mock
def test_network_failures_do_not_retry_or_call_other_providers(client, error, status):
    register(client)
    upstream = respx.get(ENDPOINT).mock(side_effect=error)
    response = client.post("/api/translate", json={"text": "bom dia", "source": "pt-BR", "target": "en"})
    assert response.status_code == status
    assert upstream.call_count == 1


def test_email_configuration_is_optional_and_validated():
    assert Settings(_env_file=None, mymemory_email="").mymemory_email is None
    with pytest.raises(ValueError):
        Settings(_env_file=None, mymemory_email="invalid")
