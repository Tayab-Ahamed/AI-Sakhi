"""
Language selection, detection, and enforcement helpers for AI Sakhi.
"""
from __future__ import annotations

import re

SUPPORTED_LANGUAGES = {"english", "hindi", "hinglish", "kannada", "tamil"}
SCRIPT_RANGES = {
    "hindi": (0x0900, 0x097F),
    "kannada": (0x0C80, 0x0CFF),
    "tamil": (0x0B80, 0x0BFF),
}

HINGLISH_MARKERS = {
    "kya", "kaise", "kyun", "samjhao", "samjha", "samajh", "mujhe",
    "mera", "meri", "maths", "acha", "accha", "nahi", "haan", "karna",
    "karo", "please", "homework", "jaldi", "thoda", "simple", "exam",
}


def normalize_language(language: str | None) -> str:
    value = (language or "").strip().lower()
    if value in SUPPORTED_LANGUAGES:
        return value.title() if value != "hinglish" else "Hinglish"
    aliases = {
        "en": "English",
        "eng": "English",
        "hi": "Hindi",
        "kn": "Kannada",
        "ta": "Tamil",
    }
    return aliases.get(value, "English")


def detect_language(text: str) -> str:
    if not text:
        return "English"

    counts = {name: 0 for name in SCRIPT_RANGES}
    for ch in text:
        code = ord(ch)
        for name, (start, end) in SCRIPT_RANGES.items():
            if start <= code <= end:
                counts[name] += 1

    for name, count in counts.items():
        if count >= 2:
            return name.title()

    lowered = text.lower()
    tokens = set(re.findall(r"[a-zA-Z']+", lowered))
    if tokens & HINGLISH_MARKERS:
        return "Hinglish"

    return "English"


def choose_response_language(selected_language: str | None, user_message: str) -> str:
    selected = normalize_language(selected_language)
    detected = detect_language(user_message)

    if detected in {"Hindi", "Kannada", "Tamil"}:
        return detected
    if detected == "Hinglish" and selected in {"Hindi", "Hinglish", "English"}:
        return "Hinglish"
    return selected


def language_instruction(language: str) -> str:
    extra_rules = {
        "Hindi": (
            "Write primarily in natural Hindi using Devanagari script. "
            "Do not write Hindi using English letters unless the student explicitly requests Hinglish."
        ),
        "Kannada": (
            "Write in natural Kannada using Kannada script. "
            "Do not transliterate Kannada into English letters."
        ),
        "Tamil": (
            "Write in natural Tamil using Tamil script. "
            "Do not transliterate Tamil into English letters."
        ),
        "Hinglish": (
            "Write in natural Hinglish using mostly English letters with a Hindi-speaking tone. "
            "Do not switch into fully formal English."
        ),
        "English": "Write in simple, natural English.",
    }
    style_rule = extra_rules.get(language, "Write in the requested language naturally.")
    return (
        f"You must ALWAYS respond in {language}. "
        "Never switch to English unless the student explicitly asks for English or translation fails. "
        "If the student mixes Hindi and English, respond naturally in Hinglish when appropriate. "
        f"{style_rule} "
        "Keep explanations culturally natural, beginner-friendly, and emotionally supportive."
    )


def is_text_compatible_with_language(text: str, language: str) -> bool:
    normalized = normalize_language(language)
    if not text.strip():
        return False

    detected = detect_language(text)
    if normalized == "English":
        return detected in {"English", "Hinglish"}
    if normalized == "Hinglish":
        return detected in {"Hinglish", "English"}
    if normalized in {"Hindi", "Kannada", "Tamil"}:
        return detected == normalized
    return True
