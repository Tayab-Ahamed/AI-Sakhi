"""API routes completing chat history, artifact library, and spaced repetition."""
from __future__ import annotations

import json
from datetime import UTC, datetime
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.db import get_connection, now_iso
from backend.spaced_repetition import initial_review_state, next_review_iso, sm2_update

router = APIRouter()

class ChatRename(BaseModel):
    user_id: int
    title: str = Field(min_length=1, max_length=120)

class ArtifactCreate(BaseModel):
    user_id: int
    artifact_type: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=160)
    topic: str | None = Field(default=None, max_length=160)
    source_session_id: str | None = Field(default=None, max_length=160)
    payload: dict

class ArtifactUpdate(BaseModel):
    user_id: int
    title: str | None = Field(default=None, min_length=1, max_length=160)
    topic: str | None = Field(default=None, max_length=160)
    payload: dict | None = None

class ReviewCreate(BaseModel):
    user_id: int
    topic: str = Field(min_length=1, max_length=160)
    card_id: int | str
    card_front: str = Field(min_length=1, max_length=2000)
    card_back: str = Field(min_length=1, max_length=5000)

class ReviewRate(BaseModel):
    user_id: int
    quality: int = Field(ge=1, le=4)

@router.get("/chat/sessions/{user_id}")
def list_chat_sessions(user_id: int):
    conn = get_connection()
    rows = conn.execute("SELECT session_id, COALESCE(title,'New chat') title, created_at, updated_at FROM chat_sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 100", (user_id,)).fetchall()
    conn.close()
    return {"sessions": [dict(r) for r in rows]}

@router.put("/chat/session/{session_id}")
def rename_chat_session(session_id: str, req: ChatRename):
    conn = get_connection()
    result = conn.execute("UPDATE chat_sessions SET title=?, updated_at=? WHERE session_id=? AND user_id=?", (req.title.strip(), now_iso(), session_id, req.user_id))
    conn.commit(); conn.close()
    if not result.rowcount: raise HTTPException(404, "Chat session not found")
    return {"ok": True, "session_id": session_id, "title": req.title.strip()}

@router.delete("/chat/session/{session_id}")
def delete_chat_session(session_id: str, user_id: int):
    conn = get_connection(); result = conn.execute("DELETE FROM chat_sessions WHERE session_id=? AND user_id=?", (session_id, user_id)); conn.commit(); conn.close()
    if not result.rowcount: raise HTTPException(404, "Chat session not found")
    return {"ok": True}

@router.post("/artifacts")
def create_artifact(req: ArtifactCreate):
    conn = get_connection(); now = now_iso()
    cur = conn.execute("INSERT INTO artifacts(user_id,artifact_type,title,topic,source_session_id,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", (req.user_id,req.artifact_type,req.title.strip(),req.topic,req.source_session_id,json.dumps(req.payload,ensure_ascii=False),now,now))
    artifact_id=cur.lastrowid; conn.commit(); conn.close()
    return {"id": artifact_id, **req.model_dump(), "created_at": now, "updated_at": now}

@router.get("/artifacts/{user_id}")
def list_artifacts(user_id: int, artifact_type: str | None = None):
    conn=get_connection(); params=[user_id]; where="user_id=?"
    if artifact_type: where += " AND artifact_type=?"; params.append(artifact_type)
    rows=conn.execute(f"SELECT * FROM artifacts WHERE {where} ORDER BY updated_at DESC LIMIT 200", params).fetchall(); conn.close()
    items=[]
    for row in rows:
        item=dict(row); item["payload"]=json.loads(item.pop("payload_json") or "{}"); items.append(item)
    return {"artifacts": items}

@router.patch("/artifacts/{artifact_id}")
def update_artifact(artifact_id: int, req: ArtifactUpdate):
    updates=[]; values=[]
    for field in ("title","topic"):
        value=getattr(req,field)
        if value is not None: updates.append(f"{field}=?"); values.append(value.strip() if isinstance(value,str) else value)
    if req.payload is not None: updates.append("payload_json=?"); values.append(json.dumps(req.payload,ensure_ascii=False))
    if not updates: raise HTTPException(400,"No fields to update")
    updates.append("updated_at=?"); values.append(now_iso()); values.extend([artifact_id,req.user_id])
    conn=get_connection(); result=conn.execute(f"UPDATE artifacts SET {', '.join(updates)} WHERE id=? AND user_id=?",values); conn.commit(); conn.close()
    if not result.rowcount: raise HTTPException(404,"Artifact not found")
    return {"ok":True}

@router.delete("/artifacts/{artifact_id}")
def delete_artifact(artifact_id: int, user_id: int):
    conn=get_connection(); result=conn.execute("DELETE FROM artifacts WHERE id=? AND user_id=?",(artifact_id,user_id)); conn.commit(); conn.close()
    if not result.rowcount: raise HTTPException(404,"Artifact not found")
    return {"ok":True}

@router.post("/flashcards/review")
def create_review(req: ReviewCreate):
    state=initial_review_state(); now=now_iso(); conn=get_connection()
    conn.execute("INSERT INTO flashcard_reviews(user_id,card_id,topic,card_front,card_back,ef,interval,repetitions,next_review_at,last_reviewed_at,total_reviews,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,card_id) DO UPDATE SET topic=excluded.topic, card_front=excluded.card_front, card_back=excluded.card_back",(req.user_id,str(req.card_id),req.topic,req.card_front,req.card_back,state["easiness_factor"],state["interval_days"],state["repetitions"],state["next_review_at"],None,0,now))
    row=conn.execute("SELECT * FROM flashcard_reviews WHERE user_id=? AND card_id=?",(req.user_id,str(req.card_id))).fetchone(); conn.commit(); conn.close(); return dict(row)

@router.get("/flashcards/due/{user_id}")
def due_reviews(user_id: int):
    conn=get_connection(); rows=conn.execute("SELECT * FROM flashcard_reviews WHERE user_id=? AND next_review_at<=? ORDER BY next_review_at LIMIT 100",(user_id,now_iso())).fetchall(); total=conn.execute("SELECT COUNT(*) total FROM flashcard_reviews WHERE user_id=?",(user_id,)).fetchone()["total"]; conn.close(); return {"reviews":[dict(r) for r in rows],"stats":{"total_cards":total,"due_now":len(rows)}}

@router.post("/flashcards/review/{review_id}/rate")
def rate_review(review_id: int, req: ReviewRate):
    conn=get_connection(); row=conn.execute("SELECT * FROM flashcard_reviews WHERE id=? AND user_id=?",(review_id,req.user_id)).fetchone()
    if not row: conn.close(); raise HTTPException(404,"Review not found")
    ef,interval,reps=sm2_update(row["ef"],row["interval"],row["repetitions"],req.quality); now=now_iso()
    conn.execute("UPDATE flashcard_reviews SET ef=?,interval=?,repetitions=?,next_review_at=?,last_reviewed_at=?,total_reviews=COALESCE(total_reviews,0)+1 WHERE id=?",(ef,interval,reps,next_review_iso(interval),now,review_id)); conn.commit(); conn.close()
    return {"id":review_id,"easiness_factor":ef,"interval_days":interval,"repetitions":reps,"next_review_at":next_review_iso(interval)}
