import json
import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend import survey_api, google_auth_api


class SurveyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / 'surveys.sqlite3'
        self.path_patch = patch.object(survey_api, 'DB_PATH', self.db)
        self.path_patch.start()
        self.app = FastAPI()
        self.app.include_router(survey_api.router)
        self.client = TestClient(self.app)
        self.payload = {'version': '1.8', 'status': 'completed', 'answers': {
            'categories': ['카페'], 'subcategories': {'카페': ['커피']},
            'preferredRegions': ['성수'], 'avoidedRegions': ['강남'],
            'avoidances': {'foods': ['고수']}}}

    def tearDown(self):
        self.client.close()
        self.path_patch.stop()
        self.tmp.cleanup()

    def user(self, name='google:one'):
        self.app.dependency_overrides[google_auth_api.require_auth_user] = lambda: {'id': name}

    def test_anonymous_cannot_read_or_write(self):
        with patch.object(google_auth_api, '_session_user', return_value=None):
            self.assertEqual(self.client.get('/api/outing/survey').status_code, 401)
            self.assertEqual(self.client.put('/api/outing/survey', json=self.payload).status_code, 401)
        self.assertFalse(self.db.exists())

    def test_account_isolation_persistence_edit_and_separate_profiles(self):
        self.user()
        self.assertIsNone(self.client.get('/api/outing/survey').json()['survey'])
        response = self.client.put('/api/outing/survey', json=self.payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        saved = response.json()['survey']
        self.assertEqual(saved['profile']['categories'], {'카페': 1})
        self.assertEqual(saved['profile']['excludedTags'], ['고수'])
        self.assertEqual(self.client.get('/api/outing/survey').json()['survey'], saved)
        self.user('google:two')
        self.assertIsNone(self.client.get('/api/outing/survey').json()['survey'])
        self.client.put('/api/outing/survey', json={'status': 'skipped', 'answers': {}})
        self.user()
        self.assertEqual(self.client.get('/api/outing/survey').json()['survey'], saved)
        self.payload['answers']['categories'] = ['쇼핑']
        self.payload['answers']['subcategories'] = {'쇼핑': ['패션']}
        updated = self.client.put('/api/outing/survey', json=self.payload).json()['survey']
        self.assertEqual(updated['profile']['categories'], {'쇼핑': 1})
        conn = sqlite3.connect(self.db)
        try:
            self.assertEqual(conn.execute('SELECT count(*) FROM user_survey').fetchone()[0], 2)
            row = conn.execute('SELECT profile_json FROM user_preference WHERE user_id=?', ('google:one',)).fetchone()
            self.assertEqual(json.loads(row[0]), updated['profile'])
        finally:
            conn.close()

    def test_partial_or_skipped_answers_are_neutral(self):
        self.user()
        result = self.client.put('/api/outing/survey', json={'status': 'skipped', 'answers': {}}).json()['survey']
        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['profile']['categories'], {})
        self.assertEqual(result['profile']['excludedTags'], [])

    def test_invalid_answers_and_client_identity_rejected(self):
        self.user()
        for answers in [
            {'categories': ['없는 항목']}, {'categories': ['카페', '카페']},
            {'subcategories': {'카페': ['커피']}},
            {'categories': ['카페'], 'subcategories': {'카페': ['한식']}},
            {'preferredRegions': ['성수'], 'avoidedRegions': ['성수']},
            {'avoidances': {'foods': ['a' * 41]}},
        ]:
            with self.subTest(answers=answers):
                self.assertEqual(self.client.put('/api/outing/survey', json={'status': 'completed', 'answers': answers}).status_code, 422)
        self.assertEqual(self.client.put('/api/outing/survey', json={**self.payload, 'user_id': 'google:two'}).status_code, 422)

    def test_cross_origin_mutation_denied(self):
        with patch.object(google_auth_api, '_session_user', return_value={'id': 'google:one'}):
            response = self.client.put('/api/outing/survey', json=self.payload, headers={'Origin': 'https://untrusted.invalid'})
            self.assertEqual(response.status_code, 403)
        self.assertFalse(self.db.exists())

    def test_location_consent_is_explicit_account_scoped_and_idempotent(self):
        self.user()
        self.assertIsNone(self.client.get('/api/outing/survey').json()['locationConsent'])
        url = '/api/outing/survey/location-consent'
        for payload in [{}, {'agreed': False}, {'agreed': True, 'user_id': 'google:two'}]:
            self.assertEqual(self.client.put(url,json=payload).status_code,422)
        saved = self.client.put(url,json={'agreed': True, 'version': '1'})
        self.assertEqual(saved.status_code,200)
        self.assertEqual(saved.headers['cache-control'],'no-store')
        self.assertEqual(self.client.put(url,json={'agreed': True}).json(),saved.json())
        self.assertEqual(self.client.get('/api/outing/survey').json()['locationConsent'],saved.json()['locationConsent'])
        self.user('google:two')
        self.assertIsNone(self.client.get('/api/outing/survey').json()['locationConsent'])
        self.app.dependency_overrides.clear()
        with patch.object(google_auth_api,'_session_user',return_value=None):
            self.assertEqual(self.client.put(url,json={'agreed': True}).status_code,401)

    def test_repository_snapshot_is_account_scoped_and_live_survey_takes_priority(self):
        self.user()
        directory = Path(self.tmp.name) / 'snapshots'
        directory.mkdir()
        account_hash = hashlib.sha256(b'google:one').hexdigest()
        backup = {'schemaVersion':1, 'accountHash':account_hash, 'exportedAt':'2026-09-21T00:00:00Z',
                  'outing':{'customCourses':[{'id':'mine-one','name':'Saved course'}]},
                  'survey':self.payload}
        (directory / f'{account_hash}.json').write_text(json.dumps(backup),encoding='utf-8')
        with patch.object(survey_api,'SNAPSHOT_DIR',directory):
            result = self.client.get('/api/outing/survey').json()
            self.assertEqual(result['accountBackup'],backup)
            self.assertEqual(result['survey']['profile']['categories'],{'카페':1})
            self.assertIsNone(result['locationConsent'])
            self.client.put('/api/outing/survey',json={'status':'skipped','answers':{}})
            self.assertEqual(self.client.get('/api/outing/survey').json()['survey']['status'],'skipped')
            self.user('google:two')
            result = self.client.get('/api/outing/survey').json()
            self.assertIsNone(result['accountBackup'])
            self.assertIsNone(result['survey'])


if __name__ == '__main__':
    unittest.main()
