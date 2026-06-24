"""Settings, sourced from environment variables (Doppler in production).

All variables use the ATS_AI_ prefix, e.g. ATS_AI_CORS_ORIGINS.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ATS_AI_", env_file=".env")

    # Comma-separated list of allowed CORS origins (the Next.js app).
    cors_origins: list[str] = ["http://localhost:3000"]

    # spaCy model name; falls back to a blank pipeline if it can't be loaded.
    spacy_model: str = "en_core_web_sm"

    # Reject uploads larger than this many bytes (default 5 MB).
    max_upload_bytes: int = 5 * 1024 * 1024


settings = Settings()
