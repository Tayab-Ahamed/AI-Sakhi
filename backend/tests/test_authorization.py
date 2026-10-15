import pytest

from backend import auth, db, main
from backend.authz import Identity, require_chat_access, unprotected_routes
from backend.security import PUBLIC_EXACT, PUBLIC_PREFIXES


def test_every_protected_route_declares_authentication():
    assert unprotected_routes(main.app, PUBLIC_EXACT, PUBLIC_PREFIXES) == []


@pytest.mark.parametrize("path", ["/dashboard", "/users", "/assignments", "/assignments/1/submissions"])
def test_students_cannot_reach_staff_collections(school_api, path):
    client, _, headers, _, _ = school_api
    assert client.get(path, headers=headers("student")).status_code == 403


def test_admin_collections_default_to_their_school(school_api):
    client, ids, headers, _, _ = school_api
    for path in ["/users", "/dashboard"]:
        response = client.get(path, headers=headers("admin"))
        assert response.status_code == 200
        assert all(u["organization_id"] == 1 for u in response.json()["users"])
        assert str(ids["other_student"]) not in [
            str(u.get("id", u.get("user_id"))) for u in response.json()["users"]
        ]


@pytest.mark.parametrize("role", ["student", "teacher", "parent", "admin"])
def test_other_school_learner_is_inaccessible(school_api, role):
    client, ids, headers, _, _ = school_api
    assert client.get(f"/user/{ids['other_student']}", headers=headers(role)).status_code == 403


def test_unlinked_parent_cannot_read_student(school_api):
    client, ids, headers, _, _ = school_api
    assert client.get(f"/progress/{ids['student']}", headers=headers("parent")).status_code == 403


def test_stale_parent_link_does_not_expose_another_school(school_api):
    client, ids, headers, _, _ = school_api
    db.link_child_to_parent(ids["parent"], ids["other_student"])
    db.link_child_to_parent(ids["parent"], ids["student"])
    response = client.get(f"/parent/children/{ids['parent']}", headers=headers("parent"))
    assert response.status_code == 200
    assert [child["user_id"] for child in response.json()["children"]] == [ids["student"]]


def test_assignment_lists_and_submissions_are_school_scoped(school_api):
    client, _, headers, assignment, other = school_api
    response = client.get("/assignments", headers=headers("teacher"))
    assert response.status_code == 200
    assert [a["id"] for a in response.json()] == [assignment]
    assert client.get(f"/assignments/{other}/submissions", headers=headers("teacher")).status_code == 403
    assert client.get(f"/assignments/{other}/submissions", headers=headers("admin")).status_code == 403


def test_submission_cannot_target_another_school(school_api):
    client, ids, headers, _, other = school_api
    response = client.post(
        f"/assignments/{other}/submit",
        headers=headers("student"),
        json={"student_id": ids["student"], "score": 5, "total_questions": 5},
    )
    assert response.status_code == 403


def test_cannot_mint_a_session_for_another_user(school_api):
    client, ids, headers, _, _ = school_api
    response = client.post("/auth/token", headers=headers("admin"), json={"user_id": ids["student"]})
    assert response.status_code == 403


def test_profile_does_not_expose_password_hash(school_api):
    client, ids, headers, _, _ = school_api
    db.set_user_password(ids["student"], "private-password-hash")
    assert "password_hash" not in client.get(f"/user/{ids['student']}", headers=headers("student")).json()


def test_chat_ownership_checked_before_model_call(school_api, monkeypatch):
    client, ids, headers, _, _ = school_api
    db.save_chat_session("private", [], {"user_id": ids["classmate"], "organization_id": 1})

    def unexpected(*args, **kwargs):
        pytest.fail("Model should not be called for another user's chat")

    monkeypatch.setattr(main, "chat", unexpected)
    response = client.post(
        "/chat", headers=headers("student"), json={"session_id": "private", "message": "hello"}
    )
    assert response.status_code == 403


def test_session_reservation_cannot_be_reassigned(school_api):
    _, ids, _, _, _ = school_api
    first = Identity(ids["student"], "student", 1)
    second = Identity(ids["classmate"], "student", 1)
    require_chat_access(first, "reserved", claim=True)
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as denied:
        require_chat_access(second, "reserved", claim=True)
    assert denied.value.status_code == 403
    db.save_chat_session("reserved", [], {"user_id": second.user_id})
    assert db.get_chat_history("reserved")["user_id"] == first.user_id


def test_cookie_mutations_require_csrf(school_api):
    client, ids, _, _, _ = school_api
    client.cookies.set("sakhi_token", auth.issue_session_token(ids["student"])["token"])
    assert client.post("/auth/logout", json={}).status_code == 403
    csrf = client.get("/auth/csrf").json()["csrf_token"]
    response = client.post("/auth/logout", json={}, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    assert client.get("/auth/session").status_code == 401


def test_current_session_returns_metadata_without_token(school_api):
    client, ids, headers, _, _ = school_api
    response = client.get("/auth/session", headers=headers("student"))
    assert response.status_code == 200
    assert response.json()["user"]["user_id"] == ids["student"]
    assert "token" not in response.json()["auth"]
    assert response.headers["cache-control"] == "no-store"


def test_demoted_or_suspended_account_cannot_reuse_old_privileges(school_api):
    client, ids, headers, _, _ = school_api
    assert client.get("/dashboard", headers=headers("admin")).status_code == 200
    conn = db.get_connection()
    conn.execute("UPDATE users SET role='student' WHERE id=?", (ids["admin"],))
    conn.commit()
    conn.close()
    assert client.get("/dashboard", headers=headers("admin")).status_code == 403
    db.deactivate_user(ids["student"])
    assert client.get("/auth/session", headers=headers("student")).status_code == 401
