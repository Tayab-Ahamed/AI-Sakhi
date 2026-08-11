"""Single hardened entry point for every LLM call.

Responsibilities:
  * lazy client construction (so the package imports without network deps)
  * per-request timeout
  * bounded retries with exponential backoff + jitter on transient failures
  * an in-process TTL cache for deterministic (temperature<=0.2) prompts
  * token accounting and latency metrics for observability

Every module should call `complete()` instead of touching the Groq SDK.
"""
from __future__ import annotations

import hashlib
import json
import logging
import random
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Iterator, Sequence

from backend.config import settings

logger = logging.getLogger("sakhi.llm")


class LLMError(RuntimeError):
    """Raised when the language model cannot be reached or fails permanently."""

    def __init__(self, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


@dataclass
class LLMUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: int = 0
    model: str = ""
    cached: bool = False
    attempts: int = 1


@dataclass
class LLMResult:
    text: str
    usage: LLMUsage


class _TTLCache:
    """Tiny thread-safe LRU+TTL cache. Avoids a Redis dependency for single-node runs."""

    def __init__(self, max_entries: int, ttl_seconds: int):
        self._max = max_entries
        self._ttl = ttl_seconds
        self._data: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Any | None:
        if self._max <= 0 or self._ttl <= 0:
            return None
        with self._lock:
            entry = self._data.get(key)
            if not entry:
                self.misses += 1
                return None
            expires_at, value = entry
            if expires_at < time.time():
                self._data.pop(key, None)
                self.misses += 1
                return None
            self._data.move_to_end(key)
            self.hits += 1
            return value

    def set(self, key: str, value: Any) -> None:
        if self._max <= 0 or self._ttl <= 0:
            return
        with self._lock:
            self._data[key] = (time.time() + self._ttl, value)
            self._data.move_to_end(key)
            while len(self._data) > self._max:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


_cache = _TTLCache(settings.llm_cache_max_entries, settings.llm_cache_ttl_seconds)
_client: Any = None
_client_lock = threading.Lock()

# Rolling counters exposed on /metrics
STATS: dict[str, int] = {
    "llm_requests_total": 0,
    "llm_failures_total": 0,
    "llm_retries_total": 0,
    "llm_cache_hits_total": 0,
    "llm_prompt_tokens_total": 0,
    "llm_completion_tokens_total": 0,
    "llm_latency_ms_total": 0,
}
_stats_lock = threading.Lock()


def _bump(field: str, amount: int = 1) -> None:
    with _stats_lock:
        STATS[field] = STATS.get(field, 0) + amount


def get_client() -> Any:
    """Return a lazily constructed, shared Groq client."""
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is None:
            if not settings.groq_api_key:
                raise LLMError("GROQ_API_KEY is not configured")
            try:
                from groq import Groq  # imported lazily so tests need no SDK
            except ImportError as exc:  # pragma: no cover - dependency guard
                raise LLMError(f"groq SDK unavailable: {exc}") from exc
            _client = Groq(api_key=settings.groq_api_key, timeout=settings.llm_timeout_seconds)
    return _client


def reset_client() -> None:
    """Testing hook: drop the cached client and response cache."""
    global _client
    _client = None
    _cache.clear()


def is_configured() -> bool:
    return bool(settings.groq_api_key)


def _cache_key(model: str, messages: Sequence[dict], temperature: float, max_tokens: int) -> str:
    payload = json.dumps(
        {"m": model, "msg": list(messages), "t": round(temperature, 3), "mt": max_tokens},
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _is_retryable(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
    if isinstance(status, int):
        return status == 408 or status == 429 or status >= 500
    text = f"{type(exc).__name__}: {exc}".lower()
    return any(token in text for token in ("timeout", "timed out", "connection", "temporarily", "rate limit", "503"))


def complete(
    messages: Sequence[dict],
    *,
    model: str | None = None,
    temperature: float = 0.4,
    max_tokens: int = 800,
    use_cache: bool | None = None,
    tag: str = "generic",
) -> LLMResult:
    """Run a chat completion with retries, timeout, caching and metrics."""
    model = model or settings.groq_model
    if use_cache is None:
        use_cache = temperature <= 0.2
    key = _cache_key(model, messages, temperature, max_tokens)

    if use_cache:
        cached = _cache.get(key)
        if cached is not None:
            _bump("llm_cache_hits_total")
            usage = LLMUsage(model=model, cached=True)
            return LLMResult(text=cached, usage=usage)

    client = get_client()
    last_error: Exception | None = None
    started = time.perf_counter()

    for attempt in range(settings.llm_max_retries + 1):
        try:
            _bump("llm_requests_total")
            response = client.chat.completions.create(
                model=model,
                messages=list(messages),
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=settings.llm_timeout_seconds,
            )
            text = (response.choices[0].message.content or "").strip()
            raw_usage = getattr(response, "usage", None)
            usage = LLMUsage(
                prompt_tokens=int(getattr(raw_usage, "prompt_tokens", 0) or 0),
                completion_tokens=int(getattr(raw_usage, "completion_tokens", 0) or 0),
                total_tokens=int(getattr(raw_usage, "total_tokens", 0) or 0),
                latency_ms=int((time.perf_counter() - started) * 1000),
                model=model,
                attempts=attempt + 1,
            )
            _bump("llm_prompt_tokens_total", usage.prompt_tokens)
            _bump("llm_completion_tokens_total", usage.completion_tokens)
            _bump("llm_latency_ms_total", usage.latency_ms)
            logger.info(
                "llm_call",
                extra={
                    "llm_tag": tag,
                    "llm_model": model,
                    "llm_latency_ms": usage.latency_ms,
                    "llm_total_tokens": usage.total_tokens,
                    "llm_attempts": usage.attempts,
                },
            )
            if use_cache:
                _cache.set(key, text)
            return LLMResult(text=text, usage=usage)
        except Exception as exc:  # noqa: BLE001 - normalised into LLMError below
            last_error = exc
            if attempt >= settings.llm_max_retries or not _is_retryable(exc):
                break
            _bump("llm_retries_total")
            backoff = min(8.0, (2**attempt) * 0.75) + random.uniform(0, 0.4)
            logger.warning(
                "llm_retry", extra={"llm_tag": tag, "llm_attempt": attempt + 1, "llm_error": str(exc)[:200]}
            )
            time.sleep(backoff)

    _bump("llm_failures_total")
    logger.error("llm_failed", extra={"llm_tag": tag, "llm_error": str(last_error)[:500]})
    raise LLMError(str(last_error or "unknown LLM failure"), retryable=_is_retryable(last_error or Exception()))


def complete_text(prompt: str, *, system: str | None = None, **kwargs: Any) -> str:
    """Convenience wrapper returning only the completion text."""
    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return complete(messages, **kwargs).text


def stream(
    messages: Sequence[dict],
    *,
    model: str | None = None,
    temperature: float = 0.4,
    max_tokens: int = 800,
    tag: str = "stream",
) -> Iterator[str]:
    """Yield content deltas from a streaming completion."""
    model = model or settings.groq_model
    client = get_client()
    started = time.perf_counter()
    _bump("llm_requests_total")
    try:
        response = client.chat.completions.create(
            model=model,
            messages=list(messages),
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            timeout=settings.llm_timeout_seconds,
        )
        for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception as exc:  # noqa: BLE001
        _bump("llm_failures_total")
        logger.error("llm_stream_failed", extra={"llm_tag": tag, "llm_error": str(exc)[:500]})
        raise LLMError(str(exc), retryable=_is_retryable(exc)) from exc
    finally:
        _bump("llm_latency_ms_total", int((time.perf_counter() - started) * 1000))


def cache_stats() -> dict[str, int]:
    return {"hits": _cache.hits, "misses": _cache.misses}
