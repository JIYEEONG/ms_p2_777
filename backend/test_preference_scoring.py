import math
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from backend.preference_scoring import (
    DEFAULT_AHP_CONFIG,
    aggregate_behavior_vector,
    build_place_vector,
    build_survey_vector,
    calculate_ahp_weights,
    cosine_similarity,
    frequency_factor,
    rank_candidates,
    recency_factor,
)


NOW = datetime(2026, 9, 21, tzinfo=timezone.utc)


def event(event_type, course_id, category, days_ago=0):
    return {
        "event_type": event_type,
        "course_id": course_id,
        "occurred_at": (NOW - timedelta(days=days_ago)).isoformat(),
        "tags": {"category": [category]},
    }


class PreferenceScoringTests(unittest.TestCase):
    def test_multiple_survey_categories_are_equal_and_sum_to_one(self):
        vector = build_survey_vector(["카페", "전시", "음식점"])
        self.assertAlmostEqual(vector["카페"], 1 / 3)
        self.assertAlmostEqual(vector["전시"], 1 / 3)
        self.assertAlmostEqual(vector["음식점"], 1 / 3)
        self.assertAlmostEqual(sum(vector.values()), 1.0)

    def test_single_survey_category_is_one(self):
        vector = build_survey_vector(["카페"])
        self.assertAlmostEqual(vector["카페"], 1.0)
        self.assertAlmostEqual(sum(vector.values()), 1.0)

    def test_repeated_behavior_is_not_linear_count_multiplier(self):
        self.assertLess(frequency_factor(10), frequency_factor(1) * 10)

    def test_recent_event_contributes_more_than_old_event(self):
        self.assertGreater(recency_factor(1, 0.05), recency_factor(30, 0.05))

    def test_unsaved_course_is_excluded_from_positive_save_signal(self):
        weights = {"course_save": 1.0}
        result = aggregate_behavior_vector([
            event("course_save", "course-1", "카페", days_ago=1),
            event("course_unsave", "course-1", "카페", days_ago=0),
        ], weights, now=NOW)
        self.assertEqual(result["valid_event_count"], 0)
        self.assertAlmostEqual(result["vector"]["카페"], 0.0)

    def test_unliked_course_is_excluded_from_positive_like_signal(self):
        weights = {"course_like": 1.0}
        result = aggregate_behavior_vector([
            event("course_like", "course-1", "전시", days_ago=1),
            event("course_unlike", "course-1", "전시", days_ago=0),
        ], weights, now=NOW)
        self.assertEqual(result["valid_event_count"], 0)
        self.assertAlmostEqual(result["vector"]["전시"], 0.0)

    def test_ahp_rejects_high_consistency_ratio(self):
        bad_config = {
            "version": "bad",
            "criteria": ["c1", "c2", "c3"],
            "alternatives": ["course_select", "course_like"],
            "criteria_matrix": [[1, 9, 1 / 9], [1 / 9, 1, 9], [9, 1 / 9, 1]],
            "alternative_matrices": {
                "c1": [[1, 1], [1, 1]],
                "c2": [[1, 1], [1, 1]],
                "c3": [[1, 1], [1, 1]],
            },
        }
        with self.assertRaises(ValueError):
            calculate_ahp_weights(bad_config)

    def test_default_ahp_weights_sum_to_one(self):
        weights = calculate_ahp_weights(DEFAULT_AHP_CONFIG)["weights"]
        self.assertAlmostEqual(sum(weights.values()), 1.0)

    def test_tag_type_weights_are_not_added_to_rank_score(self):
        user_vector = build_survey_vector(["카페"])
        candidates = [{
            "place_id": "cafe",
            "name": "카페",
            "tags": {"category": {"카페"}},
            "tag_type_weights": {"category": 999},
            "distance_km": None,
        }]
        ranked = rank_candidates(candidates, user_vector)
        self.assertAlmostEqual(ranked[0]["score"], 1.0)

    def test_matched_tags_count_times_ten_is_not_used_for_ranking(self):
        user_vector = build_survey_vector(["카페"])
        ranked = rank_candidates([
            {
                "place_id": "many-tags",
                "name": "전시 쇼핑",
                "tags": {"category": {"전시", "쇼핑"}},
                "matched_tags": ["카페", "음식점", "관광"],
                "distance_km": None,
            },
            {
                "place_id": "matching-category",
                "name": "카페",
                "tags": {"category": {"카페"}},
                "matched_tags": ["카페"],
                "distance_km": None,
            },
        ], user_vector)
        self.assertEqual(ranked[0]["place_id"], "matching-category")

    def test_category_preference_increases_cosine_similarity(self):
        place_vector = build_place_vector({"category": {"카페"}})
        high = cosine_similarity(build_survey_vector(["카페"]), place_vector)
        low = cosine_similarity(build_survey_vector(["전시"]), place_vector)
        self.assertGreater(high, low)


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, *_args):
        return None

    def fetchall(self):
        return self.rows


class FakeConn:
    def __init__(self, rows):
        self.rows = rows

    def cursor(self):
        return FakeCursor(self.rows)


class RecommendationIntegrationTests(unittest.TestCase):
    def test_hard_filter_excludes_candidate_even_with_high_preference(self):
        try:
            import backend.outing_api as outing_api
        except Exception as exc:
            self.skipTest(f"outing_api dependencies are unavailable: {exc}")
        rows = [
            ("excluded", "강남 카페", None, None, None, None, "CATEGORY", "카페"),
            ("included", "동네 전시", None, None, None, None, "CATEGORY", "전시"),
        ]
        profile = {
            "tags": ["카페"],
            "excluded_tags": ["강남"],
            "excluded_regions": [],
            "preferred_regions": [],
            "final_user_vector": build_survey_vector(["카페"]),
        }
        with patch.object(outing_api, "get_conn", return_value=FakeConn(rows)), patch.object(outing_api, "release_conn"):
            ranked, _tags = outing_api._load_candidate_places(profile, None, None)
        self.assertEqual([item["place_id"] for item in ranked], ["included"])

    def test_azure_failure_does_not_change_python_candidate_order(self):
        try:
            import backend.outing_api as outing_api
        except Exception as exc:
            self.skipTest(f"outing_api dependencies are unavailable: {exc}")
        candidates = [
            {"place_id": "best", "name": "카페", "address": "", "tag_names": ["카페"], "matched_tags": ["카페"], "tags": {"category": {"카페"}}, "latitude": None, "longitude": None, "open_time": None, "close_time": None, "distance_km": None, "score": 1.0, "match_score": 100},
            {"place_id": "next", "name": "전시", "address": "", "tag_names": ["전시"], "matched_tags": [], "tags": {"category": {"전시"}}, "latitude": None, "longitude": None, "open_time": None, "close_time": None, "distance_km": None, "score": 0.1, "match_score": 10},
        ]
        with patch.object(outing_api, "_llm_route", return_value=None):
            course = outing_api._build_recommended_course({"tags": ["카페"]}, candidates, ["카페", "전시"], 1)
        self.assertEqual(course["points"][0]["place_name_kr"], "카페")
        self.assertEqual(course["points"][0]["match_score"], 100)


if __name__ == "__main__":
    unittest.main()
