# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Email the maintainer
or use GitHub's private vulnerability reporting on
<https://github.com/Tayab-Ahamed/AI-Sakhi>. We aim to acknowledge within 72 hours.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 2.1.x   | Yes       |
| < 2.1   | No        |

## Security controls in this codebase

| Area | Control |
| --- | --- |
| Passwords | bcrypt over a SHA-256 pre-hash (no 72-byte truncation), minimum length and complexity policy in `backend/auth.py` |
| Sessions | Short-lived JWTs (`iss`/`aud`/`nbf`/`exp`/`jti`), httpOnly + `SameSite=Strict` cookies, server-side revocation list |
| Token storage | Only a SHA-256 hash and the `jti` are stored; the raw JWT never touches the database |
| CSRF | Double-submit token (`sakhi_csrf` cookie + `X-CSRF-Token` header) on cookie-authenticated state changes |
| AuthZ | Central role/ownership checks in `backend/authz.py` plus the deny-by-default middleware in `backend/security.py` |
| Input | Body size cap, identifier type validation, upload size and page-count caps |
| Prompt injection | Retrieved passages are fenced and marked untrusted; `backend/safety.py` scans for override patterns |
| Headers | HSTS (production), CSP, `X-Content-Type-Options`, `X-Frame-Options`, COOP, CORP, Referrer-Policy |
| Audit | Every mutating request is written to `audit_log` with a hashed IP |
| Secrets | Startup refuses to boot in production with the development JWT secret or a missing API key |

## Known limitations

- SQLite is used for storage. It is suitable for pilots, not for multi-node deployments.
- Rate limiting is per-process and in-memory; a shared Redis store is needed behind multiple workers.
- The safety classifier is heuristic and is not a substitute for human escalation.
