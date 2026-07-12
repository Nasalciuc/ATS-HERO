"""Settings, sourced from environment variables (Doppler / Heroku in production).

Prefixed vars use ATS_AI_ (e.g. ATS_AI_SPACY_MODEL). CORS also accepts
unprefixed ALLOWED_ORIGINS (comma-separated) for Heroku config.
"""
from __future__ import annotations

import json
import os

from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_origins(raw: str) -> list[str]:
    raw = raw.strip()
    if not raw:
        return ["http://localhost:3000"]
    if raw.startswith("["):
        parsed = json.loads(raw)
        return [str(o).strip() for o in parsed if str(o).strip()]
    return [o.strip() for o in raw.split(",") if o.strip()]


def resolve_cors_origins(default: list[str] | None = None) -> list[str]:
    """Prefer ALLOWED_ORIGINS (Heroku), then ATS_AI_CORS_ORIGINS, else default."""
    for key in ("ALLOWED_ORIGINS", "ATS_AI_CORS_ORIGINS"):
        raw = os.getenv(key)
        if raw and raw.strip():
            return _parse_origins(raw)
    return list(default or ["http://localhost:3000"])


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ATS_AI_", env_file=".env", extra="ignore")

    # Comma-separated / JSON list of allowed CORS origins (the Next.js app).
    # Overridden at runtime by ALLOWED_ORIGINS when set (see resolve_cors_origins).
    cors_origins: list[str] = ["http://localhost:3000"]

    # spaCy model name; falls back to a blank pipeline if it can't be loaded.
    spacy_model: str = "en_core_web_sm"

    # Reject uploads larger than this many bytes (default 5 MB).
    max_upload_bytes: int = 5 * 1024 * 1024


settings = Settings()
settings.cors_origins = resolve_cors_origins(settings.cors_origins)
