"""Google server-side OAuth login with one-use browser-bound state and sessions.

Only the public user profile reaches the browser. Google tokens are neither
stored nor returned; the session cookie contains a random opaque token.
"""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass
from urllib.parse import urlencode, urlsplit

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse


router = APIRouter(prefix='/api/auth', tags=['authentication'])
DB_PATH = Path(__file__).with_name('.auth-sessions.sqlite3')
SESSION_COOKIE = 'moov_session'
FLOW_COOKIE = 'moov_google_flow'
FLOW_TTL = 10 * 60
SESSION_TTL = 7 * 24 * 60 * 60
DEFAULT_APP_BASE = 'http://localhost:3000'
CALLBACK_PATH = '/api/auth/google/callback'
GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
PRIVATE_HEADERS = {'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Referrer-Policy': 'no-referrer'}


class LoginFailed(Exception):
    """Expected authentication failure; its details never reach the client."""


@dataclass(frozen=True)
class AuthConfig:
    client_id: str
    client_secret: str
    redirect_uri: str
    app_base: str
    session_secret: str

    @property
    def secure(self):
        return self.app_base.startswith('https://')


def _origin(value):
    """Accept a literal HTTP(S) origin, without credentials or redirect data."""
    if not isinstance(value, str) or not value or any(ord(char) < 33 for char in value) or '\\' in value:
        raise ValueError('Invalid application origin')
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username is not None or parsed.password is not None:
        raise ValueError('Invalid application origin')
    if parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('Application URL must be an origin')
    host = parsed.hostname.lower()
    if parsed.scheme == 'http' and host not in ('localhost', '127.0.0.1', '::1'):
        raise ValueError('Public application origins require HTTPS')
    port = parsed.port
    host = '[' + host + ']' if ':' in host else host
    port_part = '' if port is None or port == (443 if parsed.scheme == 'https' else 80) else ':' + str(port)
    return parsed.scheme + '://' + host + port_part


def _app_base():
    return _origin(os.getenv('APP_BASE_URL', DEFAULT_APP_BASE).strip())


def _config():
    try:
        base = _app_base()
        client_id = os.getenv('GOOGLE_CLIENT_ID', '').strip()
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET', '').strip()
        session_secret = os.getenv('AUTH_SESSION_SECRET', '').strip()
        redirect = os.getenv('GOOGLE_REDIRECT_URI', base + CALLBACK_PATH).strip()
        parsed = urlsplit(redirect)
        redirect_origin = _origin(parsed.scheme + '://' + parsed.netloc)
        if redirect_origin != base or parsed.path != CALLBACK_PATH or parsed.query or parsed.fragment or '\\' in redirect:
            return None
        if not client_id or not client_secret or len(session_secret) < 32:
            return None
        return AuthConfig(client_id, client_secret, redirect, base, session_secret)
    except (TypeError, ValueError):
        return None


@contextmanager
def _database():
    connection = sqlite3.connect(str(DB_PATH), timeout=5)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute('''CREATE TABLE IF NOT EXISTS oauth_flows (
            state_hash TEXT PRIMARY KEY, binding_hash TEXT NOT NULL,
            nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires_at REAL NOT NULL
        )''')
        connection.execute('''CREATE TABLE IF NOT EXISTS auth_sessions (
            token_hash TEXT PRIMARY KEY, profile TEXT NOT NULL,
            created_at REAL NOT NULL, expires_at REAL NOT NULL
        )''')
        connection.commit()
        with connection:
            yield connection
    finally:
        connection.close()


