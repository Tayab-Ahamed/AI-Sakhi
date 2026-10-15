"""Shared reviewed-MCQ interpretation; no diagnostic-specific policy."""

import json


def mcq_snapshot(row: dict) -> dict | None:
    """Exclude malformed historical questions instead of guessing an answer key."""
    try:
        options = json.loads(row["options_json"])
    except (ValueError, TypeError, KeyError):
        return None
    if (
        not isinstance(options, list)
        or not 2 <= len(options) <= 10
        or any(not isinstance(o, str) or not o.strip() for o in options)
        or len({o.strip().casefold() for o in options}) != len(options)
    ):
        return None
    answer = str(row["correct_answer"]).strip()
    if len(answer) == 1 and "A" <= answer.upper() < chr(65 + len(options)):
        index = ord(answer.upper()) - 65
    elif answer in options:
        index = options.index(answer)
    else:
        return None
    return {
        "id": row["id"],
        "question_text": row["question_text"],
        "options": options,
        "correct_index": index,
        "explanation": row["explanation"] or "",
    }
