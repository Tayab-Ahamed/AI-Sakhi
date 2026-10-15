"""School-scoped diagnostic workflow. Short transactions; no legacy mastery writes."""

import json
from functools import wraps
from uuid import UUID, uuid4

from backend.db import now_iso
from backend.diagnostic_rules import (
    MAX_OPTIONS_JSON,
    diagnostic_snapshot,
    public_definition,
    score_definition,
    topological_ids,
    validate_answers,
    validate_definition,
)


class DiagnosticError(Exception):
    def __init__(self, status: int, detail: str):
        self.status, self.detail = status, detail


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _transaction(function):
    @wraps(function)
    def run(conn, *args, **kwargs):
        conn.execute("BEGIN IMMEDIATE")
        try:
            result = function(conn, *args, **kwargs)
            conn.commit()
            return result
        except Exception:
            conn.rollback()
            raise

    return run


def _intent(value):
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise DiagnosticError(422, "Creation key must be a UUID") from exc


def _account(conn, identity, roles):
    if identity.role not in roles or identity.organization_id is None:
        raise DiagnosticError(403, "Active school account with the required role needed")
    account = conn.execute(
        "SELECT class,role FROM users WHERE id=? AND organization_id=? AND is_active=1",
        (identity.user_id, identity.organization_id),
    ).fetchone()
    if not account or account["role"] != identity.role:
        raise DiagnosticError(403, "Active school account with the required role needed")
    return account


def _blueprint(conn, identity, blueprint_id):
    _account(conn, identity, ("teacher", "admin"))
    row = conn.execute(
        "SELECT * FROM diagnostic_blueprints WHERE id=? AND organization_id=?",
        (blueprint_id, identity.organization_id),
    ).fetchone()
    if row is None:
        raise DiagnosticError(404, "Assessment not found")
    return row


def version_metadata(row):
    snapshot = json.loads(row["snapshot_json"])
    return {
        **{
            k: row[k]
            for k in (
                "id",
                "blueprint_id",
                "version_number",
                "draft_revision",
                "class_level",
                "subject",
                "published_at",
                "withdrawn_at",
            )
        },
        "concept_count": len(snapshot["concepts"]),
        "question_count": sum(len(c["questions"]) for c in snapshot["concepts"]),
    }


def _latest(conn, blueprint_id):
    return conn.execute(
        "SELECT * FROM diagnostic_versions WHERE blueprint_id=? ORDER BY version_number DESC LIMIT 1",
        (blueprint_id,),
    ).fetchone()


def _selected_questions(conn, organization_id, definition):
    ids = [qid for c in definition["concepts"] for qid in c["question_ids"]]
    if not ids:
        return {}
    rows = conn.execute(
        "SELECT id,question_text,options_json,correct_answer,explanation FROM question_bank "
        "WHERE organization_id=? AND class_level=? AND subject=? AND status='approved' AND question_type='mcq' "
        "AND id IN (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
        "AND length(question_text) BETWEEN 1 AND 5000 AND length(options_json)<=? "
        "AND length(COALESCE(explanation,''))<=5000 AND length(correct_answer)<=5000",
        (
            organization_id,
            definition["class_level"],
            definition["subject"],
            *ids,
            *([None] * (18 - len(ids))),
            MAX_OPTIONS_JSON,
        ),
    ).fetchall()
    return {q["id"]: q for row in rows if (q := diagnostic_snapshot(dict(row))) is not None}


def read_blueprint(conn, identity, blueprint_id):
    row = _blueprint(conn, identity, blueprint_id)
    definition = json.loads(row["definition_json"])
    selected = _selected_questions(conn, identity.organization_id, definition)
    ids = [qid for c in definition["concepts"] for qid in c["question_ids"]]
    latest = _latest(conn, blueprint_id)
    return {
        "id": row["id"],
        "definition": definition,
        "draft_revision": row["draft_revision"],
        "latest_version": version_metadata(latest) if latest else None,
        "preview": [selected[qid] for qid in ids if qid in selected],
        "preview_warnings": [
            f"Question {qid} is unavailable for this draft." for qid in ids if qid not in selected
        ],
    }


