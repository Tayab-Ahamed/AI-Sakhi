import json

import pytest


def question(options=None, answer="A"):
    return {
        "id": 1,
        "question_text": "Choose a value",
        "options_json": json.dumps(options or ["One", "Two"]),
        "correct_answer": answer,
        "explanation": "School explanation",
    }


def test_letter_key_keeps_precedence_over_option_text():
    from backend.question_rules import mcq_snapshot

    assert mcq_snapshot(question(["B", "A"]))["correct_index"] == 0


@pytest.mark.parametrize(
    "options", [["One", " one "], ["One"], list(map(str, range(11))), ["", "Two"], [1, "Two"], {"A": "One"}]
)
def test_invalid_options_are_not_eligible(options):
    from backend.question_rules import mcq_snapshot

    assert mcq_snapshot(question(options)) is None


def test_malformed_json_is_not_eligible():
    from backend.question_rules import mcq_snapshot

    assert mcq_snapshot({**question(), "options_json": "not json"}) is None


@pytest.mark.parametrize("answer,index", [("Two", 1), ("b", 1), ("Z", None), ("missing", None)])
def test_answer_interpretation(answer, index):
    from backend.question_rules import mcq_snapshot

    result = mcq_snapshot(question(answer=answer))
    assert (result["correct_index"] if result else None) == index
