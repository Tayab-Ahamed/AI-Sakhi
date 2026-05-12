import json
import secrets
import sqlite3
from datetime import UTC, datetime, timedelta

from backend.config import DB_PATH


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _ensure_column(cur: sqlite3.Cursor, table: str, column: str, definition: str):
    rows = cur.execute(f"PRAGMA table_info({table})").fetchall()
    existing = {row["name"] for row in rows}
    if column not in existing:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _user_from_row(row: sqlite3.Row | None) -> dict | None:
    if not row:
        return None
    data = dict(row)
    data["user_id"] = data.pop("id")
    data["class_"] = data.pop("class")
    return data


def init_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            tier TEXT DEFAULT 'hackathon',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id INTEGER,
            name TEXT NOT NULL,
            class TEXT NOT NULL,
            language TEXT DEFAULT 'English',
            weak_subject TEXT,
            role TEXT DEFAULT 'student',
            created_at TEXT,
            updated_at TEXT,
            last_active_at TEXT,
            FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );

        CREATE TABLE IF NOT EXISTS progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            topic TEXT,
            score INTEGER DEFAULT 0,
            total INTEGER DEFAULT 5,
            streak INTEGER DEFAULT 0,
            timestamp TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS chat_sessions (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER,
            organization_id INTEGER,
            messages_json TEXT NOT NULL,
            profile_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );

        CREATE TABLE IF NOT EXISTS learning_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            organization_id INTEGER,
            session_id TEXT,
            event_type TEXT NOT NULL,
            metadata_json TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );

        CREATE TABLE IF NOT EXISTS auth_tokens (
            token_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            organization_id INTEGER,
            token_type TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            revoked_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );
    """)
    _ensure_column(cur, "users", "organization_id", "INTEGER")
    _ensure_column(cur, "users", "role", "TEXT DEFAULT 'student'")
    _ensure_column(cur, "users", "updated_at", "TEXT")
    _ensure_column(cur, "users", "last_active_at", "TEXT")
    _ensure_column(cur, "chat_sessions", "user_id", "INTEGER")
    _ensure_column(cur, "chat_sessions", "organization_id", "INTEGER")
    _ensure_column(cur, "learning_events", "organization_id", "INTEGER")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_progress_user_time ON progress(user_id, timestamp DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_events_type_time ON learning_events(event_type, created_at DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_events_user_time ON learning_events(user_id, created_at DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_time ON chat_sessions(user_id, updated_at DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_org_role ON users(organization_id, role)")
    conn.commit()
    conn.close()


def ensure_default_organization() -> int:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute("SELECT id FROM organizations WHERE slug = 'demo-school'").fetchone()
    if row:
        conn.close()
        return row["id"]
    cur.execute(
        "INSERT INTO organizations (name, slug, tier, created_at) VALUES (?, ?, ?, ?)",
        ("Demo School", "demo-school", "hackathon", now_iso()),
    )
    org_id = cur.lastrowid
    conn.commit()
    conn.close()
    return org_id


def create_user(name: str, class_: str, language: str, weak_subject: str, role: str = "student", organization_id: int | None = None) -> int:
    conn = get_connection()
    cur = conn.cursor()
    timestamp = now_iso()
    org_id = organization_id or ensure_default_organization()
    cur.execute(
        """
        INSERT INTO users (organization_id, name, class, language, weak_subject, role, created_at, updated_at, last_active_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (org_id, name, class_, language, weak_subject, role, timestamp, timestamp, timestamp),
    )
    user_id = cur.lastrowid
    conn.commit()
    conn.close()
    return user_id


def update_user(
    user_id: int,
    name: str,
    class_: str,
    language: str,
    weak_subject: str,
    role: str | None = None,
    organization_id: int | None = None,
) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    existing = cur.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not existing:
        conn.close()
        return None
    next_role = role or existing["role"] or "student"
    next_org = organization_id or existing["organization_id"] or ensure_default_organization()
    cur.execute(
        """
        UPDATE users
        SET name = ?, class = ?, language = ?, weak_subject = ?, role = ?, organization_id = ?, updated_at = ?, last_active_at = ?
        WHERE id = ?
        """,
        (name, class_, language, weak_subject, next_role, next_org, now_iso(), now_iso(), user_id),
    )
    conn.commit()
    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return _user_from_row(row)


def touch_user_activity(user_id: int | None):
    if not user_id:
        return
    conn = get_connection()
    cur = conn.cursor()
    timestamp = now_iso()
    cur.execute("UPDATE users SET last_active_at = ?, updated_at = ? WHERE id = ?", (timestamp, timestamp, user_id))
    conn.commit()
    conn.close()


