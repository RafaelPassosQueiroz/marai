"""Cloudflare Workers entrypoint for the existing FastAPI application."""

import os

from sqlalchemy.engine import URL
from workers import WorkerEntrypoint, asgi


_SETTING_NAMES = (
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "GEMINI_MODEL",
    "GEMINI_TTS_MODEL",
    "GROQ_MODEL",
    "GROQ_STT_MODEL",
    "TTS_PROVIDER",
    "FRONTEND_URL",
    "COOKIE_SECURE",
    "SESSION_DAYS",
    "GEMINI_COOLDOWN_SECONDS",
    "MAX_AUDIO_SECONDS",
    "MAX_AUDIO_BYTES",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "MYMEMORY_EMAIL",
    "OAUTH_STATE_SECRET",
)


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        # Populate settings before importing app.main, whose Settings and
        # SQLAlchemy engine are intentionally initialized once at startup.
        if not getattr(self.env, "OAUTH_STATE_SECRET", None):
            raise RuntimeError("OAUTH_STATE_SECRET must be configured as a Worker secret.")
        for name in _SETTING_NAMES:
            value = getattr(self.env, name, None)
            if value is not None:
                os.environ[name] = str(value)

        hyperdrive = self.env.HYPERDRIVE
        os.environ["DATABASE_URL"] = URL.create(
            "postgresql+pg8000",
            username=hyperdrive.user,
            password=hyperdrive.password,
            host=hyperdrive.host,
            port=int(hyperdrive.port),
            database=hyperdrive.database,
            query={"sslmode": "disable"},
        ).render_as_string(hide_password=False)

        from app.main import app

        return await asgi.fetch(app, request, self.env)