@_transaction
def create_blueprint(conn, identity, creation_key, title, class_level, subject):
    _account(conn, identity, ("teacher", "admin"))
    creation_key = _intent(creation_key)
    definition = validate_definition(
        {"title": title, "class_level": class_level, "subject": subject, "concepts": []}
    )
    fingerprint = encode(definition)
    previous = conn.execute(
        "SELECT id,creation_fingerprint FROM diagnostic_blueprints WHERE organization_id=? AND created_by=? AND creation_key=?",
        (identity.organization_id, identity.user_id, creation_key),
    ).fetchone()
    if previous:
        if previous["creation_fingerprint"] != fingerprint:
            raise DiagnosticError(409, "Creation key already used for a different assessment intent")
        return read_blueprint(conn, identity, previous["id"])
    cursor = conn.execute(
        "INSERT INTO diagnostic_blueprints(organization_id,created_by,creation_key,creation_fingerprint,definition_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        (
            identity.organization_id,
            identity.user_id,
            creation_key,
            fingerprint,
            fingerprint,
            now_iso(),
            now_iso(),
        ),
    )
    return read_blueprint(conn, identity, cursor.lastrowid)


@_transaction
def save_blueprint(conn, identity, blueprint_id, expected_revision, definition):
    row = _blueprint(conn, identity, blueprint_id)
    if row["draft_revision"] != expected_revision:
        raise DiagnosticError(
            409, "Draft changed. Reload the saved draft before saving again; your local edits were not saved."
        )
    definition = validate_definition(definition)
    conn.execute(
        "UPDATE diagnostic_blueprints SET definition_json=?,draft_revision=draft_revision+1,updated_at=? WHERE id=?",
        (encode(definition), now_iso(), blueprint_id),
    )
    return read_blueprint(conn, identity, blueprint_id)


def _page(after_id, limit):
    if type(after_id) is not int or after_id < 0 or type(limit) is not int or not 1 <= limit <= 100:
        raise DiagnosticError(422, "Use a nonnegative cursor and page size 1-100")


def list_blueprints(conn, identity, after_id=0, limit=100):
    profile = _account(conn, identity, ("teacher", "admin", "student"))
    _page(after_id, limit)
    student = identity.role == "student"
    rows = conn.execute(
        "SELECT b.id,b.definition_json,b.draft_revision,v.id AS latest_id,v.snapshot_json,v.blueprint_id,"
        "v.version_number,v.draft_revision AS published_revision,v.class_level,v.subject,v.published_at,v.withdrawn_at "
        "FROM diagnostic_blueprints b LEFT JOIN diagnostic_versions v ON v.blueprint_id=b.id "
        "AND v.version_number=(SELECT MAX(v2.version_number) FROM diagnostic_versions v2 WHERE v2.blueprint_id=b.id) "
        "WHERE b.organization_id=? AND b.id>? AND (?=0 OR (v.class_level=? AND v.withdrawn_at IS NULL)) "
        "ORDER BY b.id LIMIT ?",
        (identity.organization_id, after_id, int(student), profile["class"], limit + 1),
    ).fetchall()
    cards = []
    for row in rows[:limit]:
        version = None
        if row["latest_id"] is not None:
            version = version_metadata(
                {**dict(row), "id": row["latest_id"], "draft_revision": row["published_revision"]}
            )
        definition = json.loads(row["snapshot_json"] if student else row["definition_json"])
        card = {
            "id": row["id"],
            **{k: definition[k] for k in ("title", "class_level", "subject")},
            "concept_count": len(definition["concepts"]),
            "question_count": sum(
                len(c["questions" if student else "question_ids"]) for c in definition["concepts"]
            ),
            "latest_version": version,
        }
        if not student:
            card["draft_revision"] = row["draft_revision"]
        cards.append(card)
    return {"blueprints": cards, "next_after_id": rows[limit - 1]["id"] if len(rows) > limit else None}


