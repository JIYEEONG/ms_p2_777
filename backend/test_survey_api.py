import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend import google_auth_api, survey_api


class SurveyTests(unittest.TestCase):
    def setUp(self):
        self.rows, self.consents = {}, {}
        self.tmp = tempfile.TemporaryDirectory()
        self.patches = [
            patch.object(survey_api, 'SNAPSHOT_DIR', Path(self.tmp.name)),
            patch.object(survey_api, '_load_account', side_effect=self.load),
            patch.object(survey_api, '_store_consent', side_effect=self.store_consent),
            patch.object(survey_api, '_store_survey', side_effect=self.store_survey),
        ]
        for item in self.patches:
            item.start()
        self.app = FastAPI()
        self.app.include_router(survey_api.router)
        self.client = TestClient(self.app)
        self.user()
        self.payload = {'version': '1.8', 'status': 'completed', 'answers': {
            'categories': ['카페'], 'subcategories': {'카페': ['커피']},
            'preferredRegions': ['성수'], 'avoidedRegions': ['강남'],
            'avoidances': {'foods': ['고수']}}}

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):
            item.stop()
        self.tmp.cleanup()

    def user(self, user_id='google:one'):
        self.user_id = user_id
        self.app.dependency_overrides[google_auth_api.require_auth_user] = lambda: {'id': user_id}

    def load(self, user_id):
        return self.rows.get(user_id), self.consents.get(user_id)

    def store_consent(self, user_id, version):
        self.consents.setdefault(user_id, (version, datetime.now(timezone.utc)))
        return self.consents[user_id]

    def store_survey(self, user_id, body):
        now = datetime.now(timezone.utc)
        answers = body.answers.model_dump()
        profile = survey_api.derive_profile(body.answers)
        self.rows[user_id] = (body.version, {'status': body.status, 'answers': answers}, now)
        return answers, profile, now

    def test_account_isolation_edit_and_location_consent(self):
        self.assertIsNone(self.client.get('/api/outing/survey').json()['survey'])
        saved = self.client.put('/api/outing/survey', json=self.payload).json()['survey']
        self.assertEqual(saved['profile']['categories'], {'카페': 1})
        self.assertEqual(saved['profile']['excludedTags'], ['고수'])
        self.assertEqual(self.client.get('/api/outing/survey').json()['survey'], saved)
        consent = self.client.put('/api/outing/survey/location-consent', json={'agreed': True}).json()
        self.assertEqual(consent['locationConsent']['version'], '1')
        self.user('google:two')
        result = self.client.get('/api/outing/survey').json()
        self.assertIsNone(result['survey'])
        self.assertIsNone(result['locationConsent'])

    def test_category_mapping_and_validation(self):
        body = survey_api.SurveyInput.model_validate(self.payload)
        profile = survey_api.derive_profile(body.answers)
        self.assertEqual(survey_api._preference_rows(profile), [
            ('CATEGORY', '카페'), ('SUB_CATEGORY', '커피'), ('REGION', '성수'),
            ('EXCLUDED_REGION', '강남'), ('EXCLUDED_TAG', '고수')])
        response = self.client.put('/api/outing/survey', json={
            'status': 'completed', 'answers': {'categories': ['카페'], 'subcategories': {'카페': ['한식']}}})
        self.assertEqual(response.status_code, 422)

    def test_anonymous_cannot_read_or_write(self):
        self.app.dependency_overrides.clear()
        with patch.object(google_auth_api, '_session_user', return_value=None):
            self.assertEqual(self.client.get('/api/outing/survey').status_code, 401)
            self.assertEqual(self.client.put('/api/outing/survey', json=self.payload).status_code, 401)


if __name__ == '__main__':
    unittest.main()
