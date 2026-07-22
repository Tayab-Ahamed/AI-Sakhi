"""Production-oriented learning goals, answer feedback, invitations, and readiness APIs."""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.auth import hash_password, issue_session_token
from backend.db import create_user, get_connection, get_user_with_org, now_iso, set_user_password

router = APIRouter()

class GoalCreate(BaseModel):
    user_id: int
    title: str = Field(min_length=3, max_length=160)
    target_minutes: int = Field(default=30, ge=5, le=600)
    target_date: str | None = None

class GoalCheckin(BaseModel):
    user_id: int
    minutes: int = Field(ge=1, le=600)
    note: str = Field(default="", max_length=500)

class AnswerFeedback(BaseModel):
    user_id: int
    session_id: str = Field(min_length=1, max_length=160)
    rating: int = Field(ge=1, le=5)
    reason: str = Field(default="", max_length=500)

class InviteCreate(BaseModel):
    role: str
    expires_in_hours: int = Field(default=72, ge=1, le=168)

class InviteRegistration(BaseModel):
    invite_code: str = Field(min_length=16, max_length=128)
    name: str = Field(min_length=2, max_length=120)
    class_: str = Field(default="8", max_length=20)
    language: str = Field(default="English", max_length=30)
    weak_subject: str = Field(default="", max_length=120)
    password: str = Field(min_length=8, max_length=128)

@router.get("/ready")
def readiness():
    try:
        conn = get_connection(); conn.execute("SELECT 1").fetchone(); conn.close()
        return {"status": "ready", "database": True, "timestamp": now_iso()}
    except Exception:
        raise HTTPException(503, "Service is not ready")

@router.post("/goals")
def create_goal(req: GoalCreate):
    conn=get_connection(); now=now_iso()
    cur=conn.execute("INSERT INTO learning_goals(user_id,title,target_minutes,target_date,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",(req.user_id,req.title.strip(),req.target_minutes,req.target_date,"active",now,now))
    goal_id=cur.lastrowid; conn.commit(); conn.close()
    return {"id":goal_id,**req.model_dump(),"status":"active","progress_minutes":0}

@router.get("/goals/{user_id}")
def list_goals(user_id: int):
    conn=get_connection()
    rows=conn.execute("""SELECT g.*, COALESCE(SUM(c.minutes),0) progress_minutes FROM learning_goals g LEFT JOIN goal_checkins c ON c.goal_id=g.id WHERE g.user_id=? GROUP BY g.id ORDER BY (g.status='active') DESC, g.updated_at DESC""",(user_id,)).fetchall(); conn.close()
    return {"goals":[dict(r) for r in rows]}

@router.post("/goals/{goal_id}/checkin")
def checkin_goal(goal_id: int, req: GoalCheckin):
    conn=get_connection(); goal=conn.execute("SELECT * FROM learning_goals WHERE id=? AND user_id=?",(goal_id,req.user_id)).fetchone()
    if not goal: conn.close(); raise HTTPException(404,"Goal not found")
    conn.execute("INSERT INTO goal_checkins(goal_id,user_id,minutes,note,created_at) VALUES(?,?,?,?,?)",(goal_id,req.user_id,req.minutes,req.note.strip(),now_iso()))
    total=conn.execute("SELECT COALESCE(SUM(minutes),0) total FROM goal_checkins WHERE goal_id=?",(goal_id,)).fetchone()["total"]
    status="completed" if total>=goal["target_minutes"] else "active"
    conn.execute("UPDATE learning_goals SET status=?,updated_at=? WHERE id=?",(status,now_iso(),goal_id)); conn.commit(); conn.close()
    return {"ok":True,"goal_id":goal_id,"progress_minutes":total,"status":status}

@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: int, user_id: int):
    conn=get_connection(); result=conn.execute("DELETE FROM learning_goals WHERE id=? AND user_id=?",(goal_id,user_id)); conn.commit(); conn.close()
    if not result.rowcount: raise HTTPException(404,"Goal not found")
    return {"ok":True}

@router.post("/feedback/answer")
def answer_feedback(req: AnswerFeedback):
    conn=get_connection(); cur=conn.execute("INSERT INTO answer_feedback(user_id,session_id,rating,reason,created_at) VALUES(?,?,?,?,?)",(req.user_id,req.session_id,req.rating,req.reason.strip(),now_iso())); conn.commit(); conn.close()
    return {"ok":True,"id":cur.lastrowid}

@router.post("/admin/invites")
def create_invite(req: InviteCreate, request: Request):
    if request.state.auth.get("role") != "admin": raise HTTPException(403,"Administrator role required")
    if req.role not in {"teacher","parent","admin"}: raise HTTPException(400,"Invalid invited role")
    code=secrets.token_urlsafe(24); digest=hashlib.sha256(code.encode()).hexdigest(); expires=(datetime.now(UTC)+timedelta(hours=req.expires_in_hours)).replace(microsecond=0).isoformat()
    conn=get_connection(); conn.execute("INSERT INTO role_invites(code_hash,role,organization_id,created_by,expires_at,created_at) VALUES(?,?,?,?,?,?)",(digest,req.role,request.state.auth.get("org"),int(request.state.auth["sub"]),expires,now_iso())); conn.commit(); conn.close()
    return {"invite_code":code,"role":req.role,"expires_at":expires}

@router.post("/auth/register-invite")
def register_invite(req: InviteRegistration):
    digest=hashlib.sha256(req.invite_code.encode()).hexdigest(); conn=get_connection()
    invite=conn.execute("SELECT * FROM role_invites WHERE code_hash=? AND used_at IS NULL AND expires_at>?",(digest,now_iso())).fetchone()
    if not invite: conn.close(); raise HTTPException(400,"Invite is invalid or expired")
    claim_time = now_iso()
    claimed = conn.execute("UPDATE role_invites SET used_at=? WHERE id=? AND used_at IS NULL", (claim_time, invite["id"]))
    conn.commit(); conn.close()
    if not claimed.rowcount: raise HTTPException(400,"Invite has already been used")
    try:
        uid=create_user(req.name,req.class_,req.language,req.weak_subject,role=invite["role"],organization_id=invite["organization_id"])
        set_user_password(uid,hash_password(req.password))
        conn=get_connection(); conn.execute("UPDATE role_invites SET used_by=? WHERE id=?",(uid,invite["id"])); conn.commit(); conn.close()
    except ValueError as exc:
        conn=get_connection(); conn.execute("UPDATE role_invites SET used_at=NULL WHERE id=? AND used_by IS NULL",(invite["id"],)); conn.commit(); conn.close()
        raise HTTPException(409,str(exc))
    user=get_user_with_org(uid); token=issue_session_token(uid)
    return {"user_id":uid,"auth":token,**(user or {})}
