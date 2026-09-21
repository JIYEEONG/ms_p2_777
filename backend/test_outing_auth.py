"""User-owned mutations require the verified Google session; no external DB."""
import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import google_auth_api, outing_api


class OutingAuthTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(outing_api.router)
        self.client = TestClient(self.app)
        self.event = {
            'event_id': 'test-event', 'user_id': 'google:111', 'session_id': 'test-session',
            'event_type': 'course_like', 'target_type': 'course', 'target_id': 'test-course',
            'occurred_at': '2026-09-21T00:00:00Z', 'rule_version': 'test',
        }
        self.course = {'user_id': 'google:111', 'title': 'Test course', 'stops': [{'name': 'Test place'}]}

    def tearDown(self):
        self.client.close()

    def signed_in(self):
        self.app.dependency_overrides[google_auth_api.require_auth_user] = lambda: {'id': 'google:111'}

    def test_anonymous_mutations_never_access_database_or_upload_service(self):
        with patch.object(google_auth_api, '_config', return_value=None), patch.object(outing_api, 'get_conn') as connect:
            self.assertEqual(self.client.post('/api/outing/events', json=self.event).status_code, 401)
            self.assertEqual(self.client.post('/api/outing/courses', json=self.course).status_code, 401)
            self.assertEqual(self.client.post('/api/outing/upload-image', files={'file': ('test.png', b'image', 'image/png')}).status_code, 401)
            connect.assert_not_called()

    def test_other_account_ids_are_rejected_before_database_access(self):
        self.signed_in()
        with patch.object(outing_api, 'get_conn') as connect:
            self.assertEqual(self.client.post('/api/outing/events', json={**self.event, 'user_id': 'google:222'}).status_code, 403)
            self.assertEqual(self.client.post('/api/outing/courses', json={**self.course, 'user_id': 'google:222'}).status_code, 403)
            connect.assert_not_called()

    def test_events_use_verified_identity(self):
        self.signed_in()
        connection = MagicMock()
        with patch.object(outing_api, 'get_conn', return_value=connection), patch.object(outing_api, 'release_conn'):
            self.assertEqual(self.client.post('/api/outing/events', json=self.event).status_code, 200)
            params = connection.cursor.return_value.__enter__.return_value.execute.call_args.args[1]
            self.assertEqual(params[1], 'google:111')
            connection.commit.assert_called_once()

    def test_courses_use_verified_identity(self):
        self.signed_in()
        connection = MagicMock()
        with patch.object(outing_api, 'get_conn', return_value=connection), patch.object(outing_api, 'release_conn'):
            self.assertEqual(self.client.post('/api/outing/courses', json=self.course).status_code, 200)
            params = connection.cursor.return_value.__enter__.return_value.execute.call_args_list[0].args[1]
            self.assertEqual(params[1], 'google:111')
            connection.commit.assert_called_once()


if __name__ == '__main__':
    unittest.main()
