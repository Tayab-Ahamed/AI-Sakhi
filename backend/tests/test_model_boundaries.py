import importlib
from types import SimpleNamespace

import pytest

from backend import llm, upload_service

tutor = importlib.import_module("backend.chat")


@pytest.mark.parametrize("streaming", [False, True])
def test_generated_unsafe_content_is_blocked_before_release(school_api, monkeypatch, streaming):
    _, ids, _, _, _ = school_api
    dangerous = "I want to kill myself"
    monkeypatch.setattr(tutor, "is_rag_ready", lambda: False)
    monkeypatch.setattr(tutor, "_generate_validated_response", lambda *a, **k: (dangerous, SimpleNamespace()))
    monkeypatch.setattr(tutor, "llm_stream", lambda *a, **k: iter(["I want to ", "kill myself"]))
    if streaming:
        events = list(
            tutor.stream_chat("gated-stream", "Explain fractions", user_id=ids["student"], organization_id=1)
        )
        released = "".join(e.get("text", "") for e in events if e["type"] == "token")
    else:
        released = tutor.chat("gated-chat", "Explain fractions", user_id=ids["student"], organization_id=1)[
            "response"
        ]
    assert dangerous not in released
    assert "trusted adult" in released.lower()


def test_spoofed_upload_rejected_before_model(school_api, monkeypatch):
    client, _, headers, _, _ = school_api
    monkeypatch.setattr(
        llm, "complete", lambda *a, **k: pytest.fail("Model must not receive spoofed uploads")
    )
    response = client.post(
        "/chat/upload", headers=headers("student"), files={"file": ("picture.png", b"not a png", "image/png")}
    )
    assert response.status_code == 415


def test_upload_cannot_impersonate_another_learner(school_api):
    client, ids, headers, _, _ = school_api
    response = client.post(
        f"/chat/upload?user_id={ids['classmate']}",
        headers=headers("student"),
        files={"file": ("page.txt", b"fractions", "text/plain")},
    )
    assert response.status_code == 403


def test_upload_output_uses_safety_gate(monkeypatch, school_api):
    _, ids, _, _, _ = school_api
    monkeypatch.setattr(llm, "complete", lambda *a, **k: SimpleNamespace(text="I want to kill myself"))
    result = upload_service.explain_upload(b"Explain fractions", "page.txt", "9", "English", ids["student"])
    assert result["safety"]["blocked"] is True
    assert "trusted adult" in result["response"].lower()
