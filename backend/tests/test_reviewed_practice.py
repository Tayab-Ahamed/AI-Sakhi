"""School-reviewed practice: answers and progress stay server-authoritative."""

import json
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from backend import db


@pytest.fixture
def practice_api(school_api):
    client, ids, headers, *_ = school_api
    question = {
        "class_level": "8",
        "subject": "Math",
        "chapter": "Fractions",
        "question_text": "Which represents one half?",
        "options": ["1/2", "1/3"],
        "correct_answer": "A",
        "explanation": "A half is one of two equal parts.",
    }

    def create(**changes):
        response = client.post("/v2/questions", headers=headers("teacher"), json={**question, **changes})
        assert response.status_code == 200
        return response.json()["id"]

    approved = create()
    assert (
        client.put(
            f"/v2/questions/{approved}/review", headers=headers("teacher"), json={"status": "approved"}
        ).status_code
        == 200
    )
    create(question_text="This draft must not appear")
    wrong_class = create(class_level="9")
    client.put(f"/v2/questions/{wrong_class}/review", headers=headers("teacher"), json={"status": "approved"})
    other = client.post("/v2/questions", headers=headers("other_teacher"), json=question).json()["id"]
    client.put(f"/v2/questions/{other}/review", headers=headers("other_teacher"), json={"status": "approved"})
    yield client, ids, headers, approved


def start(client, headers, **changes):
    return client.post(
        "/v2/practice/attempts",
        headers=headers("student"),
        json={"creation_key": str(uuid4()), "subject": "Math", "chapter": "Fractions", **changes},
    )


def submit(client, headers, attempt, question, answer=0, actor="student"):
    return client.post(
        f"/v2/practice/attempts/{attempt}/submission",
        headers=headers(actor),
        json={"answers": {str(question): answer}},
    )


def test_topics_and_attempts_never_expose_drafts_wrong_classes_or_keys(practice_api):
    client, _, headers, approved = practice_api
    topics = client.get("/v2/practice/topics", headers=headers("student"))
    assert topics.status_code == 200
    assert topics.json()["topics"] == [{"subject": "Math", "chapter": "Fractions", "question_count": 1}]
    response = start(client, headers)
    assert response.status_code == 201
    assert [q["id"] for q in response.json()["questions"]] == [approved]
    assert "correct" not in response.text
    assert "explanation" not in response.text
    assert (
        client.get(f"/v2/practice/attempts/{response.json()['id']}", headers=headers("student")).json()
        == response.json()
    )


def test_attempt_ids_do_not_allow_other_learners_or_schools(practice_api):
    client, _, headers, approved = practice_api
    attempt = start(client, headers).json()["id"]
    for actor in ("classmate", "other_student", "teacher", "parent", "admin"):
        response = client.get(f"/v2/practice/attempts/{attempt}", headers=headers(actor))
        assert response.status_code in {403, 404}
        assert submit(client, headers, attempt, approved, actor=actor).status_code in {403, 404}
    other_attempt = client.post(
        "/v2/practice/attempts",
        headers=headers("other_student"),
        json={"creation_key": str(uuid4()), "subject": "Math", "chapter": "Fractions"},
    ).json()
    assert all(q["id"] != approved for q in other_attempt["questions"])


def test_creation_retry_is_stable_and_changed_intent_conflicts(practice_api):
    client, _, headers, _ = practice_api
    key = str(uuid4())
    first = start(client, headers, creation_key=key)
    retry = start(client, headers, creation_key=key)
    assert first.json() == retry.json()
    assert start(client, headers, creation_key=key, chapter="Another").status_code == 409


def test_submission_is_server_scored_and_retry_does_not_duplicate_progress(practice_api):
    client, ids, headers, approved = practice_api
    attempt = start(client, headers).json()["id"]
    response = submit(client, headers, attempt, approved)
    assert response.status_code == 200
    assert response.json()["result"]["score"] == 1
    assert "two equal parts" in response.json()["result"]["items"][0]["explanation"]
    assert submit(client, headers, attempt, approved).json() == response.json()
    assert submit(client, headers, attempt, approved, answer=1).status_code == 409
    conn = db.get_connection()
    assert conn.execute("SELECT COUNT(*) FROM progress WHERE user_id=?", (ids["student"],)).fetchone()[0] == 1
    conn.close()
    mastery = client.get(f"/v2/mastery/{ids['student']}", headers=headers("student")).json()["mastery"]
    assert mastery[0]["score"] == 100
    assert mastery[0]["confidence"] == "low"


@pytest.mark.parametrize("answers", [{}, {"999": 0}, {"1": -1}, {"1": 99}, {"1": True}, {"1": "0"}])
def test_malformed_answers_do_not_create_progress(practice_api, answers):
    client, ids, headers, _ = practice_api
    attempt = start(client, headers).json()["id"]
    response = client.post(
        f"/v2/practice/attempts/{attempt}/submission", headers=headers("student"), json={"answers": answers}
    )
    assert response.status_code == 422
    conn = db.get_connection()
    assert conn.execute("SELECT COUNT(*) FROM progress WHERE user_id=?", (ids["student"],)).fetchone()[0] == 0
    conn.close()


