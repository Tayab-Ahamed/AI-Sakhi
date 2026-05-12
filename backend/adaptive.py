"""
Adaptive difficulty engine for AI Sakhi.

Looks at a user's recent quiz history (optionally for a specific topic)
and recommends the appropriate quiz difficulty: easy, medium, or hard.

Thresholds (based on average percentage):
  >= 80%  -> hard
  >= 55%  -> medium
  <  55%  -> easy
"""
from __future__ import annotations

import sqlite3

from backend.config import DB_PATH

_WINDOW = 5          # how many recent scores to look at
_HARD_THRESHOLD   = 80.0
_MEDIUM_THRESHOLD = 55.0


def _get_recent_scores(user_id: int, topic: str | None = None, limit: int = _WINDOW) -> list[float]:
    """
    Return the most recent quiz percentage scores for a user.
    If `topic` is given, filters to that topic only; otherwise uses all topics.
    Returns percentages in [0.0, 100.0].
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if topic:
        rows = cur.execute(
            """
            SELECT score, total FROM progress
            WHERE user_id = ? AND lower(topic) = lower(?)
            ORDER BY timestamp DESC LIMIT ?
            """,
            (user_id, topic.strip(), limit),
        ).fetchall()
    else:
        rows = cur.execute(
            """
            SELECT score, total FROM progress
            WHERE user_id = ?
            ORDER BY timestamp DESC LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    conn.close()
    percentages: list[float] = []
    for row in rows:
        total = row["total"]
        if total and total > 0:
            percentages.append(round((row["score"] / total) * 100, 1))
    return percentages


def get_recommended_difficulty(user_id: int, topic: str | None = None) -> str:
    """
    Return 'easy', 'medium', or 'hard' based on recent quiz performance.
    Falls back to 'medium' when there is no history.
    """
    scores = _get_recent_scores(user_id, topic=topic)
    if not scores:
        # No history for this topic — try global scores for a general sense
        if topic:
            scores = _get_recent_scores(user_id, topic=None)
        if not scores:
            return "medium"

    avg = sum(scores) / len(scores)
    if avg >= _HARD_THRESHOLD:
        return "hard"
    if avg >= _MEDIUM_THRESHOLD:
        return "medium"
    return "easy"


def get_difficulty_context(user_id: int, topic: str | None = None) -> dict:
    """
    Return full context for the frontend: recommended difficulty,
    the scores used, and how many data points were found.
    """
    topic_scores = _get_recent_scores(user_id, topic=topic) if topic else []
    global_scores = _get_recent_scores(user_id, topic=None)
    scores_used = topic_scores if topic_scores else global_scores
    avg = round(sum(scores_used) / len(scores_used), 1) if scores_used else None

    return {
        "recommended": get_recommended_difficulty(user_id, topic=topic),
        "average_pct": avg,
        "data_points": len(scores_used),
        "topic_specific": bool(topic_scores),
    }
