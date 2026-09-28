"""Protect venue identity while tolerating real search-result name variants."""
import unittest

from naver_place_queries import RULES, relevant, search_queries


class VenueIdentityTests(unittest.TestCase):
    def test_sadang_alias_does_not_require_redundant_city_name(self):
        self.assertTrue(relevant("태양커피 서울사당점", "[태양커피 사당점] 방문 리뷰"))
        self.assertTrue(relevant("태양커피 서울사당점", "사당역 카페 <b>태양커피</b>"))
        self.assertFalse(relevant("태양커피 서울사당점", "태양커피 방배점"))
        self.assertFalse(relevant("태양커피 서울사당점", "대전 태양커피 아인슈페너"))

    def test_other_branches_and_missing_branch_evidence_are_rejected(self):
        for place, correct, wrong in (
            ("갓잇 문래점", "문래동 갓잇", "갓잇 성수점"),
            ("그라운드시소 센트럴", "그라운드 시소 센트럴", "그라운드시소 서촌"),
            ("일편등심 강남", "강남역 일편등심", "일편등심 홍대"),
            ("만동제과", "연남동 만동제과", "강릉 만동제과"),
            ("노란돼지", "사당역 노란돼지", "부산 노란돼지"),
            ("타이파", "왕십리 타이파", "마카오 타이파 여행"),
        ):
            with self.subTest(place=place):
                self.assertTrue(relevant(place, correct))
                self.assertFalse(relevant(place, wrong))
        self.assertFalse(relevant("만동제과", "만동제과 마늘빵"))
        self.assertFalse(relevant("태양커피 서울사당점", "태양커피", "서울 서초구 방배천로 32"))

    def test_distinct_spaces_are_not_widened_to_nearby_attractions(self):
        for place, correct, wrong in (
            ("잠실지하광장 쇼핑센터", "잠실 지하광장 쇼핑센터", "잠실역 지하상가"),
            ("동대문디자인플라자 디자인전시관", "DDP 디자인전시관", "동대문디자인플라자 외관"),
            ("서울특별시청 하늘광장갤러리", "시청 하늘광장 갤러리", "서울시청 전망대"),
            ("건국대학교 일감호", "건대 일감호", "건국대학교 캠퍼스"),
            ("덕수궁 대한문", "대한문 전경", "덕수궁 석조전"),
        ):
            with self.subTest(place=place):
                self.assertTrue(relevant(place, correct))
                self.assertFalse(relevant(place, wrong))

    def test_every_configured_query_keeps_matching_identity(self):
        self.assertEqual(len(RULES), 22)
        for place in RULES:
            for query in search_queries(place):
                with self.subTest(place=place, query=query):
                    self.assertTrue(relevant(place, query))

    def test_categories_and_incomplete_names_never_match(self):
        self.assertFalse(relevant("구씨네부엌", "구씨네 홍대 파스타 맛집"))
        self.assertFalse(relevant("로얄마카롱", "서울 마카롱 맛집"))
        self.assertFalse(relevant("신규브랜드 서울사당점", "신규브랜드 사당점"))
        self.assertFalse(relevant("", ""))
        self.assertFalse(relevant("커넥트투", "How to connect to a printer"))
        self.assertTrue(relevant("커넥트투", "CONNECT TO 잠실"))

    def test_query_address_is_only_ranking_context(self):
        queries = search_queries("태양커피 서울사당점", "서울 서초구 방배천로 32")
        self.assertEqual(queries[0], "태양커피 사당점")
        self.assertTrue(queries[-1].endswith("방배천로 32"))
        self.assertEqual(len(queries), len(set(queries)))


if __name__ == "__main__":
    unittest.main()
