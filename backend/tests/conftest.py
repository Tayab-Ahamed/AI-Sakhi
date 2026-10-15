"""Isolated school fixtures; API tests never mutate the user's database."""

import pytest
from fastapi.testclient import TestClient

from backend import auth, db, main, teacher_tools


@pytest.fixture
def school_api(tmp_path, monkeypatch):
    # Each temporary school has an independent request budget, just like its DB.
    # Never disable or widen the application's actual production rate limit.
    main.limiter.reset()
    path = str(tmp_path / "test.db")
    monkeypatch.setattr(db, "DB_PATH", path)
    monkeypatch.setattr(main, "DB_PATH", path)
    monkeypatch.setattr(teacher_tools, "DB_PATH", path)
    auth._revocation_cache.clear()
    db.init_db()
    db.apply_migrations()
    db.ensure_default_organization()
    conn = db.get_connection()
    conn.execute(
        "INSERT INTO organizations(name,slug,created_at) VALUES('Other school','other',?)", (db.now_iso(),)
    )
    conn.commit()
    other_org = conn.execute("SELECT id FROM organizations WHERE slug='other'").fetchone()[0]
    conn.close()
    ids = {}
    tokens = {}
    for name, role, org in [
        ("student", "student", 1),
        ("classmate", "student", 1),
        ("teacher", "teacher", 1),
        ("parent", "parent", 1),
        ("admin", "admin", 1),
        ("other_student", "student", other_org),
        ("other_teacher", "teacher", other_org),
    ]:
        ids[name] = db.create_user(name, "8", "English", "Math", role=role, organization_id=org)
        tokens[name] = auth.issue_session_token(ids[name])["token"]
    assignment = teacher_tools.create_assignment(
        ids["teacher"], 1, "Fractions", "Math", "Fractions", class_="8"
    )
    other_assignment = teacher_tools.create_assignment(
        ids["other_teacher"], other_org, "Other", "Math", "Fractions", class_="8"
    )
    client = TestClient(main.app)

    def headers(name):
        return {"Authorization": "Bearer " + tokens[name]}

    yield client, ids, headers, assignment["id"], other_assignment["id"]
    client.close()
    auth._revocation_cache.clear()
