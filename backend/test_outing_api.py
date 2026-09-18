import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from outing_api import OutingEvent, RecommendationRecord, RecommendationResult, outing_popularity, record_event, record_recommendation


class OutingStorageTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.previous_db = os.environ.get("MOOV_OUTING_DB_PATH")
        self.previous_url = os.environ.pop("MOOV_OUTING_DATABASE_URL", None)
        os.environ["MOOV_OUTING_DB_PATH"] = str(Path(self.tempdir.name) / "test.sqlite3")

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("MOOV_OUTING_DB_PATH", None)
        else:
            os.environ["MOOV_OUTING_DB_PATH"] = self.previous_db
        if self.previous_url is not None:
            os.environ["MOOV_OUTING_DATABASE_URL"] = self.previous_url
        self.tempdir.cleanup()

    def event(self, event_id, user_id, event_type):
        return OutingEvent(
            event_id=event_id,
            user_id=user_id,
            session_id=f"session-{user_id}",
            request_id="request-1",
            event_type=event_type,
            target_type="course",
            target_id="cafe",
            occurred_at=datetime.now(timezone.utc),
            rule_version="demo-category-v1",
        )

    def test_recommendation_and_events_are_idempotent_and_separated_by_user(self):
        recommendation = RecommendationRecord(
            request_id="request-1", user_id="tester-1", session_id="session-tester-1",
            occurred_at=datetime.now(timezone.utc), rule_version="demo-category-v1",
            conditions={"category": "카페"},
            results=[RecommendationResult(course_id="cafe", rank=1, score=100)],
        )
        self.assertTrue(record_recommendation(recommendation)["inserted"])
        self.assertFalse(record_recommendation(recommendation)["inserted"])
        self.assertTrue(record_event(self.event("event-1", "tester-1", "course_like"))["inserted"])
        self.assertFalse(record_event(self.event("event-1", "tester-1", "course_like"))["inserted"])
        self.assertTrue(record_event(self.event("event-2", "tester-2", "course_like"))["inserted"])
        self.assertEqual(outing_popularity()["counts"], {"cafe": 2})
        self.assertTrue(record_event(self.event("event-3", "tester-1", "course_unlike"))["inserted"])
        self.assertEqual(outing_popularity()["counts"], {"cafe": 1})
        connection = sqlite3.connect(os.environ["MOOV_OUTING_DB_PATH"])
        try:
            self.assertEqual(connection.execute("SELECT COUNT(DISTINCT user_id) FROM outing_events").fetchone()[0], 2)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM outing_recommendations").fetchone()[0], 1)
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
