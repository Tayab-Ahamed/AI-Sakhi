# Production Candidate Test Report

## Passed in this environment
- Python compilation and AST parsing for all backend modules.
- SQLite schema creation, including goals, feedback, invitations, audit logs, artifacts, and review scheduling.
- JWT issuance, verification, database-backed revocation, and inactive/missing-token rejection.
- Login lockout state after five failures and lockout clearing.
- Learning-goal/check-in SQL flow.
- SM-2 scheduling smoke tests.
- Duplicate API route scan (75 routes, no exact method/path duplicates).
- Babel parsing of all 45 TypeScript/TSX source files.
- JSON validation and ZIP integrity.

## Could not run in the sandbox
The sandbox has no package-registry network access. Therefore a clean dependency installation, full pytest run, ESLint, Vitest, Next.js production build, Docker build, browser E2E test, Groq live call, and visual route QA could not be executed here.

## Required release gate
Run these in CI or a connected development machine before serving real users:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -v

cd frontend
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build

cd ..
docker compose build --no-cache
docker compose up -d
curl -f http://localhost:8000/ready
```

Then complete role-by-role browser tests and cross-tenant security tests. This archive is a production candidate, not a substitute for that release gate.
