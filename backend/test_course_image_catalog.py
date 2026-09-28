import json
from pathlib import Path
import tempfile
import unittest

from backend.course_image_catalog import apply_course_images


class CourseCoverStopTests(unittest.TestCase):
    def apply_photo(self, **changes):
        row = {
            "id": "course", "title": "A → B → C",
            "image_url": "/assets/naver-courses/photo.jpg", "sha256": "unique-photo",
            "points": [{"sequence_no": index, "place_name": name, "place_image_url": "/old.jpg"}
                       for index, name in enumerate(["A", "B", "C"])],
            **changes,
        }
        original = {"id": "course", "image_url": "/unverified.jpg"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "catalog.json"
            path.write_text(json.dumps({"count": 1, "courses": [row]}), encoding="utf-8")
            course = apply_course_images([original], path)[0]
        self.assertEqual(original, {"id": "course", "image_url": "/unverified.jpg"})
        return course

    def test_legacy_photo_still_belongs_to_first_place(self):
        course = self.apply_photo()
        self.assertEqual(course["cover_stop_index"], 0)
        self.assertEqual(course["image_place"], "A")
        self.assertEqual(course["cover_role"], "first")
        self.assertEqual([point["place_image_url"] for point in course["points"]],
                         [course["image_url"], None, None])

    def test_destination_and_waypoint_photo_only_appears_at_its_actual_stop(self):
        for index, place, role in [(1, "B", "waypoint"), (2, "C", "destination")]:
            with self.subTest(role=role):
                course = self.apply_photo(cover_stop_index=index, image_place=place, cover_role=role)
                self.assertEqual(course["points"][index]["place_image_url"], course["image_url"])
                self.assertTrue(all(point["place_image_url"] is None
                                    for i, point in enumerate(course["points"]) if i != index))
                self.assertEqual(course["image_source"]["image_place"], place)
                self.assertEqual(course["image_source"]["cover_role"], role)
                self.assertTrue(course["first_place_cover"])

    def test_rejects_photo_with_invalid_stop_or_wrong_place(self):
        for changes in [
            {"cover_stop_index": -1}, {"cover_stop_index": 3},
            {"cover_stop_index": "1"}, {"cover_stop_index": True},
            {"cover_stop_index": 2, "image_place": "A"},
            {"cover_stop_index": 2, "cover_role": "first"},
        ]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.apply_photo(**changes)

    def test_unresolved_photos_never_inherit_old_stop_images(self):
        course = self.apply_photo(image_url=None, sha256=None, review="missing-by-user-request")
        self.assertIsNone(course["image_url"])
        self.assertIsNone(course["image_place"])
        self.assertTrue(all(point["place_image_url"] is None for point in course["points"]))


if __name__ == "__main__":
    unittest.main()
