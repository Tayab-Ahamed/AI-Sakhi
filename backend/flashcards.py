"""
Flashcard generation for AI Sakhi.
Creates short study cards for school topics.
"""
from __future__ import annotations

import json
import re

from groq import Groq

from backend.config import GROQ_API_KEY, GROQ_MODEL
from backend.language import is_text_compatible_with_language, language_instruction, normalize_language

client = Groq(api_key=GROQ_API_KEY)

FLASHCARD_SYSTEM = (
    "You are a flashcard generator for Indian school students. "
    "Return only valid JSON with no markdown and no extra text."
)

FLASHCARD_PROMPT = """Create exactly 6 study flashcards about "{topic}" for a Class {class_} student.

Return ONLY this JSON structure:
{{
  "topic": "{topic}",
  "class": "{class_}",
  "language": "{language}",
  "cards": [
    {{
      "id": 1,
      "front": "Short question or prompt",
      "back": "Short clear answer in 1-3 sentences",
      "hint": "Tiny memory cue"
    }}
  ]
}}

Rules:
- NCERT or school-level Class {class_} only
- All visible student-facing text must be in {language}
- Keep each card concise and memorable
- Cover definitions, examples, and key concepts
- Use simple language with confidence-building wording
- All 6 cards must be present
- {language_instruction}
"""


def generate_flashcards(topic: str, class_: str = "8", language: str = "English") -> dict:
    selected_language = normalize_language(language)
    prompt = FLASHCARD_PROMPT.format(
        topic=topic,
        class_=class_,
        language=selected_language,
        language_instruction=language_instruction(selected_language),
    )

    def _call(messages: list[dict]) -> dict:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=1400,
            temperature=0.5,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)

    try:
        messages = [
            {"role": "system", "content": FLASHCARD_SYSTEM},
            {"role": "user", "content": prompt},
        ]
        deck = _call(messages)
        visible_text = " ".join(
            [deck.get("topic", "")]
            + [
                " ".join([
                    card.get("front", ""),
                    card.get("back", ""),
                    card.get("hint", ""),
                ])
                for card in deck.get("cards", [])
            ]
        )
        if not is_text_compatible_with_language(visible_text, selected_language):
            retry_messages = messages + [
                {
                    "role": "user",
                    "content": (
                        f"The flashcards were not fully in {selected_language}. "
                        f"Regenerate them fully in proper {selected_language} only, including the correct script."
                    ),
                }
            ]
            deck = _call(retry_messages)
        return {"success": True, "flashcards": deck}
    except json.JSONDecodeError:
        return {"success": False, "error": "Could not parse flashcards JSON. Please try again."}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
