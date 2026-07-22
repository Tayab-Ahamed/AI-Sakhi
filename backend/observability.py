"""Production observability primitives with no external service dependency."""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import UTC, datetime
from uuid import uuid4
from typing import Any


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("request_id", "method", "path", "status_code", "duration_ms", "user_id", "organization_id"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


async def request_logging_middleware(request: Any, call_next):
    started = time.perf_counter()
    request_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except Exception:
        logging.getLogger("sakhi.request").exception(
            "Unhandled request failure",
            extra={"request_id": request_id, "method": request.method, "path": request.url.path},
        )
        raise
    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    auth = getattr(request.state, "auth", {}) or {}
    logging.getLogger("sakhi.request").info(
        "Request completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "user_id": auth.get("sub"),
            "organization_id": auth.get("org"),
        },
    )
    response.headers["X-Request-ID"] = request_id
    response.headers["Server-Timing"] = f"app;dur={duration_ms}"
    return response


def init_error_monitoring() -> None:
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=dsn, environment=os.getenv("SAKHI_ENV", "development"), traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")), send_default_pii=False)
    except Exception:
        logging.getLogger("sakhi.monitoring").exception("Could not initialize error monitoring")


def validate_production_config() -> list[str]:
    """Return configuration errors. Production startup must fail when non-empty."""
    errors: list[str] = []
    if os.getenv("SAKHI_ENV") == "production":
        secret = os.getenv("SAKHI_JWT_SECRET", "")
        if len(secret.encode()) < 32:
            errors.append("SAKHI_JWT_SECRET must contain at least 32 bytes")
        origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "").split(",") if x.strip()]
        if not origins or any(x == "*" or x.startswith("http://") for x in origins):
            errors.append("ALLOWED_ORIGINS must contain explicit HTTPS origins")
        if not os.getenv("GROQ_API_KEY"):
            errors.append("GROQ_API_KEY is required")
    return errors
