"""
SuperMemo SM-2 spaced repetition algorithm for AI Sakhi.

This module is pure logic with no database or network calls.

Quality scale (student self-rating):
  1 - Forgot completely (Again)
  2 - Remembered with serious difficulty (Hard)
  3 - Remembered with some effort (Okay)
  4 - Remembered easily (Easy)

Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

# SM-2 constants
_MIN_EF = 1.3      # easiness factor never goes below this
_INIT_EF = 2.5     # initial easiness factor for a new card


def sm2_update(
    easiness_factor: float,
    interval_days: int,
    repetitions: int,
    quality: int,
) -> tuple[float, int, int]:
    """
    Apply one SM-2 review step.

    Args:
        easiness_factor: Current EF (2.5 for new cards).
        interval_days:   Current inter-repetition interval in days.
        repetitions:     Number of consecutive successful repetitions (quality >= 3).
        quality:         Student rating 1–4.

    Returns:
        (new_easiness_factor, new_interval_days, new_repetitions)
    """
    quality = max(1, min(4, quality))           # clamp to [1, 4]

    # Update EF using the SM-2 formula (adapted for 1-4 scale → 0-5 scale)
    q5 = (quality - 1) * (5 / 3)               # map 1-4 to 0-5
    new_ef = easiness_factor + (0.1 - (5 - q5) * (0.08 + (5 - q5) * 0.02))
    new_ef = max(_MIN_EF, round(new_ef, 3))

    if quality < 3:
        # Forgot — reset repetition counter, review again soon
        new_repetitions = 0
        new_interval = 1
    else:
        # Remembered — advance the schedule
        new_repetitions = repetitions + 1
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = max(1, round(interval_days * new_ef))

    return new_ef, new_interval, new_repetitions


def next_review_iso(interval_days: int) -> str:
    """Return an ISO 8601 UTC timestamp for `interval_days` from now."""
    return (
        datetime.now(UTC).replace(microsecond=0) + timedelta(days=interval_days)
    ).isoformat()


def initial_review_state() -> dict:
    """Return the default review state for a brand-new flashcard."""
    return {
        "easiness_factor": _INIT_EF,
        "interval_days": 1,
        "repetitions": 0,
        "next_review_at": next_review_iso(1),   # due tomorrow
        "last_reviewed_at": None,
        "total_reviews": 0,
    }


def quality_label(quality: int) -> str:
    """Human-readable label for a quality rating."""
    return {1: "Forgot", 2: "Hard", 3: "Okay", 4: "Easy"}.get(quality, "Unknown")
