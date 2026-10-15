"""Phase 4 API: privacy controls, guardian digests, and minimal safety events."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from backend.authz import get_identity, require_request_scope
from backend.db import get_connection, now_iso
from backend.privacy_service import export_data

router = APIRouter(prefix="/v2", tags=["privacy-safety"])


def _auth(request: Request) -> tuple[int, str, int | None]:
    data = request.state.auth
    return int(data["sub"]), str(data.get("role", "student")), data.get("org")


def _self_or_admin(request: Request, user_id: int) -> None:
    from backend.authz import require_self

    require_self(get_identity(request), user_id)
    actor, role, _ = _auth(request)
    if actor != user_id and role != "admin":
        raise HTTPException(403, "User access denied")


class PrivacyRequestInput(BaseModel):
    user_id: int
    request_type: str = Field(pattern="^(export|delete_account|delete_chat_history|restrict_processing)$")


class SafetyEventInput(BaseModel):
    user_id: int | None = None
    category: str = Field(pattern="^(self_harm|abuse|bullying|exploitation|dangerous_content|privacy_risk)$")
    severity: str = Field(pattern="^(low|medium|high|urgent)$")
    minimal_context: str = Field(default="", max_length=500)


@router.get("/privacy/export/{user_id}", dependencies=[Depends(get_identity), Depends(require_request_scope)])
def export_user_data(user_id: int, request: Request):
    _self_or_admin(request, user_id)
    conn = get_connection()
    try:
        if not conn.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "User not found")
        return export_data(conn, user_id)
    finally:
        conn.close()


@router.post("/privacy/requests", dependencies=[Depends(get_identity), Depends(require_request_scope)])
def create_privacy_request(req: PrivacyRequestInput, request: Request):
    _self_or_admin(request, req.user_id)
    conn = get_connection()
    existing = conn.execute(
        "SELECT id,status FROM privacy_requests WHERE user_id=? AND request_type=? AND status='pending'",
        (req.user_id, req.request_type),
    ).fetchone()
    if existing:
        conn.close()
        return {"id": existing["id"], "status": existing["status"], "duplicate": True}
    cur = conn.execute(
        "INSERT INTO privacy_requests(user_id,organization_id,request_type,status,created_at) VALUES(?,?,?,'pending',?)",
        (req.user_id, get_identity(request).organization_id, req.request_type, now_iso()),
    )
    conn.commit()
    conn.close()
    return {"id": cur.lastrowid, "status": "pending", "request_type": req.request_type}


@router.get(
    "/guardian/digest/{child_id}", dependencies=[Depends(get_identity), Depends(require_request_scope)]
)
def guardian_digest(child_id: int, request: Request):
    from backend.authz import require_user_access

    require_user_access(get_identity(request), child_id)
    actor, role, org = _auth(request)
    conn = get_connection()
    child = conn.execute(
        "SELECT id,name,class,weak_subject,parent_id,organization_id FROM users WHERE id=? AND role='student'",
        (child_id,),
    ).fetchone()
    if not child:
        conn.close()
        raise HTTPException(404, "Student not found")
    if role != "admin" and not (
        role == "parent" and child["parent_id"] == actor and child["organization_id"] == org
    ):
        conn.close()
        raise HTTPException(403, "Child is not linked to this parent")
    since = (datetime.now(UTC) - timedelta(days=7)).replace(microsecond=0).isoformat()
    scores = conn.execute(
        "SELECT topic,score,total,timestamp FROM progress WHERE user_id=? AND timestamp>=? ORDER BY timestamp DESC",
        (child_id, since),
    ).fetchall()
    sessions = conn.execute(
        "SELECT metadata_json FROM learning_events WHERE user_id=? AND event_type='session_end' AND created_at>=?",
        (child_id, since),
    ).fetchall()
    total_minutes = 0
    for row in sessions:
        try:
            total_minutes += int(json.loads(row["metadata_json"] or "{}").get("duration_seconds", 0)) // 60
        except (ValueError, TypeError, json.JSONDecodeError):
            continue  # ignore malformed legacy duration metadata
    avg = (
        round(sum((r["score"] / r["total"]) * 100 for r in scores if r["total"]) / len(scores), 1)
        if scores
        else None
    )
    strongest = max(scores, key=lambda r: r["score"] / max(r["total"], 1))["topic"] if scores else None
    focus = (
        min(scores, key=lambda r: r["score"] / max(r["total"], 1))["topic"]
        if scores
        else child["weak_subject"]
    )
    digest = {
        "child": {"name": child["name"], "class_": child["class"]},
        "period_days": 7,
        "study_minutes": total_minutes,
        "quiz_attempts": len(scores),
        "average_score_pct": avg,
        "celebrate": strongest,
        "focus_next": focus,
        "parent_action": f"Ask your child to explain one idea from {focus}."
        if focus
        else "Celebrate consistent effort and choose one small goal together.",
    }
    conn.execute(
        "INSERT INTO guardian_digests(child_id,parent_id,period_start,period_end,digest_json,created_at) VALUES(?,?,?,?,?,?)",
        (child_id, actor, since, now_iso(), json.dumps(digest, ensure_ascii=False), now_iso()),
    )
    conn.commit()
    conn.close()
    return digest


@router.post("/safety/events", dependencies=[Depends(get_identity), Depends(require_request_scope)])
def create_safety_event(req: SafetyEventInput, request: Request):
    actor, role, _ = _auth(request)
    user_id = req.user_id or actor
    if user_id != actor and role != "admin":
        raise HTTPException(403, "User access denied")
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO safety_events(user_id,organization_id,category,categories,severity,minimal_context,status,created_at) VALUES(?,?,?,?,?,?,?,?)",
        (
            user_id,
            get_identity(request).organization_id,
            req.category,
            json.dumps([req.category]),
            req.severity,
            "",
            "open",
            now_iso(),
        ),
    )
    conn.commit()
    conn.close()
    guidance = (
        "Contact local emergency services and a trusted adult now."
        if req.severity == "urgent"
        else "Encourage the learner to contact a trusted adult and follow the reviewed safeguarding process."
    )
    return {
        "id": cur.lastrowid,
        "status": "open",
        "guidance": guidance,
        "data_minimization": "Only minimal context was stored.",
    }
