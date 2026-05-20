"""
Practice Paper Generator — AI Sakhi
Generates structured exam papers with sections, marks, and model answers.
"""
from __future__ import annotations

import json
import re

from groq import Groq

from backend.config import GROQ_API_KEY, GROQ_MODEL

client = Groq(api_key=GROQ_API_KEY)


def generate_practice_paper(
    topic: str,
    class_: str = "9",
    subject: str = "Science",
    language: str = "English",
    num_questions: int = 10,
) -> dict:
    """
    Generate a full practice exam paper with sections (MCQ, Short Answer, Long Answer).
    Returns a structured dict with title, total_marks, sections.
    """
    prompt = f"""You are an expert Indian school exam paper setter for CBSE/State Board curriculum.

Generate a practice exam paper for:
- Topic: {topic}
- Subject: {subject}
- Class: {class_}
- Language: {language}
- Total Questions: {num_questions}

Return ONLY valid JSON in this exact structure:
{{
  "title": "Practice Paper: {topic}",
  "subject": "{subject}",
  "class_": "{class_}",
  "total_marks": <number>,
  "time_allowed": "<e.g. 1 hour>",
  "general_instructions": ["<instruction 1>", "<instruction 2>", "<instruction 3>"],
  "sections": [
    {{
      "name": "Section A — Multiple Choice Questions",
      "marks_per_question": 1,
      "instructions": "Choose the correct option.",
      "questions": [
        {{
          "number": 1,
          "question": "<question text>",
          "options": ["A) <option>", "B) <option>", "C) <option>", "D) <option>"],
          "marks": 1,
          "model_answer": "<correct option letter and explanation>"
        }}
      ]
    }},
    {{
      "name": "Section B — Short Answer Questions",
      "marks_per_question": 2,
      "instructions": "Answer in 2-3 sentences.",
      "questions": [
        {{
          "number": <n>,
          "question": "<question text>",
          "options": null,
          "marks": 2,
          "model_answer": "<concise model answer>"
        }}
      ]
    }},
    {{
      "name": "Section C — Long Answer Questions",
      "marks_per_question": 5,
      "instructions": "Answer in detail with examples.",
      "questions": [
        {{
          "number": <n>,
          "question": "<question text>",
          "options": null,
          "marks": 5,
          "model_answer": "<detailed model answer with key points>"
        }}
      ]
    }}
  ]
}}

Distribute questions roughly: 4-5 MCQs, 3-4 Short Answer, 2-3 Long Answer.
All questions must be NCERT-aligned and appropriate for Class {class_}.
Return ONLY the JSON object, no markdown, no explanation."""

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
            temperature=0.4,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        paper = json.loads(raw)
        return {"success": True, "paper": paper}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"JSON parse error: {str(e)}", "raw": raw[:500]}
    except Exception as e:
        return {"success": False, "error": str(e)}
