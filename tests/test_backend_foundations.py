import sqlite3
import unittest

from backend import chat, db, language


class _ConnectionProxy:
    def __init__(self):
        self._conn = sqlite3.connect(":memory:")
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def close(self):
        return None

    def real_close(self):
        self._conn.close()


class BackendFoundationsTest(unittest.TestCase):
    def setUp(self):
        self.proxy = _ConnectionProxy()
        self.original_get_connection = db.get_connection
        db.get_connection = lambda: self.proxy
        db.init_db()

    def tearDown(self):
        db.get_connection = self.original_get_connection
        self.proxy.real_close()

    def test_user_role_and_org_persist(self):
        user_id = db.create_user("Asha", "8", "Hindi", "Math", role="teacher")
        user = db.get_user_with_org(user_id)
        self.assertIsNotNone(user)
        self.assertEqual(user["role"], "teacher")
        self.assertEqual(user["language"], "Hindi")
        self.assertTrue(user["organization_id"])
        self.assertEqual(user["organization_slug"], "demo-school")

    def test_chat_session_persistence(self):
        user_id = db.create_user("Rani", "9", "English", "Science", role="student")
        user = db.get_user(user_id)
        session = chat.get_session(
            "session_test",
            language="English",
            class_="9",
            user_name="Rani",
            weak_subject="Science",
            user_id=user_id,
            organization_id=user["organization_id"],
        )
        self.assertEqual(session["profile"]["user_name"], "Rani")
        loaded = db.load_chat_session("session_test")
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["profile"]["weak_subject"], "Science")
        self.assertEqual(loaded["messages"][0]["role"], "system")

    def test_auth_token_lifecycle(self):
        user_id = db.create_user("Meera", "10", "English", "Math", role="admin")
        token = db.create_auth_token(user_id, expires_in_hours=1)
        payload = db.validate_auth_token(token["token"])
        self.assertIsNotNone(payload)
        self.assertEqual(payload["user_id"], user_id)
        db.revoke_auth_token(token["token"])
        self.assertIsNone(db.validate_auth_token(token["token"]))

    def test_language_script_validation(self):
        self.assertTrue(language.is_text_compatible_with_language("यह एक सरल उत्तर है", "Hindi"))
        self.assertTrue(language.is_text_compatible_with_language("ನಮಸ್ಕಾರ ಇದು ಸರಳ ಉತ್ತರ", "Kannada"))
        self.assertFalse(language.is_text_compatible_with_language("This is only English", "Tamil"))

    def test_student_report_contains_recent_history(self):
        user_id = db.create_user("Kavya", "7", "English", "Math", role="student")
        db.update_progress(user_id, "Fractions", 4, 5)
        db.update_progress(user_id, "Decimals", 2, 5)
        report = db.get_student_report(user_id)
        self.assertIsNotNone(report)
        self.assertEqual(report["student"]["name"], "Kavya")
        self.assertGreaterEqual(len(report["recent_history"]), 2)
        self.assertIn("Decimals", report["weak_topics"])


if __name__ == "__main__":
    unittest.main()
