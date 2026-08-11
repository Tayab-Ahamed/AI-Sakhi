"""Schema migration tests. No FastAPI, no network."""

from __future__ import annotations

import os
import sqlite3
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend import migrations  # noqa: E402


class TestMigrations(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row

    def tearDown(self):
        self.conn.close()

    def test_versions_are_unique_and_ordered(self):
        versions = [m.version for m in migrations.MIGRATIONS]
        self.assertEqual(versions, sorted(versions), "migrations must be in ascending order")
        self.assertEqual(len(versions), len(set(versions)), "duplicate migration version")
        self.assertEqual(versions[0], 1)

    def test_fresh_database_reaches_latest_version(self):
        applied = migrations.run_migrations(self.conn)
        self.assertEqual(applied, [m.version for m in migrations.MIGRATIONS])
        self.assertEqual(migrations.current_version(self.conn), migrations.latest_version())

    def test_migrations_are_idempotent(self):
        migrations.run_migrations(self.conn)
        second_run = migrations.run_migrations(self.conn)
        self.assertEqual(second_run, [], "re-running migrations must be a no-op")
        self.assertEqual(migrations.current_version(self.conn), migrations.latest_version())

    def test_expected_tables_exist_after_migrating(self):
        migrations.run_migrations(self.conn)
        rows = self.conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        names = {row[0] for row in rows}
        for table in ("schema_migrations", "safety_events", "chat_messages", "ai_evaluations"):
            self.assertIn(table, names)

    def test_partial_upgrade_applies_only_missing_versions(self):
        migrations.run_migrations(self.conn)
        latest = migrations.latest_version()
        self.conn.execute("DELETE FROM schema_migrations WHERE version = ?", (latest,))
        self.conn.commit()
        applied = migrations.run_migrations(self.conn)
        self.assertEqual(applied, [latest])

    def test_applied_versions_matches_current_version(self):
        migrations.run_migrations(self.conn)
        self.assertEqual(max(migrations.applied_versions(self.conn)), migrations.current_version(self.conn))


if __name__ == "__main__":
    unittest.main()
