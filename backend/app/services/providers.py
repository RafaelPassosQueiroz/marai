"""Real provider calls. Failures are sanitized; credentials never enter URLs or logs."""

import asyncio
import json
from time import monotonic
import httpx
from fastapi import HTTPException
from ..config import settings


class ProviderError(Exception):
    def __init__(self, status: int):
        self.status = status


class Providers:
    def __init__(self):
        self.gemini_unavailable_until = 0.0
        self.last_provider = ""

    async def gemini(
        self, system: str, messages: list[dict], json_mode=False, temperature=0.85
    ):
        if not settings.gemini_api_key:
            raise ProviderError(401)
        contents = [
            {
                "role": "model" if m["role"] == "assistant" else "user",
                "parts": [{"text": m["content"]}],
            }
            for m in messages
        ]
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": {"temperature": temperature, "maxOutputTokens": 1800},
        }
        if json_mode:
            body["generationConfig"]["responseMimeType"] = "application/json"
        async with httpx.AsyncClient(timeout=55) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent",
                headers={"x-goog-api-key": settings.gemini_api_key},
                json=body,
            )
        if r.status_code != 200:
            raise ProviderError(r.status_code)
        try:
            parts = r.json()["candidates"][0]["content"]["parts"]
            result = "".join(
                p.get("text", "") for p in parts if not p.get("thought")
            ).strip()
            if not result:
                raise ValueError()
            return result
        except (KeyError, IndexError, ValueError):
            raise ProviderError(502)

    async def groq(
        self, system: str, messages: list[dict], json_mode=False, temperature=0.85
    ):
        if not settings.groq_api_key:
            raise ProviderError(401)
        body = {
            "model": settings.groq_model,
            "messages": [{"role": "system", "content": system}, *messages],
            "temperature": temperature,
            "max_completion_tokens": 2200,
            "reasoning_effort": "low",
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=55) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json=body,
            )
        if r.status_code != 200:
            raise ProviderError(r.status_code)
        try:
            result = r.json()["choices"][0]["message"]["content"].strip()
            if not result:
                raise ValueError()
            return result
        except (KeyError, IndexError, ValueError, AttributeError):
            raise ProviderError(502)

    async def complete(
        self, system: str, messages: list[dict], json_mode=False, temperature=0.85
    ):
        if monotonic() >= self.gemini_unavailable_until:
            try:
                result = await self.gemini(system, messages, json_mode, temperature)
                self.last_provider = "gemini"
                return result, "gemini"
            except (ProviderError, httpx.HTTPError) as error:
                status = error.status if isinstance(error, ProviderError) else 503
                # Cooldown includes exhausted quota, invalid/unavailable model and network failures.
                if status in (400, 401, 403, 404, 408, 429) or status >= 500:
                    self.gemini_unavailable_until = (
                        monotonic() + settings.gemini_cooldown_seconds
                    )
                else:
                    raise HTTPException(
                        502, "Não foi possível consultar a IA. Tente novamente."
                    )
        try:
            result = await self.groq(system, messages, json_mode, temperature)
            self.last_provider = "groq"
            return result, "groq"
        except (ProviderError, httpx.HTTPError) as error:
            status = error.status if isinstance(error, ProviderError) else 503
            if status == 429:
                raise HTTPException(
                    503,
                    "Os provedores de IA estão no limite de uso. Aguarde e tente novamente.",
                )
            raise HTTPException(
                503,
                "A IA está indisponível. Verifique as credenciais e a conexão e tente novamente.",
            )

    async def json(self, system: str, messages: list[dict], *, temperature=0.85):
        text, provider = await self.complete(
            system + "\nReturn ONLY a valid JSON object.", messages, True, temperature
        )
        try:
            result = json.loads(
                text.removeprefix("```json").removesuffix("```").strip()
            )
            if not isinstance(result, dict):
                raise ValueError("Expected JSON object")
            return result, provider
        except (ValueError, TypeError):
            raise HTTPException(
                502, "A IA retornou um formato inválido. Tente novamente."
            )


providers = Providers()
