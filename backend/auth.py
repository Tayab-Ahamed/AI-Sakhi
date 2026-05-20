"""
AI Sakhi — Auth module.
Wraps the DB-backed opaque-token system and adds JWT signing for frontend use.
The token stored in the DB is the JWT itself, so it is self-verifiable without
a DB round-trip, but we ALSO store it in the DB so we can revoke it.
"""
from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta

import jwt

from backend.db import create_auth_token, get_connection, revoke_auth_token

_SECRET = os.environ.get("SAKHI_JWT_SECRET", "sakhi-dev-secret-change-in-production")
_ALGORITHM = "HS256"


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
        "SELECT revoked_at FROM auth_tokens WHERE token_id = ?", (token,)
    ).fetchone()
    conn.close()

    if row and row["revoked_at"]:
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
