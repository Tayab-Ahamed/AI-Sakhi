# Architecture

## Overview

```
Next.js 16 (App Router)  ──HTTPS──▶  FastAPI (Uvicorn)
        │                                │
        │                                ├── backend/security.py   deny-by-default middleware, CSRF, audit
        │                                ├── backend/authz.py      roles + ownership
        │                                ├── backend/chat.py       safety → RAG → LLM → safety
        │                                │        ├── backend/safety.py   classifier + helplines
        │                                │        ├── backend/rag.py      Chroma retrieval + citations
        │                                │        └── backend/llm.py      Groq client, retries, TTL cache
        │                                ├── backend/db.py         SQLite (WAL) + migrations
        │                                └── backend/metrics.py    Prometheus text endpoint
        ▼
  localStorage (UI state only)     Session lives in an httpOnly cookie
```

## Request lifecycle

1. `security_middleware` assigns a request id, caps the body size, validates identifiers,
   enforces CSRF for cookie-authenticated mutations, and resolves the identity from the
   `sakhi_token` cookie or a bearer token.
2. The route handler runs. Authorization is a `require_*` dependency from `backend/authz.py`.
3. Mutations are appended to `audit_log` with a hashed IP.
4. Latency and status are recorded in `backend/metrics.py` and exposed at `/metrics`.

## Chat pipeline

`classify()` → crisis/refusal short-circuit → `retrieve()` (Chroma, over-fetch then filter by
distance) → prompt assembly with untrusted-content fencing → `complete()`/`stream()` with retry,
backoff and a TTL cache → output re-scan → persistence in `chat_messages` plus any
`safety_events`.

Streaming uses SSE where **every frame is JSON**: `{"type":"token"|"citations"|"safety"|"error"}`
followed by a terminal `data: [DONE]`. This is why multi-line tokens no longer corrupt the stream.

## Data layer

SQLite in WAL mode with `busy_timeout`, versioned forward-only migrations in
`backend/migrations.py`, and `schema_version()` reported by `/health`.

Core tables: `organizations`, `users`, `progress`, `chat_sessions`, `chat_messages`,
`learning_events`, `auth_tokens`, `assignments`, `audit_log`, `login_attempts`,
`safety_events`, `ai_evaluations`, `schema_migrations`.

## Configuration

All environment variables are parsed, coerced and range-checked once in `backend/config.py`
into a frozen `Settings` object. `validate_production_config()` refuses to start production
with the development JWT secret or without an LLM key.

## Observability

- `/health` — dependency checks, schema version, degraded status
- `/live` — process liveness
- `/metrics` — Prometheus exposition (can be disabled)
- Structured JSON logs with request ids; Sentry when `SENTRY_DSN` is set

## Known trade-offs

| Choice | Why | When to revisit |
| --- | --- | --- |
| SQLite | Zero-ops for school pilots | More than one backend node, or heavy write contention |
| In-process rate limits and caches | No extra infrastructure | Multiple workers — move to Redis |
| Heuristic safety classifier | Deterministic, testable, offline | When labelled data exists for a trained classifier |
| Chroma on local disk | Simple ingest story | Corpus beyond a few hundred thousand chunks |
