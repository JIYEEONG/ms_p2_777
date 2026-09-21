"""Add missing Google login settings without printing existing secrets."""
from pathlib import Path
import secrets

from dotenv import dotenv_values, set_key


def main():
    env_path = Path(__file__).resolve().parents[1] / 'backend' / '.env'
    env_path.touch(exist_ok=True)
    existing = dotenv_values(env_path)
    base = (existing.get('APP_BASE_URL') or 'http://localhost:3000').rstrip('/')
    defaults = {
        'GOOGLE_CLIENT_ID': '',
        'GOOGLE_CLIENT_SECRET': '',
        'GOOGLE_REDIRECT_URI': base + '/api/auth/google/callback',
        'APP_BASE_URL': base,
    }
    missing = {key: value for key, value in defaults.items() if key not in existing}
    if missing:
        with env_path.open('a', encoding='utf-8') as env:
            env.write('\n\n# Google login: application Client ID / Client Secret, not account password.\n')
            for key, value in missing.items():
                env.write(f'{key}={value}\n')
    if not existing.get('AUTH_SESSION_SECRET'):
        set_key(str(env_path), 'AUTH_SESSION_SECRET', secrets.token_urlsafe(48), quote_mode='never')
    print('Google login environment template is ready. Existing credentials were preserved.')
    for key in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'):
        print(f'{key}: ' + ('already configured' if existing.get(key) else 'needs your Google Cloud value'))


if __name__ == '__main__':
    main()
