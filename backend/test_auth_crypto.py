"""Encrypted login persistence and legacy migration, using disposable databases."""
import json
import os
import sqlite3
import time
import unittest
from contextlib import closing
from unittest.mock import patch

from cryptography.fernet import Fernet
from fastapi import HTTPException

from backend import auth_crypto, google_auth_api as auth, test_google_auth_api as fixtures
from backend.test_google_auth_api import body, request, response_cookie


class LoginStorageTests(unittest.TestCase):
    setUp = fixtures.GoogleAuthTests.setUp
    start = fixtures.GoogleAuthTests.start
    claims = fixtures.GoogleAuthTests.claims
    login = fixtures.GoogleAuthTests.login

    def signed_in(self, token):
        return body(auth.auth_me(request(cookies={auth.SESSION_COOKIE: token})))['authenticated']

    def session(self):
        response, *_ = self.login()
        return response_cookie(response, auth.SESSION_COOKIE).value

    def legacy_database(self, profile=None):
        token, state, binding = 't' * 43, 's' * 43, 'b' * 43
        user = {'id': 'google:legacy123', 'email': 'legacy-person@example.com',
                'name': 'Legacy 사용자', 'picture': 'https://example.com/private-avatar'}
        nonce, verifier = 'legacy-nonce-' + 'n' * 43, 'legacy-verifier-' + 'v' * 43
        # Build the schema from the previous version without running the upgrade.
        with patch.object(auth_crypto, 'migrate'), auth._database() as database:
            database.execute('INSERT INTO auth_sessions VALUES(?,?,?,?)',
                             (auth._digest(token), json.dumps(user, ensure_ascii=False) if profile is None else profile,
                              time.time(), time.time() + 3600))
            database.execute('INSERT INTO oauth_flows VALUES(?,?,?,?,?)',
                             (auth._digest(state), auth._digest(binding), nonce, verifier, time.time() + 600))
        return token, state, binding, user, nonce, verifier

    def test_legacy_records_are_encrypted_once_without_losing_session_or_oauth_flow(self):
        token, state, binding, user, nonce, verifier = self.legacy_database()
        self.assertIn(user['email'].encode(), auth.DB_PATH.read_bytes())
        response = auth.auth_me(request(cookies={auth.SESSION_COOKIE: token}))
        self.assertEqual(body(response), {'authenticated': True, 'user': user})
        with auth._database() as database:
            profile = database.execute('SELECT profile FROM auth_sessions').fetchone()[0]
            flow = dict(database.execute('SELECT * FROM oauth_flows').fetchone())
        for plaintext in [*user.values(), nonce, verifier]:
            self.assertNotIn(plaintext.encode(), auth.DB_PATH.read_bytes())
        self.assertTrue(profile.startswith(auth_crypto.PREFIX))
        self.assertTrue(flow['nonce'].startswith(auth_crypto.PREFIX))
        self.assertTrue(flow['verifier'].startswith(auth_crypto.PREFIX))
        self.assertTrue(self.signed_in(token))
        with auth._database() as database:
            self.assertEqual(database.execute('SELECT profile FROM auth_sessions').fetchone()[0], profile)
        self.assertEqual(auth._consume_flow(state, binding), {'nonce': nonce, 'verifier': verifier})

    def test_migration_failure_rolls_back_all_records_and_can_retry(self):
        token, _, _, user, nonce, _ = self.legacy_database()
        real_seal = auth_crypto.seal

        def fail_flow(value, purpose, binding):
            if purpose == 'oauth-nonce':
                raise auth_crypto.StorageEncryptionError('test failure')
            return real_seal(value, purpose, binding)

        with patch.object(auth_crypto, 'seal', side_effect=fail_flow):
            self.assertFalse(self.signed_in(token))
        with closing(sqlite3.connect(auth.DB_PATH)) as database, database:
            self.assertEqual(json.loads(database.execute('SELECT profile FROM auth_sessions').fetchone()[0]), user)
            self.assertEqual(database.execute('SELECT nonce FROM oauth_flows').fetchone()[0], nonce)
            self.assertEqual(database.execute('SELECT COUNT(*) FROM auth_storage_meta').fetchone()[0], 0)
        self.assertTrue(self.signed_in(token))

    def test_corrupt_legacy_record_does_not_block_other_sessions(self):
        token, *_ = self.legacy_database(profile='["invalid-profile"]')
        self.assertFalse(self.signed_in(token))
        self.assertTrue(self.signed_in(self.session()))

    def test_same_profile_uses_distinct_ciphertext_and_cross_session_swaps_fail(self):
        first, second = self.session(), self.session()
        with auth._database() as database:
            rows = database.execute('SELECT token_hash,profile FROM auth_sessions').fetchall()
            self.assertNotEqual(rows[0]['profile'], rows[1]['profile'])
            database.execute('UPDATE auth_sessions SET profile=? WHERE token_hash=?',
                             (rows[0]['profile'], rows[1]['token_hash']))
            database.execute('UPDATE auth_sessions SET profile=? WHERE token_hash=?',
                             (rows[1]['profile'], rows[0]['token_hash']))
        self.assertFalse(self.signed_in(first))
        self.assertFalse(self.signed_in(second))

    def test_tampering_and_plaintext_injection_after_migration_are_rejected(self):
        token = self.session()
        with auth._database() as database:
            encrypted = database.execute('SELECT profile FROM auth_sessions').fetchone()[0]
        changed = encrypted[:50] + ('A' if encrypted[50] != 'A' else 'B') + encrypted[51:]
        forged = json.dumps({'id': 'google:forged', 'email': 'forged@example.com'})
        for corrupt in [changed, forged]:
            with self.subTest(value=corrupt[:15]):
                with auth._database() as database:
                    database.execute('UPDATE auth_sessions SET profile=?', (corrupt,))
                response = auth.auth_me(request(cookies={auth.SESSION_COOKIE: token}))
                self.assertEqual(body(response), {'authenticated': False, 'user': None})
                self.assertEqual(response_cookie(response, auth.SESSION_COOKIE)['max-age'], '0')

    def test_swapping_oauth_fields_rejects_and_consumes_flow_before_exchange(self):
        _, params, cookie = self.start()
        with auth._database() as database:
            database.execute('UPDATE oauth_flows SET nonce=verifier,verifier=nonce')
        with patch.object(auth, '_exchange_code') as exchange:
            response = auth.google_callback(request(query={'state': params['state'], 'code': 'test-code'},
                                                  cookies={auth.FLOW_COOKIE: cookie}))
        self.assertIn('auth_error=failed', response.headers['location'])
        exchange.assert_not_called()
        with auth._database() as database:
            self.assertEqual(database.execute('SELECT COUNT(*) FROM oauth_flows').fetchone()[0], 0)

    def test_missing_or_invalid_encryption_configuration_never_falls_back_to_plaintext(self):
        for settings in [{'AUTH_SESSION_SECRET': ''}, {'AUTH_DATA_ENCRYPTION_KEY': 'not-a-valid-key'}]:
            with self.subTest(settings=list(settings)), patch.dict(os.environ, settings):
                self.assertFalse(body(auth.auth_config())['configured'])
                with self.assertRaises(HTTPException) as raised:
                    auth.google_start(request())
                self.assertEqual(raised.exception.status_code, 503)
        self.assertFalse(auth.DB_PATH.exists())

    def test_signing_secret_change_invalidates_sessions_when_using_derived_key(self):
        token = self.session()
        with patch.dict(os.environ, {'AUTH_SESSION_SECRET': 'replacement-secret-with-at-least-thirty-two-characters'}):
            self.assertFalse(self.signed_in(token))
            self.assertTrue(self.signed_in(self.session()))

    def test_dedicated_key_is_server_only_and_independent_of_signing_secret(self):
        key = Fernet.generate_key().decode()
        with patch.dict(os.environ, {'AUTH_DATA_ENCRYPTION_KEY': key}):
            token = self.session()
            self.assertTrue(self.signed_in(token))
            self.assertNotIn(key, auth.auth_config().body.decode())
            self.assertNotIn(key, auth.auth_me(request(cookies={auth.SESSION_COOKIE: token})).body.decode())
            self.assertNotIn(key.encode(), auth.DB_PATH.read_bytes())
            with patch.dict(os.environ, {'AUTH_SESSION_SECRET': 'replacement-secret-with-at-least-thirty-two-characters'}):
                self.assertTrue(self.signed_in(token))
            with patch.dict(os.environ, {'AUTH_DATA_ENCRYPTION_KEY': Fernet.generate_key().decode()}):
                self.assertFalse(self.signed_in(token))

    def test_legacy_demo_does_not_need_encryption_secret(self):
        user = {'id': 'demo:moov', 'name': 'MOOV 체험', 'email': '', 'picture': ''}
        token, *_ = self.legacy_database(profile=json.dumps(user))
        # No pending Google flow exists in a demo-only installation.
        with closing(sqlite3.connect(auth.DB_PATH)) as database, database:
            database.execute('DELETE FROM oauth_flows')
        with patch.dict(os.environ, {'GOOGLE_CLIENT_ID': '', 'GOOGLE_CLIENT_SECRET': '', 'AUTH_SESSION_SECRET': ''}):
            self.assertTrue(self.signed_in(token))
            with auth._database() as database:
                self.assertEqual(database.execute('SELECT profile FROM auth_sessions').fetchone()[0], auth_crypto.DEMO_PROFILE)


if __name__ == '__main__':
    unittest.main()
