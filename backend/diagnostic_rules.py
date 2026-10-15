"""Bounded school-defined graphs and tentative evidence; no I/O or model calls."""

import re

from backend.question_rules import mcq_snapshot

CONCEPT_ID = re.compile(r"^[a-z][a-z0-9-]{0,39}$")
# Ten 1,000-character strings, worst-case escaped JSON plus separators.
MAX_OPTIONS_JSON = 60_040
LIMITATIONS = (
    "Tentative evidence, not proof of mastery or a validated diagnosis. "
    "These thresholds are product heuristics. Repeated questions are not independent evidence of improvement. "
    "Prerequisite relationships are school-defined suggestions, not established learning dependencies."
)


class DiagnosticRuleError(ValueError):
    """A bounded, safe validation message without private question content."""


def _text(value, name, maximum):
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= maximum:
        raise DiagnosticRuleError(f"{name} must contain 1-{maximum} trimmed characters")
    return value.strip()


def topological_ids(concepts):
    ids = [c["id"] for c in concepts]
    if len(set(ids)) != len(ids):
        raise DiagnosticRuleError("Concept IDs must be unique")
    pending = {}
    for concept in concepts:
        edges = concept["prerequisite_ids"]
        if len(set(edges)) != len(edges):
            raise DiagnosticRuleError("Duplicate prerequisite selection")
        if concept["id"] in edges:
            raise DiagnosticRuleError("A concept cannot require itself")
        if any(edge not in ids for edge in edges):
            raise DiagnosticRuleError("Remove references to missing or renamed concepts")
        pending[concept["id"]] = set(edges)
    ordered = []
    while pending:
        ready = next((cid for cid in ids if cid in pending and not pending[cid]), None)
        if ready is None:
            raise DiagnosticRuleError("Prerequisites must not form a cycle")
        ordered.append(ready)
        del pending[ready]
        for edges in pending.values():
            edges.discard(ready)
    return ordered


def validate_definition(definition, *, complete=False):
    if not isinstance(definition, dict) or set(definition) != {"title", "class_level", "subject", "concepts"}:
        raise DiagnosticRuleError("Provide title, class_level, subject and concepts only")
    result = {
        name: _text(definition.get(name), name, bound)
        for name, bound in (("title", 120), ("class_level", 20), ("subject", 100))
    }
    concepts = definition["concepts"]
    if not isinstance(concepts, list) or not (1 if complete else 0) <= len(concepts) <= 6:
        raise DiagnosticRuleError("Use 1-6 concepts to publish; drafts may be empty")
    normalized = []
    used_questions = set()
    for concept in concepts:
        if not isinstance(concept, dict) or set(concept) != {
            "id",
            "label",
            "prerequisite_ids",
            "question_ids",
        }:
            raise DiagnosticRuleError("Each concept needs id, label, prerequisite_ids and question_ids only")
        cid = concept["id"]
        if not isinstance(cid, str) or not CONCEPT_ID.fullmatch(cid):
            raise DiagnosticRuleError(
                "Concept ID must start with a lowercase letter; use up to 40 lowercase letters, digits or hyphens"
            )
        edges, questions = concept["prerequisite_ids"], concept["question_ids"]
        if not isinstance(edges, list) or len(edges) > 5 or any(not isinstance(e, str) for e in edges):
            raise DiagnosticRuleError("Use up to five local prerequisite IDs")
        if not isinstance(questions, list) or not (3 if complete else 0) <= len(questions) <= 3:
            raise DiagnosticRuleError("Select exactly three questions per concept to publish")
        for qid in questions:
            if type(qid) is not int or not 1 <= qid <= 2**63 - 1 or qid in used_questions:
                raise DiagnosticRuleError(
                    "Question IDs must be distinct positive integers across the assessment"
                )
            used_questions.add(qid)
        normalized.append(
            {
                "id": cid,
                "label": _text(concept["label"], "Concept label", 80),
                "prerequisite_ids": list(edges),
                "question_ids": list(questions),
            }
        )
    topological_ids(normalized)
    return {**result, "concepts": normalized}


def diagnostic_snapshot(row):
    for field in ("question_text", "explanation", "options_json", "correct_answer"):
        value = row.get(field)
        if field == "explanation" and value is None:
            continue
        cap = MAX_OPTIONS_JSON if field == "options_json" else 5000
        if not isinstance(value, str) or len(value) > cap:
            return None
    result = mcq_snapshot(row)
    if result is None or not result["question_text"].strip() or any(len(o) > 1000 for o in result["options"]):
        return None
    return result


