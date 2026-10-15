"""Provider-independent practice; server-owned keys, snapshots and atomic scoring."""

import json
from collections import Counter
from uuid import uuid4

from backend.db import now_iso, record_progress
from backend.question_rules import mcq_snapshot

QUESTION_SCAN_LIMIT = 1000


class PracticeError(Exception):
    def __init__(self, status: int, detail: str):
        self.status, self.detail = status, detail


def public_questions(questions: list[dict]) -> list[dict]:
    return [{key: q[key] for key in ("id", "question_text", "options")} for q in questions]


def public_attempt(row) -> dict:
    return {
        "id": row["id"],
        "subject": row["subject"],
        "chapter": row["chapter"],
        "status": row["status"],
        "questions": public_questions(json.loads(row["questions_json"])),
        "result": json.loads(row["result_json"]) if row["result_json"] else None,
    }


def _profile(conn, identity):
    profile = conn.execute(
        "SELECT class FROM users WHERE id=? AND organization_id=? AND role='student' AND is_active=1",
        (identity.user_id, identity.organization_id),
    ).fetchone()
    if not profile:
        raise PracticeError(403, "Active student account in a school required")
    return profile


def available_topics(conn, identity) -> dict:
    profile = _profile(conn, identity)
    rows = conn.execute(
        "SELECT * FROM question_bank WHERE organization_id=? AND class_level=? AND status='approved' "
        "AND question_type='mcq' ORDER BY id LIMIT ?",
        (identity.organization_id, profile["class"], QUESTION_SCAN_LIMIT + 1),
    ).fetchall()
    counts = Counter(
        (r["subject"], r["chapter"]) for r in rows[:QUESTION_SCAN_LIMIT] if mcq_snapshot(dict(r))
    )
    return {
        "topics": [
            {"subject": s, "chapter": c, "question_count": count} for (s, c), count in sorted(counts.items())
        ],
        "truncated": len(rows) > QUESTION_SCAN_LIMIT,
    }


def _load_attempt(conn, identity, attempt_id):
    profile = _profile(conn, identity)
    row = conn.execute(
        "SELECT * FROM practice_attempts WHERE id=? AND user_id=? AND organization_id=? AND class_level=?",
        (attempt_id, identity.user_id, identity.organization_id, profile["class"]),
    ).fetchone()
    if not row:
        raise PracticeError(404, "Practice attempt not found")
    return row


def _check_pending_questions(conn, identity, row):
    if row["status"] == "completed":
        return  # Completed evidence remains historical, including its original explanation.
    for q in json.loads(row["questions_json"]):
        current = conn.execute(
            "SELECT status FROM question_bank WHERE id=? AND organization_id=? AND class_level=?",
            (q["id"], identity.organization_id, row["class_level"]),
        ).fetchone()
        if not current or current["status"] != "approved":
            raise PracticeError(409, "A question was recalled by your school. Start a new practice attempt.")


def read_attempt(conn, identity, attempt_id):
    row = _load_attempt(conn, identity, attempt_id)
    _check_pending_questions(conn, identity, row)
    return public_attempt(row)


def start_attempt(conn, identity, creation_key, subject, chapter, count):
    conn.execute("BEGIN IMMEDIATE")
    profile = _profile(conn, identity)
    existing = conn.execute(
        "SELECT * FROM practice_attempts WHERE user_id=? AND creation_key=?", (identity.user_id, creation_key)
    ).fetchone()
    if existing:
        if (
            existing["subject"],
            existing["chapter"],
            existing["requested_count"],
            existing["organization_id"],
            existing["class_level"],
        ) != (subject, chapter, count, identity.organization_id, profile["class"]):
            raise PracticeError(409, "Creation key was already used for a different practice intent")
        _check_pending_questions(conn, identity, existing)
        return public_attempt(existing)
    rows = conn.execute(
        "SELECT * FROM question_bank WHERE organization_id=? AND class_level=? AND subject=? AND chapter=? "
        "AND status='approved' AND question_type='mcq' ORDER BY id LIMIT ?",
        (identity.organization_id, profile["class"], subject, chapter, QUESTION_SCAN_LIMIT),
    ).fetchall()
    questions = [q for r in rows if (q := mcq_snapshot(dict(r))) is not None][:count]
    if not questions:
        raise PracticeError(404, "No approved multiple-choice questions are available for this topic")
    attempt_id = str(uuid4())
    conn.execute(
        "INSERT INTO practice_attempts(id,user_id,organization_id,class_level,creation_key,subject,chapter,"
        "requested_count,status,questions_json,created_at) VALUES(?,?,?,?,?,?,?,?,'active',?,?)",
        (
            attempt_id,
            identity.user_id,
            identity.organization_id,
            profile["class"],
            creation_key,
            subject,
            chapter,
            count,
            json.dumps(questions, ensure_ascii=False),
            now_iso(),
        ),
    )
    result = read_attempt(conn, identity, attempt_id)
    conn.commit()
    return result


def submit_attempt(conn, identity, attempt_id, answers):
    conn.execute("BEGIN IMMEDIATE")
    row = _load_attempt(conn, identity, attempt_id)
    questions = json.loads(row["questions_json"])
    if set(answers) != {str(q["id"]) for q in questions} or any(
        not 0 <= answers[str(q["id"])] < len(q["options"]) for q in questions
    ):
        raise PracticeError(422, "Answer every question using one of its option indices")
    encoded = json.dumps(answers, sort_keys=True)
    if row["status"] == "completed":
        if encoded != row["answers_json"]:
            raise PracticeError(409, "This attempt is already completed with different answers")
        return public_attempt(row)
    _check_pending_questions(conn, identity, row)
    items = [
        {
            "question_id": q["id"],
            "is_correct": answers[str(q["id"])] == q["correct_index"],
            "selected_index": answers[str(q["id"])],
            "correct_index": q["correct_index"],
            "explanation": q["explanation"],
        }
        for q in questions
    ]
    score = sum(item["is_correct"] for item in items)
    result = {
        "score": score,
        "total": len(items),
        "items": items,
        "next_action": "Review the teacher explanations, then revisit this topic later. One practice is not proof of mastery.",
    }
    record_progress(conn, identity.user_id, row["chapter"] or row["subject"], score, len(items))
    conn.execute(
        "UPDATE practice_attempts SET status='completed',answers_json=?,result_json=?,submitted_at=? WHERE id=?",
        (encoded, json.dumps(result, ensure_ascii=False), now_iso(), attempt_id),
    )
    conn.execute(
        "INSERT INTO learning_events(user_id,organization_id,event_type,metadata_json,created_at) VALUES(?,?,'reviewed_practice_submitted',?,?)",
        (
            identity.user_id,
            identity.organization_id,
            json.dumps({"attempt_id": attempt_id, "score": score, "total": len(items)}),
            now_iso(),
        ),
    )
    output = read_attempt(conn, identity, attempt_id)
    conn.commit()
    return output
