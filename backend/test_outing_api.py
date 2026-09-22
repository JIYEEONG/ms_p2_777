import unittest

from backend.outing_api import _rank_courses


def course(course_id, category, subcategory, region=''):
    return {
        'id': course_id, 'title': f'{region} {course_id}', 'created_at': '2026-09-22',
        'points': [{'address': region}],
        'tags': {'category': category, 'subcategory': subcategory, 'region': [],
                 'purpose': [], 'mood': [], 'companion': []},
    }


class RecommendationTests(unittest.TestCase):
    def test_survey_tags_rank_and_exclusions_apply(self):
        courses = [
            course('matched', ['카페'], ['커피'], '성수'),
            course('wrong', ['관광'], ['자연'], '성수'),
            course('excluded', ['카페'], ['커피'], '강남'),
        ]
        preferences = {
            'CATEGORY': ['카페'], 'SUB_CATEGORY': ['커피'], 'REGION': ['성수'],
            'EXCLUDED_REGION': ['강남'],
        }
        ranked = _rank_courses(courses, preferences, {}, {'wrong': 99})
        self.assertEqual([item['course']['id'] for item in ranked], ['matched', 'wrong'])
        self.assertEqual(ranked[0]['matched_tags'], ['카페', '커피'])


if __name__ == '__main__':
    unittest.main()