def public_definition(snapshot):
    return {
        **{k: snapshot[k] for k in ("title", "class_level", "subject")},
        "concepts": [
            {
                **{k: c[k] for k in ("id", "label", "prerequisite_ids")},
                "questions": [{k: q[k] for k in ("id", "question_text", "options")} for q in c["questions"]],
            }
            for c in snapshot["concepts"]
        ],
    }


def validate_answers(snapshot, answers):
    questions = [q for c in snapshot["concepts"] for q in c["questions"]]
    if not isinstance(answers, dict) or set(answers) != {str(q["id"]) for q in questions}:
        raise DiagnosticRuleError(
            "Choose an option or explicitly skip every question; provide exactly its question ID"
        )
    for q in questions:
        value = answers[str(q["id"])]
        if value is not None and (type(value) is not int or not 0 <= value < len(q["options"])):
            raise DiagnosticRuleError("Answers must be integer option indices or null for an explicit skip")


def score_definition(snapshot, answers):
    validate_answers(snapshot, answers)
    by_id = {c["id"]: c for c in snapshot["concepts"]}
    ordered = topological_ids(snapshot["concepts"])
    results, items, ancestors = {}, [], {}
    for cid in ordered:
        concept = by_id[cid]
        feedback = [
            {
                "question_id": q["id"],
                "selected_index": answers[str(q["id"])],
                "correct_index": q["correct_index"],
                "is_skipped": answers[str(q["id"])] is None,
                "is_correct": answers[str(q["id"])] == q["correct_index"],
                "explanation": q["explanation"],
            }
            for q in concept["questions"]
        ]
        items.extend(feedback)
        answered = sum(not item["is_skipped"] for item in feedback)
        correct = sum(item["is_correct"] for item in feedback)
        state = (
            "insufficient_evidence"
            if answered < 3
            else "review_suggested"
            if correct < 2
            else "provisional_strength"
        )
        ancestors[cid] = set(concept["prerequisite_ids"])
        for parent in concept["prerequisite_ids"]:
            ancestors[cid].update(ancestors[parent])

        def prerequisite_evidence(target, current_id=cid):
            return [
                {"id": aid, "label": by_id[aid]["label"]}
                for aid in ordered
                if aid in ancestors[current_id] and results[aid]["state"] == target
            ]

        results[cid] = {
            "id": cid,
            "label": concept["label"],
            "question_count": len(feedback),
            "answered_count": answered,
            "correct_count": correct,
            "skipped_count": len(feedback) - answered,
            "state": state,
            "review_prerequisites": prerequisite_evidence("review_suggested"),
            "unassessed_prerequisites": prerequisite_evidence("insufficient_evidence"),
        }
    target = next((results[cid] for cid in ordered if results[cid]["state"] != "provisional_strength"), None)
    if target:
        kind = "collect_evidence" if target["state"] == "insufficient_evidence" else "review"
        reason = (
            f"{target['label']}: {target['answered_count']}/{target['question_count']} answered, "
            f"{target['correct_count']} correct. "
            + ("Gather more evidence." if kind == "collect_evidence" else "These answers suggest a review.")
        )
        relations = by_id[target["id"]]["prerequisite_ids"]
        if relations:
            reason += (
                " School-defined prerequisites: " + ", ".join(by_id[p]["label"] for p in relations) + "."
            )
        else:
            reason += " No prerequisite evidence is required by this school's graph."
        next_action = {"kind": kind, "concept_id": target["id"], "reason": reason, "href": "/practice"}
    else:
        next_action = {
            "kind": "spaced_practice",
            "concept_id": None,
            "reason": f"{len(items)}/{len(items)} answered, {sum(item['is_correct'] for item in items)} correct. Every concept shows provisional strength; use spaced practice, not a claim of mastery.",
            "href": "/practice",
        }
    answered = sum(not item["is_skipped"] for item in items)
    return {
        "correct_count": sum(item["is_correct"] for item in items),
        "answered_count": answered,
        "question_count": len(items),
        "skipped_count": len(items) - answered,
        "concept_results": [results[cid] for cid in ordered],
        "items": items,
        "next_action": next_action,
        "limitations": LIMITATIONS,
    }
