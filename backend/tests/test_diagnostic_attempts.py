import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from backend import db
from backend import diagnostic_service as service
from backend.tests.diagnostic_helpers import invoke, published_blueprint


def start(ids, configured, key=None, actor="student"):
    return invoke(
        service.start_attempt,
        ids,
        actor,
        creation_key=key or str(uuid4()),
        version_id=configured["version"]["id"],
    )


def answers(configured, value=0):
    return {str(qid): value for qid in configured["question_ids"]}


def counts(user_id):
    conn = db.get_connection()
    try:
        return (
            conn.execute(
                "SELECT COUNT(*) FROM learning_events WHERE user_id=? AND event_type='diagnostic_completed'",
                (user_id,),
            ).fetchone()[0],
            conn.execute("SELECT COUNT(*) FROM progress WHERE user_id=?", (user_id,)).fetchone()[0],
            conn.execute("SELECT COUNT(*) FROM mastery_snapshots WHERE user_id=?", (user_id,)).fetchone()[0],
        )
    finally:
        conn.close()


def test_submission_once_and_completed_get_after_response_loss(school_api):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers, concepts=2)
    attempt = start(ids, configured)
    assert "correct_index" not in json.dumps(attempt) and "explanation" not in json.dumps(attempt)
    first = invoke(
        service.submit_attempt, ids, "student", attempt_id=attempt["id"], answers=answers(configured)
    )
    assert first["result"]["correct_count"] == 6
    assert first["result"]["next_action"]["kind"] == "spaced_practice"
    assert (
        invoke(service.submit_attempt, ids, "student", attempt_id=attempt["id"], answers=answers(configured))
        == first
    )
    for _ in range(3):
        assert invoke(service.read_attempt, ids, "student", attempt_id=attempt["id"]) == first
    assert counts(ids["student"]) == (1, 0, 0)
    with pytest.raises(service.DiagnosticError) as error:
        invoke(
            service.submit_attempt, ids, "student", attempt_id=attempt["id"], answers=answers(configured, 1)
        )
    assert error.value.status == 409


def test_concurrent_start_and_submit(school_api):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    key = str(uuid4())
    with ThreadPoolExecutor(max_workers=4) as pool:
        attempts = list(pool.map(lambda _: start(ids, configured, key), range(4)))
    assert len({a["id"] for a in attempts}) == 1
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(
            pool.map(
                lambda _: invoke(
                    service.submit_attempt,
                    ids,
                    "student",
                    attempt_id=attempts[0]["id"],
                    answers=answers(configured, None),
                ),
                range(4),
            )
        )
    assert all(r == results[0] for r in results)
    assert results[0]["result"]["skipped_count"] == 3
    assert counts(ids["student"]) == (1, 0, 0)


def test_creation_retry_recovers_superseded_version_but_new_intent_conflicts(school_api):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    key = str(uuid4())
    attempt = start(ids, configured, key)
    saved = invoke(
        service.save_blueprint,
        ids,
        "teacher",
        blueprint_id=configured["blueprint"]["id"],
        expected_revision=2,
        definition=configured["definition"],
    )
    latest = invoke(service.publish_blueprint, ids, "teacher", blueprint_id=saved["id"], expected_revision=3)
    assert start(ids, configured, key) == attempt
    with pytest.raises(service.DiagnosticError) as error:
        start(ids, configured)
    assert error.value.status == 409
    with pytest.raises(service.DiagnosticError) as error:
        invoke(service.start_attempt, ids, "student", creation_key=key, version_id=latest["id"])
    assert error.value.status == 409
    assert (
        invoke(service.submit_attempt, ids, "student", attempt_id=attempt["id"], answers=answers(configured))[
            "status"
        ]
        == "completed"
    )


