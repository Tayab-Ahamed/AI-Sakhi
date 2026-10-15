"""Diagnostic privacy projections. The canonical privacy transaction owns commit/rollback."""

import json

from backend.db import now_iso
from backend.diagnostic_service import encode, public_attempt, version_metadata


def export_diagnostics(conn, user_id):
    attempts = []
    for row in conn.execute(
        "SELECT a.*,v.snapshot_json FROM diagnostic_attempts a JOIN diagnostic_versions v ON v.id=a.version_id "
        "WHERE a.user_id=? ORDER BY a.created_at,a.id",
        (user_id,),
    ):
        attempt = {
            **public_attempt(row),
            "created_at": row["created_at"],
            "submitted_at": row["submitted_at"],
        }
        if row["status"] == "completed":
            attempt["answers"] = json.loads(row["answers_json"])
        attempts.append(attempt)
    authored = [
        {
            "id": row["id"],
            "definition": json.loads(row["definition_json"]),
            "draft_revision": row["draft_revision"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in conn.execute(
            "SELECT * FROM diagnostic_blueprints WHERE created_by=? ORDER BY id", (user_id,)
        )
    ]
    publications = [
        {**version_metadata(row), "snapshot": json.loads(row["snapshot_json"])}
        for row in conn.execute(
            "SELECT * FROM diagnostic_versions WHERE published_by=? ORDER BY id", (user_id,)
        )
    ]
    return {
        "diagnostic_attempts": attempts,
        "authored_diagnostic_blueprints": authored,
        "authored_diagnostic_versions": publications,
    }


def erase_diagnostics(conn, user_id):
    conn.execute("DELETE FROM diagnostic_attempts WHERE user_id=?", (user_id,))
    conn.execute(
        "UPDATE diagnostic_versions SET withdrawn_at=COALESCE(withdrawn_at,?) "
        "WHERE published_by=? OR blueprint_id IN (SELECT id FROM diagnostic_blueprints WHERE created_by=?)",
        (now_iso(), user_id, user_id),
    )
    conn.execute("UPDATE diagnostic_versions SET published_by=NULL WHERE published_by=?", (user_id,))
    conn.execute(
        "DELETE FROM diagnostic_blueprints WHERE created_by=? "
        "AND NOT EXISTS(SELECT 1 FROM diagnostic_versions WHERE blueprint_id=diagnostic_blueprints.id)",
        (user_id,),
    )
    # Do not retain the original creation fingerprint's free text after authorship erasure.
    empty = {
        "title": "Assessment draft (author erased)",
        "class_level": "Unassigned",
        "subject": "Unassigned",
        "concepts": [],
    }
    conn.execute(
        "UPDATE diagnostic_blueprints SET created_by=NULL,definition_json=?,creation_fingerprint=?,"
        "draft_revision=draft_revision+1,updated_at=? WHERE created_by=?",
        (encode(empty), "[erased]", now_iso(), user_id),
    )
