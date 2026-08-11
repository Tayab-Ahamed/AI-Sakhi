"""Versioned, forward-only schema migrations for SQLite.

The previous approach (`_ensure_column` sprinkled through the data layer) made
the live schema depend on which code path ran first. This module gives the
schema a single ordered history with a recorded version, so every environment
converges on the same shape and drift is detectable.

Migrations are plain SQL statements. They must be idempotent-safe: the runner
skips any migration whose version is already recorded, and each migration runs
inside a transaction.
"""
from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Callable, Sequence

logger = logging.getLogger("sakhi.migrations")


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    statements: Sequence[str] = ()
    python: Callable[[sqlite3.Connection], None] | None = None


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return row is not None


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    if not _table_exists(conn, table):
        return set()
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    if not _table_exists(conn, table):
        return
    if column not in _columns(conn, table):
        conn.execute(f'ALTER TABLE {table} ADD COLUMN "{column}" {ddl}')


def _m002_auth_token_columns(conn: sqlite3.Connection) -> None:
    """Store a token *identifier* (jti) and a hash, never the raw JWT."""
    _add_column_if_missing(conn, "auth_tokens", "jti", "TEXT")
    _add_column_if_missing(conn, "auth_tokens", "token_hash", "TEXT")
    _add_column_if_missing(conn, "auth_tokens", "last_used_at", "TEXT")
    if _table_exists(conn, "auth_tokens"):
        conn.execute("CREATE INDEX IF NOT EXISTS idx_auth_tokens_jti ON auth_tokens(jti)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at)")


def _m003_safety_events(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS safety_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            organization_id INTEGER,
            session_id TEXT,
            severity TEXT NOT NULL,
            categories TEXT NOT NULL DEFAULT '[]',
            source TEXT NOT NULL DEFAULT 'classifier',
            blocked INTEGER NOT NULL DEFAULT 0,
            excerpt TEXT,
            acknowledged_at TEXT,
            acknowledged_by INTEGER,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_safety_events_user ON safety_events(user_id, created_at DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_safety_events_sev ON safety_events(severity, created_at DESC)")


def _m004_chat_messages(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            user_id INTEGER,
            organization_id INTEGER,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            citations_json TEXT NOT NULL DEFAULT '[]',
            model TEXT,
            prompt_tokens INTEGER DEFAULT 0,
            completion_tokens INTEGER DEFAULT 0,
            latency_ms INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, id)"
    )


def _m005_performance_indexes(conn: sqlite3.Connection) -> None:
    index_specs = [
        ("progress", "idx_progress_user_time", "progress(user_id, timestamp DESC)"),
        ("learning_events", "idx_events_user_type", "learning_events(user_id, event_type)"),
        ("learning_events", "idx_events_org_time", "learning_events(organization_id, created_at DESC)"),
        ("users", "idx_users_org_role", "users(organization_id, role)"),
        ("users", "idx_users_parent", "users(parent_id)"),
        ("chat_sessions", "idx_chat_sessions_user", "chat_sessions(user_id, updated_at DESC)"),
        ("audit_log", "idx_audit_created", "audit_log(created_at DESC)"),
    ]
    for table, index_name, definition in index_specs:
        if _table_exists(conn, table):
            conn.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {definition}")


def _m006_ai_evaluations(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            git_sha TEXT,
            case_id TEXT NOT NULL,
            category TEXT,
            score REAL NOT NULL,
            passed INTEGER NOT NULL DEFAULT 0,
            detail_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_evals_run ON ai_evaluations(run_id)")


MIGRATIONS: tuple[Migration, ...] = (
    Migration(
        version=1,
        name="schema_migrations_bootstrap",
        statements=(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                   version INTEGER PRIMARY KEY,
                   name TEXT NOT NULL,
                   applied_at TEXT NOT NULL
               )""",
        ),
    ),
    Migration(version=2, name="auth_token_identifiers", python=_m002_auth_token_columns),
    Migration(version=3, name="safety_events", python=_m003_safety_events),
    Migration(version=4, name="chat_messages", python=_m004_chat_messages),
    Migration(version=5, name="performance_indexes", python=_m005_performance_indexes),
    Migration(version=6, name="ai_evaluations", python=_m006_ai_evaluations),
)


def current_version(conn: sqlite3.Connection) -> int:
    if not _table_exists(conn, "schema_migrations"):
        return 0
    row = conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()
    return int(row[0] or 0)


def applied_versions(conn: sqlite3.Connection) -> set[int]:
    if not _table_exists(conn, "schema_migrations"):
        return set()
    return {int(row[0]) for row in conn.execute("SELECT version FROM schema_migrations").fetchall()}


def run_migrations(conn: sqlite3.Connection) -> list[int]:
    """Apply every pending migration in order. Returns the versions applied."""
    conn.execute(
        """CREATE TABLE IF NOT EXISTS schema_migrations (
               version INTEGER PRIMARY KEY,
               name TEXT NOT NULL,
               applied_at TEXT NOT NULL
           )"""
    )
    conn.commit()
    done = applied_versions(conn)
    applied: list[int] = []

    for migration in sorted(MIGRATIONS, key=lambda m: m.version):
        if migration.version in done:
            continue
        try:
            for statement in migration.statements:
                conn.execute(statement)
            if migration.python is not None:
                migration.python(conn)
            conn.execute(
                "INSERT OR REPLACE INTO schema_migrations(version, name, applied_at) VALUES (?,?,?)",
                (
                    migration.version,
                    migration.name,
                    datetime.now(UTC).replace(microsecond=0).isoformat(),
                ),
            )
            conn.commit()
            applied.append(migration.version)
            logger.info("migration_applied", extra={"version": migration.version, "name": migration.name})
        except Exception:
            conn.rollback()
            logger.exception("migration_failed version=%s name=%s", migration.version, migration.name)
            raise

    return applied


def latest_version() -> int:
    return max(m.version for m in MIGRATIONS)
