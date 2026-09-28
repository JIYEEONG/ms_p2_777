import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


collector = module("collector", "tools/prepare_naver_course_images.py")
catalog = module("catalog", "backend/course_image_catalog.py")


class CourseImagesTests(unittest.TestCase):
    def test_branch_match_requires_branch(self):
        self.assertTrue(collector.relevant("태양커피 서울사당점", "태양커피 서울사당점 방문"))
        self.assertFalse(collector.relevant("태양커피 서울사당점", "태양커피 강남점"))
        self.assertFalse(collector.relevant("문화역서울284", "감성 전시관"))

    def test_resized_naver_image_is_same_photo(self):
        a = "https://blogfiles.pstatic.net/photo.jpg?type=w800"
        b = "https://blogfiles.pstatic.net/photo.jpg?type=w1200"
        self.assertEqual(collector.canonical_url(a), collector.canonical_url(b))

    def test_missing_catalog_leaves_courses_unchanged(self):
        courses = [{"id": "a"}]
        with tempfile.TemporaryDirectory() as directory:
            self.assertIs(catalog.apply_course_images(courses, Path(directory) / "missing.json"), courses)

    def test_unreviewed_photo_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            manifest = work / "runtime.json"
            (work / "review-catalog.json").write_text(json.dumps({"count": 1, "courses": [{"id": "a", "image_url": "/assets/naver-courses/a.jpg", "sha256": "abc"}]}), encoding="utf-8")
            (work / "reviewed.json").write_text("{}", encoding="utf-8")
            with patch.object(collector, "WORK", work), patch.object(collector, "MANIFEST", manifest):
                with self.assertRaisesRegex(ValueError, "Visual review missing"):
                    collector.publish()
            self.assertFalse(manifest.exists())

    def test_deferred_photo_keeps_route_visible_and_has_no_fallback_image(self):
        row = {"id": "a", "title": "A → B", "image_url": None, "sha256": None,
               "review": "missing-by-user-request", "tags": {"category": ["체험"]},
               "points": [{"place_name": "A", "place_image_url": "unverified-stock.jpg"}],
               "distance_m": None, "duration_seconds": None}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "catalog.json"
            path.write_text(json.dumps({"count": 1, "courses": [row]}), encoding="utf-8")
            result = catalog.apply_course_images([{"id": "a", "image_url": "old-stock.jpg", "distance_m": 1000}], path)
        self.assertIsNone(result[0]["image_url"])
        self.assertIsNone(result[0]["points"][0]["place_image_url"])
        self.assertIsNone(result[0]["distance_m"])
        self.assertTrue(result[0]["first_place_cover"])
        self.assertTrue(result[0]["preserve_course_identity"])

    def test_catalog_sets_first_stop_and_preserves_other_courses(self):
        record = {"id": "a", "title": "A → B", "image_url": "/assets/naver-courses/a.jpg", "sha256": "abc",
                  "points": [{"place_name": "A"}, {"place_name": "B", "place_image_url": "b.jpg"}],
                  **{key: "value" for key in ("source", "first_place", "query", "search_url", "original_url", "source_title", "review")}}
        original = [{"id": "a", "tags": {"category": ["카페"]}}, {"id": "b"}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "catalog.json"
            path.write_text(json.dumps({"count": 1, "courses": [record]}), encoding="utf-8")
            result = catalog.apply_course_images(original, path)
        self.assertEqual(result[0]["image_url"], result[0]["points"][0]["place_image_url"])
        self.assertIsNone(result[0]["points"][1]["place_image_url"])
        self.assertTrue(result[0]["preserve_course_identity"])
        self.assertEqual(result[0]["tags"], original[0]["tags"])
        self.assertIs(result[1], original[1])
        self.assertNotIn("image_url", original[0])


if __name__ == "__main__":
    unittest.main()
