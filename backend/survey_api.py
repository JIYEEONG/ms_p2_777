"""Account-owned onboarding survey. Raw answers and recommendation inputs are separate."""
import json
import hashlib
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

if __package__:
    from .google_auth_api import require_auth_user
else:
    from google_auth_api import require_auth_user

router = APIRouter(prefix='/api/outing/survey', tags=['survey'])
DB_PATH = Path(__file__).with_name('.user-surveys.sqlite3')
SNAPSHOT_DIR = Path(__file__).with_name('account_snapshots')
SCHEMA = json.loads((Path(__file__).resolve().parents[1] / 'front/public/survey-schema.json').read_text(encoding='utf-8'))


class Avoidances(BaseModel):
    model_config = ConfigDict(extra='forbid')
    foodRestrictions: list[str] = Field(default_factory=list, max_length=6)
    foods: list[str] = Field(default_factory=list, max_length=20)
    other: list[str] = Field(default_factory=list, max_length=20)


class Answers(BaseModel):
    model_config = ConfigDict(extra='forbid')
    categories: list[str] = Field(default_factory=list, max_length=6)
    subcategories: dict[str, list[str]] = Field(default_factory=dict)
    preferredRegions: list[str] = Field(default_factory=list, max_length=9)
    avoidedRegions: list[str] = Field(default_factory=list, max_length=9)
    avoidances: Avoidances = Field(default_factory=Avoidances)

    @model_validator(mode='after')
    def validate_answers(self):
        for values, allowed in [(self.categories, SCHEMA['categories']),
                                (self.preferredRegions, SCHEMA['regions']),
                                (self.avoidedRegions, SCHEMA['regions']),
                                (self.avoidances.foodRestrictions, SCHEMA['foodRestrictions'])]:
            if len(values) != len(set(values)) or any(v not in allowed for v in values):
                raise ValueError('Unknown or duplicate survey option')
        if set(self.preferredRegions) & set(self.avoidedRegions):
            raise ValueError('A region cannot be both preferred and avoided')
        for category, values in self.subcategories.items():
            if category not in self.categories or len(values) > 6 or len(values) != len(set(values)):
                raise ValueError('Subcategories must belong to a selected activity')
            if any(v not in SCHEMA['subcategories'][category] for v in values):
                raise ValueError('Unknown subcategory')
        for values in [self.avoidances.foods, self.avoidances.other]:
            if any(not v.strip() or len(v) > 40 or any(ord(c) < 32 for c in v) for v in values):
                raise ValueError('Exclusion tags must contain 1 to 40 printable characters')
        return self


class SurveyInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: Literal['1.8'] = '1.8'
    status: Literal['completed', 'skipped']
    answers: Answers


class LocationConsentInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    agreed: Literal[True]
    version: Literal['1'] = '1'


def account_snapshot(user_id: str):
    account_hash = hashlib.sha256(user_id.encode('utf-8')).hexdigest()
    path = SNAPSHOT_DIR / f'{account_hash}.json'
    if not path.is_file():
        return None
    snapshot = json.loads(path.read_text(encoding='utf-8'))
    if snapshot.get('schemaVersion') != 1 or snapshot.get('accountHash') != account_hash:
        raise ValueError('Invalid account snapshot')
    return snapshot


def derive_profile(answers: Answers):
    # Unselected categories remain unknown, not negative preferences.
    return {
        'categories': {value: 1 for value in answers.categories},
        'subcategories': answers.subcategories,
        'preferredRegions': answers.preferredRegions,
        'excludedRegions': answers.avoidedRegions,
        'excludedTags': list(dict.fromkeys(v.strip() for values in answers.avoidances.model_dump().values() for v in values)),
        'source': 'survey', 'ruleVersion': 'survey-content-v1.8',
    }


@contextmanager
def database():
    conn = sqlite3.connect(str(DB_PATH), timeout=5)
    try:
        conn.row_factory = sqlite3.Row
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS user_survey (
                user_id TEXT PRIMARY KEY, version TEXT NOT NULL, status TEXT NOT NULL,
                answers_json TEXT NOT NULL, updated_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS user_preference (
                user_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL, updated_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS location_consent (
                user_id TEXT PRIMARY KEY, version TEXT NOT NULL, agreed_at TEXT NOT NULL);
        ''')
        with conn:
            yield conn
    finally:
        conn.close()


@router.get('')
def get_survey(response: Response, user: dict = Depends(require_auth_user)):
    response.headers['Cache-Control'] = 'no-store'
    backup = account_snapshot(user['id'])
    with database() as conn:
        row = conn.execute('''SELECT s.*, p.profile_json FROM user_survey s
            JOIN user_preference p USING(user_id) WHERE user_id=?''', (user['id'],)).fetchone()
        consent = conn.execute('SELECT version, agreed_at FROM location_consent WHERE user_id=?', (user['id'],)).fetchone()
    location_consent = {'version': consent['version'], 'agreedAt': consent['agreed_at']} if consent else None
    if row is None:
        survey = None
        if backup and backup.get('survey'):
            saved = SurveyInput.model_validate(backup['survey'])
            survey = {**saved.model_dump(), 'profile': derive_profile(saved.answers), 'updatedAt': backup['exportedAt']}
        return {'survey': survey, 'locationConsent': location_consent, 'accountBackup': backup}
    return {'accountBackup': backup, 'locationConsent': location_consent, 'survey': {'version': row['version'], 'status': row['status'],
                       'answers': json.loads(row['answers_json']), 'profile': json.loads(row['profile_json']),
                       'updatedAt': row['updated_at']}}


@router.put('/location-consent')
def save_location_consent(body: LocationConsentInput, response: Response, user: dict = Depends(require_auth_user)):
    response.headers['Cache-Control'] = 'no-store'
    now = datetime.now(timezone.utc).isoformat()
    with database() as conn:
        conn.execute('INSERT OR IGNORE INTO location_consent VALUES (?, ?, ?)', (user['id'], body.version, now))
        row = conn.execute('SELECT version, agreed_at FROM location_consent WHERE user_id=?', (user['id'],)).fetchone()
    # App agreement only. This record never claims that browser GPS permission was granted.
    return {'locationConsent': {'version': row['version'], 'agreedAt': row['agreed_at']}}


@router.put('')
def save_survey(body: SurveyInput, response: Response, user: dict = Depends(require_auth_user)):
    response.headers['Cache-Control'] = 'no-store'
    updated = datetime.now(timezone.utc).isoformat()
    answers, profile = body.answers.model_dump(), derive_profile(body.answers)
    with database() as conn:
        conn.execute('INSERT OR REPLACE INTO user_survey VALUES (?, ?, ?, ?, ?)',
                     (user['id'], body.version, body.status, json.dumps(answers, ensure_ascii=False), updated))
        conn.execute('INSERT OR REPLACE INTO user_preference VALUES (?, ?, ?)',
                     (user['id'], json.dumps(profile, ensure_ascii=False), updated))
    return {'survey': {'version': body.version, 'status': body.status, 'answers': answers,
                       'profile': profile, 'updatedAt': updated}}
