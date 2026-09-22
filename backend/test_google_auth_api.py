import importlib.util
import json
import os
from concurrent.futures import ThreadPoolExecutor
from http.cookies import SimpleCookie
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlencode, urlsplit

from fastapi import HTTPException, Request

from backend import google_auth_api as auth


TEST_ENV = {
    'GOOGLE_CLIENT_ID': 'unit-test-client.apps.googleusercontent.com',
    'GOOGLE_CLIENT_SECRET': 'unit-test-secret-not-a-real-google-credential',
    'AUTH_SESSION_SECRET': 'unit-test-signing-key-with-more-than-thirty-two-characters',
    'AUTH_DATA_ENCRYPTION_KEY': '',
    'APP_BASE_URL': 'http://localhost:3000',
    'GOOGLE_REDIRECT_URI': 'http://localhost:3000/api/auth/google/callback',
}


def request(method='GET', query=None, cookies=None, origin=None):
    headers = []
    if cookies:
        headers.append((b'cookie', '; '.join(key + '=' + value for key, value in cookies.items()).encode()))
    if origin is not None:
        headers.append((b'origin', origin.encode()))
    return Request({
        'type': 'http', 'method': method, 'scheme': 'http', 'path': '/',
        'query_string': urlencode(query or {}).encode(), 'headers': headers,
        'server': ('localhost', 3000), 'client': ('127.0.0.1', 43210),
    })


def response_cookie(response, name):
    cookie = SimpleCookie()
    for header in response.headers.getlist('set-cookie'):
        cookie.load(header)
    return cookie[name] if name in cookie else None


def body(response):
    return json.loads(response.body)


class GoogleAuthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='moov-auth-test-')
        self.addCleanup(self.temp.cleanup)
        self.env = patch.dict(os.environ, TEST_ENV)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.db = patch.object(auth, 'DB_PATH', Path(self.temp.name) / 'sessions.sqlite3')
        self.db.start()
        self.addCleanup(self.db.stop)

    def start(self):
        response = auth.google_start(request())
        params = {key: values[0] for key, values in parse_qs(urlsplit(response.headers['location']).query).items()}
        return response, params, response_cookie(response, auth.FLOW_COOKIE).value

    def claims(self, params, **changes):
        return {
            'aud': TEST_ENV['GOOGLE_CLIENT_ID'], 'iss': 'https://accounts.google.com',
            'exp': int(time.time()) + 3600, 'iat': int(time.time()),
            'nonce': params['nonce'], 'sub': '123456789012345678901',
            'email': 'person@example.com', 'email_verified': True,
            'name': 'Google User', 'picture': 'https://lh3.googleusercontent.com/avatar',
            **changes,
        }

    def login(self, old_token=None, changes=None):
        _, params, cookie = self.start()
        cookies = {auth.FLOW_COOKIE: cookie}
        if old_token:
            cookies[auth.SESSION_COOKIE] = old_token
        with patch.object(auth, '_exchange_code', return_value='test-id-token') as exchange, patch.object(auth, '_verify_google_token', return_value=self.claims(params, **(changes or {}))) as verify:
            response = auth.google_callback(request(query={'state': params['state'], 'code': 'test-code'}, cookies=cookies))
        return response, params, cookie, exchange, verify

    def test_public_configuration_never_exposes_credentials(self):
        response = auth.auth_config()
        self.assertEqual(body(response), {'configured': True, 'demoEnabled': True, 'loginUrl': '/api/auth/google/start'})
        self.assertEqual(response.headers['cache-control'], 'no-store')
        for key in ['GOOGLE_CLIENT_SECRET', 'AUTH_SESSION_SECRET']:
            self.assertNotIn(TEST_ENV[key], response.body.decode())

    def test_absent_config_is_graceful_and_does_not_create_database(self):
        with patch.dict(os.environ, {'GOOGLE_CLIENT_ID': '', 'GOOGLE_CLIENT_SECRET': ''}):
            self.assertFalse(body(auth.auth_config())['configured'])
            self.assertEqual(body(auth.auth_me(request())), {'authenticated': False, 'user': None})
            with self.assertRaises(HTTPException) as raised:
                auth.google_start(request())
            self.assertEqual(raised.exception.status_code, 503)
        self.assertFalse(auth.DB_PATH.exists())

    def test_config_rejects_cross_origin_redirects_weak_secret_and_public_http(self):
        changes = [
            {'GOOGLE_REDIRECT_URI': 'https://attacker.example/api/auth/google/callback'},
            {'GOOGLE_REDIRECT_URI': TEST_ENV['GOOGLE_REDIRECT_URI'] + '?next=https://attacker.example'},
            {'GOOGLE_REDIRECT_URI': 'http://localhost:3000/wrong/callback'},
            {'APP_BASE_URL': 'http://public.example'},
            {'APP_BASE_URL': 'https://user:password@example.com'},
            {'APP_BASE_URL': 'https://example.com/#redirect'},
            {'AUTH_SESSION_SECRET': 'too-short'},
        ]
        for change in changes:
            with self.subTest(change=list(change)), patch.dict(os.environ, change):
                self.assertFalse(body(auth.auth_config())['configured'])

    def test_start_uses_pkce_nonce_signed_browser_cookie_and_hashed_state(self):
        response, params, cookie = self.start()
        self.assertEqual(response.status_code, 303)
        self.assertTrue(response.headers['location'].startswith(auth.GOOGLE_AUTHORIZE + '?'))
        self.assertEqual(params['scope'], 'openid email profile')
        self.assertEqual(params['response_type'], 'code')
        self.assertEqual(params['code_challenge_method'], 'S256')
        self.assertEqual(params['redirect_uri'], TEST_ENV['GOOGLE_REDIRECT_URI'])
        self.assertNotIn(TEST_ENV['GOOGLE_CLIENT_SECRET'], response.headers['location'])
        morsel = response_cookie(response, auth.FLOW_COOKIE)
        self.assertTrue(morsel['httponly'])
        self.assertEqual(morsel['samesite'], 'lax')
        self.assertFalse(morsel['secure'])
        self.assertEqual(morsel['max-age'], str(auth.FLOW_TTL))
        with auth._database() as database:
            row = database.execute('SELECT * FROM oauth_flows').fetchone()
        self.assertEqual(row['state_hash'], auth._digest(params['state']))
        self.assertNotEqual(row['state_hash'], params['state'])
        self.assertEqual(row['binding_hash'], auth._digest(auth._read_binding(cookie, auth._config())))
        nonce = auth.auth_crypto.unseal(row['nonce'], 'oauth-nonce', row['state_hash'])
        verifier = auth.auth_crypto.unseal(row['verifier'], 'oauth-verifier', row['state_hash'])
        self.assertEqual(nonce, params['nonce'])
        self.assertEqual(params['code_challenge'], auth._base64(auth.hashlib.sha256(verifier.encode()).digest()))
        for field, plaintext in [('nonce', nonce), ('verifier', verifier)]:
            self.assertTrue(row[field].startswith(auth.auth_crypto.PREFIX))
            self.assertNotIn(plaintext.encode(), auth.DB_PATH.read_bytes())

    def test_success_uses_verified_subject_and_stores_only_session_hash_and_profile(self):
        response, params, cookie, exchange, verify = self.login()
        self.assertEqual(response.headers['location'], TEST_ENV['APP_BASE_URL'] + '/')
        token = response_cookie(response, auth.SESSION_COOKIE).value
        self.assertNotIn('test-id-token', token)
        user = body(auth.auth_me(request(cookies={auth.SESSION_COOKIE: token})))
        self.assertEqual(user['authenticated'], True)
        self.assertEqual(user['user']['id'], 'google:123456789012345678901')
        self.assertEqual(user['user']['email'], 'person@example.com')
        verify.assert_called_once_with('test-id-token', TEST_ENV['GOOGLE_CLIENT_ID'])
        self.assertEqual(exchange.call_args.args[0], 'test-code')
        with auth._database() as database:
            row = dict(database.execute('SELECT * FROM auth_sessions').fetchone())
        self.assertEqual(row['token_hash'], auth._digest(token))
        self.assertNotIn(token, json.dumps(row))
        self.assertNotIn('test-id-token', json.dumps(row))
        self.assertTrue(row['profile'].startswith(auth.auth_crypto.PREFIX))
        for plaintext in user['user'].values():
            self.assertNotIn(plaintext.encode(), auth.DB_PATH.read_bytes())
        self.assertEqual(response_cookie(response, auth.FLOW_COOKIE)['max-age'], '0')

    def test_https_deployment_marks_both_cookies_secure(self):
        with patch.dict(os.environ, {'APP_BASE_URL': 'https://app.example.com', 'GOOGLE_REDIRECT_URI': 'https://app.example.com/api/auth/google/callback'}):
            response, _, _ = self.start()
            self.assertTrue(response_cookie(response, auth.FLOW_COOKIE)['secure'])
            response, *_ = self.login()
            self.assertTrue(response_cookie(response, auth.SESSION_COOKIE)['secure'])

    def test_wrong_missing_tampered_or_cross_browser_state_never_reaches_google(self):
        _, params, cookie = self.start()
        _, _, second_cookie = self.start()
        attempts = [
            ({'state': params['state'], 'code': 'x'}, {}),
            ({'code': 'x'}, {auth.FLOW_COOKIE: cookie}),
            ({'state': 'incorrect', 'code': 'x'}, {auth.FLOW_COOKIE: cookie}),
            ({'state': params['state'], 'code': 'x'}, {auth.FLOW_COOKIE: cookie + 'x'}),
            ({'state': params['state'], 'code': 'x'}, {auth.FLOW_COOKIE: second_cookie}),
        ]
        with patch.object(auth, '_exchange_code') as exchange:
            for query, cookies in attempts:
                response = auth.google_callback(request(query=query, cookies=cookies))
                self.assertEqual(response.headers['location'], TEST_ENV['APP_BASE_URL'] + '/?auth_error=failed')
            exchange.assert_not_called()

    def test_expired_state_cannot_be_used(self):
        _, params, cookie = self.start()
        with patch.object(auth.time, 'time', return_value=time.time() + auth.FLOW_TTL + 1), patch.object(auth, '_exchange_code') as exchange:
            response = auth.google_callback(request(query={'state': params['state'], 'code': 'x'}, cookies={auth.FLOW_COOKIE: cookie}))
        exchange.assert_not_called()
        self.assertIn('auth_error=failed', response.headers['location'])

    def test_callback_state_is_one_use_even_with_original_cookie(self):
        response, params, cookie, _, _ = self.login()
        self.assertIsNotNone(response_cookie(response, auth.SESSION_COOKIE))
        with patch.object(auth, '_exchange_code') as exchange:
            replay = auth.google_callback(request(query={'state': params['state'], 'code': 'test-code'}, cookies={auth.FLOW_COOKIE: cookie}))
        exchange.assert_not_called()
        self.assertIn('auth_error=failed', replay.headers['location'])

    def test_concurrent_callbacks_cannot_both_consume_a_state(self):
        _, params, cookie = self.start()
        binding = auth._read_binding(cookie, auth._config())

        def consume(_):
            try:
                auth._consume_flow(params['state'], binding)
                return True
            except auth.LoginFailed:
                return False

        with ThreadPoolExecutor(max_workers=2) as executor:
            self.assertEqual(sorted(executor.map(consume, [0, 1])), [False, True])

    def test_invalid_nonce_audience_issuer_expiry_or_email_never_creates_session(self):
        for changes in [
            {'nonce': 'another-flow'}, {'aud': 'another-client'}, {'iss': 'https://attacker.example'},
            {'exp': 0}, {'exp': float('nan')}, {'exp': float('inf')},
            {'sub': ''}, {'sub': '1' * 58}, {'email_verified': False}, {'email_verified': 'true'},
        ]:
            with self.subTest(changes=list(changes)):
                response, *_ = self.login(changes=changes)
                self.assertIsNone(response_cookie(response, auth.SESSION_COOKIE))
                self.assertIn('auth_error=failed', response.headers['location'])
        with auth._database() as database:
            self.assertEqual(database.execute('SELECT COUNT(*) FROM auth_sessions').fetchone()[0], 0)

    def test_provider_cancellation_consumes_state_without_token_exchange(self):
        _, params, cookie = self.start()
        with patch.object(auth, '_exchange_code') as exchange:
            response = auth.google_callback(request(query={'state': params['state'], 'error': 'access_denied'}, cookies={auth.FLOW_COOKIE: cookie}))
        exchange.assert_not_called()
        self.assertIn('auth_error=cancelled', response.headers['location'])
        with self.assertRaises(auth.LoginFailed):
            auth._consume_flow(params['state'], auth._read_binding(cookie, auth._config()))

    def test_provider_errors_and_invalid_signatures_are_sanitized(self):
        for target in ['_exchange_code', '_verify_google_token']:
            _, params, cookie = self.start()
            with patch.object(auth, '_exchange_code', return_value='id-token'), patch.object(auth, target, side_effect=ValueError('secret-sentinel token details')):
                response = auth.google_callback(request(query={'state': params['state'], 'code': 'secret-code'}, cookies={auth.FLOW_COOKIE: cookie}))
            self.assertEqual(response.headers['location'], TEST_ENV['APP_BASE_URL'] + '/?auth_error=failed')
            self.assertNotIn('secret', str(response.headers))
            self.assertIsNone(response_cookie(response, auth.SESSION_COOKIE))

    def test_session_expiry_and_unknown_tokens_are_unauthenticated(self):
        response, *_ = self.login()
        token = response_cookie(response, auth.SESSION_COOKIE).value
        self.assertFalse(body(auth.auth_me(request(cookies={auth.SESSION_COOKIE: 'x' * 43})))['authenticated'])
        with patch.object(auth.time, 'time', return_value=time.time() + auth.SESSION_TTL + 1):
            response = auth.auth_me(request(cookies={auth.SESSION_COOKIE: token}))
        self.assertEqual(body(response), {'authenticated': False, 'user': None})
        self.assertEqual(response_cookie(response, auth.SESSION_COOKIE)['max-age'], '0')

    def test_login_rotates_existing_session(self):
        first, *_ = self.login()
        old_token = response_cookie(first, auth.SESSION_COOKIE).value
        second, *_ = self.login(old_token=old_token)
        new_token = response_cookie(second, auth.SESSION_COOKIE).value
        self.assertNotEqual(old_token, new_token)
        self.assertFalse(body(auth.auth_me(request(cookies={auth.SESSION_COOKIE: old_token})))['authenticated'])
        self.assertTrue(body(auth.auth_me(request(cookies={auth.SESSION_COOKIE: new_token})))['authenticated'])

    def test_logout_rejects_missing_and_foreign_origin_then_revokes_session(self):
        response, *_ = self.login()
        token = response_cookie(response, auth.SESSION_COOKIE).value
        for origin in [None, 'null', 'https://attacker.example', 'http://127.0.0.1:3000', 'http://localhost:3001']:
            with self.assertRaises(HTTPException) as raised:
                auth.auth_logout(request('POST', cookies={auth.SESSION_COOKIE: token}, origin=origin))
            self.assertEqual(raised.exception.status_code, 403)
        self.assertTrue(body(auth.auth_me(request(cookies={auth.SESSION_COOKIE: token})))['authenticated'])
        response = auth.auth_logout(request('POST', cookies={auth.SESSION_COOKIE: token}, origin=TEST_ENV['APP_BASE_URL']))
        self.assertFalse(body(response)['authenticated'])
        self.assertEqual(response_cookie(response, auth.SESSION_COOKIE)['max-age'], '0')
        self.assertFalse(body(auth.auth_me(request(cookies={auth.SESSION_COOKIE: token})))['authenticated'])

    def test_protected_routers_get_only_session_identity_and_check_unsafe_origin(self):
        with self.assertRaises(HTTPException) as raised:
            auth.require_auth_user(request(query={'user_id': 'google:forged'}))
        self.assertEqual(raised.exception.status_code, 401)
        response, *_ = self.login()
        token = response_cookie(response, auth.SESSION_COOKIE).value
        cookies = {auth.SESSION_COOKIE: token}
        user = auth.require_auth_user(request(query={'user_id': 'google:forged'}, cookies=cookies))
        self.assertEqual(user['id'], 'google:123456789012345678901')
        for method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            with self.assertRaises(HTTPException) as raised:
                auth.require_auth_user(request(method, cookies=cookies))
            self.assertEqual(raised.exception.status_code, 403)
            self.assertEqual(auth.require_auth_user(request(method, cookies=cookies, origin=TEST_ENV['APP_BASE_URL']))['id'], user['id'])

    def test_user_identity_follows_subject_not_changeable_email_or_name(self):
        _, params, _ = self.start()
        original = auth._user_from_claims(self.claims(params), auth._config(), params['nonce'])
        renamed = auth._user_from_claims(self.claims(params, email='renamed@example.com', name='New Name', picture='javascript:alert(1)'), auth._config(), params['nonce'])
        self.assertEqual(original['id'], renamed['id'])
        self.assertEqual(renamed['picture'], '')
        longest = auth._user_from_claims(self.claims(params, sub='1' * 57), auth._config(), params['nonce'])
        self.assertEqual(len(longest['id']), 64)

    @unittest.skipUnless(importlib.util.find_spec('google') is not None, 'google-auth dependency not installed yet')
    def test_official_verifier_receives_client_audience_and_bounded_transport(self):
        from google.oauth2 import id_token
        from google.auth.transport.requests import Request as GoogleRequest

        def verify(token, transport, audience):
            self.assertEqual(token, 'signed-token')
            self.assertEqual(audience, TEST_ENV['GOOGLE_CLIENT_ID'])
            transport('https://www.googleapis.com/oauth2/v1/certs', method='GET')
            return {'verified': True}

        with patch.object(id_token, 'verify_oauth2_token', side_effect=verify), patch.object(GoogleRequest, '__call__', return_value=None) as network:
            result = auth._verify_google_token('signed-token', TEST_ENV['GOOGLE_CLIENT_ID'])
        self.assertEqual(result, {'verified': True})
        self.assertEqual(network.call_args.kwargs['timeout'], (3.05, 8))


