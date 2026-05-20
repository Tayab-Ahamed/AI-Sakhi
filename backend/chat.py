"""
Core chat module for AI Sakhi.
Handles Groq LLM calls with strict system prompt, session persistence, and RAG context injection.
"""
from __future__ import annotations

from groq import Groq

from backend.config import GROQ_API_KEY, GROQ_MODEL
from backend.db import clear_chat_session, load_chat_session, log_event, save_chat_session, touch_user_activity
from backend.language import (
    choose_response_language,
    is_text_compatible_with_language,
    language_instruction,
    normalize_language,
)
from backend.rag import is_rag_ready, retrieve_context

client = Groq(api_key=GROQ_API_KEY)

BASE_SYSTEM_PROMPT = """You are AI Sakhi, a warm and encouraging learning companion for Indian school girls from Kindergarten to Class 12 and PUC.

STRICT RULES - follow every single one:
1. BREVITY: Maximum 4-5 sentences unless the student explicitly asks for more detail.
2. SIMPLE LANGUAGE: Explain like talking to a 12-year-old. Avoid jargon.
3. ONE EXAMPLE: Give exactly one relatable Indian daily-life example per concept.
4. NEVER shame mistakes. Never say "Wrong" or "Incorrect".
5. If a student makes a mistake, say "Almost there! Let's try together" and guide gently.
6. Be emotionally warm and confidence-building.
7. Encourage girls in STEM and academics with natural, sincere support.
8. Stay within the student's class level and common Indian school syllabus scope.
9. If uncertain, say "Let me think with you - what did your teacher say about this?"
10. Use emojis sparingly, at most 1-2 per response.

TONE: Warm elder sister, emotionally supportive tutor, never robotic, never condescending."""


def build_system_prompt(language: str, class_: str, user_name: str = "", weak_subject: str = "") -> str:
    profile = [f"Student class: {class_}."]
    if user_name:
        profile.append(f"Student name: {user_name}.")
    if weak_subject:
        profile.append(f"Priority support subject: {weak_subject}.")
    return (
        f"{BASE_SYSTEM_PROMPT}\n\n"
        f"{' '.join(profile)}\n"
        f"{language_instruction(language)}\n"
        "If the selected language is Hindi, Kannada, or Tamil, keep the answer in that script throughout unless a key technical term is better known in English."
    )


def get_session(
    session_id: str,
    language: str = "English",
    class_: str = "8",
    user_name: str = "",
    weak_subject: str = "",
    user_id: int | None = None,
    organization_id: int | None = None,
) -> dict:
    selected_language = normalize_language(language)
    existing = load_chat_session(session_id)
    if not existing:
        session = {
            "messages": [{"role": "system", "content": build_system_prompt(selected_language, class_, user_name, weak_subject)}],
            "profile": {
                "selected_language": selected_language,
                "response_language": selected_language,
                "class_": class_,
                "user_name": user_name,
                "weak_subject": weak_subject,
                "user_id": user_id,
                "organization_id": organization_id,
            },
        }
        save_chat_session(session_id, session["messages"], session["profile"])
        return session

    profile = existing["profile"]
    profile["selected_language"] = selected_language
    profile["class_"] = class_
    profile["user_name"] = user_name or profile.get("user_name", "")
    profile["weak_subject"] = weak_subject or profile.get("weak_subject", "")
    profile["user_id"] = user_id or profile.get("user_id")
    profile["organization_id"] = organization_id or profile.get("organization_id")
    existing["messages"][0] = {
        "role": "system",
        "content": build_system_prompt(
            profile["selected_language"],
            profile["class_"],
            profile["user_name"],
            profile["weak_subject"],
        ),
    }
    save_chat_session(session_id, existing["messages"], existing["profile"])
    return existing


def clear_session(session_id: str):
    clear_chat_session(session_id)


def _request_completion(messages: list[dict]) -> str:
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        max_tokens=500,
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()


def _generate_validated_response(messages: list[dict], response_language: str) -> str:
    first = _request_completion(messages)
    if is_text_compatible_with_language(first, response_language):
        return first

    retry_messages = messages + [
        {"role": "assistant", "content": first},
        {
            "role": "user",
            "content": (
                f"Your previous answer drifted out of {response_language}. "
                f"Please answer again fully in {response_language}. "
                "Keep the meaning the same, stay concise, and use the correct script/style."
            ),
        },
    ]
    second = _request_completion(retry_messages)
    return second


