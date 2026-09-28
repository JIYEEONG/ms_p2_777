"""Offline regressions for wrong-branch and unrelated fallback image results."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from collect_course_stop_fallbacks import matches, usable_source


class NaverStopFallbackGuardTests(unittest.TestCase):
    def test_accepts_explicit_starbucks_sadang_branch(self):
        self.assertTrue(matches("스타벅스 사당점", "스타벅스 사당점 방문", ""))

    def test_rejects_yeouido_parliament_branch_for_sadang(self):
        # 사당 is a substring of 의사당, but these are different branches.
        self.assertFalse(matches("스타벅스 사당점", "스타벅스 여의도의사당점", ""))

    def test_accepts_hunchun_branch_one(self):
        self.assertTrue(matches("훈춘양꼬치 1호점", "건대 훈춘양꼬치 1호점", ""))

    def test_rejects_hunchun_branch_two_for_branch_one(self):
        self.assertFalse(matches("훈춘양꼬치 1호점", "건대 훈춘양꼬치 2호점", ""))

    def test_rejects_seongsu_for_gwangjin_gyetanjip(self):
        self.assertFalse(matches("계탄집", "계탄집 성수점", ""))

    def test_accepts_jayang_gyetanjip_locality(self):
        self.assertTrue(matches("계탄집", "자양동 계탄집", ""))

    def test_accepts_exact_exhibition_venue(self):
        self.assertTrue(matches("서울도시건축전시관", "서울도시건축전시관 외관", ""))

    def test_rejects_generic_architecture_category(self):
        self.assertFalse(matches("서울도시건축전시관", "서울의 건축 전시와 풍경", ""))

    def test_rejects_neighboring_gojong_path_for_deoksugung_wall(self):
        self.assertFalse(matches("덕수궁돌담길", "덕수궁돌담길에서 이어지는 고종의길", ""))

    def test_rejects_stock_library_even_with_venue_title(self):
        self.assertFalse(usable_source({
            "link": "https://image.shutterstock.com/test.jpg",
            "title": "전광수커피하우스 정동점",
        }))

    def test_rejects_stock_library_wrapped_in_naver_proxy(self):
        self.assertFalse(usable_source({
            "link": "https://search.pstatic.net/?src=https%3A%2F%2Fimage.shutterstock.com%2Ftest.jpg",
            "title": "전광수커피하우스 정동점",
        }))

    def test_rejects_nearby_restaurant_listing_as_venue_evidence(self):
        self.assertFalse(usable_source({
            "link": "https://example.com/photo.jpg",
            "title": "힉스커피 근처 맛집 Best 10",
        }))

    def test_accepts_ordinary_venue_photo_source(self):
        self.assertTrue(usable_source({
            "link": "https://example.com/cafe.jpg",
            "title": "전광수커피하우스 정동점 내부",
        }))


if __name__ == "__main__":
    unittest.main()
