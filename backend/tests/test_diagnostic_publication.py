import json
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from backend import db
from backend import diagnostic_service as service
from backend.diagnostic_rules import DiagnosticRuleError
from backend.tests.diagnostic_helpers import approved_questions, invoke, published_blueprint


def test_publication_retry_after_withdrawal_and_later_draft(school_api):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    version, blueprint = configured["version"], configured["blueprint"]
    withdrawn = invoke(service.withdraw_version, ids, "teacher", version_id=version["id"])
    assert invoke(service.withdraw_version, ids, "teacher", version_id=version["id"]) == withdrawn
    invoke(
        service.save_blueprint,
        ids,
        "teacher",
        blueprint_id=blueprint["id"],
        expected_revision=blueprint["draft_revision"],
        definition=configured["definition"],
    )
    replay = invoke(
        service.publish_blueprint,
        ids,
        "teacher",
        blueprint_id=blueprint["id"],
        expected_revision=version["draft_revision"],
    )
    assert replay == withdrawn
    assert invoke(service.list_blueprints, ids, "student")["blueprints"] == []


def test_publish_requires_complete_coverage(school_api):
    _, ids, *_ = school_api
    draft = invoke(
        service.create_blueprint,
        ids,
        "teacher",
        creation_key=str(uuid4()),
        title="Check",
        class_level="8",
        subject="Math",
    )
    with pytest.raises(DiagnosticRuleError):
        invoke(service.publish_blueprint, ids, "teacher", blueprint_id=draft["id"], expected_revision=1)


@pytest.mark.parametrize(
    "change",
    [
        {"organization_id": 2},
        {"class_level": "9"},
        {"subject": "Mathematics"},
        {"status": "draft"},
        {"options_json": '["Yes", " yes "]'},
        {"options_json": '["' + "x" * 1001 + '", "No"]'},
    ],
    ids=["school", "class", "exact-subject", "status", "duplicate-options", "long-option"],
)
def test_unavailable_questions_block_new_publication_without_leaking_content(school_api, change):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    conn = db.get_connection()
    for name, value in change.items():
        conn.execute(f"UPDATE question_bank SET {name}=? WHERE id=?", (value, configured["question_ids"][0]))
    conn.commit()
    conn.close()
    saved = invoke(
        service.save_blueprint,
        ids,
        "teacher",
        blueprint_id=configured["blueprint"]["id"],
        expected_revision=2,
        definition=configured["definition"],
    )
    assert len(saved["preview_warnings"]) == 1
    with pytest.raises(service.DiagnosticError) as error:
        invoke(service.publish_blueprint, ids, "teacher", blueprint_id=saved["id"], expected_revision=3)
    assert error.value.status == 422
    assert "School explanation" not in error.value.detail
    conn = db.get_connection()
    assert conn.execute("SELECT COUNT(*) FROM diagnostic_versions").fetchone()[0] == 1
    conn.close()


def test_concurrent_publication_and_withdrawn_latest_no_fallback(school_api):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    saved = invoke(
        service.save_blueprint,
        ids,
        "teacher",
        blueprint_id=configured["blueprint"]["id"],
        expected_revision=2,
        definition=configured["definition"],
    )
    with ThreadPoolExecutor(max_workers=4) as pool:
        versions = list(
            pool.map(
                lambda _: invoke(
                    service.publish_blueprint, ids, "teacher", blueprint_id=saved["id"], expected_revision=3
                ),
                range(4),
            )
        )
    assert len({v["id"] for v in versions}) == 1
    assert versions[0]["version_number"] == 2
    student = invoke(service.list_blueprints, ids, "student")
    assert student["blueprints"][0]["latest_version"]["id"] == versions[0]["id"]
    assert "correct_index" not in json.dumps(student) and "explanation" not in json.dumps(student)
    invoke(service.withdraw_version, ids, "teacher", version_id=versions[0]["id"])
    assert invoke(service.list_blueprints, ids, "student")["blueprints"] == []


def test_candidate_cursor_advances_through_invalid_historical_page(school_api):
    client, ids, headers, *_ = school_api
    draft = invoke(
        service.create_blueprint,
        ids,
        "teacher",
        creation_key=str(uuid4()),
        title="Check",
        class_level="8",
        subject="Math",
    )
    first = approved_questions(client, headers, 1)[0]
    conn = db.get_connection()
    conn.execute("UPDATE question_bank SET options_json='broken' WHERE id=?", (first,))
    for _ in range(100):
        conn.execute(
            "INSERT INTO question_bank(organization_id,created_by,class_level,subject,chapter,question_text,question_type,difficulty,options_json,correct_answer,explanation,status,created_at,updated_at) SELECT organization_id,created_by,class_level,subject,chapter,question_text,question_type,difficulty,options_json,correct_answer,explanation,status,created_at,updated_at FROM question_bank WHERE id=?",
            (first,),
        )
    conn.commit()
    conn.close()
    valid = approved_questions(client, headers, 1)[0]
    page = invoke(service.question_candidates, ids, "teacher", blueprint_id=draft["id"], limit=100)
    assert page["questions"] == []
    assert page["next_after_id"] > first
    next_page = invoke(
        service.question_candidates,
        ids,
        "teacher",
        blueprint_id=draft["id"],
        limit=100,
        after_id=page["next_after_id"],
    )
    assert [q["id"] for q in next_page["questions"]] == [valid]
    assert next_page["next_after_id"] is None


def test_foreign_withdrawal_is_not_found(school_api):
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    with pytest.raises(service.DiagnosticError) as error:
        invoke(service.withdraw_version, ids, "other_teacher", version_id=configured["version"]["id"])
    assert error.value.status == 404
