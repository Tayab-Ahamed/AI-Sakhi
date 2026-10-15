"""Temporary-school diagnostic fixtures; no live DB or provider use."""

from uuid import uuid4

from backend import db
from backend.authz import Identity


def invoke(function, ids, actor, **kwargs):
    role = "student" if actor in ("classmate", "other_student") else actor.removeprefix("other_")
    identity = Identity(ids[actor], role, 2 if actor.startswith("other_") else 1)
    conn = db.get_connection()
    try:
        return function(conn, identity, **kwargs)
    finally:
        conn.close()


def approved_questions(client, headers, count, chapter="Diagnostic foundations"):
    result = []
    for position in range(count):
        response = client.post(
            "/v2/questions",
            headers=headers("teacher"),
            json={
                "class_level": "8",
                "subject": "Math",
                "chapter": chapter,
                "question_text": f"School diagnostic question {position + 1}: choose Yes.",
                "options": ["Yes", "No"],
                "correct_answer": "A",
                "explanation": "School explanation: Yes.",
            },
        )
        assert response.status_code == 200, response.text
        qid = response.json()["id"]
        assert (
            client.put(
                f"/v2/questions/{qid}/review", headers=headers("teacher"), json={"status": "approved"}
            ).status_code
            == 200
        )
        result.append(qid)
    return result


def published_blueprint(client, ids, headers, concepts=1):
    from backend import diagnostic_service as service

    questions = approved_questions(client, headers, concepts * 3)
    blueprint = invoke(
        service.create_blueprint,
        ids,
        "teacher",
        creation_key=str(uuid4()),
        title="School check",
        class_level="8",
        subject="Math",
    )
    definition = {
        **blueprint["definition"],
        "concepts": [
            {
                "id": "base" if i == 0 else "next",
                "label": "Foundations" if i == 0 else "Next idea",
                "prerequisite_ids": [] if i == 0 else ["base"],
                "question_ids": questions[i * 3 : i * 3 + 3],
            }
            for i in range(concepts)
        ],
    }
    blueprint = invoke(
        service.save_blueprint,
        ids,
        "teacher",
        blueprint_id=blueprint["id"],
        expected_revision=1,
        definition=definition,
    )
    version = invoke(
        service.publish_blueprint,
        ids,
        "teacher",
        blueprint_id=blueprint["id"],
        expected_revision=blueprint["draft_revision"],
    )
    return {"blueprint": blueprint, "version": version, "question_ids": questions, "definition": definition}
