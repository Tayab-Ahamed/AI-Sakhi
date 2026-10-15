import copy
import json

import pytest


@pytest.fixture
def snapshot():
    return {
        "title": "School check",
        "class_level": "8",
        "subject": "Math",
        "concepts": [
            {
                "id": cid,
                "label": label,
                "prerequisite_ids": [] if pos == 0 else ["base"],
                "questions": [
                    {
                        "id": pos * 3 + i,
                        "question_text": f"School question {pos * 3 + i}",
                        "options": ["Yes", "No"],
                        "correct_index": 0,
                        "explanation": "School explanation",
                    }
                    for i in range(1, 4)
                ],
            }
            for pos, (cid, label) in enumerate((("base", "Foundations"), ("next", "Next idea")))
        ],
    }


def definition(snapshot):
    result = copy.deepcopy(snapshot)
    for concept in result["concepts"]:
        concept["question_ids"] = [q["id"] for q in concept.pop("questions")]
    return result


@pytest.mark.parametrize(
    "answers,state,correct,answered,kind",
    [
        ({str(i): None for i in range(1, 7)}, "insufficient_evidence", 0, 0, "collect_evidence"),
        ({str(i): 0 for i in range(1, 7)}, "provisional_strength", 6, 6, "spaced_practice"),
        ({str(i): 1 for i in range(1, 7)}, "review_suggested", 0, 6, "review"),
    ],
)
def test_evidence_states(snapshot, answers, state, correct, answered, kind):
    from backend.diagnostic_rules import score_definition

    result = score_definition(snapshot, answers)
    assert result["correct_count"] == correct
    assert result["answered_count"] == answered
    assert result["skipped_count"] == 6 - answered
    assert all(c["state"] == state for c in result["concept_results"])
    assert result["next_action"]["kind"] == kind
    assert result["next_action"]["href"] == "/practice"
    assert "not proof of mastery" in result["limitations"]


def test_prerequisite_evidence_and_partial_counts(snapshot):
    from backend.diagnostic_rules import score_definition

    answers = {str(i): (1 if i <= 3 else 0) for i in range(1, 7)}
    result = score_definition(snapshot, answers)
    assert result["concept_results"][1]["review_prerequisites"] == [{"id": "base", "label": "Foundations"}]
    assert result["next_action"]["concept_id"] == "base"
    answers["1"] = None
    result = score_definition(snapshot, answers)
    assert result["answered_count"] == 5
    assert result["concept_results"][1]["unassessed_prerequisites"] == [
        {"id": "base", "label": "Foundations"}
    ]
    assert result["items"][0]["is_correct"] is False
    assert result["items"][0]["is_skipped"] is True


@pytest.mark.parametrize(
    "change",
    [
        lambda d: d.update(title=" "),
        lambda d: d.update(title="x" * 121),
        lambda d: d.update(class_level="x" * 21),
        lambda d: d.update(subject="x" * 101),
        lambda d: d["concepts"][0].update(id="INVALID"),
        lambda d: d["concepts"][1].update(id="base"),
        lambda d: d["concepts"][0].update(label=" "),
        lambda d: d["concepts"][0].update(label="x" * 81),
        lambda d: d["concepts"][1].update(prerequisite_ids=["missing"]),
        lambda d: d["concepts"][1].update(prerequisite_ids=["next"]),
        lambda d: d["concepts"][1].update(prerequisite_ids=["base", "base"]),
        lambda d: d["concepts"][0].update(prerequisite_ids=["next"]),
        lambda d: d["concepts"][0].update(id="renamed"),
        lambda d: d["concepts"].pop(0),
        lambda d: d["concepts"][1].update(question_ids=[1, 5, 6]),
        lambda d: d["concepts"][0].update(question_ids=[1, 1, 2]),
        lambda d: d["concepts"][0].update(question_ids=[True]),
        lambda d: d.update(concepts=d["concepts"] * 4),
    ],
)
def test_invalid_drafts(snapshot, change):
    from backend.diagnostic_rules import DiagnosticRuleError, validate_definition

    draft = definition(snapshot)
    change(draft)
    with pytest.raises(DiagnosticRuleError):
        validate_definition(draft)


def test_draft_incomplete_and_unicode_normalization(snapshot):
    from backend.diagnostic_rules import DiagnosticRuleError, validate_definition

    draft = definition(snapshot)
    draft["title"] = "  Check  "
    draft["concepts"][0].update(label="  आधार  ", question_ids=[])
    assert validate_definition(draft)["concepts"][0]["label"] == "आधार"
    assert validate_definition(draft)["title"] == "Check"
    with pytest.raises(DiagnosticRuleError):
        validate_definition(draft, complete=True)
    draft["concepts"] = []
    assert validate_definition(draft)["concepts"] == []
    with pytest.raises(DiagnosticRuleError):
        validate_definition(draft, complete=True)


def test_stable_topology_and_indirect_cycles():
    from backend.diagnostic_rules import DiagnosticRuleError, topological_ids

    concepts = [
        {"id": "z", "prerequisite_ids": ["a"]},
        {"id": "b", "prerequisite_ids": []},
        {"id": "a", "prerequisite_ids": []},
    ]
    assert topological_ids(concepts) == ["b", "a", "z"]
    concepts[1]["prerequisite_ids"] = ["z"]
    concepts[2]["prerequisite_ids"] = ["b"]
    with pytest.raises(DiagnosticRuleError):
        topological_ids(concepts)


@pytest.mark.parametrize("value", [True, "0", 0.0, -1, 2, {}, []])
def test_strict_answers(snapshot, value):
    from backend.diagnostic_rules import DiagnosticRuleError, score_definition

    answers = {str(i): 0 for i in range(1, 7)}
    answers["1"] = value
    with pytest.raises(DiagnosticRuleError):
        score_definition(snapshot, answers)


@pytest.mark.parametrize("answers", [{}, {str(i): 0 for i in range(1, 8)}, {"01": 0}])
def test_exact_question_ids(snapshot, answers):
    from backend.diagnostic_rules import DiagnosticRuleError, score_definition

    with pytest.raises(DiagnosticRuleError):
        score_definition(snapshot, answers)


def test_two_correct_is_provisional_not_confirmed(snapshot):
    from backend.diagnostic_rules import score_definition

    answers = {str(i): (1 if i % 3 == 0 else 0) for i in range(1, 7)}
    assert all(
        c["state"] == "provisional_strength" for c in score_definition(snapshot, answers)["concept_results"]
    )


def test_public_projection_never_exposes_keys(snapshot):
    from backend.diagnostic_rules import public_definition

    public = json.dumps(public_definition(snapshot))
    assert "correct_index" not in public and "explanation" not in public
    assert "School question" in public


@pytest.mark.parametrize(
    "field,value",
    [
        ("options_json", "x" * 60021),
        ("options_json", json.dumps(["x" * 1001, "No"])),
        ("question_text", "x" * 5001),
        ("explanation", "x" * 5001),
    ],
    ids=["raw-json", "option", "text", "explanation"],
)
def test_historical_content_bounds(field, value):
    from backend.diagnostic_rules import diagnostic_snapshot

    row = {
        "id": 1,
        "question_text": "School question",
        "options_json": '["Yes","No"]',
        "correct_answer": "A",
        "explanation": "",
    }
    row[field] = value
    assert diagnostic_snapshot(row) is None
