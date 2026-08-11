"""Authentication: password hashing, JWT sessions, and revocation.

Key change from the earlier design: the database stores a random token
identifier (`jti`) and a SHA-256 hash of the token, never the JWT itself.
A leaked database backup therefore cannot be replayed as a set of live
sessions, and the revocation list stays small and indexable.

Revocation checks are cached in-process for a few seconds so the hot auth path
does not hit SQLite on every single request, while logout still takes effect
almost immediately.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import threading
import time
from datetime import UTC, datetime, timedelta

import jwt

from backend.config import settings
from backend.db import get_connection

logger = logging.getLogger("sakhi.auth")

_SECRET = settings.jwt_secret
_ALGORITHM = settings.jwt_algorithm
_ISSUER = "ai-sakhi"
_AUDIENCE = "ai-sakhi-app"

_REVOCATION_TTL_SECONDS = 10
_revocation_cache: dict[str, tuple[float, bool]] = {}
_cache_lock = threading.Lock()

MIN_PASSWORD_LENGTH = 8
COMMON_PASSWORDS = {
    "password", "password1", "12345678", "123456789", "qwerty123", "iloveyou",
    "admin123", "letmein1", "welcome1", "sakhi123", "student1", "teacher1",
}


# -- Passwords ---------------------------------------------------------------
def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt."""
    import bcrypt

    # bcrypt silently truncates at 72 bytes; hash first so long passphrases keep entropy.
    digest = hashlib.sha256(plain.encode("utf-8")).digest()
    return bcrypt.hashpw(digest, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against a bcrypt hash (supports pre-sha256 legacy hashes)."""
    import bcrypt

    if not plain or not hashed:
        return False
    encoded = hashed.encode("utf-8")
    digest = hashlib.sha256(plain.encode("utf-8")).digest()
    try:
        if bcrypt.checkpw(digest, encoded):
            return True
    except Exception:
        pass
    try:  # legacy hashes created directly from the raw password
        return bcrypt.checkpw(plain.encode("utf-8")[:72], encoded)
    except Exception:
        return False


def password_problems(password: str, *, name: str = "") -> list[str]:
    """Return human-readable reasons a password is unacceptable."""
    problems: list[str] = []
    value = password or ""
    if len(value) < MIN_PASSWORD_LENGTH:
        problems.append(f"Use at least {MIN_PASSWORD_LENGTH} characters")
    if value.lower() in COMMON_PASSWORDS:
        problems.append("This password is too common")
    if name and value.lower().strip() == name.lower().strip():
        problems.append("Password must not be your name")
    if value and value.isdigit():
        problems.append("Add at least one letter")
    return problems


# -- Sessions ----------------------------------------------------------------
def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _cache_get(jti: str) -> bool | None:
    with _cache_lock:
        entry = _revocation_cache.get(jti)
        if not entry:
            return None
        expires_at, valid = entry
        if expires_at < time.time():
            _revocation_cache.pop(jti, None)
            return None
        return valid


def _cache_set(jti: str, valid: bool) -> None:
    with _cache_lock:
        if len(_revocation_cache) > 5000:
            _revocation_cache.clear()
        _revocation_cache[jti] = (time.time() + _REVOCATION_TTL_SECONDS, valid)


def _cache_invalidate(jti: str) -> None:
    with _cache_lock:
        _revocation_cache.pop(jti, None)


def issue_session_token(user_id: int, expires_in_hours: int | None = None) -> dict:
    """Issue a signed session token and persist only its identifier + hash."""
    from backend.db import get_user_with_org

    user = get_user_with_org(user_id)
    if not user:
        raise ValueError("User not found")

    hours = expires_in_hours or settings.session_hours
    issued_at = datetime.now(UTC)
    expires_at = issued_at + timedelta(hours=hours)
    jti = secrets.token_urlsafe(24)
    payload = {
        "sub": str(user_id),
        "role": user.get("role", "student"),
        "org": user.get("organization_id"),
        "exp": expires_at,
        "iat": issued_at,
        "nbf": issued_at,
        "iss": _ISSUER,
        "aud": _AUDIENCE,
        "jti": jti,
    }
    token = jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)

    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO auth_tokens (token_id, jti, token_hash, user_id, organization_id,
                                     token_type, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                jti,
                jti,
                _token_hash(token),
                user_id,
                user.get("organization_id"),
                "session",
                expires_at.replace(microsecond=0).isoformat(),
                issued_at.replace(microsecond=0).isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "token": token,
        "token_type": "Bearer",
        "expires_at": expires_at.replace(microsecond=0).isoformat(),
        "expires_in": int(hours * 3600),
        "user_id": user_id,
        "organization_id": user.get("organization_id"),
        "role": user.get("role", "student"),
    }


def _session_is_live(jti: str, token: str) -> bool:
    cached = _cache_get(jti)
    if cached is not None:
        return cached

    conn = get_connection()
    try:
        row = conn.execute(
            """SELECT t.revoked_at, u.is_active FROM auth_tokens t
               JOIN users u ON u.id = t.user_id
               WHERE t.jti = ? OR t.token_id = ?""",
            (jti, token),
        ).fetchone()
    except Exception:
        logger.exception("Token lookup failed")
        return False
    finally:
        conn.close()

    valid = bool(row) and not row["revoked_at"] and row["is_active"] != 0
    _cache_set(jti, valid)
    return valid


def verify_session_token(token: str) -> dict | None:
    """Verify a JWT session token. Returns the decoded payload or None."""
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            _SECRET,
            algorithms=[_ALGORITHM],
            audience=_AUDIENCE,
            issuer=_ISSUER,
            options={"require": ["exp", "sub"]},
        )
    except jwt.InvalidTokenError:
        # Tokens minted before issuer/audience claims were added.
        try:
            payload = jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])
        except jwt.InvalidTokenError:
            return None

    jti = payload.get("jti") or token
    if not _session_is_live(jti, token):
        return None
    return payload


def logout_session_token(token: str):
    """Revoke a token so it cannot be used again."""
    jti = token
    try:
        decoded = jwt.decode(token, _SECRET, algorithms=[_ALGORITHM], options={"verify_exp": False, "verify_aud": False})
        jti = decoded.get("jti") or token
    except jwt.InvalidTokenError:
        pass

    conn = get_connection()
    try:
        conn.execute(
            "UPDATE auth_tokens SET revoked_at = ? WHERE jti = ? OR token_id = ?",
            (datetime.now(UTC).replace(microsecond=0).isoformat(), jti, token),
        )
        conn.commit()
    finally:
        conn.close()
    _cache_invalidate(jti)


def revoke_all_sessions(user_id: int) -> int:
    """Revoke every live session for a user (password change, suspension)."""
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE auth_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            (datetime.now(UTC).replace(microsecond=0).isoformat(), user_id),
        )
        conn.commit()
        count = cur.rowcount or 0
    finally:
        conn.close()
    with _cache_lock:
        _revocation_cache.clear()
    return count


def purge_expired_tokens() -> int:
    """Delete tokens that expired more than a day ago. Safe to run on startup."""
    cutoff = (datetime.now(UTC) - timedelta(days=1)).replace(microsecond=0).isoformat()
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM auth_tokens WHERE expires_at < ?", (cutoff,))
        conn.commit()
        return cur.rowcount or 0
    except Exception:
        logger.exception("Token purge failed")
        return 0
    finally:
        conn.close()


# -- Login throttling --------------------------------------------------------
def _attempt_key(name: str, ip: str) -> str:
    return hashlib.sha256(f"{name.strip().lower()}|{ip}".encode()).hexdigest()


def check_login_allowed(name: str, ip: str) -> bool:
    key = _attempt_key(name, ip)
    now = datetime.now(UTC)
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM login_attempts WHERE attempt_key=?", (key,)).fetchone()
    finally:
        conn.close()
    if not row:
        return True
    if row["blocked_until"] and datetime.fromisoformat(row["blocked_until"]) > now:
        return False
    return True


def record_login_failure(name: str, ip: str):
    key = _attempt_key(name, ip)
    now = datetime.now(UTC)
    window = now - timedelta(minutes=15)
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM login_attempts WHERE attempt_key=?", (key,)).fetchone()
        attempts = 1
        if row and datetime.fromisoformat(row["window_started_at"]) >= window:
            attempts = row["attempts"] + 1
        blocked = (now + timedelta(minutes=15)).replace(microsecond=0).isoformat() if attempts >= 5 else None
        conn.execute(
            "INSERT INTO login_attempts(attempt_key,attempts,window_started_at,blocked_until) "
            "VALUES(?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET attempts=excluded.attempts,"
            "window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until",
            (key, attempts, now.replace(microsecond=0).isoformat(), blocked),
        )
        conn.commit()
    finally:
        conn.close()


def clear_login_failures(name: str, ip: str):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM login_attempts WHERE attempt_key=?", (_attempt_key(name, ip),))
        conn.commit()
    finally:
        conn.close()
