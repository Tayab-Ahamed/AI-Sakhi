"""Phase 3 API: teacher-owned, reviewable curriculum question bank."""
from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.db import get_connection, now_iso

router = APIRouter(prefix="/v2/questions", tags=["question-bank"])


def _teacher(request: Request) -> tuple[int, int, str]:
    auth = request.state.auth
    role = auth.get("role")
    if role not in {"teacher", "admin"}:
        raise HTTPException(403, "Teacher or administrator role required")
    return int(auth["sub"]), int(auth.get("org") or 0), role


class QuestionCreate(BaseModel):
    board: str = Field(default="CBSE", max_length=40)
    class_level: str = Field(min_length=1, max_length=20)
    subject: str = Field(min_length=1, max_length=100)
    chapter: str = Field(default="", max_length=160)
    learning_outcome: str = Field(default="", max_length=300)
    question_type: str = Field(default="mcq", pattern="^(mcq|multi_select|fill_blank|numerical|short_answer|long_answer|assertion_reason|case_study)$")
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    question_text: str = Field(min_length=5, max_length=5000)
    options: list[str] = Field(default_factory=list, max_length=10)
    correct_answer: str = Field(min_length=1, max_length=3000)
    explanation: str = Field(default="", max_length=5000)
    misconception_tag: str = Field(default="", max_length=100)


class ReviewInput(BaseModel):
    status: str = Field(pattern="^(approved|rejected|draft)$")
    note: str = Field(default="", max_length=1000)


@router.post("")
def create_question(req: QuestionCreate, request: Request):
    actor, org, _ = _teacher(request)
    if req.question_type in {"mcq", "multi_select"} and len(req.options) < 2:
        raise HTTPException(400, "Choice questions require at least two options")
    now = now_iso(); conn = get_connection()
    cur = conn.execute("""INSERT INTO question_bank(organization_id,created_by,board,class_level,subject,chapter,learning_outcome,question_type,difficulty,question_text,options_json,correct_answer,explanation,misconception_tag,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (org,actor,req.board,req.class_level,req.subject,req.chapter,req.learning_outcome,req.question_type,req.difficulty,req.question_text,json.dumps(req.options,ensure_ascii=False),req.correct_answer,req.explanation,req.misconception_tag,"draft",now,now))
    qid=cur.lastrowid; conn.commit(); conn.close()
    return {"id":qid,"status":"draft","message":"Question saved for review"}


@router.get("")
def list_questions(request: Request, status: str | None = None, subject: str | None = None, limit: int = 100):
    _, org, _ = _teacher(request); clauses=["organization_id=?"]; params:list=[org]
    if status: clauses.append("status=?"); params.append(status)
    if subject: clauses.append("subject=?"); params.append(subject)
    params.append(max(1,min(limit,200))); conn=get_connection()
    rows=conn.execute(f"SELECT * FROM question_bank WHERE {' AND '.join(clauses)} ORDER BY updated_at DESC LIMIT ?",params).fetchall(); conn.close()
    result=[]
    for row in rows:
        item=dict(row); item["options"]=json.loads(item.pop("options_json") or "[]"); result.append(item)
    return {"questions":result}


@router.put("/{question_id}/review")
def review_question(question_id: int, req: ReviewInput, request: Request):
    actor, org, _ = _teacher(request); conn=get_connection()
    result=conn.execute("UPDATE question_bank SET status=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=? AND organization_id=?",(req.status,actor,now_iso(),now_iso(),question_id,org))
    conn.commit(); conn.close()
    if not result.rowcount: raise HTTPException(404,"Question not found")
    return {"id":question_id,"status":req.status,"review_note":req.note}
