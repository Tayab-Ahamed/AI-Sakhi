# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [2.1.0] - 2026-08-11

A correctness, safety and security release. No new user-facing features.

### Fixed
- **File uploads returned 500 for every PDF/TXT/MD file.** The summarisation block in
  `/chat/upload` sat after a `raise`, so `response_text` was never assigned. The text path
  is now reachable and returns 422 when a file has no extractable text.
- **User admin endpoints crashed.** `GET /users` and `PUT /users/{id}` selected a `class_`
  column that does not exist; the schema column is `class`.
- **404s were reported as 500s.** Roughly two dozen `except Exception` handlers swallowed the
  route's own `HTTPException`. Every one now re-raises intentional HTTP errors first.
- **Streaming was protocol-unsafe.** SSE frames are now JSON, so tokens containing newlines
  can no longer terminate an event early. The frontend parser was updated to match.
- **Decommissioned vision model.** `llava-v1.5-7b-4096-preview` is replaced by a configurable
  `GROQ_VISION_MODEL`.
- **Unguarded integer casts** in the security middleware turned malformed input into 500s;
  they now return 400.
- Health endpoint version no longer disagrees with the FastAPI application version.

### Security
- Raw JWTs are no longer stored. Only the `jti` and a SHA-256 hash are persisted.
- Passwords are SHA-256 pre-hashed before bcrypt (no silent 72-byte truncation), with a
  password policy and a legacy verification fallback.
- Tokens carry `iss`, `aud`, `nbf`, and `jti`; `revoke_all_sessions()` runs on role changes.
- CSRF double-submit protection for cookie-authenticated mutations.
- Session cookies moved from `SameSite=Lax` to `SameSite=Strict`.
- Request body size cap, upload size cap and PDF page cap are now configuration-driven.
- Added CSP, COOP, CORP headers and production HSTS.
- Retrieved passages are fenced as untrusted input and scanned for prompt injection.

### Added
- `backend/config.py`: a validated, frozen settings object; production boot fails fast on a
  development secret or a missing API key.
- `backend/llm.py`: shared lazy Groq client with timeouts, retries with jittered backoff,
  a TTL response cache, and usage counters.
- `backend/safety.py`: severity taxonomy, crisis and refusal responses, Indian helplines,
  injection detection.
- `backend/authz.py`: centralised role and ownership checks.
- `backend/migrations.py`: versioned forward-only migrations, reported via `/health`.
- `backend/metrics.py` and a Prometheus `/metrics` endpoint; `/live` liveness probe.
- Citations are now returned to the client for both streaming and non-streaming chat.
- SQLite WAL mode, `busy_timeout`, and performance indexes.
- `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ARCHITECTURE.md`,
  `docs/SAFETY.md`.
- Tests for safety, migrations, LLM caching, metrics and route protection; `pytest.ini` now
  actually collects both test directories.
- CI runs lint, tests with coverage, an evaluation gate, and dependency audits.

### Changed
- `chat()` returns a structured result and raises `ChatUnavailable` instead of returning a
  cheerful fake answer when the model is down. The API surfaces 503.
- Embedding model and retrieval thresholds are configurable instead of hardcoded.
- `Dockerfile.backend` is multi-stage and runs as a non-root user.
- Removed the unused `axios` dependency from the frontend.

## Not done yet (roadmap)

Honesty matters more than a tidy changelog. These remain open:

- Postgres and Alembic; SQLite is still the only supported store.
- Redis-backed rate limiting and caching for multi-worker deployments.
- Offline-first PWA sync beyond the current service worker shell.
- WhatsApp delivery (the Twilio variables were dead code and have been removed).
- A real i18n library; translations are still inline.
- Decomposition of the four large frontend page components.
- Rolling conversation summarisation for very long chats.
- A published pilot study with classroom outcome data.

## [2.0.0] - earlier

Initial public feature set: tutor chat, quizzes, flashcards, study plans, spaced repetition,
teacher and parent dashboards, RAG over NCERT content.
