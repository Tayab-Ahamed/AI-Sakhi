"""
Quiz generation and evaluation for AI Sakhi.
Generates 5-question MCQs via Groq and evaluates student answers.
"""
from __future__ import annotations

import json
import re

from groq import Groq

from backend.config import GROQ_API_KEY, GROQ_MODEL
from backend.language import is_text_compatible_with_language, language_instruction, normalize_language

client = Groq(api_key=GROQ_API_KEY)

QUIZ_SYSTEM = (
    "You are a quiz generator for Indian school students. "
    "Return only valid JSON with no markdown and no extra text."
)

DIFFICULTY_INSTRUCTIONS = {
    "easy":   "Questions should test basic recall and definitions. Use straightforward language. Each question should have one obviously correct answer.",
    "medium": "Questions should test understanding and application. Include scenario-based questions with plausible distractors.",
    "hard":   "Questions should test analysis, reasoning, and deep understanding. Include multi-step logic and conceptual traps.",
}

QUIZ_PROMPT = """Generate exactly 5 multiple-choice questions about "{topic}" for a Class {class_} student.

Difficulty level: {difficulty_upper} — {difficulty_instruction}

Return ONLY this JSON structure:
{{
  "topic": "{topic}",
  "language": "{language}",
  "questions": [
    {{
      "id": 1,
      "question": "Question text?",
      "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "correct": "A",
      "hint": "A guiding hint that does not reveal the answer",
      "explanation": "One simple sentence explaining why this is correct"
    }}
  ]
}}

Rules:
- NCERT or school-level Class {class_} only
- All visible student-facing text must be in {language}
- Use simple, clear language
- Make questions interesting using real-world Indian examples where possible
- Hints must be encouraging, not shaming
- All 5 questions must be present
- {language_instruction}
"""


def generate_quiz(topic: str, class_: str = "8", language: str = "English", difficulty: str = "medium") -> dict:
    """Generate a 5-question MCQ quiz. Returns dict with 'success' and 'quiz' or 'error'."""
    selected_language = normalize_language(language)
    diff = difficulty.lower() if difficulty.lower() in DIFFICULTY_INSTRUCTIONS else "medium"
    prompt = QUIZ_PROMPT.format(
        topic=topic,
        class_=class_,
        language=selected_language,
        language_instruction=language_instruction(selected_language),
        difficulty_upper=diff.upper(),
        difficulty_instruction=DIFFICULTY_INSTRUCTIONS[diff],
    )
    def _call(messages: list[dict]) -> dict:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=1800,
            temperature=0.5,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)

    try:
        messages = [
            {"role": "system", "content": QUIZ_SYSTEM},
            {"role": "user", "content": prompt},
        ]
        quiz = _call(messages)
        visible_text = " ".join(
            [quiz.get("topic", "")]
            + [
                " ".join([
                    q.get("question", ""),
                    " ".join(q.get("options", {}).values()),
                    q.get("hint", ""),
                    q.get("explanation", ""),
                ])
                for q in quiz.get("questions", [])
            ]
        )
        if not is_text_compatible_with_language(visible_text, selected_language):
            retry_messages = messages + [
                {
                    "role": "user",
                    "content": (
                        f"The quiz text was not fully in {selected_language}. "
                        f"Regenerate the full quiz in proper {selected_language} only, including the correct script."
                    ),
                }
            ]
            quiz = _call(retry_messages)
        return {"success": True, "quiz": quiz}
    except json.JSONDecodeError:
        return {"success": False, "error": "Could not parse quiz JSON. Please try again."}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def evaluate_answer(question: dict, user_answer: str, language: str = "English") -> dict:
    """Evaluate a single MCQ answer and return feedback."""
    selected_language = normalize_language(language)
    correct = question.get("correct", "").upper()
    given = user_answer.upper().strip()
    is_correct = given == correct
    explanation = question.get("explanation", "")

    if selected_language == "Hindi":
        feedback = f"बहुत बढ़िया! {explanation}" if is_correct else f"लगभग सही! सही उत्तर **{correct}** है। {explanation}"
    elif selected_language == "Kannada":
        feedback = f"ಚೆನ್ನಾಗಿದೆ! {explanation}" if is_correct else f"ಬಹುತೇಕ ಸರಿಯೇ! ಸರಿಯಾದ ಉತ್ತರ **{correct}**. {explanation}"
    elif selected_language == "Tamil":
        feedback = f"சிறப்பு! {explanation}" if is_correct else f"கிட்டத்தட்ட சரி! சரியான பதில் **{correct}**. {explanation}"
    elif selected_language == "Hinglish":
        feedback = f"Bilkul sahi! {explanation}" if is_correct else f"Almost there! Sahi answer **{correct}** hai. {explanation}"
    else:
        feedback = f"Correct! {explanation}" if is_correct else f"Almost there! The correct answer is **{correct}**. {explanation}"

    return {
        "is_correct": is_correct,
        "feedback": feedback,
        "correct_answer": correct,
    }
