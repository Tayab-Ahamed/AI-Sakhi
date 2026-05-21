"""
FastAPI backend for AI Sakhi.
Core endpoints for chat, quiz, study plans, profile sync, exports, progress, roles, and ops health.
"""
from __future__ import annotations

import os
import re
from typing import List, Optional

import uvicorn
from fastapi import Depends, FastAPI, File, HTTPException, Security, UploadFile, Cookie, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import StreamingResponse

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
from backend.flashcards import generate_flashcards
from backend.quiz import evaluate_answer, generate_quiz
from backend.rag import get_rag_catalog, get_rag_stats
from backend.study_notes import generate_study_notes
from backend.study_plan import generate_study_plan

app = FastAPI(title="AI Sakhi API", version="1.4.0")

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    sakhi_token: Optional[str] = Cookie(None)
) -> Optional[dict]:
    """Dependency: returns decoded token payload if a valid Bearer token is supplied or secure cookie is present, else None."""
    token = None
    if credentials:
        token = credentials.credentials
    elif sakhi_token:
        token = sakhi_token
    if not token:
        return None
    from backend.auth import verify_session_token
    return verify_session_token(token)


def require_roles(*roles: str):
    """Factory: returns a FastAPI dependency that raises 403 unless the token role is in *roles."""
    def _dep(token_data: Optional[dict] = Depends(get_current_user)):
        if not token_data:
            raise HTTPException(status_code=401, detail="Authentication required")
        if token_data.get("role") not in roles:
            raise HTTPException(status_code=403, detail=f"Role must be one of: {list(roles)}")
        return token_data
    return _dep

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
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
    password: Optional[str] = None


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


class StudyNotesRequest(BaseModel):
    topic: str
    class_: str = "8"
    language: str = "English"
    subject: str = ""
    user_id: Optional[int] = None


class FlashcardsRequest(BaseModel):
    topic: str
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


class LoginRequest(BaseModel):
    name: str
    password: str


class SessionEndRequest(BaseModel):
    user_id: int
    module: str
    duration_seconds: int


@app.get("/")
def root():
    return {"message": "AI Sakhi API is running", "version": "1.4.0"}


@app.get("/health")
def api_health():
    rag = get_rag_stats()
    return {
        "status": "ok",
        "version": "1.4.0",
        "model": GROQ_MODEL,
        "database": {"path": os.path.basename(DB_PATH), "configured": bool(DB_PATH)},
        "rag": rag,
    }


@app.post("/auth/token")
def api_issue_token(req: TokenRequest, response: Response):
    token = issue_session_token(req.user_id, req.expires_in_hours)
    response.set_cookie(
        key="sakhi_token",
        value=token["token"],
        httponly=True,
        samesite="lax",
        max_age=req.expires_in_hours * 3600
    )
    return token


