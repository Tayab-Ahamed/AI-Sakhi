"""Engineering approval controls, not a claim of legally valid consent."""

from fastapi import HTTPException

from backend.config import settings
from backend.db import now_iso


def policy_info() -> dict:
    configured = settings.ai_approval_mode in {"guardian", "school"} and bool(settings.privacy_policy_version)
    return {
        "configured": configured,
        "approval_mode": settings.ai_approval_mode,
        "policy_version": settings.privacy_policy_version,
        "enforced": settings.ai_approval_mode != "unconfigured" or settings.is_production,
        "chat_retention_days": settings.chat_retention_days or None,
        "automatic_deletion_enabled": False,
        "sharing_notice": "AI requests send learning prompts and selected context to the configured Groq model provider. Do not submit sensitive personal information.",
        "limitations": "The operator must publish its full policy, verify approval authority and address provider retention, backups and device copies separately.",
    }


def approval_state(conn, user_id: int) -> dict:
    user = conn.execute("SELECT * FROM users WHERE id=? AND is_active=1", (user_id,)).fetchone()
    if not user:
        raise HTTPException(404, "Account not found")
    policy = policy_info()
    row = conn.execute(
        "SELECT * FROM ai_approvals WHERE user_id=? AND organization_id IS ? AND policy_version=? AND approval_mode=? ORDER BY id DESC LIMIT 1",
        (user_id, user["organization_id"], settings.privacy_policy_version, settings.ai_approval_mode),
    ).fetchone()
    granted = bool(row and row["granted"])
    if granted:
        actor = conn.execute("SELECT * FROM users WHERE id=? AND is_active=1", (row["actor_id"],)).fetchone()
        if user["role"] == "student":
            same_school = bool(
                actor
                and user["organization_id"] is not None
                and actor["organization_id"] == user["organization_id"]
            )
            granted = same_school and (
                (
                    settings.ai_approval_mode == "guardian"
                    and actor["role"] == "parent"
                    and user["parent_id"] == actor["id"]
                )
                or (settings.ai_approval_mode == "school" and actor["role"] in {"teacher", "admin"})
            )
        else:
            granted = bool(actor and actor["id"] == user_id)
    restricted = bool(user["processing_restricted"])
    return {
        "user_id": user_id,
        "policy": policy,
        "approved": bool(granted and policy["configured"]),
        "processing_restricted": restricted,
        "ai_allowed": not restricted and (not policy["enforced"] or bool(granted and policy["configured"])),
    }


def record_approval(conn, identity, user_id: int, granted: bool, policy_version: str) -> dict:
    """Caller owns the transaction; authorization reads current account relations."""
    state = approval_state(conn, user_id)
    policy = state["policy"]
    if not policy["configured"] or policy_version != policy["policy_version"]:
        raise HTTPException(409, "Approval policy is unconfigured or changed; reload it first")
    user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    actor = conn.execute("SELECT * FROM users WHERE id=? AND is_active=1", (identity.user_id,)).fetchone()
    if not actor:
        raise HTTPException(403, "Approval authority unavailable")
    self_action = actor["id"] == user_id
    same_school = user["organization_id"] is not None and actor["organization_id"] == user["organization_id"]
    can_approve_student = same_school and (
        (
            policy["approval_mode"] == "guardian"
            and actor["role"] == "parent"
            and user["parent_id"] == actor["id"]
        )
        or (policy["approval_mode"] == "school" and actor["role"] in {"teacher", "admin"})
    )
    allowed = (self_action and (not granted or user["role"] != "student")) or (
        user["role"] == "student" and can_approve_student
    )
    if not allowed:
        raise HTTPException(403, "Approval authority denied")
    conn.execute(
        "INSERT INTO ai_approvals(user_id,organization_id,actor_id,approval_mode,policy_version,granted,created_at) VALUES(?,?,?,?,?,?,?)",
        (
            user_id,
            user["organization_id"],
            actor["id"],
            policy["approval_mode"],
            policy_version,
            int(granted),
            now_iso(),
        ),
    )
    return approval_state(conn, user_id)


def require_ai_approval(conn, user_id: int) -> None:
    if not approval_state(conn, user_id)["ai_allowed"]:
        raise HTTPException(403, "AI processing requires current approval and an unrestricted account")
