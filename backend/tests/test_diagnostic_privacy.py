import json
import sqlite3
from uuid import uuid4

import pytest

from backend import db
from backend import diagnostic_service as service
from backend.privacy_service import erase_account, export_data
from backend.tests.diagnostic_helpers import invoke, published_blueprint


def attempt(ids, version_id, actor="student"):
    return invoke(service.start_attempt, ids, actor, creation_key=str(uuid4()), version_id=version_id)


def exported(user_id):
    conn = db.get_connection()
    try:
        return export_data(conn, user_id)
    finally:
        conn.close()


def erase(user_id):
    conn = db.get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        erase_account(conn, user_id)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def test_pending_export_no_keys_and_no_other_learners(school_api):
    client, ids, headers, *_ = school_api
    config = published_blueprint(client, ids, headers)
    owned = attempt(ids, config["version"]["id"])
    attempt(ids, config["version"]["id"], "classmate")
    data = exported(ids["student"])
    assert [a["id"] for a in data["diagnostic_attempts"]] == [owned["id"]]
    text = json.dumps(data["diagnostic_attempts"])
    assert not any(key in text for key in ("correct_index", "explanation", "snapshot_json"))
    assert data["authored_diagnostic_blueprints"] == []
    assert exported(ids["teacher"])["diagnostic_attempts"] == []


def test_completed_export_has_own_feedback_and_erase_removes_attempts_events(school_api):
    client, ids, headers, *_ = school_api
    config = published_blueprint(client, ids, headers)
    owned = attempt(ids, config["version"]["id"])
    invoke(
        service.submit_attempt,
        ids,
        "student",
        attempt_id=owned["id"],
        answers={str(q): 0 for q in config["question_ids"]},
    )
    result = exported(ids["student"])["diagnostic_attempts"][0]
    assert result["result"]["correct_count"] == 3
    assert result["result"]["items"][0]["explanation"] == "School explanation: Yes."
    erase(ids["student"])
    conn = db.get_connection()
    assert (
        conn.execute(
            "SELECT COUNT(*) FROM diagnostic_attempts WHERE user_id=?", (ids["student"],)
        ).fetchone()[0]
        == 0
    )
    assert (
        conn.execute("SELECT COUNT(*) FROM learning_events WHERE user_id=?", (ids["student"],)).fetchone()[0]
        == 0
    )
    conn.close()


def test_erased_creator_withdraws_all_retained_versions_without_fallback(school_api):
    client, ids, headers, *_ = school_api
    config = published_blueprint(client, ids, headers)
    completed = attempt(ids, config["version"]["id"], "classmate")
    result = invoke(
        service.submit_attempt,
        ids,
        "classmate",
        attempt_id=completed["id"],
        answers={str(q): 0 for q in config["question_ids"]},
    )
    saved = invoke(
        service.save_blueprint,
        ids,
        "teacher",
        blueprint_id=config["blueprint"]["id"],
        expected_revision=2,
        definition={**config["definition"], "title": "Private unpublished draft title"},
    )
    version = invoke(service.publish_blueprint, ids, "admin", blueprint_id=saved["id"], expected_revision=3)
    pending = attempt(ids, version["id"])
    unpublished = invoke(
        service.create_blueprint,
        ids,
        "teacher",
        creation_key=str(uuid4()),
        title="Unpublished private title",
        class_level="8",
        subject="Math",
    )
    erase(ids["teacher"])
    assert invoke(service.list_blueprints, ids, "student")["blueprints"] == []
    assert invoke(service.read_attempt, ids, "classmate", attempt_id=completed["id"]) == result
    with pytest.raises(service.DiagnosticError) as error:
        invoke(service.read_attempt, ids, "student", attempt_id=pending["id"])
    assert error.value.status == 409
    conn = db.get_connection()
    row = conn.execute("SELECT * FROM diagnostic_blueprints WHERE id=?", (saved["id"],)).fetchone()
    assert row["created_by"] is None
    assert "Private unpublished draft title" not in row["definition_json"]
    assert "School check" not in row["creation_fingerprint"]
    assert row["draft_revision"] == 4
    assert (
        conn.execute("SELECT id FROM diagnostic_blueprints WHERE id=?", (unpublished["id"],)).fetchone()
        is None
    )
    versions = conn.execute(
        "SELECT * FROM diagnostic_versions WHERE blueprint_id=?", (saved["id"],)
    ).fetchall()
    assert len(versions) == 2 and all(v["withdrawn_at"] for v in versions)
    assert versions[0]["published_by"] is None
    assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
    conn.close()
    replay = invoke(service.publish_blueprint, ids, "admin", blueprint_id=saved["id"], expected_revision=2)
    assert replay["withdrawn_at"] is not None


def test_erased_publisher_not_creator_withdraws_owned_publication(school_api):
    client, ids, headers, *_ = school_api
    config = published_blueprint(client, ids, headers)
    saved = invoke(
        service.save_blueprint,
        ids,
        "teacher",
        blueprint_id=config["blueprint"]["id"],
        expected_revision=2,
        definition=config["definition"],
    )
    version = invoke(service.publish_blueprint, ids, "admin", blueprint_id=saved["id"], expected_revision=3)
    erase(ids["admin"])
    assert invoke(service.list_blueprints, ids, "student")["blueprints"] == []
    conn = db.get_connection()
    row = conn.execute(
        "SELECT published_by,withdrawn_at FROM diagnostic_versions WHERE id=?", (version["id"],)
    ).fetchone()
    assert row["published_by"] is None and row["withdrawn_at"] is not None
    conn.close()


def test_canonical_erasure_failure_rolls_back_diagnostics(school_api):
    client, ids, headers, *_ = school_api
    config = published_blueprint(client, ids, headers)
    owned = attempt(ids, config["version"]["id"])
    conn = db.get_connection()
    conn.execute(
        "CREATE TRIGGER fail_erasure BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT,'injected erasure failure'); END"
    )
    conn.commit()
    conn.close()
    with pytest.raises(sqlite3.IntegrityError, match="injected erasure failure"):
        erase(ids["student"])
    assert invoke(service.read_attempt, ids, "student", attempt_id=owned["id"]) == owned
