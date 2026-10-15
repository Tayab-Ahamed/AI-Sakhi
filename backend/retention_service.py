"""Read-only retention planning; no deletion or scheduling is performed."""

from datetime import UTC, datetime, timedelta


def preview_chat_retention(conn, organization_id: int, days: int, *, now: datetime | None = None) -> dict:
    if days < 0 or days > 3650:
        raise ValueError("Retention must be between 0 and 3650 days")
    if organization_id is None:
        raise ValueError("A school is required")
    result = {
        "enabled": days > 0,
        "dry_run": True,
        "automatic_deletion_enabled": False,
        "eligible_sessions": 0,
        "held_sessions": 0,
        "cutoff": None,
        "excluded_stores": [
            "backups",
            "device copies",
            "provider data",
            "learning records",
            "safety events",
            "orphan messages",
        ],
    }
    if not days:
        return result
    instant = now or datetime.now(UTC)
    if instant.tzinfo is None:
        raise ValueError("Preview time must have a timezone")
    cutoff = (instant.astimezone(UTC) - timedelta(days=days)).isoformat()
    result["cutoff"] = cutoff
    # Normalize ISO / legacy SQLite timestamps via julianday. Unknown dates
    # are deliberately excluded; a linked safety event conservatively holds a chat.
    row = conn.execute(
        """SELECT
            COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM safety_events e WHERE e.session_id=s.session_id) THEN 0 ELSE 1 END),0),
            COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM safety_events e WHERE e.session_id=s.session_id) THEN 1 ELSE 0 END),0)
        FROM chat_sessions s
        JOIN users u ON u.id=s.user_id AND u.organization_id=s.organization_id
        WHERE s.organization_id=? AND julianday(s.updated_at)<julianday(?)""",
        (organization_id, cutoff),
    ).fetchone()
    result["eligible_sessions"], result["held_sessions"] = row[0], row[1]
    return result
