"""Cookie-backed browser session restoration and device/session controls."""

from fastapi import APIRouter, Depends, HTTPException, Response

from backend.auth import revoke_all_sessions
from backend.authz import Identity, get_identity
from backend.db import get_connection, get_user_with_org, now_iso

router = APIRouter(prefix="/auth", tags=["sessions"])


@router.get("/session")
def current_session(response: Response, identity: Identity = Depends(get_identity)):
    user = get_user_with_org(identity.user_id)
    if not user:
        raise HTTPException(401, "Authentication required")
    conn = get_connection()
    try:
        session = conn.execute(
            "SELECT expires_at FROM auth_tokens WHERE jti=?", (identity.token_id,)
        ).fetchone()
    finally:
        conn.close()
    response.headers["Cache-Control"] = "no-store"
    return {
        "user": user,
        "auth": {
            "user_id": identity.user_id,
            "role": identity.role,
            "organization_id": identity.organization_id,
            "expires_at": session["expires_at"] if session else now_iso(),
            "token_type": "Cookie",
        },
    }


@router.get("/sessions")
def list_sessions(identity: Identity = Depends(get_identity)):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT jti,created_at,expires_at FROM auth_tokens WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC",
            (identity.user_id, now_iso()),
        ).fetchall()
    finally:
        conn.close()
    return {
        "sessions": [
            {
                "id": r["jti"],
                "created_at": r["created_at"],
                "expires_at": r["expires_at"],
                "is_current": r["jti"] == identity.token_id,
            }
            for r in rows
        ]
    }


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: str, identity: Identity = Depends(get_identity)):
    from backend.auth import invalidate_session_cache

    conn = get_connection()
    try:
        result = conn.execute(
            "UPDATE auth_tokens SET revoked_at=? WHERE user_id=? AND jti=?",
            (now_iso(), identity.user_id, session_id),
        )
        conn.commit()
    finally:
        conn.close()
    if not result.rowcount:
        raise HTTPException(404, "Session not found")
    invalidate_session_cache(session_id)
    return {"ok": True}


@router.post("/logout-all")
def logout_all(response: Response, identity: Identity = Depends(get_identity)):
    count = revoke_all_sessions(identity.user_id)
    response.delete_cookie("sakhi_token")
    response.delete_cookie("sakhi_csrf")
    return {"ok": True, "revoked": count}