def chat(
    session_id: str,
    user_message: str,
    class_: str = "8",
    simplify: bool = False,
    selected_language: str = "English",
    user_name: str = "",
    weak_subject: str = "",
    translate_to: str | None = None,
    user_id: int | None = None,
    organization_id: int | None = None,
) -> str:
    """
    Main chat function.
    - Injects RAG context if available.
    - If simplify=True, rewrites the last response at a lower level.
    - If translate_to is provided, translates the previous assistant answer.
    """
    session = get_session(session_id, selected_language, class_, user_name, weak_subject, user_id, organization_id)
    messages = session["messages"]
    response_language = normalize_language(translate_to) if translate_to else choose_response_language(selected_language, user_message)
    session["profile"]["response_language"] = response_language

    if translate_to:
        prompt = (
            f"Translate your previous assistant answer into {response_language}. "
            "Preserve formatting, bullets, markdown, and line breaks. Do not add new information. "
            f"{language_instruction(response_language)}"
        )
        stored_user_message = f"[Translate previous answer to {response_language}]"
    elif simplify:
        prompt = (
            "Please re-explain your last answer much more simply. "
            "Imagine explaining to a 10-year-old. Use an even easier example. "
            f"Keep it to 3 sentences max. {language_instruction(response_language)}"
        )
        stored_user_message = f"[Simplify previous answer in {response_language}]"
    else:
        context = retrieve_context(user_message) if is_rag_ready() else ""
        if context:
            prompt = (
                f"Relevant NCERT textbook content:\n---\n{context}\n---\n\n"
                f"Based on the above, answer this Class {class_} student's question in {response_language}:\n"
                f"{user_message}\n\n"
                f"Remember: short answer, one example, warm tone. {language_instruction(response_language)}"
            )
        else:
            prompt = f"{language_instruction(response_language)}\n\nStudent message:\n{user_message}"
        stored_user_message = user_message

    model_messages = messages + [{"role": "user", "content": prompt}]

    try:
        ai_response = _generate_validated_response(model_messages, response_language)
        messages.append({"role": "user", "content": stored_user_message})
        messages.append({"role": "assistant", "content": ai_response})

        if len(messages) > 21:
            messages = [messages[0]] + messages[-20:]

        session["messages"] = messages
        save_chat_session(session_id, session["messages"], session["profile"])
        touch_user_activity(user_id)
        log_event(
            "chat_message",
            user_id=user_id,
            session_id=session_id,
            metadata={
                "language": response_language,
                "simplify": simplify,
                "translate": bool(translate_to),
                "has_rag_context": bool(not simplify and not translate_to and is_rag_ready()),
            },
        )
        return ai_response
    except Exception as exc:
        return f"Oops! Something went wrong. Please try again in a moment. (Error: {str(exc)[:60]})"


def stream_chat(
    session_id: str,
    user_message: str,
    class_: str = "8",
    selected_language: str = "English",
    user_name: str = "",
    weak_subject: str = "",
    user_id: int | None = None,
    organization_id: int | None = None,
):
    """
    Generator that streams chat tokens one by one using Groq's streaming API.
    Yields strings (token chunks). Saves completed message to session on finish.
    """
    session = get_session(session_id, selected_language, class_, user_name, weak_subject, user_id, organization_id)
    messages = session["messages"]
    response_language = normalize_language(selected_language)

    context = retrieve_context(user_message) if is_rag_ready() else ""
    if context:
        prompt = (
            f"Relevant NCERT textbook content:\n---\n{context}\n---\n\n"
            f"Based on the above, answer this Class {class_} student's question in {response_language}:\n"
            f"{user_message}\n\n"
            f"Remember: short answer, one example, warm tone. {language_instruction(response_language)}"
        )
    else:
        prompt = f"{language_instruction(response_language)}\n\nStudent message:\n{user_message}"

    model_messages = messages + [{"role": "user", "content": prompt}]

    full_response = ""
    try:
        stream = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=model_messages,
            max_tokens=500,
            temperature=0.7,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                full_response += delta
                yield delta

        # Persist to session after streaming completes
        messages.append({"role": "user", "content": user_message})
        messages.append({"role": "assistant", "content": full_response})
        if len(messages) > 21:
            messages = [messages[0]] + messages[-20:]
        session["messages"] = messages
        save_chat_session(session_id, session["messages"], session["profile"])
        touch_user_activity(user_id)
        log_event(
            "chat_message",
            user_id=user_id,
            session_id=session_id,
            metadata={"language": response_language, "simplify": False, "translate": False, "streamed": True},
        )
    except Exception as exc:
        yield f"\n\n[Error: {str(exc)[:80]}]"

