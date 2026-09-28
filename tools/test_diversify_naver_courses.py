import copy
import unittest

from diversify_naver_courses import candidate_routes, course_tags, diversify, distance_km, is_visit_destination, place_profile, role, route_key


def place(key, name, category, lat, lon, **extra):
    return {
        "matched_place_id": key, "place_name": name, "place_name_kr": name,
        "category": category, "sub_category": None,
        "latitude": lat, "longitude": lon, "sequence_no": 0,
        "address": "서울 종로구 예시로", "tags": {}, **extra,
    }


class DiversifyRoutesTests(unittest.TestCase):
    def setUp(self):
        self.a = place("a", "첫 카페", "카페", 37.57, 126.98, tags={"mood": ["조용함"]})
        self.b = place("b", "전시관", "전시", 37.571, 126.981, sequence_no=1, tags={"purpose": ["문화"]})
        self.c = place("c", "작은 공원", "관광", 37.572, 126.983)
        self.d = place("d", "식당", "음식점", 37.573, 126.984, tags={"purpose": ["식사"]})
        self.places = {p["matched_place_id"]: p for p in (self.a, self.b, self.c, self.d)}

    def course(self, key, points):
        return {"id": key, "first_place": points[0]["place_name"], "points": copy.deepcopy(points),
                "title": "중복 코스 · " + key, "tags": {"mood": ["오래된 태그"]}, "distance_m": 999999, "duration_seconds": 999999}

    def test_preserves_first_and_original_routes_and_produces_unique_routes(self):
        courses = [self.course("1", [self.a, self.b]), self.course("2", [self.a, self.b]),
                   self.course("3", [self.a, self.b]), self.course("4", [self.a, self.b, self.c])]
        plan = {"courses": courses, "count": 4}
        before = copy.deepcopy(plan)
        result = diversify(plan, self.places)
        self.assertEqual(plan, before)
        after = result["courses"]
        self.assertEqual(after[0]["points"], courses[0]["points"])
        self.assertEqual(after[3]["points"], courses[3]["points"])
        for old, new in zip(courses, after):
            self.assertEqual(old["points"][0], new["points"][0])
            self.assertEqual(old["id"], new["id"])
            self.assertNotIn("오래된 태그", new["tags"]["mood"])
            self.assertIsNone(new["distance_m"])
            self.assertIsNone(new["duration_seconds"])
            self.assertNotIn(" · ", new["title"])
        self.assertEqual(len({route_key(c["points"]) for c in after}), 4)
        self.assertEqual(len({c["title"] for c in after}), 4)
        self.assertEqual(result["route_diversification"]["duplicate_routes_rebuilt"], 2)

    def test_far_places_and_repeated_venue_names_are_excluded(self):
        far = place("far", "멀리 있는 공원", "관광", 37.0, 127.9)
        duplicate = place("duplicate", "첫  카페", "관광", 37.5701, 126.9801)
        missing_address = place("missing", "주소 없음", "전시", 37.5701, 126.9801, address=None)
        candidates = candidate_routes(self.a, {**self.places, "far": far, "duplicate": duplicate, "missing": missing_address})
        self.assertTrue(candidates)
        for _, _, _, a, b in candidates:
            self.assertNotIn(a["matched_place_id"], {"far", "duplicate", "missing"})
            self.assertNotIn(b["matched_place_id"], {"far", "duplicate", "missing"})
            self.assertLessEqual(distance_km(self.a, a), 2.5)
            self.assertLessEqual(distance_km(a, b), 2.5)
            self.assertEqual(len({role(self.a), role(a), role(b)}), 3)

    def test_missing_nearby_routes_fails_without_inventing_places(self):
        courses = [self.course("1", [self.a, self.b]), self.course("2", [self.a, self.b])]
        with self.assertRaisesRegex(ValueError, "Not enough nearby"):
            diversify({"courses": courses}, {"a": self.a, "b": self.b})

    def test_tags_follow_selected_venues(self):
        tags = course_tags([self.a, self.d], self.places)
        self.assertEqual(tags["category"], ["음식점", "카페"])
        self.assertEqual(tags["purpose"], ["식사"])
        self.assertEqual(tags["mood"], ["조용함"])
        self.assertEqual(tags["sub_category"], tags["subcategory"])

    def test_service_points_are_not_added_as_destinations(self):
        for name, category, subcategory in (
            ("쇼핑센터 주차장", "쇼핑", None),
            ("쇼핑센터 12번출구", "쇼핑", None),
            ("쇼핑몰 안내데스크", "쇼핑", None),
            ("진로직업체험지원센터", "체험", "기타"),
            ("체험판의컴퓨터채널", "체험", "기타"),
        ):
            with self.subTest(name=name):
                self.assertFalse(is_visit_destination(place("x", name, category, 37.57, 126.98, sub_category=subcategory)))
        self.assertTrue(is_visit_destination(place("craft", "도자기공방", "체험", 37.57, 126.98, sub_category="공예")))

    def test_report_uses_shared_categories_without_relabeling_or_inventing_facts(self):
        bakery = place("bakery", "빵집", "음식점", 37.57, 126.98, sub_category="음식점 > 간식 > 제과,베이커리")
        profile = place_profile(bakery)
        self.assertEqual(role(bakery), "음식점")
        self.assertEqual(profile["raw_category"], bakery["sub_category"])
        self.assertEqual(profile["activity_category"], bakery["category"])
        self.assertIsNone(profile["price"])
        self.assertIsNone(profile["open_time"])
        self.assertIsNone(profile["reservation_available"])
        self.assertIsNone(place_profile(self.a)["raw_category"])

    def test_reruns_regenerate_only_previously_rebuilt_courses_deterministically(self):
        original = {"courses": [self.course("1", [self.a, self.b]), self.course("2", [self.a, self.b]), self.course("3", [self.a, self.b])]}
        result = diversify(original, self.places)
        rerun = diversify(result, self.places)
        self.assertEqual(result, rerun)
        self.assertEqual(rerun["route_diversification"]["original_unique_routes_preserved"], 1)
        self.assertEqual(rerun["route_diversification"]["duplicate_routes_rebuilt"], 2)
        self.assertEqual(rerun["route_diversification"]["rebuilt_routes_with_three_distinct_activity_categories"], 2)
        self.assertIsNone(rerun["generation_policy"]["current_filters"])
        self.assertIsNone(rerun["generation_policy"]["user_preference"])
        self.assertIsNone(rerun["generation_policy"]["personalization_score"])
        self.assertEqual(rerun["place_profiles"]["a"]["activity_category"], "카페")
        self.assertIn("unverified", rerun["courses"][0]["operational_validation"]["road_route"])


if __name__ == "__main__":
    unittest.main()