@pytest.mark.parametrize(
    "change", ["recall", "text", "options", "key", "explanation", "school", "class", "subject", "withdraw"]
)
def test_pending_content_changes_block_read_retry_submit_but_completed_history_survives(school_api, change):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    key = str(uuid4())
    pending = start(ids, configured, key)
    completed = start(ids, configured, actor="classmate")
    result = invoke(
        service.submit_attempt, ids, "classmate", attempt_id=completed["id"], answers=answers(configured)
    )
    if change == "withdraw":
        invoke(service.withdraw_version, ids, "teacher", version_id=configured["version"]["id"])
    else:
        values = {
            "recall": ("status", "draft"),
            "text": ("question_text", "Edited question"),
            "options": ("options_json", '["No","Yes"]'),
            "key": ("correct_answer", "B"),
            "explanation": ("explanation", "Changed explanation"),
            "school": ("organization_id", 2),
            "class": ("class_level", "9"),
            "subject": ("subject", "Mathematics"),
        }
        field, value = values[change]
        conn = db.get_connection()
        conn.execute(f"UPDATE question_bank SET {field}=? WHERE id=?", (value, configured["question_ids"][0]))
        conn.commit()
        conn.close()
    calls = [
        lambda: invoke(service.read_attempt, ids, "student", attempt_id=pending["id"]),
        lambda: start(ids, configured, key),
        lambda: start(ids, configured),
        lambda: invoke(
            service.submit_attempt, ids, "student", attempt_id=pending["id"], answers=answers(configured)
        ),
    ]
    for call in calls:
        with pytest.raises(service.DiagnosticError) as error:
            call()
        assert error.value.status == 409
    assert invoke(service.read_attempt, ids, "classmate", attempt_id=completed["id"]) == result
    assert (
        invoke(
            service.submit_attempt, ids, "classmate", attempt_id=completed["id"], answers=answers(configured)
        )
        == result
    )
    assert counts(ids["student"]) == (0, 0, 0)


@pytest.mark.parametrize(
    "actor,status",
    [("classmate", 404), ("other_student", 404), ("teacher", 403), ("admin", 403), ("parent", 403)],
)
def test_owner_and_role_scope(school_api, actor, status):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    attempt = start(ids, configured)
    with pytest.raises(service.DiagnosticError) as error:
        invoke(service.read_attempt, ids, actor, attempt_id=attempt["id"])
    assert error.value.status == status


@pytest.mark.parametrize(
    "field,value,status", [("class", "9", 404), ("organization_id", 2, 404), ("is_active", 0, 403)]
)
def test_current_profile_scope(school_api, field, value, status):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    attempt = start(ids, configured)
    conn = db.get_connection()
    conn.execute(f"UPDATE users SET {field}=? WHERE id=?", (value, ids["student"]))
    conn.commit()
    conn.close()
    with pytest.raises(service.DiagnosticError) as error:
        if field == "organization_id":
            # HTTP authentication derives current school, not the original fixture claim.
            from backend.authz import Identity

            current = db.get_connection()
            try:
                service.read_attempt(current, Identity(ids["student"], "student", value), attempt["id"])
            finally:
                current.close()
        else:
            invoke(service.read_attempt, ids, "student", attempt_id=attempt["id"])
    assert error.value.status == status


def test_failure_between_attempt_update_and_event_rolls_back(school_api):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    attempt = start(ids, configured)
    conn = db.get_connection()
    conn.execute(
        "CREATE TRIGGER fail_diagnostic_event BEFORE INSERT ON learning_events WHEN NEW.event_type='diagnostic_completed' BEGIN SELECT RAISE(ABORT,'injected test failure'); END"
    )
    conn.commit()
    conn.close()
    with pytest.raises(sqlite3.IntegrityError, match="injected test failure"):
        invoke(service.submit_attempt, ids, "student", attempt_id=attempt["id"], answers=answers(configured))
    assert invoke(service.read_attempt, ids, "student", attempt_id=attempt["id"]) == attempt
    assert counts(ids["student"]) == (0, 0, 0)


def test_minimal_event_contains_no_answers_or_content(school_api):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    attempt = start(ids, configured)
    invoke(service.submit_attempt, ids, "student", attempt_id=attempt["id"], answers=answers(configured))
    conn = db.get_connection()
    metadata = json.loads(
        conn.execute(
            "SELECT metadata_json FROM learning_events WHERE event_type='diagnostic_completed'"
        ).fetchone()[0]
    )
    conn.close()
    assert set(metadata) == {
        "attempt_id",
        "version_id",
        "correct_count",
        "answered_count",
        "question_count",
        "skipped_count",
    }
