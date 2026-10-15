from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from backend.tests.diagnostic_helpers import invoke


def create(ids, actor="teacher", **changes):
    from backend import diagnostic_service as service

    return invoke(
        service.create_blueprint,
        ids,
        actor,
        **{
            "creation_key": str(uuid4()),
            "title": "School check",
            "class_level": "8",
            "subject": "Math",
            **changes,
        },
    )


def test_duplicate_create_and_immutable_fingerprint_after_edits(school_api):
    from backend import diagnostic_service as service

    _, ids, *_ = school_api
    key = str(uuid4())
    first = create(ids, creation_key=key)
    assert create(ids, creation_key=key) == first
    changed = {**first["definition"], "title": "Edited school check"}
    saved = invoke(
        service.save_blueprint,
        ids,
        "teacher",
        blueprint_id=first["id"],
        expected_revision=1,
        definition=changed,
    )
    assert saved["draft_revision"] == 2
    assert create(ids, creation_key=key) == saved
    with pytest.raises(service.DiagnosticError) as error:
        create(ids, creation_key=key, title="Different intent")
    assert error.value.status == 409


def test_concurrent_creation(school_api):
    _, ids, *_ = school_api
    key = str(uuid4())
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: create(ids, creation_key=key), range(4)))
    assert len({r["id"] for r in results}) == 1


def test_stale_revision_and_invalid_dangling_draft_preserve_saved(school_api):
    from backend import diagnostic_service as service
    from backend.diagnostic_rules import DiagnosticRuleError

    _, ids, *_ = school_api
    first = create(ids)
    saved = invoke(
        service.save_blueprint,
        ids,
        "teacher",
        blueprint_id=first["id"],
        expected_revision=1,
        definition=first["definition"],
    )
    with pytest.raises(service.DiagnosticError) as error:
        invoke(
            service.save_blueprint,
            ids,
            "teacher",
            blueprint_id=first["id"],
            expected_revision=1,
            definition=first["definition"],
        )
    assert error.value.status == 409
    bad = {
        **first["definition"],
        "concepts": [{"id": "next", "label": "Next", "prerequisite_ids": ["removed"], "question_ids": []}],
    }
    with pytest.raises(DiagnosticRuleError):
        invoke(
            service.save_blueprint,
            ids,
            "teacher",
            blueprint_id=first["id"],
            expected_revision=2,
            definition=bad,
        )
    assert invoke(service.read_blueprint, ids, "teacher", blueprint_id=first["id"]) == saved


@pytest.mark.parametrize("actor,status", [("student", 403), ("parent", 403), ("other_teacher", 404)])
def test_draft_scope(school_api, actor, status):
    from backend import diagnostic_service as service

    _, ids, *_ = school_api
    first = create(ids)
    with pytest.raises(service.DiagnosticError) as error:
        invoke(service.read_blueprint, ids, actor, blueprint_id=first["id"])
    assert error.value.status == status


def test_live_staff_role_and_activity(school_api):
    from backend import db
    from backend import diagnostic_service as service

    _, ids, *_ = school_api
    first = create(ids)
    conn = db.get_connection()
    conn.execute("UPDATE users SET role='student' WHERE id=?", (ids["teacher"],))
    conn.commit()
    conn.close()
    with pytest.raises(service.DiagnosticError) as error:
        invoke(service.read_blueprint, ids, "teacher", blueprint_id=first["id"])
    assert error.value.status == 403


def test_list_pagination_and_unpublished_student_empty(school_api):
    from backend import diagnostic_service as service

    _, ids, *_ = school_api
    one, two = create(ids), create(ids)
    first = invoke(service.list_blueprints, ids, "teacher", limit=1)
    assert [c["id"] for c in first["blueprints"]] == [one["id"]]
    assert first["next_after_id"] == one["id"]
    second = invoke(service.list_blueprints, ids, "teacher", after_id=first["next_after_id"], limit=1)
    assert [c["id"] for c in second["blueprints"]] == [two["id"]]
    assert second["next_after_id"] is None
    assert invoke(service.list_blueprints, ids, "student")["blueprints"] == []


def test_composite_foreign_keys_and_nullable_authorship(school_api):
    import sqlite3

    from backend import db

    _, ids, *_ = school_api
    blueprint = create(ids)
    conn = db.get_connection()
    try:
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO diagnostic_versions(blueprint_id,organization_id,class_level,subject,version_number,draft_revision,snapshot_json,published_at) VALUES(?,2,'8','Math',1,1,'{}','now')",
                (blueprint["id"],),
            )
        conn.rollback()
        conn.execute(
            "INSERT INTO diagnostic_versions(blueprint_id,organization_id,class_level,subject,version_number,draft_revision,snapshot_json,published_at) VALUES(?,1,'8','Math',1,1,'{}','now')",
            (blueprint["id"],),
        )
        version_id = conn.execute("SELECT id FROM diagnostic_versions").fetchone()[0]
        conn.commit()
        for org, class_level in [(2, "8"), (1, "9")]:
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute(
                    "INSERT INTO diagnostic_attempts(id,user_id,organization_id,class_level,version_id,creation_key,status,created_at) VALUES(?,?,?,?,?,?,'active','now')",
                    (str(uuid4()), ids["student"], org, class_level, version_id, str(uuid4())),
                )
            conn.rollback()
        conn.execute("UPDATE diagnostic_blueprints SET created_by=NULL")
        conn.execute("UPDATE diagnostic_versions SET published_by=NULL")
        conn.commit()
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
    finally:
        conn.close()
