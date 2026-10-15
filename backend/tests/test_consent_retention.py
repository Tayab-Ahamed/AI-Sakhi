"""Policy abuse cases, isolated from live learner records and model calls."""

from dataclasses import replace
from datetime import UTC, datetime

import pytest

from backend import consent_service, db, governance_routes
from backend.config import Settings
from backend.retention_service import preview_chat_retention


@pytest.fixture
def guardian_policy(monkeypatch):
    policy = replace(
        consent_service.settings, env="development", ai_approval_mode="guardian", privacy_policy_version="v1"
    )
    monkeypatch.setattr(consent_service, "settings", policy)
    return policy


def link(ids):
    conn = db.get_connection()
    conn.execute("UPDATE users SET parent_id=? WHERE id=?", (ids["parent"], ids["student"]))
    conn.commit()
    conn.close()


def decide(client, ids, headers, actor, *, granted=True, version="v1", target="student"):
    return client.post(
        f"/v2/privacy/approvals/{ids[target]}",
        headers=headers(actor),
        json={"granted": granted, "policy_version": version},
    )


def test_guardian_approval_requires_current_link_and_policy(school_api, guardian_policy):
    client, ids, headers, _, _ = school_api
    assert decide(client, ids, headers, "student").status_code == 403
    assert decide(client, ids, headers, "teacher").status_code == 403
    assert decide(client, ids, headers, "admin").status_code == 403
    assert decide(client, ids, headers, "parent").status_code == 403
    link(ids)
    assert decide(client, ids, headers, "parent", version="old").status_code == 409
    result = decide(client, ids, headers, "parent")
    assert result.status_code == 200
    assert result.json()["ai_allowed"] is True
    assert decide(client, ids, headers, "parent", target="classmate").status_code == 403
    assert decide(client, ids, headers, "other_teacher").status_code == 403
    assert (
        client.get(f"/v2/privacy/approvals/{ids['student']}", headers=headers("other_teacher")).status_code
        == 403
    )


def test_student_can_withdraw_and_restriction_cannot_be_overridden(school_api, guardian_policy):
    client, ids, headers, _, _ = school_api
    link(ids)
    assert decide(client, ids, headers, "parent").json()["approved"]
    assert not decide(client, ids, headers, "student", granted=False).json()["ai_allowed"]
    conn = db.get_connection()
    conn.execute("UPDATE users SET processing_restricted=1 WHERE id=?", (ids["student"],))
    conn.commit()
    conn.close()
    result = decide(client, ids, headers, "parent").json()
    assert result["approved"] and result["processing_restricted"] and not result["ai_allowed"]


@pytest.mark.parametrize("change", ["policy", "parent", "school", "actor_inactive"])
def test_approvals_do_not_survive_authority_changes(school_api, guardian_policy, monkeypatch, change):
    client, ids, headers, _, _ = school_api
    link(ids)
    assert decide(client, ids, headers, "parent").json()["approved"]
    conn = db.get_connection()
    if change == "policy":
        monkeypatch.setattr(
            consent_service, "settings", replace(guardian_policy, privacy_policy_version="v2")
        )
    elif change == "parent":
        conn.execute("UPDATE users SET parent_id=NULL WHERE id=?", (ids["student"],))
    elif change == "school":
        conn.execute("UPDATE users SET organization_id=2 WHERE id=?", (ids["student"],))
    else:
        conn.execute("UPDATE users SET is_active=0 WHERE id=?", (ids["parent"],))
    conn.commit()
    conn.close()
    result = client.get(f"/v2/privacy/approvals/{ids['student']}", headers=headers("student")).json()
    assert not result["approved"] and not result["ai_allowed"]


def test_school_mode_and_adult_self_acknowledgement(school_api, guardian_policy, monkeypatch):
    client, ids, headers, _, _ = school_api
    monkeypatch.setattr(consent_service, "settings", replace(guardian_policy, ai_approval_mode="school"))
    link(ids)
    assert decide(client, ids, headers, "parent").status_code == 403
    assert decide(client, ids, headers, "teacher").json()["approved"]
    assert decide(client, ids, headers, "other_teacher").status_code == 403
    assert decide(client, ids, headers, "teacher", target="teacher").json()["approved"]
    assert decide(client, ids, headers, "admin", target="teacher").status_code == 403


@pytest.mark.parametrize(
    "path,body",
    [
        ("/chat", {"session_id": "no-approval", "message": "fractions", "class_": "8"}),
        ("/chat/stream", {"session_id": "no-approval", "message": "fractions", "class_": "8"}),
        ("/quiz/generate", {"topic": "Fractions", "class_": "8"}),
    ],
)
def test_model_entrypoints_fail_before_calling_provider(school_api, guardian_policy, path, body):
    client, _, headers, _, _ = school_api
    assert client.post(path, headers=headers("student"), json=body).status_code == 403


