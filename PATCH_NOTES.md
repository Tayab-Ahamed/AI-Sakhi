# AI Sakhi hardening patch

This patch adds central authentication/RBAC/tenant checks, secure production cookies, stricter JWT validation, upload limits and real PDF extraction, missing chat/artifact/flashcard APIs, schema fixes, and Docker corrections.

## Important behavior change
Public registration now creates **student** accounts only. Promote teacher, parent, and admin accounts through a trusted admin process. Set a strong `SAKHI_JWT_SECRET` and `SAKHI_ENV=production` before deployment.

## Before launch
Run `pip install -r requirements.txt`, `pytest`, and in `frontend/`: `npm ci && npm run lint && npm test && npm run build`. Perform a full role-by-role browser QA against a staging database.