def get_user(user_id: int) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return _user_from_row(row)


def get_user_with_org(user_id: int) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute(
        """
        SELECT u.*, o.name as organization_name, o.slug as organization_slug, o.tier as organization_tier
        FROM users u
        LEFT JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = ?
        """,
        (user_id,),
    ).fetchone()
    conn.close()
    user = _user_from_row(row)
    if not user:
        return None
    user["organization_name"] = row["organization_name"]
    user["organization_slug"] = row["organization_slug"]
    user["organization_tier"] = row["organization_tier"]
    return user


def save_chat_session(session_id: str, messages: list[dict], profile: dict):
    payload_messages = json.dumps(messages, ensure_ascii=False)
    payload_profile = json.dumps(profile, ensure_ascii=False)
    timestamp = now_iso()
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO chat_sessions (session_id, user_id, organization_id, messages_json, profile_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
            user_id = excluded.user_id,
            organization_id = excluded.organization_id,
            messages_json = excluded.messages_json,
            profile_json = excluded.profile_json,
            updated_at = excluded.updated_at
        """,
        (
            session_id,
            profile.get("user_id"),
            profile.get("organization_id"),
            payload_messages,
            payload_profile,
            timestamp,
            timestamp,
        ),
    )
    conn.commit()
    conn.close()


def load_chat_session(session_id: str) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT messages_json, profile_json FROM chat_sessions WHERE session_id = ?", (session_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "messages": json.loads(row["messages_json"]),
        "profile": json.loads(row["profile_json"]),
    }


def clear_chat_session(session_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM chat_sessions WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()


def get_chat_history(session_id: str) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute(
        """
        SELECT session_id, user_id, organization_id, messages_json, profile_json, created_at, updated_at
        FROM chat_sessions
        WHERE session_id = ?
        """,
        (session_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "session_id": row["session_id"],
        "user_id": row["user_id"],
        "organization_id": row["organization_id"],
        "messages": json.loads(row["messages_json"]),
        "profile": json.loads(row["profile_json"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def log_event(event_type: str, user_id: int | None = None, session_id: str | None = None, metadata: dict | None = None):
    conn = get_connection()
    cur = conn.cursor()
    org_id = None
    if user_id:
        row = cur.execute("SELECT organization_id FROM users WHERE id = ?", (user_id,)).fetchone()
        org_id = row["organization_id"] if row else None
    cur.execute(
        """
        INSERT INTO learning_events (user_id, organization_id, session_id, event_type, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (user_id, org_id, session_id, event_type, json.dumps(metadata or {}, ensure_ascii=False), now_iso()),
    )
    conn.commit()
    conn.close()


def create_auth_token(user_id: int, token_type: str = "session", expires_in_hours: int = 24) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    user = cur.execute("SELECT organization_id, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        raise ValueError("User not found")
    token_id = secrets.token_urlsafe(24)
    created_at = now_iso()
    expires_at = (datetime.now(UTC) + timedelta(hours=expires_in_hours)).replace(microsecond=0).isoformat()
    cur.execute(
        """
        INSERT INTO auth_tokens (token_id, user_id, organization_id, token_type, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (token_id, user_id, user["organization_id"], token_type, expires_at, created_at),
    )
    conn.commit()
    conn.close()
    return {
        "token": token_id,
        "token_type": token_type,
        "expires_at": expires_at,
        "user_id": user_id,
        "organization_id": user["organization_id"],
        "role": user["role"],
    }


def validate_auth_token(token: str) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute(
        """
        SELECT t.token_id, t.user_id, t.organization_id, t.token_type, t.expires_at, t.revoked_at, u.role
        FROM auth_tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token_id = ?
        """,
        (token,),
    ).fetchone()
    conn.close()
    if not row or row["revoked_at"]:
        return None
    if datetime.fromisoformat(row["expires_at"]) < datetime.now(UTC):
        return None
    return dict(row)


def revoke_auth_token(token: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE auth_tokens SET revoked_at = ? WHERE token_id = ?", (now_iso(), token))
    conn.commit()
    conn.close()


def _calculate_next_streak(cur: sqlite3.Cursor, user_id: int) -> int:
    row = cur.execute(
        "SELECT streak, timestamp FROM progress WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1",
        (user_id,),
    ).fetchone()
    if not row or not row["timestamp"]:
        return 1

    last_dt = datetime.fromisoformat(row["timestamp"])
    today = datetime.now(UTC).date()
    last_day = last_dt.date()
    if last_day == today:
        return row["streak"] or 1
    if last_day == today - timedelta(days=1):
        return (row["streak"] or 0) + 1
    return 1


def update_progress(user_id: int, topic: str, score: int, total: int = 5) -> int:
    conn = get_connection()
    cur = conn.cursor()
    current_streak = _calculate_next_streak(cur, user_id)
    timestamp = now_iso()
    cur.execute(
        "INSERT INTO progress (user_id, topic, score, total, streak, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, topic, score, total, current_streak, timestamp),
    )
    cur.execute("UPDATE users SET last_active_at = ?, updated_at = ? WHERE id = ?", (timestamp, timestamp, user_id))
    conn.commit()
    conn.close()
    return current_streak


def get_user_progress(user_id: int) -> list:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT topic, score, total, streak, timestamp FROM progress WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10",
        (user_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_streak(user_id: int) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT streak, timestamp FROM progress WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1", (user_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return 0
    last_day = datetime.fromisoformat(row["timestamp"]).date()
    if last_day < datetime.now(UTC).date() - timedelta(days=1):
        return 0
    return row["streak"] or 0


def get_all_users() -> list:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.*, o.name as organization_name, o.slug as organization_slug, o.tier as organization_tier
        FROM users u
        LEFT JOIN organizations o ON o.id = u.organization_id
        ORDER BY u.created_at DESC
        """
    )
    rows = cur.fetchall()
    conn.close()
    users = []
    for row in rows:
        user = _user_from_row(row)
        user["organization_name"] = row["organization_name"]
        user["organization_slug"] = row["organization_slug"]
        user["organization_tier"] = row["organization_tier"]
        users.append(user)
    return users


def get_dashboard_metrics(organization_id: int | None = None) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    now = datetime.now(UTC)
    last_7_days = (now - timedelta(days=7)).replace(microsecond=0).isoformat()
    params: tuple = ()
    user_where = ""
    progress_where = ""
    session_where = ""
    event_where = ""
    if organization_id:
        user_where = " WHERE organization_id = ?"
        progress_where = " WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?)"
        session_where = " WHERE organization_id = ?"
        event_where = " WHERE organization_id = ?"
        params = (organization_id,)

    totals = {
        "total_users": cur.execute(f"SELECT COUNT(*) FROM users{user_where}", params).fetchone()[0],
        "active_users_7d": cur.execute(
            f"SELECT COUNT(*) FROM users{user_where}{' AND' if user_where else ' WHERE'} COALESCE(last_active_at, created_at) >= ?",
            params + (last_7_days,),
        ).fetchone()[0],
        "total_quiz_attempts": cur.execute(f"SELECT COUNT(*) FROM progress{progress_where}", params).fetchone()[0],
        "total_chat_sessions": cur.execute(f"SELECT COUNT(*) FROM chat_sessions{session_where}", params).fetchone()[0],
        "total_events": cur.execute(f"SELECT COUNT(*) FROM learning_events{event_where}", params).fetchone()[0],
    }
    avg_score = cur.execute(
        f"SELECT AVG(CAST(score AS FLOAT) / NULLIF(total, 0)) FROM progress{progress_where}",
        params,
    ).fetchone()[0]
    role_rows = cur.execute(
        f"SELECT role, COUNT(*) as count FROM users{user_where} GROUP BY role",
        params,
    ).fetchall()
    language_rows = cur.execute(
        f"SELECT language, COUNT(*) as count FROM users{user_where} GROUP BY language ORDER BY count DESC",
        params,
    ).fetchall()
    event_rows = cur.execute(
        f"SELECT event_type, COUNT(*) as count FROM learning_events{event_where} GROUP BY event_type ORDER BY count DESC",
        params,
    ).fetchall()
    totals["average_quiz_score_pct"] = round((avg_score or 0) * 100, 1)
    totals["roles"] = {row["role"]: row["count"] for row in role_rows}
    totals["languages"] = [{ "language": row["language"], "count": row["count"] } for row in language_rows]
    totals["top_events"] = [{ "event_type": row["event_type"], "count": row["count"] } for row in event_rows[:8]]
    conn.close()
    return totals


def get_student_report(user_id: int) -> dict | None:
    user = get_user_with_org(user_id)
    if not user:
        return None
    history = get_user_progress(user_id)
    streak = get_streak(user_id)
    avg_score = round(sum((row["score"] / row["total"]) * 100 for row in history) / len(history), 1) if history else 0
    weak_topics = sorted(history, key=lambda row: (row["score"] / row["total"]))[:3]
    return {
        "student": user,
        "streak": streak,
        "average_score_pct": avg_score,
        "recent_history": history,
        "weak_topics": [row["topic"] for row in weak_topics],
        "generated_at": now_iso(),
    }
