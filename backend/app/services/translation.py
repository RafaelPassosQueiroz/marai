"""Free MyMemory lookup, independent of conversation generation and persistence."""

from html import unescape

import httpx

from ..config import settings
from .safety import REFUSALS, locally_blocked

ENDPOINT = "https://api.mymemory.translated.net/get"
LANGUAGES = {"pt-BR", "en", "es", "fr", "de", "it", "ja", "ko", "zh-CN", "ar", "ru", "nl", "pl", "tr", "hi", "sv"}
LIMIT_MESSAGE = "O limite diário gratuito do tradutor foi atingido. Tente novamente mais tarde."
UNAVAILABLE_MESSAGE = "O tradutor está indisponível no momento. Tente novamente em instantes."


class TranslationError(Exception):
    def __init__(self, message: str, status: int = 503):
        super().__init__(message)
        self.status = status


async def translate(text: str, source: str, target: str) -> dict:
    if len(text.encode("utf-8")) > 500:
        raise TranslationError("Use no máximo 500 bytes por consulta. Reduza o texto e tente novamente.", 422)
    text = text.strip()
    if not text:
        raise TranslationError("Digite uma palavra ou frase para traduzir.", 422)
    if source not in LANGUAGES or target not in LANGUAGES or source == target:
        raise TranslationError("Escolha dois idiomas diferentes entre as opções disponíveis.", 422)
    # Preserve local content restrictions without calling an AI or changing the conversation.
    if locally_blocked(text):
        raise TranslationError(REFUSALS["pt"], 422)

    params = {"q": text, "langpair": f"{source}|{target}"}
    if settings.mymemory_email:
        params["de"] = str(settings.mymemory_email)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(12, connect=5)) as client:
            response = await client.get(ENDPOINT, params=params)
    except httpx.TimeoutException:
        raise TranslationError("O tradutor demorou para responder. Tente novamente em instantes.", 504) from None
    except httpx.RequestError:
        raise TranslationError(UNAVAILABLE_MESSAGE) from None

    if response.status_code == 429:
        raise TranslationError(LIMIT_MESSAGE, 429)
    if response.status_code >= 500:
        raise TranslationError(UNAVAILABLE_MESSAGE)
    try:
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("invalid response")
        data = payload.get("responseData")
        result = data.get("translatedText") if isinstance(data, dict) else None
        details = str(payload.get("responseDetails") or "").lower()
        status = str(payload.get("responseStatus", response.status_code))
    except (ValueError, TypeError):
        raise TranslationError("O tradutor retornou uma resposta inesperada. Tente novamente.", 502) from None

    if (payload.get("quotaFinished") in (True, "true") or status == "429"
            or "used all available free" in details
            or (isinstance(result, str) and result.upper().startswith("MYMEMORY WARNING"))):
        raise TranslationError(LIMIT_MESSAGE, 429)
    if response.status_code >= 400 or status != "200":
        raise TranslationError("Não foi possível traduzir esse texto. Confira os idiomas e tente novamente.", 422)
    if not isinstance(result, str) or not result.strip():
        raise TranslationError("O tradutor não retornou uma tradução. Tente outra palavra ou frase.", 502)
    translated = unescape(result).strip()
    if locally_blocked(translated):
        raise TranslationError(REFUSALS["pt"], 422)
    return {"translated_text": translated, "source": source, "target": target, "provider": "MyMemory"}
