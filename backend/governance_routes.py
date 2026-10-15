"""Operational queues for privacy requests and safeguarding review."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.authz import (
    Identity,
    get_identity,
    require_admin,
    require_same_org,
    require_teacher,
    require_user_access,
)
from backend.config import settings
from backend.consent_service import approval_state, policy_info, record_approval
from backend.db import get_connection, now_iso
from backend.privacy_service import erase_account, erase_chat_history, export_data

router = APIRouter(prefix="/v2", tags=["governance"])


class Review(BaseModel):
    note: str = Field(default="", max_length=1000)


class ApprovalDecision(BaseModel):
    granted: bool
    policy_version: str = Field(min_length=1, max_length=100)


@router.get("/privacy/policy")
def privacy_policy(identity: Identity = Depends(get_identity)):
    return policy_info()


@router.get("/privacy/approvals/{user_id}")
def read_approval(user_id: int, identity: Identity = Depends(get_identity)):
    require_user_access(identity, user_id)
    conn = get_connection()
    try:
        return approval_state(conn, user_id)
    finally:
        conn.close()


@router.post("/privacy/approvals/{user_id}")
def decide_approval(user_id: int, decision: ApprovalDecision, identity: Identity = Depends(get_identity)):
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        result = record_approval(conn, identity, user_id, decision.granted, decision.policy_version)
        conn.commit()
        if not decision.granted:
            from backend.llm import clear_response_cache

            clear_response_cache()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.get("/privacy/retention/preview")
def retention_preview(identity: Identity = Depends(require_admin)):
    require_same_org(identity, identity.organization_id)
    from backend.retention_service import preview_chat_retention

    conn = get_connection()
    try:
        return preview_chat_retention(conn, identity.organization_id, settings.chat_retention_days)
    finally:
        conn.close()


@router.get("/privacy/requests")
def privacy_queue(identity: Identity = Depends(get_identity)):
    conn = get_connection()
    try:
        if identity.is_admin:
            rows = conn.execute(
                "SELECT * FROM privacy_requests WHERE organization_id=? ORDER BY created_at DESC LIMIT 200",
                (identity.organization_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM privacy_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 200",
                (identity.user_id,),
            ).fetchall()
        return {"requests": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/privacy/requests/{request_id}/fulfil")
def fulfil_request(request_id: int, review: Review, identity: Identity = Depends(require_admin)):
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        item = conn.execute("SELECT * FROM privacy_requests WHERE id=?", (request_id,)).fetchone()
        if not item:
            raise HTTPException(404, "Request not found")
        require_same_org(identity, item["organization_id"])
        if item["status"] != "pending":
            raise HTTPException(409, "Request already reviewed")
        user_id = item["user_id"]
        exported = None
        if item["request_type"] == "export":
            exported = export_data(conn, user_id)
        elif item["request_type"] == "delete_chat_history":
            erase_chat_history(conn, user_id)
        elif item["request_type"] == "delete_account":
            erase_account(conn, user_id)
        elif item["request_type"] == "restrict_processing":
            conn.execute("UPDATE users SET processing_restricted=1 WHERE id=?", (user_id,))
        status = (
            "awaiting_backup_expiry"
            if item["request_type"] in {"delete_account", "delete_chat_history"}
            else "completed"
        )
        conn.execute(
            "UPDATE privacy_requests SET status=?,completed_at=?,reviewed_by=?,review_note=? WHERE id=?",
            (status, now_iso(), identity.user_id, review.note, request_id),
        )
        conn.commit()
        if item["request_type"] in {"delete_account", "delete_chat_history"}:
            from backend.llm import clear_response_cache

            clear_response_cache()
        return {
            "id": request_id,
            "status": status,
            "export": exported,
            "device_action": "Erase device copies on logout or account removal",
            "backup_action": "Operator must expire backups under the deployment retention policy before closure is represented as complete erasure",
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.get("/safety/events")
def safety_queue(identity: Identity = Depends(require_teacher)):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id,user_id,severity,categories,category,status,created_at,acknowledged_at,acknowledged_by FROM safety_events WHERE organization_id=? ORDER BY acknowledged_at IS NULL DESC,created_at DESC LIMIT 200",
            (identity.organization_id,),
        ).fetchall()
        return {"events": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/safety/events/{event_id}/acknowledge")
def acknowledge(event_id: int, review: Review, identity: Identity = Depends(require_teacher)):
    conn = get_connection()
    try:
        event = conn.execute("SELECT organization_id FROM safety_events WHERE id=?", (event_id,)).fetchone()
        if not event:
            raise HTTPException(404, "Event not found")
        require_same_org(identity, event["organization_id"])
        conn.execute(
            "UPDATE safety_events SET acknowledged_at=?,acknowledged_by=?,status='acknowledged',review_note=? WHERE id=?",
            (now_iso(), identity.user_id, review.note, event_id),
        )
        conn.commit()
        return {"id": event_id, "status": "acknowledged"}
    finally:
        conn.close()
