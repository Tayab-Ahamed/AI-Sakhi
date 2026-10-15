import json
from uuid import uuid4

import pytest

from backend import auth, db, main
from backend.authz import get_identity, unprotected_routes
from backend.security import PUBLIC_EXACT, PUBLIC_PREFIXES
from backend.tests.diagnostic_helpers import invoke, published_blueprint

PREFIX = "/v2/diagnostics"


def creation(**changes):
    return {"creation_key": str(uuid4()), "title": "Check", "class_level": "8", "subject": "Math", **changes}


def test_creation_forbids_caller_authority_and_fake_scores(school_api):
    client, _, headers, *_ = school_api
    for extra in ({"organization_id": 2}, {"score": 3}, {"correct_index": 0}, {"created_by": 4}):
        assert (
            client.post(
                PREFIX + "/blueprints", headers=headers("teacher"), json=creation(**extra)
            ).status_code
            == 422
        )


def test_all_ten_routes_explicitly_depend_on_identity():
    routes = [r for r in main.app.routes if getattr(r, "path", "").startswith(PREFIX)]
    assert len(routes) == 10
    for route in routes:
        assert any(d.call == get_identity for d in route.dependant.dependencies)
    assert unprotected_routes(main.app, PUBLIC_EXACT, PUBLIC_PREFIXES) == []


def test_anonymous_and_wrong_role(school_api):
    client, _, headers, *_ = school_api
    assert client.get(PREFIX + "/blueprints").status_code == 401
    for actor in ("student", "parent"):
        assert client.post(PREFIX + "/blueprints", headers=headers(actor), json=creation()).status_code == 403
    assert client.get(PREFIX + "/blueprints", headers=headers("parent")).status_code == 403
    for actor in ("teacher", "admin", "parent"):
        assert (
            client.post(
                PREFIX + "/attempts",
                headers=headers(actor),
                json={"creation_key": str(uuid4()), "version_id": 1},
            ).status_code
            == 403
        )


def test_real_cookie_csrf_creation_and_logout(school_api):
    client, ids, _, *_ = school_api
    client.cookies.set("sakhi_token", auth.issue_session_token(ids["teacher"])["token"])
    body = creation()
    assert client.post(PREFIX + "/blueprints", json=body).status_code == 403
    csrf = client.get("/auth/csrf").json()["csrf_token"]
    created = client.post(PREFIX + "/blueprints", headers={"X-CSRF-Token": csrf}, json=body)
    assert created.status_code == 201
    assert created.headers["cache-control"] == "no-store"
    assert client.post("/auth/logout", headers={"X-CSRF-Token": csrf}, json={}).status_code == 200
    assert client.get(PREFIX + "/blueprints").status_code == 401


@pytest.mark.parametrize("version", [True, "1", 1.0, 0, -1, 2**63])
def test_strict_version_ids(school_api, version):
    client, _, headers, *_ = school_api
    assert (
        client.post(
            PREFIX + "/attempts",
            headers=headers("student"),
            json={"creation_key": str(uuid4()), "version_id": version},
        ).status_code
        == 422
    )


@pytest.mark.parametrize("value", [True, "0", 0.0, -1, 2])
def test_strict_answer_indices(school_api, value):
    from backend import diagnostic_service as service

    client, ids, headers, *_ = school_api
    config = published_blueprint(client, ids, headers)
    attempt = invoke(
        service.start_attempt, ids, "student", creation_key=str(uuid4()), version_id=config["version"]["id"]
    )
    answers = {str(q): value for q in config["question_ids"]}
    response = client.post(
        PREFIX + f"/attempts/{attempt['id']}/submission",
        headers=headers("student"),
        json={"answers": answers},
    )
    assert response.status_code == 422
    assert "School explanation" not in response.text


def test_http_scopes_live_class_and_no_get_side_effects_or_generation(school_api, monkeypatch):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)

    def unexpected(*args, **kwargs):
        pytest.fail("Diagnostics must not invoke model generation")

    monkeypatch.setattr(main, "chat", unexpected)
    result = client.post(
        PREFIX + "/attempts",
        headers=headers("student"),
        json={"creation_key": str(uuid4()), "version_id": configured["version"]["id"]},
    )
    assert result.status_code == 201
    attempt_id = result.json()["id"]
    assert "correct_index" not in result.text and "explanation" not in result.text
    for actor in ("classmate", "other_student"):
        assert client.get(PREFIX + f"/attempts/{attempt_id}", headers=headers(actor)).status_code == 404
    assert (
        client.get(
            PREFIX + f"/blueprints/{configured['blueprint']['id']}", headers=headers("other_teacher")
        ).status_code
        == 404
    )
    assert (
        client.get(
            PREFIX + f"/blueprints/{configured['blueprint']['id']}", headers=headers("student")
        ).status_code
        == 403
    )
    for _ in range(3):
        assert client.get(PREFIX + f"/attempts/{attempt_id}", headers=headers("student")).status_code == 200
        assert client.get(PREFIX + "/blueprints", headers=headers("student")).status_code == 200
    conn = db.get_connection()
    assert (
        conn.execute("SELECT COUNT(*) FROM learning_events WHERE user_id=?", (ids["student"],)).fetchone()[0]
        == 0
    )
    assert (
        conn.execute("SELECT COUNT(*) FROM mastery_snapshots WHERE user_id=?", (ids["student"],)).fetchone()[
            0
        ]
        == 0
    )
    conn.execute("UPDATE users SET class='9' WHERE id=?", (ids["student"],))
    conn.commit()
    conn.close()
    assert client.get(PREFIX + f"/attempts/{attempt_id}", headers=headers("student")).status_code == 404
    assert client.get(PREFIX + "/blueprints", headers=headers("student")).json()["blueprints"] == []


def test_invalid_draft_stale_and_pagination_errors(school_api):
    client, _, headers, *_ = school_api
    created = client.post(PREFIX + "/blueprints", headers=headers("teacher"), json=creation()).json()
    path = PREFIX + f"/blueprints/{created['id']}"
    definition = created["definition"]
    assert (
        client.put(
            path, headers=headers("teacher"), json={"expected_revision": True, "definition": definition}
        ).status_code
        == 422
    )
    assert (
        client.put(
            path, headers=headers("teacher"), json={"expected_revision": 1, "definition": definition}
        ).status_code
        == 200
    )
    assert (
        client.put(
            path, headers=headers("teacher"), json={"expected_revision": 1, "definition": definition}
        ).status_code
        == 409
    )
    assert (
        client.post(path + "/publish", headers=headers("teacher"), json={"expected_revision": 2}).status_code
        == 422
    )
    for query in ("limit=101", "limit=0", "after_id=-1"):
        assert client.get(PREFIX + "/blueprints?" + query, headers=headers("teacher")).status_code == 422


def test_no_snapshot_leak_in_student_list_and_revocation(school_api):
    client, ids, headers, *_ = school_api
    published_blueprint(client, ids, headers)
    response = client.get(PREFIX + "/blueprints", headers=headers("student"))
    assert response.status_code == 200
    assert not any(
        k in json.dumps(response.json())
        for k in ("snapshot_json", "correct_index", "explanation", 'draft_revision": null')
    )
    db.deactivate_user(ids["student"])
    assert client.get(PREFIX + "/blueprints", headers=headers("student")).status_code == 401
