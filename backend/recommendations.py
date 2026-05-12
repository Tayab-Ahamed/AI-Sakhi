"""
Learning path recommendation engine for AI Sakhi.

Cross-references the user's quiz history with curriculum.json to suggest:
  1. next_topics  — 3 unattempted topics in curriculum order
  2. retry_topic  — the single weakest previously attempted topic
"""
from __future__ import annotations

import json
import os
import sqlite3

from backend.config import DB_PATH

# Load curriculum once at import time
_CURRICULUM_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "curriculum", "curriculum.json"
)

def _load_curriculum() -> dict:
    try:
        with open(_CURRICULUM_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"topics": {}, "subjects": []}

_CURRICULUM = _load_curriculum()


def _get_user(user_id: int) -> dict | None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def _get_progress(user_id: int) -> list[dict]:
    """Return all progress rows for the user, most recent first."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT topic, score, total, timestamp FROM progress WHERE user_id = ? ORDER BY timestamp DESC",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _subject_label(subject_id: str) -> str:
    for s in _CURRICULUM.get("subjects", []):
        if s.get("id") == subject_id:
            return s.get("label", subject_id)
    return subject_id.replace("_", " ").title()


def get_recommendations(user_id: int) -> dict:
    """
    Return learning path recommendations for the given user.

    Response shape:
    {
      "next_topics": [
        {"topic": str, "subject": str, "subject_id": str, "reason": str},
        ...
      ],
      "retry_topic": {
        "topic": str, "subject": str, "subject_id": str,
        "score_pct": float, "reason": str
      } | None,
      "has_history": bool
    }
    """
    user = _get_user(user_id)
    if not user:
        return {"next_topics": [], "retry_topic": None, "has_history": False}

    class_ = str(user.get("class", user.get("class_", "8")))
    weak_subject = str(user.get("weak_subject", "")).strip().lower()
    progress = _get_progress(user_id)

    # Build sets of attempted topics (case-insensitive)
    attempted: dict[str, float] = {}   # topic_lower -> best_pct
    for row in progress:
        total = row.get("total") or 0
        if total > 0:
            pct = round((row["score"] / total) * 100, 1)
            key = row["topic"].strip().lower()
            attempted[key] = max(attempted.get(key, 0.0), pct)

    topics_data = _CURRICULUM.get("topics", {})

    # ── Collect next (unattempted) topics ──────────────────────────────
    next_topics: list[dict] = []
    # Prioritise the user's weak subject first, then all other subjects
    subject_order: list[str] = []
    for sub_id in topics_data:
        class_topics = topics_data[sub_id].get(class_)
        if not class_topics:
            continue
        if weak_subject and weak_subject in sub_id.lower():
            subject_order.insert(0, sub_id)
        else:
            subject_order.append(sub_id)

    for sub_id in subject_order:
        class_topics = topics_data.get(sub_id, {}).get(class_, [])
        label = _subject_label(sub_id)
        for t in class_topics:
            if t.strip().lower() not in attempted:
                reason = f"Next topic in Class {class_} {label}"
                next_topics.append({
                    "topic": t,
                    "subject": label,
                    "subject_id": sub_id,
                    "reason": reason,
                })
            if len(next_topics) >= 3:
                break
        if len(next_topics) >= 3:
            break

    # ── Find the weakest attempted topic ──────────────────────────────
    retry_topic = None
    if attempted:
        weakest_key = min(attempted, key=lambda k: attempted[k])
        weakest_pct = attempted[weakest_key]
        # Find original casing from progress rows
        original_name = weakest_key
        for row in progress:
            if row["topic"].strip().lower() == weakest_key:
                original_name = row["topic"].strip()
                break
        # Find which subject this topic belongs to
        retry_subject = "General"
        retry_subject_id = ""
        for sub_id, class_map in topics_data.items():
            for cls, tlist in class_map.items():
                if any(t.strip().lower() == weakest_key for t in tlist):
                    retry_subject = _subject_label(sub_id)
                    retry_subject_id = sub_id
                    break
        retry_topic = {
            "topic": original_name,
            "subject": retry_subject,
            "subject_id": retry_subject_id,
            "score_pct": weakest_pct,
            "reason": f"You scored {weakest_pct:.0f}% — a quick revision will help! 💪",
        }

    return {
        "next_topics": next_topics,
        "retry_topic": retry_topic,
        "has_history": bool(attempted),
    }