def question_candidates(conn, identity, blueprint_id, after_id=0, limit=100):
    row = _blueprint(conn, identity, blueprint_id)
    _page(after_id, limit)
    definition = json.loads(row["definition_json"])
    rows = conn.execute(
        "SELECT id,question_text,options_json,correct_answer,explanation FROM question_bank "
        "WHERE organization_id=? AND class_level=? AND subject=? AND status='approved' AND question_type='mcq' "
        "AND id>? AND length(question_text) BETWEEN 1 AND 5000 AND length(options_json)<=? "
        "AND length(COALESCE(explanation,''))<=5000 AND length(correct_answer)<=5000 ORDER BY id LIMIT ?",
        (
            identity.organization_id,
            definition["class_level"],
            definition["subject"],
            after_id,
            MAX_OPTIONS_JSON,
            limit + 1,
        ),
    ).fetchall()
    return {
        "questions": [q for row in rows[:limit] if (q := diagnostic_snapshot(dict(row))) is not None],
        "next_after_id": rows[limit - 1]["id"] if len(rows) > limit else None,
    }


@_transaction
def publish_blueprint(conn, identity, blueprint_id, expected_revision):
    row = _blueprint(conn, identity, blueprint_id)
    previous = conn.execute(
        "SELECT * FROM diagnostic_versions WHERE blueprint_id=? AND draft_revision=?",
        (blueprint_id, expected_revision),
    ).fetchone()
    if previous:
        return version_metadata(previous)  # Withdrawal remains terminal, including on replay.
    if expected_revision != row["draft_revision"]:
        raise DiagnosticError(409, "Draft changed. Reload before publishing.")
    definition = validate_definition(json.loads(row["definition_json"]), complete=True)
    questions = _selected_questions(conn, identity.organization_id, definition)
    if len(questions) != sum(len(c["question_ids"]) for c in definition["concepts"]):
        raise DiagnosticError(
            422,
            "One or more selected questions are unavailable or not eligible. Review the draft selections.",
        )
    concepts = {c["id"]: c for c in definition["concepts"]}
    snapshot = {
        **definition,
        "concepts": [
            {
                **{k: concepts[cid][k] for k in ("id", "label", "prerequisite_ids")},
                "questions": [questions[qid] for qid in concepts[cid]["question_ids"]],
            }
            for cid in topological_ids(definition["concepts"])
        ],
    }
    latest = _latest(conn, blueprint_id)
    cursor = conn.execute(
        "INSERT INTO diagnostic_versions(blueprint_id,organization_id,class_level,subject,version_number,draft_revision,snapshot_json,published_by,published_at) VALUES(?,?,?,?,?,?,?,?,?)",
        (
            blueprint_id,
            identity.organization_id,
            definition["class_level"],
            definition["subject"],
            latest["version_number"] + 1 if latest else 1,
            expected_revision,
            encode(snapshot),
            identity.user_id,
            now_iso(),
        ),
    )
    return version_metadata(
        conn.execute("SELECT * FROM diagnostic_versions WHERE id=?", (cursor.lastrowid,)).fetchone()
    )


@_transaction
def withdraw_version(conn, identity, version_id):
    _account(conn, identity, ("teacher", "admin"))
    row = conn.execute(
        "SELECT * FROM diagnostic_versions WHERE id=? AND organization_id=?",
        (version_id, identity.organization_id),
    ).fetchone()
    if row is None:
        raise DiagnosticError(404, "Publication not found")
    if row["withdrawn_at"] is None:
        conn.execute("UPDATE diagnostic_versions SET withdrawn_at=? WHERE id=?", (now_iso(), version_id))
    return version_metadata(
        conn.execute("SELECT * FROM diagnostic_versions WHERE id=?", (version_id,)).fetchone()
    )


def _attempt(conn, identity, attempt_id):
    profile = _account(conn, identity, ("student",))
    row = conn.execute(
        "SELECT a.*,v.snapshot_json,v.withdrawn_at FROM diagnostic_attempts a "
        "JOIN diagnostic_versions v ON v.id=a.version_id "
        "WHERE a.id=? AND a.user_id=? AND a.organization_id=? AND a.class_level=?",
        (attempt_id, identity.user_id, identity.organization_id, profile["class"]),
    ).fetchone()
    if row is None:
        raise DiagnosticError(404, "Assessment attempt not found")
    return row


