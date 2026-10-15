"""Loopback-only synthetic browser test backend; never opens the real DB/key.

Run from repository root: python scripts/browser_test_server.py
Frontend: BACKEND_URL=http://127.0.0.1:8100 npm run build, then start on port 3101.
Synthetic login: Browser Student / Parent / Teacher / Admin; password Browser-test-only-42!
"""

import os
import secrets
import sys
import tempfile
from pathlib import Path

import uvicorn


def main():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    with tempfile.TemporaryDirectory(prefix="sakhi-browser-test-") as directory:
        os.environ.update(
            {
                "DB_PATH": str(Path(directory) / "test.db"),
                "CHROMA_PATH": str(Path(directory) / "chroma"),
                "SAKHI_ENV": "development",
                "SAKHI_JWT_SECRET": secrets.token_urlsafe(48),
                "SAKHI_AI_APPROVAL_MODE": "guardian",
                "SAKHI_PRIVACY_POLICY_VERSION": "synthetic-browser-v1",
                "SAKHI_CHAT_RETENTION_DAYS": "0",
                "SAKHI_ENABLE_DEMO_SEED": "false",
                "GROQ_API_KEY": "",
                "SENTRY_DSN": "",
                "HF_HUB_OFFLINE": "1",
                "TRANSFORMERS_OFFLINE": "1",
                "ALLOWED_ORIGINS": "http://127.0.0.1:3101",
            }
        )
        from backend import db
        from backend.auth import hash_password

        db.init_db()
        db.apply_migrations()
        db.ensure_default_organization()
        users = {}
        password = hash_password("Browser-test-only-42!")
        for role in ("student", "parent", "teacher", "admin"):
            users[role] = db.create_user(
                f"Browser {role.title()}", "8", "English", "Math", role=role, organization_id=1
            )
            db.set_user_password(users[role], password)
        classmate = db.create_user(
            "Browser Classmate", "8", "English", "Math", role="student", organization_id=1
        )
        db.set_user_password(classmate, password)
        conn = db.get_connection()
        conn.execute("UPDATE users SET parent_id=? WHERE id=?", (users["parent"], users["student"]))
        conn.commit()
        conn.close()
        print("Synthetic backend on http://127.0.0.1:8100; real provider calls disabled", flush=True)
        uvicorn.run("backend.main:app", host="127.0.0.1", port=8100, log_level="warning")


if __name__ == "__main__":
    main()
