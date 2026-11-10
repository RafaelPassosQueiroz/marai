from pathlib import Path
from pydantic import EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://marai:marai_local@127.0.0.1:5433/marai"
    gemini_api_key: str = ""
    groq_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_tts_model: str = "gemini-3.8-flash-lite-tts"
    groq_model: str = "openai/gpt-oss-120b"
    groq_stt_model: str = "whisper-large-v3-turbo"
    tts_provider: str = "edge"
    frontend_url: str = "http://localhost:5173"
    cookie_secure: bool = False
    session_days: int = 14
    gemini_cooldown_seconds: int = 300
    max_audio_seconds: int = 120
    max_audio_bytes: int = 8_388_608
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8001/api/auth/google/callback"
    mymemory_email: EmailStr | None = None

    @field_validator("mymemory_email", mode="before")
    @classmethod
    def optional_translation_email(cls, value):
        if isinstance(value, str):
            return value.strip() or None
        return value


settings = Settings()