def test_unconfigured_production_fails_closed_but_dev_is_explicit(school_api, monkeypatch):
    client, ids, headers, _, _ = school_api
    policy = replace(
        consent_service.settings, ai_approval_mode="unconfigured", privacy_policy_version="", env="production"
    )
    monkeypatch.setattr(consent_service, "settings", policy)
    state = client.get(f"/v2/privacy/approvals/{ids['student']}", headers=headers("student")).json()
    assert not state["ai_allowed"] and state["policy"]["enforced"]
    assert decide(client, ids, headers, "admin").status_code == 409
    monkeypatch.setattr(consent_service, "settings", replace(policy, env="development"))
    state = client.get(f"/v2/privacy/approvals/{ids['student']}", headers=headers("student")).json()
    assert state["ai_allowed"] and not state["approved"] and not state["policy"]["configured"]


def test_approval_export_and_erasure(school_api, guardian_policy):
    client, ids, headers, _, _ = school_api
    link(ids)
    decide(client, ids, headers, "parent")
    exported = client.get(f"/v2/privacy/export/{ids['student']}", headers=headers("student")).json()
    assert "ai_approvals" in str(exported)
    from backend.privacy_service import erase_account

    conn = db.get_connection()
    erase_account(conn, ids["parent"])
    conn.commit()
    assert (
        conn.execute("SELECT actor_id FROM ai_approvals WHERE user_id=?", (ids["student"],)).fetchone()[0]
        is None
    )
    assert not consent_service.approval_state(conn, ids["student"])["approved"]
    erase_account(conn, ids["student"])
    conn.commit()
    assert not conn.execute("SELECT 1 FROM ai_approvals WHERE user_id=?", (ids["student"],)).fetchone()
    conn.close()


def test_retention_preview_is_read_only_scoped_and_holds_safety(school_api, monkeypatch):
    client, ids, headers, _, _ = school_api
    for name, owner in [
        ("old", "student"),
        ("held", "student"),
        ("boundary", "student"),
        ("other", "other_student"),
        ("unknown", "student"),
    ]:
        db.save_chat_session(name, [{"role": "user", "content": "secret"}], {"user_id": ids[owner]})
    conn = db.get_connection()
    conn.execute(
        "UPDATE chat_sessions SET updated_at='2026-01-01T00:00:00+00:00',organization_id=(SELECT organization_id FROM users WHERE users.id=chat_sessions.user_id)"
    )
    conn.execute("UPDATE chat_sessions SET updated_at='2026-01-02T00:00:00Z' WHERE session_id='boundary'")
    conn.execute("UPDATE chat_sessions SET updated_at='unknown' WHERE session_id='unknown'")
    conn.execute(
        "INSERT INTO safety_events(user_id,session_id,category,severity,created_at) VALUES(?,'held','bullying','high',?)",
        (ids["student"], db.now_iso()),
    )
    conn.commit()
    before = conn.total_changes
    result = preview_chat_retention(conn, 1, 30, now=datetime(2026, 2, 1, tzinfo=UTC))
    assert result["eligible_sessions"] == 1 and result["held_sessions"] == 1
    assert conn.total_changes == before
    assert preview_chat_retention(conn, 1, 0)["enabled"] is False
    assert conn.execute("SELECT count(*) FROM chat_sessions").fetchone()[0] == 5
    conn.close()
    monkeypatch.setattr(
        governance_routes, "settings", replace(governance_routes.settings, chat_retention_days=30)
    )
    assert client.get("/v2/privacy/retention/preview", headers=headers("teacher")).status_code == 403
    response = client.get("/v2/privacy/retention/preview", headers=headers("admin"))
    assert response.status_code == 200 and "secret" not in response.text
    assert response.json()["automatic_deletion_enabled"] is False


def test_invalid_policy_config_is_rejected():
    assert any(
        "APPROVAL_MODE" in e for e in Settings(env="development", ai_approval_mode="self").validation_errors()
    )
    assert any(
        "POLICY_VERSION" in e
        for e in Settings(
            env="development", ai_approval_mode="guardian", privacy_policy_version=""
        ).validation_errors()
    )


def test_feedback_checks_student_approval_and_omits_name(school_api, guardian_policy, monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import Mock

    from backend import llm

    client, ids, headers, _, _ = school_api
    link(ids)
    assert decide(client, ids, headers, "teacher", target="teacher").status_code == 200
    model = Mock(return_value=SimpleNamespace(text='["Keep practising"]'))
    monkeypatch.setattr(llm, "complete", model)
    body = {"topic": "Fractions", "score": 1, "total": 2, "student_name": "Sensitive name"}
    assert client.post("/ai/feedback-suggestion", headers=headers("teacher"), json=body).status_code == 422
    body["student_id"] = ids["teacher"]
    assert client.post("/ai/feedback-suggestion", headers=headers("teacher"), json=body).status_code == 422
    body["student_id"] = ids["other_student"]
    assert client.post("/ai/feedback-suggestion", headers=headers("teacher"), json=body).status_code == 403
    body["student_id"] = ids["student"]
    assert client.post("/ai/feedback-suggestion", headers=headers("teacher"), json=body).status_code == 403
    model.assert_not_called()
    assert decide(client, ids, headers, "parent").status_code == 200
    assert client.post("/ai/feedback-suggestion", headers=headers("teacher"), json=body).status_code == 200
    model.assert_called_once()
    assert "Sensitive name" not in str(model.call_args)
