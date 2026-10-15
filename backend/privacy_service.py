"""Find and erase learner data in one transaction; no production filesystem writes."""

import json

from backend.db import now_iso
from backend.diagnostic_privacy import erase_diagnostics, export_diagnostics


def export_data(conn, user_id: int) -> dict:
    def rows(table, key="user_id"):
        # Table/column names come only from this module's fixed allowlist.
        return [dict(row) for row in conn.execute(f"SELECT * FROM {table} WHERE {key}=?", (user_id,))]  # noqa: S608 - fixed SQL fragments/identifiers; values are bound

    profile = dict(conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())
    profile.pop("password_hash", None)
    data = {"generated_at": now_iso(), "profile": profile}
    for table in (
        "progress",
        "learning_events",
        "learning_goals",
        "goal_checkins",
        "misconceptions",
        "mastery_snapshots",
        "answer_feedback",
        "artifacts",
        "flashcard_reviews",
        "chat_messages",
        "privacy_requests",
        "ai_approvals",
    ):
        data[table] = rows(table)
    sessions = rows("chat_sessions")
    for session in sessions:
        session["messages"] = [
            m for m in json.loads(session.pop("messages_json")) if m.get("role") in {"user", "assistant"}
        ]
        session.pop("profile_json", None)
    data["chat_sessions"] = sessions
    data["assignment_submissions"] = rows("assignment_submissions", "student_id")
    data["authored_assignments"] = rows("assignments", "teacher_id")
    data["authored_questions"] = rows("question_bank", "created_by")
    from backend.practice_service import public_questions

    data["practice_attempts"] = rows("practice_attempts")
    for attempt in data["practice_attempts"]:
        attempt["questions"] = public_questions(json.loads(attempt.pop("questions_json")))
    data["guardian_digests"] = [
        dict(r)
        for r in conn.execute(
            "SELECT * FROM guardian_digests WHERE child_id=? OR parent_id=?", (user_id, user_id)
        )
    ]
    data["safety_events"] = [
        {"category": r["category"], "severity": r["severity"], "created_at": r["created_at"]}
        for r in conn.execute("SELECT * FROM safety_events WHERE user_id=?", (user_id,))
    ]
    data.update(export_diagnostics(conn, user_id))
    return data


def erase_chat_history(conn, user_id: int):
    conn.execute(
        "DELETE FROM artifacts WHERE user_id=? AND (artifact_type='chat_answer' OR source_session_id IN (SELECT session_id FROM chat_sessions WHERE user_id=?))",
        (user_id, user_id),
    )
    conn.execute(
        "DELETE FROM chat_messages WHERE user_id=? OR session_id IN (SELECT session_id FROM chat_sessions WHERE user_id=?)",
        (user_id, user_id),
    )
    conn.execute("DELETE FROM chat_sessions WHERE user_id=?", (user_id,))


def erase_account(conn, user_id: int):
    erase_diagnostics(conn, user_id)
    erase_chat_history(conn, user_id)
    for table in (
        "progress",
        "learning_events",
        "goal_checkins",
        "learning_goals",
        "misconceptions",
        "mastery_snapshots",
        "answer_feedback",
        "artifacts",
        "flashcard_reviews",
        "auth_tokens",
        "safety_events",
        "ai_approvals",
        "practice_attempts",
    ):
        conn.execute(f"DELETE FROM {table} WHERE user_id=?", (user_id,))  # noqa: S608 - fixed SQL fragments/identifiers; values are bound
    conn.execute("DELETE FROM guardian_digests WHERE child_id=? OR parent_id=?", (user_id, user_id))
    conn.execute(
        "DELETE FROM assignment_submissions WHERE student_id=? OR assignment_id IN (SELECT id FROM assignments WHERE teacher_id=?)",
        (user_id, user_id),
    )
    conn.execute("DELETE FROM assignments WHERE teacher_id=?", (user_id,))
    conn.execute("DELETE FROM question_bank WHERE created_by=?", (user_id,))
    conn.execute("UPDATE question_bank SET reviewed_by=NULL WHERE reviewed_by=?", (user_id,))
    conn.execute("DELETE FROM role_invites WHERE created_by=? OR used_by=?", (user_id, user_id))
    conn.execute("UPDATE users SET parent_id=NULL WHERE parent_id=?", (user_id,))
    conn.execute("UPDATE ai_approvals SET actor_id=NULL WHERE actor_id=?", (user_id,))
    conn.execute(
        "UPDATE audit_log SET user_id=NULL, ip_hash=NULL, path='[erased]' WHERE user_id=?", (user_id,)
    )
    # Retain only an opaque, inactive tombstone so request receipts remain valid.
    conn.execute(
        "UPDATE users SET name=?,password_hash=NULL,email=NULL,class='',language='English',weak_subject='',parent_id=NULL,organization_id=NULL,is_active=0,processing_restricted=1 WHERE id=?",
        (f"Deleted account {user_id}", user_id),
    )
    conn.execute("UPDATE privacy_requests SET review_note=NULL WHERE user_id=?", (user_id,))