class DemoAuthTests(unittest.TestCase):
    setUp = GoogleAuthTests.setUp

    def test_demo_without_google_configuration_and_logout(self):
        with patch.dict(os.environ, {'GOOGLE_CLIENT_ID': '', 'GOOGLE_CLIENT_SECRET': '', 'AUTH_SESSION_SECRET': ''}):
            response = auth.demo_login(auth.DemoLogin(username='moov', password='demo1234'), request('POST', origin=TEST_ENV['APP_BASE_URL']))
            cookie = response_cookie(response, auth.SESSION_COOKIE)
            self.assertTrue(cookie['httponly'])
            cookies = {auth.SESSION_COOKIE: cookie.value}
            self.assertEqual(auth.require_auth_user(request(cookies=cookies))['id'], 'demo:moov')
            auth.auth_logout(request('POST', cookies=cookies, origin=TEST_ENV['APP_BASE_URL']))
            self.assertFalse(body(auth.auth_me(request(cookies=cookies)))['authenticated'])

    def test_demo_rejects_wrong_credentials_and_cross_origin(self):
        for username, password, origin, status in [('moov', 'wrong', TEST_ENV['APP_BASE_URL'], 401), ('google:123', 'demo1234', TEST_ENV['APP_BASE_URL'], 401), ('moov', 'demo1234', 'https://other.example', 403)]:
            with self.assertRaises(HTTPException) as raised:
                auth.demo_login(auth.DemoLogin(username=username, password=password), request('POST', origin=origin))
            self.assertEqual(raised.exception.status_code, status)

    def test_demo_and_existing_demo_sessions_are_disabled_on_public_origin(self):
        response = auth.demo_login(auth.DemoLogin(username='moov', password='demo1234'), request('POST', origin=TEST_ENV['APP_BASE_URL']))
        cookies = {auth.SESSION_COOKIE: response_cookie(response, auth.SESSION_COOKIE).value}
        for settings in [{'APP_BASE_URL': 'https://moov.example', 'GOOGLE_REDIRECT_URI': 'https://moov.example/api/auth/google/callback'}, {'ENABLE_DEMO_LOGIN': 'false'}]:
            with patch.dict(os.environ, settings):
                self.assertFalse(body(auth.auth_config())['demoEnabled'])
                self.assertFalse(body(auth.auth_me(request(cookies=cookies)))['authenticated'])
                with self.assertRaises(HTTPException) as raised:
                    auth.demo_login(auth.DemoLogin(username='moov', password='demo1234'), request('POST', origin=TEST_ENV['APP_BASE_URL']))
                self.assertEqual(raised.exception.status_code, 404)


if __name__ == '__main__':
    unittest.main()
