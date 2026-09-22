"""Authenticated encryption of server-side login records, never browser-side keys."""
import base64
import json
import os


PREFIX = 'encrypted:v1:'
DEMO_PROFILE = 'demo:v1'


class StorageEncryptionError(Exception):
    """Do not expose key material or rejected plaintext in an API error."""


def _cipher():
    try:
        from cryptography.fernet import Fernet
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF

        key = os.getenv('AUTH_DATA_ENCRYPTION_KEY', '').strip()
        if key:
            return Fernet(key.encode('ascii'))
        secret = os.getenv('AUTH_SESSION_SECRET', '').strip()
        if len(secret) < 32:
            raise ValueError('Missing server secret')
        # Domain separation: this encryption key differs from the OAuth cookie
        # signing key. AUTH_SESSION_SECRET is a random server key, not a password.
        material = HKDF(algorithm=hashes.SHA256(), length=32, salt=None,
                        info=b'moov/auth-record-encryption/v1').derive(secret.encode('utf-8'))
        return Fernet(base64.urlsafe_b64encode(material))
    except (ImportError, ValueError, TypeError, UnicodeError):
        raise StorageEncryptionError('Login storage encryption is unavailable.') from None


def check_configuration():
    _cipher()


def seal(value, purpose, binding):
    payload = json.dumps({'purpose': purpose, 'binding': binding, 'value': value},
                         ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    return PREFIX + _cipher().encrypt(payload).decode('ascii')


def unseal(value, purpose, binding):
    if not isinstance(value, str) or not value.startswith(PREFIX):
        raise StorageEncryptionError('Unencrypted login record rejected.')
    cipher = _cipher()
    try:
        from cryptography.fernet import InvalidToken
        payload = json.loads(cipher.decrypt(value[len(PREFIX):].encode('ascii')))
        # Prevent moving an otherwise valid ciphertext to another session/field.
        if not isinstance(payload, dict) or payload.get('purpose') != purpose or payload.get('binding') != binding:
            raise ValueError('Incorrect record context')
        return payload['value']
    except (InvalidToken, ValueError, TypeError, KeyError, UnicodeError):
        raise StorageEncryptionError('Invalid encrypted login record.') from None


def migrate(database):
    """One-time, transactional upgrade. Later plaintext injections are rejected."""
    database.execute('CREATE TABLE IF NOT EXISTS auth_storage_meta (version INTEGER PRIMARY KEY)')
    database.commit()
    if database.execute('SELECT 1 FROM auth_storage_meta WHERE version=1').fetchone():
        return
    changed = False
    with database:
        database.execute('BEGIN IMMEDIATE')
        if database.execute('SELECT 1 FROM auth_storage_meta WHERE version=1').fetchone():
            return
        for row in database.execute('SELECT token_hash,profile FROM auth_sessions').fetchall():
            if row['profile'] == DEMO_PROFILE or row['profile'].startswith(PREFIX):
                continue
            try:
                profile = json.loads(row['profile'])
                if not isinstance(profile, dict) or not isinstance(profile.get('id'), str):
                    raise ValueError('Invalid legacy profile')
            except (ValueError, TypeError):
                # A corrupt legacy record cannot establish an authenticated user.
                database.execute('DELETE FROM auth_sessions WHERE token_hash=?', (row['token_hash'],))
                changed = True
                continue
            # The fixed local demo has no personal profile to store or encrypt.
            encoded = DEMO_PROFILE if profile.get('id') == 'demo:moov' else seal(profile, 'session-profile', row['token_hash'])
            database.execute('UPDATE auth_sessions SET profile=? WHERE token_hash=?', (encoded, row['token_hash']))
            changed = True
        for row in database.execute('SELECT state_hash,nonce,verifier FROM oauth_flows').fetchall():
            for field in ('nonce', 'verifier'):
                if row[field].startswith(PREFIX):
                    continue
                encoded = seal(row[field], 'oauth-' + field, row['state_hash'])
                database.execute(f'UPDATE oauth_flows SET {field}=? WHERE state_hash=?', (encoded, row['state_hash']))
                changed = True
        database.execute('INSERT INTO auth_storage_meta(version) VALUES(1)')
    if changed:
        # Clear old SQLite free-page content as well as the logical field values.
        database.execute('VACUUM')
        database.execute('PRAGMA wal_checkpoint(TRUNCATE)')
