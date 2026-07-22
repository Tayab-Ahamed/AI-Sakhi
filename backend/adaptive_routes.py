"""Phase 2 API: explainable mastery, misconceptions, and daily Smart Sprints."""
from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.db import get_connection, now_iso
from backend.learning_engine import build_smart_sprint, classify_misconception, mastery_score

router = APIRouter(prefix="/v2", tags=["adaptive-learning"])


def _authorize_user(request: Request, target_id: int) -> None:
    auth = request.state.auth
    actor, role, org = int(auth["sub"]), auth.get("role"), auth.get("org")
    if role == "admin" or actor == target_id:
        return
    conn = get_connection()
    row = conn.execute("SELECT organization_id,parent_id FROM users WHERE id=?", (target_id,)).fetchone()
    conn.close()
    if not row or row["organization_id"] != org:
        raise HTTPException(403, "User access denied")
    if role == "parent" and row["parent_id"] != actor:
        raise HTTPException(403, "Child is not linked to this parent")
    if role not in {"parent", "teacher"}:
        raise HTTPException(403, "User access denied")


class MisconceptionInput(BaseModel):
    user_id: int
    topic: str = Field(min_length=1, max_length=160)
    question: str = Field(min_length=1, max_length=3000)
    answer: str = Field(default="", max_length=3000)
    expected: str = Field(min_length=1, max_length=3000)
    explanation: str = Field(default="", max_length=3000)


@router.post("/misconceptions")
def record_misconception(req: MisconceptionInput, request: Request):
    _authorize_user(request, req.user_id)
    kind = classify_misconception(req.question, req.answer, req.expected, req.explanation)
    evidence = json.dumps({"question": req.question, "answer": req.answer, "expected": req.expected}, ensure_ascii=False)
    conn = get_connection()
    conn.execute(
        """INSERT INTO misconceptions(user_id,topic,misconception_type,evidence,occurrence_count,last_seen_at)
           VALUES(?,?,?,?,1,?) ON CONFLICT(user_id,topic,misconception_type) DO UPDATE SET
           evidence=excluded.evidence, occurrence_count=occurrence_count+1, last_seen_at=excluded.last_seen_at, resolved_at=NULL""",
        (req.user_id, req.topic.strip(), kind, evidence, now_iso()),
    )
    conn.commit(); conn.close()
    return {"misconception_type": kind, "topic": req.topic, "next_action": f"Practise a targeted example for {kind.replace('_',' ')}."}


@router.get("/misconceptions/{user_id}")
def list_misconceptions(user_id: int, request: Request):
    _authorize_user(request, user_id)
    conn = get_connection()
    rows = conn.execute("SELECT topic,misconception_type,occurrence_count,last_seen_at,resolved_at FROM misconceptions WHERE user_id=? ORDER BY resolved_at IS NULL DESC,occurrence_count DESC,last_seen_at DESC", (user_id,)).fetchall()
    conn.close()
    return {"misconceptions": [dict(row) for row in rows]}


@router.get("/mastery/{user_id}")
def explainable_mastery(user_id: int, request: Request):
    _authorize_user(request, user_id)
    conn = get_connection()
    topics = conn.execute("SELECT DISTINCT topic FROM progress WHERE user_id=?", (user_id,)).fetchall()
    output = []
    for topic_row in topics:
        topic = topic_row["topic"]
        attempts = [dict(row) for row in conn.execute("SELECT score,total,timestamp FROM progress WHERE user_id=? AND topic=? ORDER BY timestamp DESC LIMIT 20", (user_id, topic)).fetchall()]
        result = mastery_score(attempts)
        misconception = conn.execute("SELECT misconception_type,occurrence_count FROM misconceptions WHERE user_id=? AND topic=? AND resolved_at IS NULL ORDER BY occurrence_count DESC LIMIT 1", (user_id, topic)).fetchone()
        conn.execute("INSERT INTO mastery_snapshots(user_id,topic,score,confidence,evidence_count,components_json,created_at) VALUES(?,?,?,?,?,?,?)", (user_id, topic, result["score"], result["confidence"], result["attempts"], json.dumps(result["components"]), now_iso()))
        output.append({"topic": topic, **result, "primary_misconception": dict(misconception) if misconception else None})
    conn.commit(); conn.close()
    output.sort(key=lambda item: item["score"])
    return {"mastery": output}


@router.get("/sprint/{user_id}")
def smart_sprint(user_id: int, request: Request, minutes: int = 25):
    _authorize_user(request, user_id)
    conn = get_connection()
    weak = conn.execute("SELECT topic,AVG(CAST(score AS FLOAT)/NULLIF(total,0)) pct FROM progress WHERE user_id=? GROUP BY topic ORDER BY pct ASC LIMIT 1", (user_id,)).fetchone()
    goal = conn.execute("SELECT title FROM learning_goals WHERE user_id=? AND status='active' ORDER BY updated_at DESC LIMIT 1", (user_id,)).fetchone()
    due = conn.execute("SELECT COUNT(*) count FROM flashcard_reviews WHERE user_id=? AND next_review_at<=?", (user_id, now_iso())).fetchone()["count"]
    conn.close()
    return build_smart_sprint(weak["topic"] if weak else None, goal["title"] if goal else None, due, minutes)