def test_client_cannot_supply_answer_key_or_score(practice_api):
    client, _, headers, approved = practice_api
    attempt = start(client, headers).json()["id"]
    response = client.post(
        f"/v2/practice/attempts/{attempt}/submission",
        headers=headers("student"),
        json={"answers": {str(approved): 1}, "score": 10, "correct_answer": 1},
    )
    assert response.status_code == 422
    assert submit(client, headers, attempt, approved, answer=1).json()["result"]["score"] == 0


def test_recalled_question_prevents_pending_submission(practice_api):
    client, _, headers, approved = practice_api
    attempt = start(client, headers).json()["id"]
    client.put(f"/v2/questions/{approved}/review", headers=headers("teacher"), json={"status": "rejected"})
    assert submit(client, headers, attempt, approved).status_code == 409
    assert start(client, headers).status_code == 404


def test_recalled_question_is_not_served_by_read_or_creation_retry(practice_api):
    client, _, headers, approved = practice_api
    key = str(uuid4())
    attempt = start(client, headers, creation_key=key).json()["id"]
    client.put(f"/v2/questions/{approved}/review", headers=headers("teacher"), json={"status": "rejected"})
    assert client.get(f"/v2/practice/attempts/{attempt}", headers=headers("student")).status_code == 409
    assert start(client, headers, creation_key=key).status_code == 409


def test_completed_history_and_identical_retry_survive_later_question_recall(practice_api):
    client, _, headers, approved = practice_api
    attempt = start(client, headers).json()["id"]
    completed = submit(client, headers, attempt, approved).json()
    client.put(f"/v2/questions/{approved}/review", headers=headers("teacher"), json={"status": "rejected"})
    assert client.get(f"/v2/practice/attempts/{attempt}", headers=headers("student")).json() == completed
    assert submit(client, headers, attempt, approved).json() == completed


def test_concurrent_submission_commits_once(practice_api):
    client, ids, headers, approved = practice_api
    attempt = start(client, headers).json()["id"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: submit(client, headers, attempt, approved), range(4)))
    assert [r.status_code for r in responses] == [200] * 4
    assert all(r.json() == responses[0].json() for r in responses)
    conn = db.get_connection()
    assert conn.execute("SELECT COUNT(*) FROM progress WHERE user_id=?", (ids["student"],)).fetchone()[0] == 1
    conn.close()


def test_concurrent_creation_has_one_stable_attempt(practice_api):
    client, _, headers, _ = practice_api
    key = str(uuid4())
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: start(client, headers, creation_key=key), range(4)))
    assert [r.status_code for r in responses] == [201] * 4
    assert len({r.json()["id"] for r in responses}) == 1


def test_failed_scoring_rolls_back_progress_and_attempt(practice_api, monkeypatch):
    from backend import practice_service

    client, ids, headers, approved = practice_api
    attempt = start(client, headers).json()["id"]

    def fail_after_progress(conn, *args):
        db.record_progress(conn, *args)
        raise RuntimeError("Synthetic interrupted transaction")

    monkeypatch.setattr(practice_service, "record_progress", fail_after_progress)
    with pytest.raises(RuntimeError, match="Synthetic interrupted"):
        submit(client, headers, attempt, approved)
    conn = db.get_connection()
    assert conn.execute("SELECT COUNT(*) FROM progress WHERE user_id=?", (ids["student"],)).fetchone()[0] == 0
    assert (
        conn.execute("SELECT status FROM practice_attempts WHERE id=?", (attempt,)).fetchone()[0] == "active"
    )
    conn.close()


def test_school_or_class_changes_invalidate_old_attempt_access(practice_api):
    client, ids, headers, approved = practice_api
    attempt = start(client, headers).json()["id"]
    conn = db.get_connection()
    conn.execute("UPDATE users SET class='9' WHERE id=?", (ids["student"],))
    conn.commit()
    conn.close()
    assert submit(client, headers, attempt, approved).status_code == 404


def test_malformed_historical_approved_question_is_not_served(practice_api):
    client, _, headers, approved = practice_api
    conn = db.get_connection()
    conn.execute("UPDATE question_bank SET correct_answer='not an option' WHERE id=?", (approved,))
    conn.commit()
    conn.close()
    assert client.get("/v2/practice/topics", headers=headers("student")).json()["topics"] == []
    assert start(client, headers).status_code == 404


def test_practice_is_in_privacy_export_and_erasure_without_pending_keys(practice_api):
    from backend.privacy_service import erase_account, export_data

    client, ids, headers, _ = practice_api
    start(client, headers)
    conn = db.get_connection()
    exported = export_data(conn, ids["student"])["practice_attempts"]
    assert len(exported) == 1
    assert "correct_index" not in json.dumps(exported)
    assert "questions_json" not in json.dumps(exported)
    erase_account(conn, ids["student"])
    conn.commit()
    assert (
        conn.execute("SELECT COUNT(*) FROM practice_attempts WHERE user_id=?", (ids["student"],)).fetchone()[
            0
        ]
        == 0
    )
    conn.close()
