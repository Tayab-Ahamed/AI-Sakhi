"""
Phase 15 — AI Study Notes Generator
Generates structured markdown study notes for a given topic using Groq LLM.
"""
from __future__ import annotations

import os
from groq import Groq
from backend.config import GROQ_MODEL


NOTE_SYSTEM_PROMPT = """You are Sakhi, a patient and knowledgeable tutor for Indian students (KG to Class 12).
Generate clear, structured study notes in the following markdown format:

# [Topic Name]

## 📌 Key Concepts
- Bullet points of the most important ideas

## 🔍 Explanation
A clear, friendly explanation in 3-5 paragraphs. Use simple language and relatable analogies.

## 📊 Important Facts & Formulas
- List key facts, dates, formulas, or definitions

## 💡 Examples
Provide 2-3 concrete examples or solved problems

## 🔗 How It Connects
Brief paragraph on how this topic connects to other subjects or real life

## ❓ Quick Review Questions
5 short questions to test understanding (no answers — for self-quiz)

Keep the language friendly and encouraging. Use Indian educational context where relevant.
Respond ONLY with the markdown — no preamble."""


async def generate_study_notes(
    topic: str,
    class_: str = "8",
    language: str = "English",
    subject: str = "",
) -> str:
    """
    Generate structured markdown study notes for the given topic.
    Returns the raw markdown string.
    """
    client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
    subject_hint = f" (Subject: {subject})" if subject else ""
    user_msg = f"Create study notes for Class {class_} students on: {topic}{subject_hint}"

    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": NOTE_SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        temperature=0.4,
        max_tokens=1800,
    )
    return resp.choices[0].message.content or ""
