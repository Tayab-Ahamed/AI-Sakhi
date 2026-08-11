"""Typed, validated application configuration.

Every setting is read once, coerced to the right type, and validated. Invalid
configuration fails loudly at import time instead of silently degrading at
runtime. Module-level constants are kept for backwards compatibility with the
existing imports across the codebase.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()

DEV_JWT_SECRET = "sakhi-dev-secret-change-in-production"  # noqa: S105 - explicit dev-only sentinel


def _str(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _int(name: str, default: int, minimum: int | None = None, maximum: int | None = None) -> int:
    raw = _str(name)
    try:
        value = int(raw) if raw else default
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer, got {raw!r}") from exc
    if minimum is not None and value < minimum:
        raise ValueError(f"{name} must be >= {minimum}")
    if maximum is not None and value > maximum:
        raise ValueError(f"{name} must be <= {maximum}")
    return value


def _float(name: str, default: float, minimum: float | None = None, maximum: float | None = None) -> float:
    raw = _str(name)
    try:
        value = float(raw) if raw else default
    except ValueError as exc:
        raise ValueError(f"{name} must be a number, got {raw!r}") from exc
    if minimum is not None and value < minimum:
        raise ValueError(f"{name} must be >= {minimum}")
    if maximum is not None and value > maximum:
        raise ValueError(f"{name} must be <= {maximum}")
    return value


def _bool(name: str, default: bool = False) -> bool:
    raw = _str(name).lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _csv(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in _str(name, default).split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    """Validated runtime settings."""

    # Environment
    env: str = field(default_factory=lambda: _str("SAKHI_ENV", "development").lower())
    log_level: str = field(default_factory=lambda: _str("LOG_LEVEL", "INFO").upper())

    # Secrets and auth
    jwt_secret: str = field(default_factory=lambda: os.environ.get("SAKHI_JWT_SECRET", DEV_JWT_SECRET))
    jwt_algorithm: str = "HS256"
    session_hours: int = field(default_factory=lambda: _int("SAKHI_SESSION_HOURS", 24, 1, 24))

    # LLM
    groq_api_key: str = field(default_factory=lambda: _str("GROQ_API_KEY"))
    groq_model: str = field(default_factory=lambda: _str("GROQ_MODEL", "llama-3.3-70b-versatile"))
    groq_vision_model: str = field(
        default_factory=lambda: _str("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    )
    llm_timeout_seconds: float = field(default_factory=lambda: _float("LLM_TIMEOUT_SECONDS", 45.0, 1.0, 300.0))
    llm_max_retries: int = field(default_factory=lambda: _int("LLM_MAX_RETRIES", 2, 0, 5))
    llm_cache_ttl_seconds: int = field(default_factory=lambda: _int("LLM_CACHE_TTL_SECONDS", 900, 0, 86_400))
    llm_cache_max_entries: int = field(default_factory=lambda: _int("LLM_CACHE_MAX_ENTRIES", 256, 0, 10_000))

    # Storage
    db_path: str = field(default_factory=lambda: _str("DB_PATH", "./sakhi.db"))
    chroma_path: str = field(default_factory=lambda: _str("CHROMA_PATH", "./chroma_db"))

    # Retrieval
    embedding_model: str = field(
        default_factory=lambda: _str("EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
    )
    rag_max_distance: float = field(default_factory=lambda: _float("RAG_MAX_DISTANCE", 0.72, 0.0, 2.0))
    rag_candidate_multiplier: int = field(default_factory=lambda: _int("RAG_CANDIDATE_MULTIPLIER", 4, 1, 20))
    rag_catalog_ttl_seconds: int = field(default_factory=lambda: _int("RAG_CATALOG_TTL_SECONDS", 300, 0, 86_400))

    # HTTP
    backend_url: str = field(default_factory=lambda: _str("BACKEND_URL", "http://localhost:8000"))
    allowed_origins: list[str] = field(default_factory=lambda: _csv("ALLOWED_ORIGINS", "http://localhost:3000"))
    max_json_body_bytes: int = field(default_factory=lambda: _int("MAX_JSON_BODY_BYTES", 1_048_576, 1024, 33_554_432))
    max_upload_bytes: int = field(default_factory=lambda: _int("MAX_UPLOAD_BYTES", 10_485_760, 1024, 52_428_800))
    max_pdf_pages: int = field(default_factory=lambda: _int("MAX_PDF_PAGES", 50, 1, 500))

    # Feature flags
    enable_demo_seed: bool = field(default_factory=lambda: _bool("SAKHI_ENABLE_DEMO_SEED", False))
    enable_metrics: bool = field(default_factory=lambda: _bool("SAKHI_ENABLE_METRICS", True))
    enable_csrf: bool = field(default_factory=lambda: _bool("SAKHI_ENABLE_CSRF", True))

    # Monitoring
    sentry_dsn: str = field(default_factory=lambda: _str("SENTRY_DSN"))
    sentry_traces_sample_rate: float = field(
        default_factory=lambda: _float("SENTRY_TRACES_SAMPLE_RATE", 0.1, 0.0, 1.0)
    )

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def using_dev_jwt_secret(self) -> bool:
        return self.jwt_secret == DEV_JWT_SECRET

    def validation_errors(self) -> list[str]:
        """Return blocking configuration problems. Empty list means healthy."""
        errors: list[str] = []
        if not self.is_production:
            return errors
        if len(self.jwt_secret.encode()) < 32 or self.using_dev_jwt_secret:
            errors.append("SAKHI_JWT_SECRET must contain at least 32 random bytes")
        if not self.allowed_origins or any(
            origin == "*" or origin.startswith("http://") for origin in self.allowed_origins
        ):
            errors.append("ALLOWED_ORIGINS must contain explicit HTTPS origins")
        if not self.groq_api_key:
            errors.append("GROQ_API_KEY is required")
        if self.enable_demo_seed:
            errors.append("SAKHI_ENABLE_DEMO_SEED must be false in production")
        return errors


def get_settings() -> Settings:
    """Build settings from the current environment (re-read on each call)."""
    return Settings()


settings = get_settings()

# ── Backwards-compatible module constants ────────────────────────────────────
GROQ_API_KEY = settings.groq_api_key
GROQ_MODEL = settings.groq_model
GROQ_VISION_MODEL = settings.groq_vision_model
CHROMA_PATH = settings.chroma_path
DB_PATH = settings.db_path
BACKEND_URL = settings.backend_url
