from __future__ import annotations

from backend.db import create_auth_token, revoke_auth_token, validate_auth_token


def issue_session_token(user_id: int, expires_in_hours: int = 24) -> dict:
    return create_auth_token(user_id, token_type="session", expires_in_hours=expires_in_hours)


def verify_session_token(token: str) -> dict | None:
    return validate_auth_token(token)


def logout_session_token(token: str):
    revoke_auth_token(token)