@app.post("/auth/verify")
def api_verify_token(req: TokenVerifyRequest):
    payload = verify_session_token(req.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


@app.post("/auth/logout")
def api_logout(req: TokenVerifyRequest, response: Response, sakhi_token: Optional[str] = Cookie(None)):
    token = req.token or sakhi_token
    if token:
        logout_session_token(token)
    response.delete_cookie(key="sakhi_token")
    return {"message": "Logged out"}


@app.post("/user/create")
def api_create_user(req: UserCreate, response: Response):
    user_id = create_user(
        req.name,
        req.class_,
        normalize_language(req.language),
        req.weak_subject,
        role=req.role,
        organization_id=req.organization_id,
    )
    if req.password:
        from backend.auth import hash_password
        from backend.db import set_user_password
        set_user_password(user_id, hash_password(req.password))
    user = get_user_with_org(user_id)
    log_event("user_created", user_id=user_id, metadata={"language": normalize_language(req.language), "class_": req.class_, "role": req.role})
    token = issue_session_token(user_id)
    response.set_cookie(
        key="sakhi_token",
        value=token["token"],
        httponly=True,
        samesite="lax",
        max_age=24 * 3600
    )
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
    """Return chat history for a session. Returns empty messages for new/unknown sessions (never 404)."""
    history = get_chat_history(session_id)
    if not history:
        # New session — return empty message list so frontend can start fresh
        return {"session_id": session_id, "messages": [], "profile": {}}
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


@app.get("/rag/catalog")
def api_rag_catalog():
    """Return the RAG catalog (classes, subjects, chapters available in the vector store)."""
    return get_rag_catalog()


# ── Study Notes ──────────────────────────────────────────────────────────────

@app.post("/study-notes/generate")
def api_generate_study_notes(req: StudyNotesRequest):
    """Generate structured markdown study notes for a topic using AI."""
    try:
        notes_md = generate_study_notes(
            topic=req.topic,
            class_=req.class_,
            language=req.language,
            subject=req.subject,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    if req.user_id:
        log_event("study_notes_generated", user_id=req.user_id, metadata={"topic": req.topic, "language": normalize_language(req.language)})
    return {"notes_md": notes_md, "topic": req.topic}


# ── Flashcards ───────────────────────────────────────────────────────────────

@app.post("/flashcards/generate")
def api_generate_flashcards(req: FlashcardsRequest):
    """Generate a set of flashcards for a topic using AI."""
    result = generate_flashcards(
        topic=req.topic,
        class_=req.class_,
        language=req.language,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Flashcard generation failed"))
    if req.user_id:
        log_event("flashcards_generated", user_id=req.user_id, metadata={"topic": req.topic, "language": normalize_language(req.language)})
    # Return the flashcard deck directly (unwrap from the success wrapper)
    return result["flashcards"]


@app.get("/dashboard")
def api_dashboard(organization_id: Optional[int] = None):
    users = get_all_users()
    metrics = get_dashboard_metrics(organization_id=organization_id)
    if organization_id:
        users = [user for user in users if user.get("organization_id") == organization_id]
    return {**metrics, "users": users}


@app.post("/auth/login")
def api_login(req: LoginRequest, response: Response):
    """Login with name + password. Returns JWT cookie."""
    from backend.db import get_user_by_name, get_user_password_hash
    from backend.auth import verify_password
    user = get_user_by_name(req.name)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid name or password")
    stored_hash = get_user_password_hash(user["user_id"])
    if not stored_hash:
        raise HTTPException(status_code=401, detail="This account has no password set. Please re-register.")
    if not verify_password(req.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid name or password")
    token = issue_session_token(user["user_id"])
    response.set_cookie(
        key="sakhi_token",
        value=token["token"],
        httponly=True,
        samesite="lax",
        max_age=24 * 3600
    )
    return {"user_id": user["user_id"], "message": f"Welcome back, {user['name']}!", "auth": token, **user}


@app.get("/analytics/mastery/{user_id}")
def api_topic_mastery(user_id: int):
    """Return per-topic mastery aggregates for a student."""
    from backend.db import get_topic_mastery
    return {"mastery": get_topic_mastery(user_id)}


@app.get("/gamification/xp/{user_id}")
def api_user_xp(user_id: int):
    """Return XP, level, and gamification data for a student."""
    from backend.db import get_user_xp
    xp = get_user_xp(user_id)
    # Level thresholds
    if xp >= 1000:
        level, level_name, next_xp = 4, "Platinum", None
    elif xp >= 500:
        level, level_name, next_xp = 3, "Gold", 1000
    elif xp >= 200:
        level, level_name, next_xp = 2, "Silver", 500
    else:
        level, level_name, next_xp = 1, "Bronze", 200
    return {
        "xp": xp,
        "level": level,
        "level_name": level_name,
        "next_level_xp": next_xp,
        "progress_pct": round((xp / (next_xp or xp or 1)) * 100, 1) if next_xp else 100,
    }


@app.post("/analytics/session-end")
def api_session_end(req: SessionEndRequest):
    """Log a study session end with duration for time tracking."""
    log_event(
        "session_end",
        user_id=req.user_id,
        metadata={"module": req.module, "duration_seconds": req.duration_seconds},
    )
    return {"ok": True}


@app.get("/analytics/study-time/{user_id}")
def api_study_time(user_id: int):
    """Return per-module study time for the last 7 days."""
    import json
    from backend.db import get_connection
    from datetime import UTC, datetime, timedelta
    since = (datetime.now(UTC) - timedelta(days=7)).isoformat()
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT metadata_json FROM learning_events
        WHERE user_id = ? AND event_type = 'session_end' AND created_at >= ?
        """,
        (user_id, since),
    ).fetchall()
    conn.close()
    totals: dict[str, int] = {}
    for row in rows:
        meta = json.loads(row["metadata_json"] or "{}")
        mod = meta.get("module", "other")
        totals[mod] = totals.get(mod, 0) + int(meta.get("duration_seconds", 0))
    return {"study_time": [{ "module": k, "seconds": v } for k, v in totals.items()]}


@app.get("/notifications/{user_id}")
def api_notifications(user_id: int):
    """Return aggregated in-app notifications for a student."""
    from backend.db import get_connection, get_streak
    import json
    notifications = []
    streak = get_streak(user_id)
    if streak == 0:
        notifications.append({"id": "streak", "type": "warning", "title": "Keep your streak alive!", "body": "You haven't studied today. Start a quiz or chat to maintain your streak.", "href": "/quiz"})
    elif streak >= 7:
        notifications.append({"id": f"streak_{streak}", "type": "success", "title": f"🔥 {streak}-day streak!", "body": "Amazing consistency! Keep it up.", "href": "/dashboard"})
    conn = get_connection()
    # Pending assignments
    try:
        rows = conn.execute(
            """
            SELECT a.title, a.subject, a.due_date FROM assignments a
            LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = ?
            WHERE s.id IS NULL AND a.class_ IN (SELECT class FROM users WHERE id = ?)
            ORDER BY a.due_date ASC LIMIT 3
            """,
            (user_id, user_id),
        ).fetchall()
        for row in rows:
            notifications.append({
                "id": f"assign_{row['title']}",
                "type": "info",
                "title": f"Assignment: {row['title']}",
                "body": f"{row['subject']} • Due: {(row['due_date'] or 'No deadline')[:10]}",
                "href": "/dashboard"
            })
    except Exception:
        pass
    conn.close()
    return {"notifications": notifications, "unread_count": len(notifications)}


# ── Streaming Chat ────────────────────────────────────────────────────────────

class StreamChatRequest(BaseModel):
    session_id: str
    message: str
    class_: str = "8"
    language: str = "English"
    user_name: str = ""
    weak_subject: str = ""
    user_id: Optional[int] = None
    organization_id: Optional[int] = None


@app.post("/chat/stream")
def api_chat_stream(req: StreamChatRequest):
    """Stream chat response token-by-token using Server-Sent Events."""
    from backend.chat import stream_chat

    def event_generator():
        for chunk in stream_chat(
            session_id=req.session_id,
            user_message=req.message,
            class_=req.class_,
            selected_language=req.language,
            user_name=req.user_name,
            weak_subject=req.weak_subject,
            user_id=req.user_id,
            organization_id=req.organization_id,
        ):
            # SSE format: data: <chunk>\n\n
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Practice Paper ────────────────────────────────────────────────────────────

class PracticePaperRequest(BaseModel):
    topic: str
    class_: str = "9"
    subject: str = "Science"
    language: str = "English"
    num_questions: int = 10
    user_id: Optional[int] = None


@app.post("/practice-paper/generate")
def api_generate_practice_paper(req: PracticePaperRequest):
    """Generate a full CBSE-style practice exam paper with model answers."""
    from backend.practice_paper import generate_practice_paper
    result = generate_practice_paper(
        topic=req.topic,
        class_=req.class_,
        subject=req.subject,
        language=req.language,
        num_questions=req.num_questions,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Paper generation failed"))
    if req.user_id:
        log_event("practice_paper_generated", user_id=req.user_id, metadata={"topic": req.topic, "subject": req.subject})
    return result["paper"]


# ── Teacher & Assignment Tools ───────────────────────────────────────────────

class AssignmentCreateRequest(BaseModel):
    teacher_id: int
    organization_id: int
    title: str
    subject: str
    topic: str
    difficulty: str = "medium"
    class_: str = "8"
    instructions: str = ""
    due_date: Optional[str] = None

class AssignmentSubmitRequest(BaseModel):
    student_id: int
    score: int
    total_questions: int

@app.post("/assignments")
def api_create_assignment(req: AssignmentCreateRequest):
    from backend.teacher_tools import create_assignment
    try:
        return create_assignment(
            teacher_id=req.teacher_id,
            organization_id=req.organization_id,
            title=req.title,
            subject=req.subject,
            topic=req.topic,
            difficulty=req.difficulty,
            class_=req.class_,
            instructions=req.instructions,
            due_date=req.due_date,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/assignments")
def api_list_assignments(
    organization_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    class_: Optional[str] = None,
):
    from backend.teacher_tools import list_assignments
    try:
        return list_assignments(
            organization_id=organization_id,
            teacher_id=teacher_id,
            class_=class_,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/assignments/{id}")
def api_get_assignment(id: int):
    from backend.teacher_tools import get_assignment
    item = get_assignment(id)
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return item

@app.delete("/assignments/{id}")
def api_delete_assignment(id: int, teacher_id: int):
    from backend.teacher_tools import delete_assignment
    success = delete_assignment(id, teacher_id)
    if not success:
        raise HTTPException(status_code=404, detail="Assignment not found or unauthorized")
    return {"ok": True}

@app.post("/assignments/{assignment_id}/submit")
def api_submit_assignment(assignment_id: int, req: AssignmentSubmitRequest):
    from backend.teacher_tools import submit_assignment
    try:
        return submit_assignment(
            assignment_id=assignment_id,
            student_id=req.student_id,
            score=req.score,
            total_questions=req.total_questions,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/assignments/student/{userId}")
def api_get_student_assignments(userId: int, organization_id: Optional[int] = None):
    from backend.teacher_tools import get_student_assignments
    try:
        return get_student_assignments(userId, organization_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/assignments/{assignment_id}/submissions")
def api_get_assignment_submissions(assignment_id: int):
    from backend.teacher_tools import get_assignment_submissions
    try:
        return {"submissions": get_assignment_submissions(assignment_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/report/student/{userId}")
def api_generate_student_report_data(userId: int):
    from backend.teacher_tools import generate_student_report_data
    try:
        return generate_student_report_data(userId)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FeedbackUpdateRequest(BaseModel):
    feedback_note: str


@app.get("/analytics/class/{org_id}")
def api_class_analytics(org_id: int):
    from backend.teacher_tools import get_class_analytics
    try:
        return get_class_analytics(org_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/organization/roster/{org_id}")
def api_organization_roster(org_id: int):
    from backend.teacher_tools import get_organization_roster
    try:
        return {"roster": get_organization_roster(org_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FeedbackUpdateRequest(BaseModel):
    feedback_note: str


@app.put("/assignments/submissions/{submission_id}/feedback")
def api_update_submission_feedback(submission_id: int, req: FeedbackUpdateRequest):
    from backend.teacher_tools import update_submission_feedback
    try:
        res = update_submission_feedback(submission_id, req.feedback_note)
        if not res:
            raise HTTPException(status_code=404, detail="Submission not found")
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DemoSeedRequest(BaseModel):
    role: str
    name: str
    class_: str
    language: str
    weak_subject: str
    organization_id: int


@app.post("/demo/seed")
def api_seed_demo_data(req: DemoSeedRequest):
    import sqlite3
    import random
    from datetime import datetime, timedelta, UTC
    from backend.config import DB_PATH
    from backend.db import create_user, set_user_password
    from backend.auth import hash_password
    try:
        user_id = create_user(
            name=req.name.strip(),
            class_=req.class_.strip(),
            language=req.language.strip(),
            weak_subject=req.weak_subject.strip(),
            role=req.role.strip(),
            organization_id=req.organization_id
        )
        set_user_password(user_id, hash_password("password123"))
        
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        now = datetime.now(UTC)
        
        if req.role == "student":
            topics = [req.weak_subject, "Mathematics", "Science", "English", "History"]
            for topic in topics:
                if not topic: continue
                num_attempts = random.randint(2, 5)
                for i in range(num_attempts):
                    days_ago = random.randint(1, 10)
                    timestamp = (now - timedelta(days=days_ago, hours=random.randint(1, 12))).isoformat()
                    score = random.randint(4, 9)
                    total = 10
                    if topic == req.weak_subject:
                        score = random.randint(2, 6)
                    cur.execute(
                        """
                        INSERT INTO progress (user_id, topic, score, total, streak, timestamp)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (user_id, topic, score, total, random.randint(1, 7), timestamp)
                    )
            
            event_types = ["progress_updated", "study_notes_generated", "flashcards_generated", "chat_message"]
            for i in range(15):
                days_ago = random.randint(1, 7)
                timestamp = (now - timedelta(days=days_ago, hours=random.randint(1, 23))).isoformat()
                cur.execute(
                    """
                    INSERT INTO learning_events (user_id, organization_id, event_type, metadata_json, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (user_id, req.organization_id, random.choice(event_types), "{}", timestamp)
                )
                
            modules = ["chat", "quiz", "flashcards", "study_notes", "study_plan"]
            for m in modules:
                for d in range(1, 6):
                    if random.random() > 0.3:
                        duration = random.randint(300, 2400)
                        timestamp = (now - timedelta(days=d, hours=random.randint(1, 12))).isoformat()
                        cur.execute(
                            """
                            INSERT INTO learning_events (user_id, organization_id, event_type, metadata_json, created_at)
                            VALUES (?, ?, 'session_end', ?, ?)
                            """,
                            (user_id, req.organization_id, f'{{"module": "{m}", "duration_seconds": {duration}}}', timestamp)
                        )
                        
        elif req.role == "teacher":
            topics = ["Algebra Essentials", "Chemical Reactions", "Indian Constitution", "Grammar Tenses"]
            for t in topics:
                due = (now + timedelta(days=random.randint(2, 7))).isoformat()
                cur.execute(
                    """
                    INSERT INTO assignments (teacher_id, organization_id, title, subject, topic, difficulty, class_, instructions, due_date, created_at, updated_at, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    """,
                    (user_id, req.organization_id, f"Mock Assignment: {t}", "General", t, "medium", req.class_, "Complete the quiz on Sakhi and analyze results.", due, now.isoformat(), now.isoformat())
                )
                
        conn.commit()
        conn.close()
        return {"ok": True, "message": f"Successfully created and seeded test {req.role} account!", "user_id": user_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/daily-activity/{org_id}")
def api_daily_activity(org_id: int):
    import sqlite3
    from datetime import datetime, timedelta, UTC
    from backend.config import DB_PATH
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        now = datetime.now(UTC)
        dates = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
        
        activity = []
        for d in dates:
            start = f"{d}T00:00:00"
            end = f"{d}T23:59:59"
            row = cur.execute(
                """
                SELECT COUNT(*) as count 
                FROM learning_events 
                WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
                """,
                (org_id, start, end),
            ).fetchone()
            count = row["count"] if row else 0
            activity.append({"date": d, "count": count})
            
        conn.close()
        return {"activity": activity}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