def public_attempt(row):
    definition = public_definition(json.loads(row["snapshot_json"]))
    return {
        "id": row["id"],
        "version_id": row["version_id"],
        **definition,
        "status": row["status"],
        "result": json.loads(row["result_json"]) if row["result_json"] else None,
    }


def _check_content(conn, organization_id, version):
    if version["withdrawn_at"] is not None:
        raise DiagnosticError(
            409, "This publication was withdrawn by your school. Return to the assessment list."
        )
    snapshot = json.loads(version["snapshot_json"])
    definition = {
        **snapshot,
        "concepts": [
            {
                **{k: c[k] for k in ("id", "label", "prerequisite_ids")},
                "question_ids": [q["id"] for q in c["questions"]],
            }
            for c in snapshot["concepts"]
        ],
    }
    current = _selected_questions(conn, organization_id, definition)
    if any(current.get(q["id"]) != q for c in snapshot["concepts"] for q in c["questions"]):
        raise DiagnosticError(
            409, "Assessment content was recalled or changed by your school. Return to the assessment list."
        )


def read_attempt(conn, identity, attempt_id):
    row = _attempt(conn, identity, attempt_id)
    if row["status"] != "completed":
        _check_content(conn, identity.organization_id, row)
    return public_attempt(row)


@_transaction
def start_attempt(conn, identity, creation_key, version_id):
    profile = _account(conn, identity, ("student",))
    creation_key = _intent(creation_key)
    previous = conn.execute(
        "SELECT * FROM diagnostic_attempts WHERE user_id=? AND creation_key=?",
        (identity.user_id, creation_key),
    ).fetchone()
    if previous:
        if (previous["version_id"], previous["organization_id"], previous["class_level"]) != (
            version_id,
            identity.organization_id,
            profile["class"],
        ):
            raise DiagnosticError(409, "Creation key already used for a different assessment intent")
        return read_attempt(conn, identity, previous["id"])
    version = conn.execute(
        "SELECT * FROM diagnostic_versions WHERE id=? AND organization_id=? AND class_level=?",
        (version_id, identity.organization_id, profile["class"]),
    ).fetchone()
    if version is None:
        raise DiagnosticError(404, "Publication not found")
    latest = _latest(conn, version["blueprint_id"])
    if latest["id"] != version_id:
        raise DiagnosticError(409, "A newer publication is available. Reload the assessment list.")
    _check_content(conn, identity.organization_id, version)
    attempt_id = str(uuid4())
    conn.execute(
        "INSERT INTO diagnostic_attempts(id,user_id,organization_id,class_level,version_id,creation_key,status,created_at) VALUES(?,?,?,?,?,?,'active',?)",
        (
            attempt_id,
            identity.user_id,
            identity.organization_id,
            profile["class"],
            version_id,
            creation_key,
            now_iso(),
        ),
    )
    return public_attempt(_attempt(conn, identity, attempt_id))


@_transaction
def submit_attempt(conn, identity, attempt_id, answers):
    row = _attempt(conn, identity, attempt_id)
    snapshot = json.loads(row["snapshot_json"])
    validate_answers(snapshot, answers)
    encoded = encode(answers)
    if row["status"] == "completed":
        if encoded != row["answers_json"]:
            raise DiagnosticError(
                409, "This attempt is already completed with different answers. Load its stored result."
            )
        return public_attempt(row)
    _check_content(conn, identity.organization_id, row)
    result = score_definition(snapshot, answers)
    conn.execute(
        "UPDATE diagnostic_attempts SET status='completed',answers_json=?,result_json=?,submitted_at=? WHERE id=?",
        (encoded, encode(result), now_iso(), attempt_id),
    )
    metadata = {
        "attempt_id": attempt_id,
        "version_id": row["version_id"],
        **{k: result[k] for k in ("correct_count", "answered_count", "question_count", "skipped_count")},
    }
    conn.execute(
        "INSERT INTO learning_events(user_id,organization_id,event_type,metadata_json,created_at) VALUES(?,?,'diagnostic_completed',?,?)",
        (identity.user_id, identity.organization_id, encode(metadata), now_iso()),
    )
    return public_attempt(_attempt(conn, identity, attempt_id))
