"""
FastAPI backend for AI Sakhi.
Core endpoints for chat, quiz, study plans, profile sync, exports, progress, roles, and ops health.
"""
from __future__ import annotations

import os
import re
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.auth import issue_session_token, logout_session_token, verify_session_token
from backend.chat import chat, clear_session
from backend.config import DB_PATH, GROQ_MODEL
from backend.db import (
    create_user,
    ensure_default_organization,
    get_all_users,
    get_chat_history,
    get_dashboard_metrics,
    get_streak,
    get_student_report,
    get_user,
    get_user_progress,
    get_user_with_org,
    init_db,
    log_event,
    update_progress,
    update_user,
)
from backend.language import normalize_language
from backend.quiz import evaluate_answer, generate_quiz
from backend.rag import get_rag_stats
from backend.study_plan import generate_study_plan

app = FastAPI(title="AI Sakhi API", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_db()
    ensure_default_organization()
    print("[OK] AI Sakhi backend started. DB initialized.")


class UserCreate(BaseModel):
    name: str
    class_: str
    language: str = "English"
    weak_subject: str = ""
    role: str = "student"
    organization_id: Optional[int] = None


class UserUpdate(BaseModel):
    name: str
    class_: str
    language: str = "English"
    weak_subject: str = ""
    role: str = "student"
    organization_id: Optional[int] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str
    class_: str = "8"
    simplify: bool = False
    language: str = "English"
    user_name: str = ""
    weak_subject: str = ""
    translate_to: Optional[str] = None
    user_id: Optional[int] = None
    organization_id: Optional[int] = None


class QuizRequest(BaseModel):
    topic: str
    class_: str = "8"
    language: str = "English"
    user_id: Optional[int] = None
    difficulty: str = "medium"


class EvaluateRequest(BaseModel):
    question: dict
    user_answer: str
    language: str = "English"
    user_id: Optional[int] = None


class StudyPlanRequest(BaseModel):
    topic: str
    subject: str
    class_: str = "8"
    language: str = "English"
    user_id: Optional[int] = None


class ProgressUpdate(BaseModel):
    user_id: int
    topic: str
    score: int
    total: int = 5


class TokenRequest(BaseModel):
    user_id: int
    expires_in_hours: int = 24


class TokenVerifyRequest(BaseModel):
    token: str


@app.get("/")
def root():
    return {"message": "AI Sakhi API is running", "version": "1.3.0"}


@app.get("/health")
def api_health():
    rag = get_rag_stats()
    return {
        "status": "ok",
        "version": "1.3.0",
        "model": GROQ_MODEL,
        "database": {"path": os.path.basename(DB_PATH), "configured": bool(DB_PATH)},
        "rag": rag,
    }


@app.post("/auth/token")
def api_issue_token(req: TokenRequest):
    token = issue_session_token(req.user_id, req.expires_in_hours)
    return token


@app.post("/auth/verify")
def api_verify_token(req: TokenVerifyRequest):
    payload = verify_session_token(req.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


@app.post("/auth/logout")
def api_logout(req: TokenVerifyRequest):
    logout_session_token(req.token)
    return {"message": "Logged out"}


@app.post("/user/create")
def api_create_user(req: UserCreate):
    user_id = create_user(
        req.name,
        req.class_,
        normalize_language(req.language),
        req.weak_subject,
        role=req.role,
        organization_id=req.organization_id,
    )
    user = get_user_with_org(user_id)
    log_event("user_created", user_id=user_id, metadata={"language": normalize_language(req.language), "class_": req.class_, "role": req.role})
    token = issue_session_token(user_id)
    return {"user_id": user_id, "message": f"Welcome, {req.name}!", "auth": token, **(user or {})}


@app.get("/user/{user_id}")
def api_get_user(user_id: int):
    user = get_user_with_org(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.put("/user/{user_id}")
def api_update_user(user_id: int, req: UserUpdate):
    user = update_user(
        user_id,
        req.name,
        req.class_,
        normalize_language(req.language),
        req.weak_subject,
        role=req.role,
        organization_id=req.organization_id,
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    full_user = get_user_with_org(user_id)
    log_event("user_updated", user_id=user_id, metadata={"language": user["language"], "class_": user["class_"], "role": user["role"]})
    return full_user


@app.get("/users")
def api_list_users(organization_id: Optional[int] = None):
    """List all users, optionally filtered by organisation. Used by Admin Console and Parent Dashboard."""
    conn = __import__("sqlite3").connect(DB_PATH)
    conn.row_factory = __import__("sqlite3").Row
    if organization_id is not None:
        rows = conn.execute(
            "SELECT id, name, class_, language, weak_subject, role, organization_id FROM users WHERE organization_id = ? ORDER BY name",
            (organization_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, name, class_, language, weak_subject, role, organization_id FROM users ORDER BY name"
        ).fetchall()
    conn.close()
    return {"users": [dict(r) for r in rows]}


@app.put("/users/{user_id}")
def api_update_user_plural(user_id: int, body: dict):
    """Role-update alias used by Admin Console (PATCH-style partial update)."""
    conn = __import__("sqlite3").connect(DB_PATH)
    allowed = {"role", "name", "class_", "language", "weak_subject", "organization_id"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", (*updates.values(), user_id))
    conn.commit()
    conn.close()
    return {"ok": True, "user_id": user_id, **updates}


@app.post("/chat")
def api_chat(req: ChatRequest):
    response = chat(
        req.session_id,
        req.message,
        req.class_,
        req.simplify,
        req.language,
        req.user_name,
        req.weak_subject,
        req.translate_to,
        req.user_id,
        req.organization_id,
    )
    return {"response": response, "language": normalize_language(req.translate_to or req.language)}


@app.post("/chat/upload")
async def api_chat_upload(
    file: UploadFile = File(...),
    class_: str = "9",
    language: str = "English",
    user_id: Optional[int] = None,
):
    """Accept a PDF or image, extract text, return explanation and quiz offer."""
    from groq import Groq as _Groq
    import base64

    client_g = _Groq(api_key=os.getenv("GROQ_API_KEY", ""))
    content = await file.read()
    fname = file.filename or "document"
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""

    try:
        if ext in ("png", "jpg", "jpeg", "webp", "gif"):
            b64 = base64.b64encode(content).decode()
            mime = f"image/{ext}" if ext != "jpg" else "image/jpeg"
            resp = client_g.chat.completions.create(
                model="llava-v1.5-7b-4096-preview",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                        {"type": "text", "text": f"You are AI Sakhi, a study companion for Class {class_} Indian students. Explain the key concepts in this image in simple {language}. Then offer 2-3 practice questions based on it."}
                    ]
                }],
                max_tokens=1200,
            )
            response_text = resp.choices[0].message.content
        else:
            # PDF or unknown: try to read as text
            try:
                text = content.decode("utf-8", errors="ignore")
            except Exception:
                text = re.sub(rb"[^\x20-\x7E\n]", b" ", content).decode("ascii", errors="ignore")
            # Trim to reasonable size
            text = text[:6000]
            prompt = (
                f"You are AI Sakhi, a study companion for Class {class_} Indian students. "
                f"The student uploaded a document named '{fname}'. Here is the extracted text:\n\n{text}\n\n"
                f"In simple {language}, summarize the key concepts from this document. "
                f"Then suggest 2-3 practice questions to help the student test their understanding."
            )
            resp = client_g.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1200,
                temperature=0.6,
            )
            response_text = resp.choices[0].message.content
        if user_id:
            log_event("file_uploaded", user_id=user_id, metadata={"filename": fname, "ext": ext})
        return {"response": response_text, "filename": fname}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/chat/clear")
def api_clear_chat(session_id: str):
    clear_session(session_id)
    return {"message": "Session cleared"}


@app.get("/chat/history/{session_id}")
def api_chat_history(session_id: str):
    history = get_chat_history(session_id)
    if not history:
        raise HTTPException(status_code=404, detail="Session not found")
    return history


@app.post("/quiz/generate")
def api_generate_quiz(req: QuizRequest):
    result = generate_quiz(req.topic, req.class_, req.language, req.difficulty)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    if req.user_id:
        log_event("quiz_generated", user_id=req.user_id, metadata={"topic": req.topic, "language": normalize_language(req.language), "difficulty": req.difficulty})
    return result["quiz"]


@app.post("/quiz/evaluate")
def api_evaluate(req: EvaluateRequest):
    if req.user_id:
        log_event("quiz_answer_checked", user_id=req.user_id, metadata={"language": normalize_language(req.language)})
    return evaluate_answer(req.question, req.user_answer, req.language)


@app.post("/study-plan")
def api_study_plan(req: StudyPlanRequest):
    result = generate_study_plan(req.topic, req.subject, req.class_, req.language)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    if req.user_id:
        log_event(
            "study_plan_generated",
            user_id=req.user_id,
            metadata={"topic": req.topic, "subject": req.subject, "language": normalize_language(req.language)},
        )
    return result["plan"]


@app.post("/progress/update")
def api_update_progress(req: ProgressUpdate):
    streak = update_progress(req.user_id, req.topic, req.score, req.total)
    log_event("progress_updated", user_id=req.user_id, metadata={"topic": req.topic, "score": req.score, "total": req.total})
    return {"streak": streak, "message": "Progress saved!"}


@app.get("/progress/{user_id}")
def api_get_progress(user_id: int):
    history = get_user_progress(user_id)
    streak = get_streak(user_id)
    return {"history": history, "streak": streak}


@app.get("/reports/user/{user_id}")
def api_user_report(user_id: int):
    report = get_student_report(user_id)
    if not report:
        raise HTTPException(status_code=404, detail="User not found")
    return report


@app.get("/rag/stats")
def api_rag_stats():
    return get_rag_stats()


@app.get("/dashboard")
def api_dashboard(organization_id: Optional[int] = None):
    users = get_all_users()
    metrics = get_dashboard_metrics(organization_id=organization_id)
    if organization_id:
        users = [user for user in users if user.get("organization_id") == organization_id]
    return {**metrics, "users": users}


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
