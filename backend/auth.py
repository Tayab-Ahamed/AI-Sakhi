"""
AI Sakhi — Auth module.
Wraps the DB-backed opaque-token system and adds JWT signing for frontend use.
The token stored in the DB is the JWT itself, so it is self-verifiable without
a DB round-trip, but we ALSO store it in the DB so we can revoke it.
"""
from __future__ import annotations

import os
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from backend.db import create_auth_token, get_connection, revoke_auth_token

_SECRET = os.environ.get("SAKHI_JWT_SECRET", "sakhi-dev-secret-change-in-production")
_ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt."""
    import bcrypt
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    import bcrypt
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def issue_session_token(user_id: int, expires_in_hours: int = 24) -> dict:
    """Issue a JWT-signed session token and persist it in the DB."""
    from backend.db import get_user_with_org

    user = get_user_with_org(user_id)
    if not user:
        raise ValueError("User not found")

    expires_at = datetime.now(UTC) + timedelta(hours=expires_in_hours)
    payload = {
        "sub": str(user_id),
        "role": user.get("role", "student"),
        "org": user.get("organization_id"),
        "exp": expires_at,
        "iat": datetime.now(UTC),
        "jti": secrets.token_urlsafe(24),
    }
    token = jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)

    # Persist in DB for revocation support
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO auth_tokens (token_id, user_id, organization_id, token_type, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            token,
            user_id,
            user.get("organization_id"),
            "session",
            expires_at.replace(microsecond=0).isoformat(),
            datetime.now(UTC).replace(microsecond=0).isoformat(),
        ),
    )
    conn.commit()
    conn.close()

    return {
        "token": token,
        "token_type": "Bearer",
        "expires_at": expires_at.replace(microsecond=0).isoformat(),
        "user_id": user_id,
        "organization_id": user.get("organization_id"),
        "role": user.get("role", "student"),
    }


def verify_session_token(token: str) -> dict | None:
    """Verify a JWT session token. Returns the decoded payload or None."""
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

    # Check revocation in DB
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute(
        """SELECT t.revoked_at, u.is_active FROM auth_tokens t
           JOIN users u ON u.id=t.user_id WHERE t.token_id = ?""", (token,)
    ).fetchone()
    conn.close()

    if not row or row["revoked_at"] or row["is_active"] == 0:
        return None

    return payload


def logout_session_token(token: str):
    """Revoke the token so it cannot be used again."""
    conn = get_connection()
    cur = conn.cursor()
    from datetime import UTC, datetime
    cur.execute(
        "UPDATE auth_tokens SET revoked_at = ? WHERE token_id = ?",
        (datetime.now(UTC).replace(microsecond=0).isoformat(), token),
    )
    conn.commit()
    conn.close()



def _attempt_key(name: str, ip: str) -> str:
    import hashlib
    return hashlib.sha256(f"{name.strip().lower()}|{ip}".encode()).hexdigest()


def check_login_allowed(name: str, ip: str) -> bool:
    key = _attempt_key(name, ip)
    now = datetime.now(UTC)
    conn = get_connection()
    row = conn.execute("SELECT * FROM login_attempts WHERE attempt_key=?", (key,)).fetchone()
    conn.close()
    if not row:
        return True
    if row["blocked_until"] and datetime.fromisoformat(row["blocked_until"]) > now:
        return False
    return True


def record_login_failure(name: str, ip: str):
    key = _attempt_key(name, ip); now = datetime.now(UTC); window = now - timedelta(minutes=15)
    conn = get_connection(); row = conn.execute("SELECT * FROM login_attempts WHERE attempt_key=?", (key,)).fetchone()
    attempts = 1
    if row and datetime.fromisoformat(row["window_started_at"]) >= window:
        attempts = row["attempts"] + 1
    blocked = (now + timedelta(minutes=15)).replace(microsecond=0).isoformat() if attempts >= 5 else None
    conn.execute("INSERT INTO login_attempts(attempt_key,attempts,window_started_at,blocked_until) VALUES(?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until", (key, attempts, now.replace(microsecond=0).isoformat(), blocked))
    conn.commit(); conn.close()


def clear_login_failures(name: str, ip: str):
    conn = get_connection(); conn.execute("DELETE FROM login_attempts WHERE attempt_key=?", (_attempt_key(name, ip),)); conn.commit(); conn.close()
