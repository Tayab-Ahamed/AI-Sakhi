"""
Personalized 20-minute study plan generator for AI Sakhi.
"""
from __future__ import annotations

import json
import re

from groq import Groq

from backend.config import GROQ_API_KEY, GROQ_MODEL
from backend.language import is_text_compatible_with_language, language_instruction, normalize_language

client = Groq(api_key=GROQ_API_KEY)

PLAN_SYSTEM = (
    "You are a study plan creator for Indian school students. "
    "Return only valid JSON with no markdown and no extra text."
)

PLAN_PROMPT = """Create a focused 20-minute study plan for a Class {class_} student studying "{topic}" in {subject}.

Return ONLY this JSON:
{{
  "topic": "{topic}",
  "subject": "{subject}",
  "class": "{class_}",
  "language": "{language}",
  "duration_minutes": 20,
  "goal": "One sentence: what the student will achieve today",
  "sections": [
    {{
      "time": "0-7 min",
      "title": "Concept Overview",
      "content": "2-3 sentence simple explanation",
      "example": "One relatable Indian daily-life example"
    }},
    {{
      "time": "8-14 min",
      "title": "Practice Questions",
      "questions": ["Question 1", "Question 2", "Question 3"]
    }},
    {{
      "time": "15-20 min",
      "title": "Quick Recap",
      "key_points": ["Key point 1", "Key point 2", "Key point 3"]
    }}
  ],
  "motivation": "A warm, encouraging closing message for the student"
}}

Rules:
- NCERT or school-level Class {class_}
- All visible student-facing text must be in {language}
- Simple language, relatable Indian examples
- Warm and encouraging tone
- {language_instruction}
"""


def generate_study_plan(topic: str, subject: str, class_: str = "8", language: str = "English") -> dict:
    """Generate a structured 20-minute study plan."""
    selected_language = normalize_language(language)
    prompt = PLAN_PROMPT.format(
        topic=topic,
        subject=subject,
        class_=class_,
        language=selected_language,
        language_instruction=language_instruction(selected_language),
    )
    def _call(messages: list[dict]) -> dict:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=1400,
            temperature=0.6,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)

    try:
        messages = [
            {"role": "system", "content": PLAN_SYSTEM},
            {"role": "user", "content": prompt},
        ]
        plan = _call(messages)
        visible_parts = [
            plan.get("topic", ""),
            plan.get("subject", ""),
            plan.get("goal", ""),
            plan.get("motivation", ""),
        ]
        for section in plan.get("sections", []):
            visible_parts.extend(
                [
                    section.get("title", ""),
                    section.get("content", ""),
                    section.get("example", ""),
                    " ".join(section.get("questions", [])),
                    " ".join(section.get("key_points", [])),
                ]
            )
        if not is_text_compatible_with_language(" ".join(visible_parts), selected_language):
            retry_messages = messages + [
                {
                    "role": "user",
                    "content": (
                        f"The study plan was not fully in {selected_language}. "
                        f"Regenerate it fully in proper {selected_language} only, including the correct script."
                    ),
                }
            ]
            plan = _call(retry_messages)
        return {"success": True, "plan": plan}
    except json.JSONDecodeError:
        return {"success": False, "error": "Could not parse study plan. Please try again."}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