def _digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _base64(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode('ascii')


def _sign_binding(binding, issued_at, config):
    payload = binding + '.' + str(issued_at)
    signature = hmac.new(config.session_secret.encode(), payload.encode(), hashlib.sha256).digest()
    return payload + '.' + _base64(signature)


def _read_binding(cookie, config):
    if not isinstance(cookie, str) or len(cookie) > 256:
        raise LoginFailed()
    try:
        binding, issued_text, signature = cookie.split('.')
        issued = int(issued_text)
        if not re.fullmatch(r'[A-Za-z0-9_-]{43}', binding):
            raise ValueError()
        expected = _sign_binding(binding, issued, config).rsplit('.', 1)[1]
        if not hmac.compare_digest(signature, expected) or not 0 <= time.time() - issued <= FLOW_TTL:
            raise ValueError()
        return binding
    except (ValueError, TypeError):
        raise LoginFailed() from None


def _set_cookie(response, name, value, max_age, secure):
    response.set_cookie(name, value, max_age=max_age, httponly=True, secure=secure, samesite='lax', path='/')


def _clear_cookie(response, name, secure):
    response.delete_cookie(name, httponly=True, secure=secure, samesite='lax', path='/')


def _failure_redirect(config=None, reason='failed'):
    try:
        base = config.app_base if config else _app_base()
    except (TypeError, ValueError):
        base = DEFAULT_APP_BASE
    response = RedirectResponse(base + '/?auth_error=' + ('cancelled' if reason == 'cancelled' else 'failed'), status_code=303, headers=PRIVATE_HEADERS)
    _clear_cookie(response, FLOW_COOKIE, base.startswith('https://'))
    return response


def _consume_flow(state, binding):
    if not isinstance(state, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', state):
        raise LoginFailed()
    with _database() as database:
        # The write lock makes two concurrent callbacks unable to consume one
        # state twice, including callbacks handled by different server workers.
        database.execute('BEGIN IMMEDIATE')
        row = database.execute('SELECT nonce, verifier FROM oauth_flows WHERE state_hash=? AND binding_hash=? AND expires_at>?', (_digest(state), _digest(binding), time.time())).fetchone()
        if row is None:
            raise LoginFailed()
        database.execute('DELETE FROM oauth_flows WHERE state_hash=?', (_digest(state),))
        return dict(row)


def _exchange_code(code, config, verifier):
    # Lazy imports keep unrelated map endpoints usable before setup/install.
    import requests
    response = requests.post(GOOGLE_TOKEN, data={
        'code': code, 'client_id': config.client_id, 'client_secret': config.client_secret,
        'redirect_uri': config.redirect_uri, 'grant_type': 'authorization_code',
        'code_verifier': verifier,
    }, timeout=(3.05, 8), allow_redirects=False)
    if response.status_code != 200:
        raise LoginFailed()
    data = response.json()
    token = data.get('id_token') if isinstance(data, dict) else None
    if not isinstance(token, str) or not token or len(token) > 16384:
        raise LoginFailed()
    return token


def _verify_google_token(token, client_id):
    import requests
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import id_token

    with requests.Session() as session:
        transport = GoogleRequest(session=session)

        def bounded_request(*args, **kwargs):
            kwargs['timeout'] = (3.05, 8)
            return transport(*args, **kwargs)

        # This official verifier checks signature, exp/iat, aud and Google iss.
        return id_token.verify_oauth2_token(token, bounded_request, audience=client_id)


def _user_from_claims(claims, config, nonce):
    if not isinstance(claims, dict):
        raise LoginFailed()
    # Defense in depth at the app boundary; nonce is not checked by google-auth.
    if claims.get('aud') != config.client_id or claims.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
        raise LoginFailed()
    claimed_nonce = claims.get('nonce')
    if not isinstance(claimed_nonce, str) or not hmac.compare_digest(claimed_nonce, nonce):
        raise LoginFailed()
    expires = claims.get('exp')
    if isinstance(expires, bool) or not isinstance(expires, (int, float)) or not time.time() < expires < float('inf'):
        raise LoginFailed()
    subject = claims.get('sub')
    email = claims.get('email')
    # Keep the stable "google:" identity within existing 64-character user IDs.
    if not isinstance(subject, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,57}', subject):
        raise LoginFailed()
    if not isinstance(email, str) or not email or len(email) > 320 or claims.get('email_verified') is not True:
        raise LoginFailed()
    name = claims.get('name')
    name = name.strip()[:200] if isinstance(name, str) and name.strip() else email.split('@')[0]
    picture = claims.get('picture', '')
    try:
        parsed_picture = urlsplit(picture) if isinstance(picture, str) and len(picture) <= 2048 else None
        if not parsed_picture or parsed_picture.scheme != 'https' or not parsed_picture.hostname or parsed_picture.username is not None or parsed_picture.password is not None:
            picture = ''
    except ValueError:
        picture = ''
    return {'id': 'google:' + subject, 'name': name, 'email': email, 'picture': picture}


def _new_session(user, old_token=None):
    token = secrets.token_urlsafe(32)
    now = time.time()
    with _database() as database:
        database.execute('DELETE FROM auth_sessions WHERE expires_at<=?', (now,))
        if isinstance(old_token, str) and len(old_token) <= 256:
            database.execute('DELETE FROM auth_sessions WHERE token_hash=?', (_digest(old_token),))
        database.execute('INSERT INTO auth_sessions(token_hash,profile,created_at,expires_at) VALUES(?,?,?,?)', (_digest(token), json.dumps(user, ensure_ascii=False), now, now + SESSION_TTL))
    return token


@router.get('/config')
def auth_config():
    return JSONResponse({'configured': _config() is not None, 'loginUrl': '/api/auth/google/start'}, headers=PRIVATE_HEADERS)


@router.get('/google/start')
def google_start(request: Request):
    config = _config()
    if config is None:
        raise HTTPException(503, 'Google login is not configured.', headers=PRIVATE_HEADERS)
    state, binding, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(4))
    now = time.time()
    try:
        with _database() as database:
            database.execute('DELETE FROM oauth_flows WHERE expires_at<=?', (now,))
            database.execute('INSERT INTO oauth_flows(state_hash,binding_hash,nonce,verifier,expires_at) VALUES(?,?,?,?,?)', (_digest(state), _digest(binding), nonce, verifier, now + FLOW_TTL))
    except sqlite3.Error:
        raise HTTPException(503, 'Google login is temporarily unavailable.', headers=PRIVATE_HEADERS) from None
    response = RedirectResponse(GOOGLE_AUTHORIZE + '?' + urlencode({
        'client_id': config.client_id, 'redirect_uri': config.redirect_uri,
        'response_type': 'code', 'scope': 'openid email profile',
        'state': state, 'nonce': nonce, 'code_challenge': _base64(hashlib.sha256(verifier.encode('ascii')).digest()),
        'code_challenge_method': 'S256', 'prompt': 'select_account',
    }), status_code=303, headers=PRIVATE_HEADERS)
    _set_cookie(response, FLOW_COOKIE, _sign_binding(binding, int(now), config), FLOW_TTL, config.secure)
    return response


@router.get('/google/callback')
def google_callback(request: Request):
    config = _config()
    if config is None:
        return _failure_redirect()
    try:
        binding = _read_binding(request.cookies.get(FLOW_COOKIE), config)
        flow = _consume_flow(request.query_params.get('state'), binding)
        if request.query_params.get('error'):
            return _failure_redirect(config, 'cancelled' if request.query_params.get('error') == 'access_denied' else 'failed')
        code = request.query_params.get('code')
        if not isinstance(code, str) or not code or len(code) > 4096:
            raise LoginFailed()
        token = _exchange_code(code, config, flow['verifier'])
        user = _user_from_claims(_verify_google_token(token, config.client_id), config, flow['nonce'])
        session = _new_session(user, request.cookies.get(SESSION_COOKIE))
    except Exception:
        # Never reflect codes, tokens, credentials, upstream errors or traces.
        return _failure_redirect(config)
    response = RedirectResponse(config.app_base + '/', status_code=303, headers=PRIVATE_HEADERS)
    _clear_cookie(response, FLOW_COOKIE, config.secure)
    _set_cookie(response, SESSION_COOKIE, session, SESSION_TTL, config.secure)
    return response


def _session_user(request):
    user = None
    token = request.cookies.get(SESSION_COOKIE)
    config = _config()
    if config and isinstance(token, str) and re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
        try:
            with _database() as database:
                row = database.execute('SELECT profile FROM auth_sessions WHERE token_hash=? AND expires_at>?', (_digest(token), time.time())).fetchone()
                if row:
                    user = json.loads(row['profile'])
        except (sqlite3.Error, ValueError):
            user = None
    if not isinstance(user, dict) or not isinstance(user.get('id'), str) or not user['id'].startswith('google:'):
        return None
    return user


def _require_same_origin(request):
    try:
        base = _app_base()
        origin = request.headers.get('origin')
        if not origin or _origin(origin) != base:
            raise ValueError()
    except (TypeError, ValueError):
        raise HTTPException(403, 'The request origin is not allowed.', headers=PRIVATE_HEADERS) from None
    return base


def require_auth_user(request: Request) -> dict:
    """Server-trusted identity for other routers; never accept body user IDs."""
    user = _session_user(request)
    if user is None:
        raise HTTPException(401, 'Sign in with Google to continue.', headers=PRIVATE_HEADERS)
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        _require_same_origin(request)
    return user


@router.get('/me')
def auth_me(request: Request):
    user = _session_user(request)
    response = JSONResponse({'authenticated': user is not None, 'user': user}, headers=PRIVATE_HEADERS)
    if request.cookies.get(SESSION_COOKIE) and user is None:
        config = _config()
        _clear_cookie(response, SESSION_COOKIE, bool(config and config.secure))
    return response


@router.post('/logout')
def auth_logout(request: Request):
    base = _require_same_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    try:
        if isinstance(token, str) and len(token) <= 256:
            with _database() as database:
                database.execute('DELETE FROM auth_sessions WHERE token_hash=?', (_digest(token),))
    except sqlite3.Error:
        raise HTTPException(503, 'Logout is temporarily unavailable.', headers=PRIVATE_HEADERS) from None
    response = JSONResponse({'authenticated': False, 'user': None}, headers=PRIVATE_HEADERS)
    _clear_cookie(response, SESSION_COOKIE, base.startswith('https://'))
    _clear_cookie(response, FLOW_COOKIE, base.startswith('https://'))
    return response
