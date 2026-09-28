"""Protect existing covers and stop ownership when publishing fallback photos."""
import hashlib
from pathlib import Path
import tempfile
import unittest

from apply_course_stop_fallbacks import merge


class FallbackMergeTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.asset = self.root / "assets/naver-courses/fallback.jpg"
        self.asset.parent.mkdir(parents=True)
        self.asset.write_bytes(b"reviewed-photo")
        self.digest = hashlib.sha256(self.asset.read_bytes()).hexdigest()
        self.plan = {"courses": [{"id": "missing", "first_place": "A", "points": [{"place_name": "A"}, {"place_name": "B"}, {"place_name": "C"}]}]}
        self.existing = {"preserved": {"sha256": "old", "original_url": "https://example.test/old.jpg", "dhash": "0000000000000000"}}
        self.photo = {"image_url": "/assets/naver-courses/fallback.jpg", "sha256": self.digest,
                      "first_place": "A", "image_place": "C", "cover_role": "destination", "cover_stop_index": 2,
                      "original_url": "https://example.test/new.jpg", "dhash": "ffffffffffffffff"}

    def run_merge(self, decisions=None, rejected=None, photo=None):
        return merge(self.plan, self.existing, {"missing": photo or self.photo},
                     decisions if decisions is not None else {"missing": self.digest}, rejected or {}, self.root)

    def test_adds_reviewed_destination_and_preserves_existing_photo(self):
        result = self.run_merge()
        self.assertEqual(result["missing"]["image_place"], "C")
        self.assertIs(result["preserved"], self.existing["preserved"])
        self.assertNotIn("missing", self.existing)

    def test_unreviewed_stale_and_rejected_photos_are_excluded(self):
        for decisions, rejected in [({}, {}), ({"missing": "old-review"}, {}), ({"missing": self.digest}, {self.digest: "wrong place"})]:
            with self.subTest(decisions=decisions, rejected=rejected):
                self.assertEqual(self.run_merge(decisions, rejected), self.existing)

    def test_wrong_stop_and_wrong_role_cannot_publish(self):
        for change in [{"image_place": "B"}, {"cover_role": "waypoint"}, {"cover_stop_index": 0}, {"first_place": "changed"}]:
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, "fallback stop|ownership mismatch"):
                self.run_merge(photo={**self.photo, **change})

    def test_changed_asset_cannot_publish(self):
        self.asset.write_bytes(b"changed-after-review")
        with self.assertRaisesRegex(ValueError, "changed after review"):
            self.run_merge()

    def test_same_photo_resized_or_nearly_identical_cannot_publish(self):
        for change in [{"original_url": self.existing["preserved"]["original_url"]}, {"dhash": "000000000000000f"}]:
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, "Duplicate fallback"):
                self.run_merge(photo={**self.photo, **change})


if __name__ == "__main__":
    unittest.main()
