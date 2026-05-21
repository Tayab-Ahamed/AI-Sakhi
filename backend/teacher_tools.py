"""
Phase 10 — Teacher Tools
Business logic for teacher-created assignments and student submission tracking.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime

from backend.config import DB_PATH


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ──────────────────────────────────────────────────────────────
# Assignments
# ──────────────────────────────────────────────────────────────

def create_assignment(
    teacher_id: int,
    organization_id: int,
    title: str,
    subject: str,
    topic: str,
    difficulty: str = "medium",
    class_: str = "8",
    instructions: str = "",
    due_date: str | None = None,
) -> dict:
    """Create a new assignment for a class in an organization."""
    conn = _conn()
    cur = conn.cursor()
    now = _now()
    cur.execute(
        """
        INSERT INTO assignments
            (teacher_id, organization_id, title, subject, topic, difficulty, class_,
             instructions, due_date, created_at, updated_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """,
        (teacher_id, organization_id, title.strip(), subject.strip(), topic.strip(),
         difficulty, class_, instructions.strip(), due_date, now, now),
    )
    row_id = cur.lastrowid
    conn.commit()
    row = cur.execute("SELECT * FROM assignments WHERE id = ?", (row_id,)).fetchone()
    conn.close()
    return _enrich_assignment(dict(row))


def get_assignment(assignment_id: int) -> dict | None:
    conn = _conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM assignments WHERE id = ?", (assignment_id,)).fetchone()
    if not row:
        conn.close()
        return None
    result = _enrich_assignment(dict(row))
    # Add submission stats
    stats = cur.execute(
        """
        SELECT COUNT(*) as total,
               SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_count,
               AVG(CASE WHEN score IS NOT NULL THEN score * 100.0 / NULLIF(total_questions, 0) END) as avg_pct
        FROM assignment_submissions WHERE assignment_id = ?
        """,
        (assignment_id,),
    ).fetchone()
    result["submission_stats"] = dict(stats) if stats else {}
    conn.close()
    return result


def list_assignments(
    organization_id: int | None = None,
    teacher_id: int | None = None,
    class_: str | None = None,
    active_only: bool = True,
) -> list[dict]:
    conn = _conn()
    cur = conn.cursor()
    clauses = []
    params: list = []
    if organization_id:
        clauses.append("organization_id = ?")
        params.append(organization_id)
    if teacher_id:
        clauses.append("teacher_id = ?")
        params.append(teacher_id)
    if class_:
        clauses.append("class_ = ?")
        params.append(class_)
    if active_only:
        clauses.append("is_active = 1")
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = cur.execute(
        f"SELECT * FROM assignments {where} ORDER BY created_at DESC",
        params,
    ).fetchall()
    assignments = [_enrich_assignment(dict(r)) for r in rows]
    # Attach submission counts efficiently
    for a in assignments:
        stats = cur.execute(
            "SELECT COUNT(*) as total, SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) as done FROM assignment_submissions WHERE assignment_id = ?",
            (a["id"],),
        ).fetchone()
        a["submission_count"] = stats["total"] if stats else 0
        a["completed_count"] = stats["done"] if stats else 0
    conn.close()
    return assignments


def delete_assignment(assignment_id: int, teacher_id: int) -> bool:
    """Soft-delete by setting is_active = 0. Returns True if found."""
    conn = _conn()
    cur = conn.cursor()
    result = cur.execute(
        "UPDATE assignments SET is_active = 0, updated_at = ? WHERE id = ? AND teacher_id = ?",
        (_now(), assignment_id, teacher_id),
    )
    conn.commit()
    conn.close()
    return result.rowcount > 0


# ──────────────────────────────────────────────────────────────
# Student Submissions
# ──────────────────────────────────────────────────────────────

def get_student_assignments(user_id: int, organization_id: int | None = None) -> list[dict]:
    """Return active assignments relevant to a student (their org + class)."""
    conn = _conn()
    cur = conn.cursor()
    user = cur.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return []
    org_id = organization_id or user["organization_id"]
    class_ = str(user.get("class") or user.get("class_") or "8")
    rows = cur.execute(
        """
        SELECT a.*,
               s.id as submission_id, s.completed, s.score, s.total_questions, s.submitted_at
        FROM assignments a
        LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = ?
        WHERE a.organization_id = ? AND a.class_ = ? AND a.is_active = 1
        ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC
        """,
        (user_id, org_id, class_),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["my_submission"] = {
            "submission_id": d.pop("submission_id", None),
            "completed": bool(d.pop("completed", False)),
            "score": d.pop("score", None),
            "total_questions": d.pop("total_questions", None),
            "submitted_at": d.pop("submitted_at", None),
        }
        result.append(_enrich_assignment(d))
    return result


def submit_assignment(
    assignment_id: int,
    student_id: int,
    score: int,
    total_questions: int,
) -> dict:
    """Record a student's quiz result for an assignment."""
    conn = _conn()
    cur = conn.cursor()
    now = _now()
    existing = cur.execute(
        "SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?",
        (assignment_id, student_id),
    ).fetchone()
    if existing:
        cur.execute(
            """
            UPDATE assignment_submissions
            SET score = ?, total_questions = ?, completed = 1, submitted_at = ?
            WHERE id = ?
            """,
            (score, total_questions, now, existing["id"]),
        )
        sub_id = existing["id"]
    else:
        cur.execute(
            """
            INSERT INTO assignment_submissions
                (assignment_id, student_id, score, total_questions, completed, submitted_at, started_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
            """,
            (assignment_id, student_id, score, total_questions, now, now),
        )
        sub_id = cur.lastrowid
    conn.commit()
    row = cur.execute("SELECT * FROM assignment_submissions WHERE id = ?", (sub_id,)).fetchone()
    conn.close()
    return dict(row)


def get_assignment_submissions(assignment_id: int) -> list[dict]:
    """Return all submissions for an assignment (teacher view)."""
    conn = _conn()
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT s.*, u.name as student_name, u.class_ as class_
        FROM assignment_submissions s
        JOIN users u ON u.id = s.student_id
        WHERE s.assignment_id = ?
        ORDER BY s.submitted_at DESC
        """,
        (assignment_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ──────────────────────────────────────────────────────────────
# Report Generation (text → frontend renders to PDF)
# ──────────────────────────────────────────────────────────────

def generate_student_report_data(user_id: int) -> dict:
    """Aggregate all data needed to render a student progress PDF report."""
    conn = _conn()
    cur = conn.cursor()
    user = cur.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return {}
    user = dict(user)

    # Quiz history (last 20)
    history = cur.execute(
        "SELECT topic, score, total, timestamp FROM progress WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20",
        (user_id,),
    ).fetchall()
    history = [dict(r) for r in history]

    # Streak
    from backend.db import get_streak
    streak = get_streak(user_id)

    # Assignments
    org_id = user.get("organization_id") or 1
    class_ = str(user.get("class") or user.get("class_") or "8")
    assignments_done = cur.execute(
        """
        SELECT a.title, a.topic, s.score, s.total_questions, s.submitted_at, s.feedback_note
        FROM assignment_submissions s
        JOIN assignments a ON a.id = s.assignment_id
        WHERE s.student_id = ? AND s.completed = 1
        ORDER BY s.submitted_at DESC LIMIT 10
        """,
        (user_id,),
    ).fetchall()

    # Flashcard stats
    fc_stats = cur.execute(
        "SELECT COUNT(*) as total, AVG(easiness_factor) as avg_ef FROM flashcard_reviews WHERE user_id = ?",
        (user_id,),
    ).fetchone()

    # Compute averages
    quiz_scores = [(r["score"] / r["total"] * 100) for r in history if r["total"]]
    avg_pct = round(sum(quiz_scores) / len(quiz_scores), 1) if quiz_scores else None

    conn.close()
    return {
        "user": {
            "name": user["name"],
            "class_": class_,
            "weak_subject": user.get("weak_subject", ""),
            "organization_id": org_id,
        },
        "streak": streak,
        "avg_quiz_pct": avg_pct,
        "total_quizzes": len(history),
        "quiz_history": history,
        "assignments_completed": [dict(r) for r in assignments_done],
        "flashcard_stats": dict(fc_stats) if fc_stats else {},
        "generated_at": _now(),
    }


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _enrich_assignment(a: dict) -> dict:
    """Add computed fields to an assignment dict."""
    due = a.get("due_date")
    if due:
        try:
            due_dt = datetime.fromisoformat(due)
            a["is_overdue"] = due_dt < datetime.now(UTC)
        except Exception:
            a["is_overdue"] = False
    else:
        a["is_overdue"] = False
    return a


def get_organization_roster(organization_id: int) -> list[dict]:
    """Get student roster in the organization, including streak, XP, and weak subject."""
    from backend.db import get_streak, get_user_xp
    conn = _conn()
    cur = conn.cursor()
    rows = cur.execute(
        "SELECT id, name, class, weak_subject, last_active_at FROM users WHERE organization_id = ? AND role = 'student' ORDER BY name",
        (organization_id,),
    ).fetchall()
    roster = []
    for r in rows:
        student_id = r["id"]
        streak = get_streak(student_id)
        xp = get_user_xp(student_id)
        d = dict(r)
        d["user_id"] = d.pop("id")
        d["class_"] = d.pop("class")
        d["streak"] = streak
        d["xp"] = xp
        roster.append(d)
    conn.close()
    return roster


def get_class_analytics(organization_id: int) -> dict:
    """Calculate overall class quiz average score, assignment completion rate, and count of struggling students."""
    conn = _conn()
    cur = conn.cursor()
    
    # 1. Overall quiz average score pct
    avg_row = cur.execute(
        """
        SELECT AVG(CAST(score AS FLOAT) / NULLIF(total, 0)) * 100 as avg_pct
        FROM progress
        WHERE user_id IN (SELECT id FROM users WHERE organization_id = ? AND role = 'student')
        """,
        (organization_id,),
    ).fetchone()
    avg_score = round(avg_row["avg_pct"], 1) if avg_row and avg_row["avg_pct"] is not None else 0.0

    # 2. Total completion rate for active assignments
    active_assigns = cur.execute(
        "SELECT COUNT(*) FROM assignments WHERE organization_id = ? AND is_active = 1",
        (organization_id,),
    ).fetchone()[0]
    
    total_students = cur.execute(
        "SELECT COUNT(*) FROM users WHERE organization_id = ? AND role = 'student'",
        (organization_id,),
    ).fetchone()[0]
    
    completed_subs = cur.execute(
        """
        SELECT COUNT(*) FROM assignment_submissions s
        JOIN assignments a ON a.id = s.assignment_id
        WHERE a.organization_id = ? AND a.is_active = 1 AND s.completed = 1
        """,
        (organization_id,),
    ).fetchone()[0]
    
    expected = active_assigns * total_students
    completion_rate = round((completed_subs / expected) * 100, 1) if expected > 0 else 0.0

    # 3. Count of struggling students (average quiz score < 60%)
    struggling_count = cur.execute(
        """
        SELECT COUNT(*) FROM (
            SELECT user_id, AVG(CAST(score AS FLOAT) / NULLIF(total, 0)) * 100 as avg_pct
            FROM progress
            WHERE user_id IN (SELECT id FROM users WHERE organization_id = ? AND role = 'student')
            GROUP BY user_id
            HAVING avg_pct < 60.0
        )
        """,
        (organization_id,),
    ).fetchone()[0]

    conn.close()
    return {
        "quiz_average": avg_score,
        "completion_rate": completion_rate,
        "struggling_count": struggling_count,
        "active_assignments": active_assigns,
        "total_students": total_students,
    }


def update_submission_feedback(submission_id: int, feedback_note: str) -> dict | None:
    """Update feedback note on an assignment submission."""
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE assignment_submissions SET feedback_note = ? WHERE id = ?",
        (feedback_note.strip(), submission_id),
    )
    conn.commit()
    row = cur.execute("SELECT * FROM assignment_submissions WHERE id = ?", (submission_id,)).fetchone()
    conn.close()
    return dict(row) if row else None
