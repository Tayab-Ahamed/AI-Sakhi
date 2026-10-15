"""Temporary-school diagnostic fixtures; no live DB or provider use."""

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
