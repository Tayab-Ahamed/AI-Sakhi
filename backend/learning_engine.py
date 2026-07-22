"""Pure adaptive-learning logic used by API routes and offline evaluations."""
from __future__ import annotations

from datetime import UTC, datetime
from math import exp

MISCONCEPTION_PATTERNS = {
    "sign_error": ("negative", "minus", "sign", "-"),
    "unit_error": ("unit", "cm", "meter", "kg", "second"),
    "formula_selection": ("formula", "equation", "substitute"),
    "concept_confusion": ("confused", "difference", "same as", "means"),
    "incomplete_reasoning": ("because", "therefore", "explain", "reason"),
    "calculation_error": ("calculate", "arithmetic", "multiply", "divide"),
}


def classify_misconception(question: str, answer: str, expected: str, explanation: str = "") -> str:
    """Deterministic fallback classifier; an LLM may enrich but never replace auditability."""
    text = f"{question} {answer} {expected} {explanation}".lower()
    if not answer.strip():
        return "no_attempt"
    for label, terms in MISCONCEPTION_PATTERNS.items():
        if any(term in text for term in terms):
            return label
    if len(answer.split()) < max(2, len(expected.split()) // 3):
        return "incomplete_reasoning"
    return "knowledge_gap"


def mastery_score(attempts: list[dict], now: datetime | None = None) -> dict:
    """Calculate explainable 0–100 mastery using accuracy, difficulty, recency and evidence."""
    if not attempts:
        return {"score": 0.0, "confidence": "low", "attempts": 0, "components": {}}
    now = now or datetime.now(UTC)
    difficulty_weight = {"easy": 0.8, "medium": 1.0, "hard": 1.25}
    weighted, possible, recent_weight = 0.0, 0.0, 0.0
    for item in attempts:
        timestamp = item.get("timestamp")
        try:
            dt = datetime.fromisoformat(timestamp) if timestamp else now
            if dt.tzinfo is None: dt = dt.replace(tzinfo=UTC)
            days = max(0.0, (now - dt).total_seconds() / 86400)
        except Exception:
            days = 30.0
        recency = exp(-days / 30.0)
        diff = difficulty_weight.get(str(item.get("difficulty", "medium")).lower(), 1.0)
        total = max(1.0, float(item.get("total", 1)))
        accuracy = max(0.0, min(1.0, float(item.get("score", 0)) / total))
        hint_penalty = 0.9 if item.get("used_hint") else 1.0
        weight = diff * (0.45 + 0.55 * recency)
        weighted += accuracy * hint_penalty * weight
        possible += weight
        recent_weight += recency
    score = round(100 * weighted / max(possible, 0.001), 1)
    evidence = len(attempts)
    confidence = "high" if evidence >= 5 and recent_weight >= 2.5 else "medium" if evidence >= 3 else "low"
    return {"score": score, "confidence": confidence, "attempts": evidence, "components": {"recent_evidence": round(recent_weight, 2), "weighted_accuracy": score}}


def build_smart_sprint(weak_topic: str | None, active_goal: str | None, due_cards: int, available_minutes: int = 25) -> dict:
    minutes = max(10, min(60, available_minutes))
    topic = weak_topic or active_goal or "your priority subject"
    warmup = max(3, round(minutes * 0.2))
    practice = max(5, round(minutes * 0.55))
    recall = minutes - warmup - practice
    return {
        "title": f"Smart Sprint: {topic}",
        "focus_topic": topic,
        "total_minutes": minutes,
        "reason": "Selected from your weakest recent topic, active goal, and due reviews.",
        "steps": [
            {"kind": "warmup", "minutes": warmup, "label": "Recall the key idea", "action": f"Explain what you already know about {topic}."},
            {"kind": "practice", "minutes": practice, "label": "Focused practice", "action": f"Complete adaptive questions on {topic}."},
            {"kind": "review", "minutes": recall, "label": "Lock it in", "action": f"Review {min(due_cards, 5)} due flashcards." if due_cards else "Write three ideas from memory."},
        ],
    }
