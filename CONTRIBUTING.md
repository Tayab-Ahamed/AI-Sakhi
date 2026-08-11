# Contributing

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install
```

## Before opening a pull request

```bash
ruff check backend
pytest                      # runs backend/tests and tests/
python evals/run_evals.py   # must stay above the CI threshold
cd frontend && npm run lint && npm run build
```

## Ground rules

1. Anything touching safety, authentication, or authorization needs a test.
2. New environment variables go in `backend/config.py` **and** `.env.example`.
3. Schema changes are migrations in `backend/migrations.py`; never edit an applied migration.
4. User-facing safety copy must match `docs/SAFETY.md` and `backend/safety.py`.
5. Keep commits focused and write why, not what, in the message body.
