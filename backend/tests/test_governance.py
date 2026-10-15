import pytest

from backend import db


def create_request(client, ids, headers, kind, actor="student"):
    response = client.post(
        "/v2/privacy/requests", headers=headers(actor), json={"user_id": ids[actor], "request_type": kind}
    )
    assert response.status_code == 200
    return response.json()["id"]


def test_export_includes_owned_transcript_without_credentials(school_api):
    client, ids, headers, _, _ = school_api
    db.save_chat_session(
        "export-me",
        [{"role": "system", "content": "private prompt"}, {"role": "user", "content": "Fractions"}],
        {"user_id": ids["student"]},
    )
    response = client.get(f"/v2/privacy/export/{ids['student']}", headers=headers("student"))
    assert response.status_code == 200
    assert "password_hash" not in response.text
    assert "private prompt" not in response.text
    assert "Fractions" in response.text


def test_privacy_queue_cannot_cross_school(school_api):
    client, ids, headers, _, _ = school_api
    own = create_request(client, ids, headers, "export")
    other = create_request(client, ids, headers, "export", "other_student")
    queue = client.get("/v2/privacy/requests", headers=headers("admin")).json()["requests"]
    assert [r["id"] for r in queue] == [own]
    assert (
        client.post(f"/v2/privacy/requests/{other}/fulfil", headers=headers("admin"), json={}).status_code
        == 403
    )


@pytest.mark.parametrize("kind", ["delete_account", "delete_chat_history"])
def test_erasure_removes_transcripts_and_tracks_backup_obligation(school_api, kind):
    client, ids, headers, _, _ = school_api
    db.save_chat_session("erase-me", [{"role": "user", "content": "private"}], {"user_id": ids["student"]})
    conn = db.get_connection()
    conn.execute(
        "INSERT INTO artifacts(user_id,artifact_type,title,source_session_id,payload_json,created_at,updated_at) VALUES(?,'bookmark','Private','erase-me','{}',?,?)",
        (ids["student"], db.now_iso(), db.now_iso()),
    )
    conn.commit()
    conn.close()
    request_id = create_request(client, ids, headers, kind)
    response = client.post(f"/v2/privacy/requests/{request_id}/fulfil", headers=headers("admin"), json={})
    assert response.status_code == 200
    assert response.json()["status"] == "awaiting_backup_expiry"
    conn = db.get_connection()
    try:
        assert conn.execute("SELECT 1 FROM chat_sessions WHERE session_id='erase-me'").fetchone() is None
        assert conn.execute("SELECT 1 FROM artifacts WHERE source_session_id='erase-me'").fetchone() is None
        if kind == "delete_account":
            row = conn.execute("SELECT * FROM users WHERE id=?", (ids["student"],)).fetchone()
            assert row["is_active"] == 0
            assert row["password_hash"] is None
            assert row["organization_id"] is None
    finally:
        conn.close()
    assert (
        client.get("/v2/privacy/requests", headers=headers("admin")).json()["requests"][0]["id"] == request_id
    )
    assert (
        client.post(
            f"/v2/privacy/requests/{request_id}/fulfil", headers=headers("admin"), json={}
        ).status_code
        == 409
    )


def test_processing_restriction_blocks_model_routes(school_api):
    client, ids, headers, _, _ = school_api
    request_id = create_request(client, ids, headers, "restrict_processing")
    assert (
        client.post(
            f"/v2/privacy/requests/{request_id}/fulfil", headers=headers("admin"), json={}
        ).status_code
        == 200
    )
    response = client.post(
        "/chat",
        headers=headers("student"),
        json={"session_id": "restricted", "message": "fractions", "class_": "9"},
    )
    assert response.status_code == 403


def test_safeguarding_reports_minimize_context_and_scope_review(school_api):
    client, ids, headers, _, _ = school_api
    response = client.post(
        "/v2/safety/events",
        headers=headers("student"),
        json={"category": "bullying", "severity": "medium", "minimal_context": "sensitive disclosure"},
    )
    assert response.status_code == 200
    event = response.json()["id"]
    assert client.get("/v2/safety/events", headers=headers("student")).status_code == 403
    assert client.get("/v2/safety/events", headers=headers("other_teacher")).json()["events"] == []
    assert "sensitive disclosure" not in client.get("/v2/safety/events", headers=headers("teacher")).text
    assert (
        client.post(
            f"/v2/safety/events/{event}/acknowledge", headers=headers("other_teacher"), json={}
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/v2/safety/events/{event}/acknowledge",
            headers=headers("teacher"),
            json={"note": "Follow school protocol"},
        ).status_code
        == 200
    )
