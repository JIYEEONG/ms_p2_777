"""Account-owned onboarding survey stored in the shared PostgreSQL schema."""
import hashlib
import json
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

if __package__:
    from .db import ensure_online_schema, get_conn, release_conn
    from .google_auth_api import require_auth_user
else:
    from db import ensure_online_schema, get_conn, release_conn
    from google_auth_api import require_auth_user

router = APIRouter(prefix='/api/outing/survey', tags=['survey'])
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
    return {
        'categories': {value: 1 for value in answers.categories},
        'subcategories': answers.subcategories,
        'preferredRegions': answers.preferredRegions,
        'excludedRegions': answers.avoidedRegions,
        'excludedTags': list(dict.fromkeys(v.strip() for values in answers.avoidances.model_dump().values() for v in values)),
        'source': 'survey', 'ruleVersion': 'survey-content-v1.8',
    }


def _decode(value):
    return json.loads(value) if isinstance(value, str) else (value or {})


def _legacy_answers(payload: dict):
    if isinstance(payload.get('answers'), dict):
        return Answers.model_validate(payload['answers'])
    subcategories = payload.get('sub_categories', {})
    if isinstance(subcategories, list):
        subcategories = {}
    return Answers.model_validate({
        'categories': payload.get('categories', []),
        'subcategories': subcategories,
        'preferredRegions': payload.get('preferred_regions', []),
        'avoidedRegions': payload.get('excluded_regions', []),
        'avoidances': {'other': payload.get('excluded_tags', [])},
    })


def _preference_rows(profile: dict):
    rows = []
    rows += [('CATEGORY', tag) for tag in profile['categories']]
    rows += [('SUB_CATEGORY', tag) for tags in profile['subcategories'].values() for tag in tags]
    rows += [('REGION', tag) for tag in profile['preferredRegions']]
    rows += [('EXCLUDED_REGION', tag) for tag in profile['excludedRegions']]
    rows += [('EXCLUDED_TAG', tag) for tag in profile['excludedTags']]
    return list(dict.fromkeys(rows))


def _load_account(user_id: str):
    ensure_online_schema()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute('''SELECT survey_version, response_json, updated_at
                FROM moov.user_survey WHERE user_id=%s ORDER BY updated_at DESC LIMIT 1''', (user_id,))
            survey = cur.fetchone()
            cur.execute('SELECT version, agreed_at FROM moov.location_consent WHERE user_id=%s', (user_id,))
            consent = cur.fetchone()
    finally:
        release_conn(conn)
    return survey, consent


def _store_consent(user_id: str, version: str):
    ensure_online_schema()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute('''INSERT INTO moov.location_consent (user_id, version)
                VALUES (%s, %s) ON CONFLICT (user_id) DO NOTHING''', (user_id, version))
            cur.execute('SELECT version, agreed_at FROM moov.location_consent WHERE user_id=%s', (user_id,))
            row = cur.fetchone()
        conn.commit()
        return row
    except Exception:
        conn.rollback()
        raise
    finally:
        release_conn(conn)


def _store_survey(user_id: str, body: SurveyInput):
    ensure_online_schema()
    answers = body.answers.model_dump()
    profile = derive_profile(body.answers)
    payload = {
        'status': body.status,
        'categories': answers['categories'],
        'sub_categories': answers['subcategories'],
        'preferred_regions': answers['preferredRegions'],
        'excluded_regions': answers['avoidedRegions'],
        'excluded_tags': profile['excludedTags'],
        'answers': answers,
    }
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute('''INSERT INTO moov.user_survey
                (survey_id, user_id, survey_version, response_json, submitted_at, updated_at)
                VALUES (%s, %s, %s, %s::jsonb, now(), now())
                ON CONFLICT (survey_id) DO UPDATE SET
                    survey_version=EXCLUDED.survey_version,
                    response_json=EXCLUDED.response_json,
                    updated_at=now()
                RETURNING updated_at''',
                (f'survey:{user_id}', user_id, body.version, json.dumps(payload, ensure_ascii=False)))
            updated = cur.fetchone()[0]
            cur.execute("DELETE FROM moov.user_preference WHERE user_id=%s AND upper(coalesce(source,''))='SURVEY'", (user_id,))
            for tag_type, tag_name in _preference_rows(profile):
                cur.execute('''INSERT INTO moov.user_preference
                    (user_id, tag_type, tag_name, score, source, score_source, updated_at)
                    VALUES (%s, %s, %s, 1.0, 'SURVEY', 'SURVEY', now())
                    ON CONFLICT (user_id, tag_type, tag_name) DO UPDATE SET
                        score=EXCLUDED.score, source='SURVEY', score_source='SURVEY', updated_at=now()''',
                    (user_id, tag_type, tag_name))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_conn(conn)
    return answers, profile, updated


@router.get('')
def get_survey(response: Response, user: dict = Depends(require_auth_user)):
    response.headers['Cache-Control'] = 'no-store'
    backup = account_snapshot(user['id'])
    row, consent = _load_account(user['id'])
    location = {'version': consent[0], 'agreedAt': consent[1].isoformat()} if consent else None
    if not row:
        survey = None
        if backup and backup.get('survey'):
            saved = SurveyInput.model_validate(backup['survey'])
            survey = {**saved.model_dump(), 'profile': derive_profile(saved.answers), 'updatedAt': backup['exportedAt']}
        return {'survey': survey, 'locationConsent': location, 'accountBackup': backup}
    payload = _decode(row[1])
    answers = _legacy_answers(payload)
    return {'accountBackup': backup, 'locationConsent': location, 'survey': {
        'version': row[0], 'status': payload.get('status', 'completed'),
        'answers': answers.model_dump(), 'profile': derive_profile(answers),
        'updatedAt': row[2].isoformat(),
    }}


@router.put('/location-consent')
def save_location_consent(body: LocationConsentInput, response: Response, user: dict = Depends(require_auth_user)):
    response.headers['Cache-Control'] = 'no-store'
    row = _store_consent(user['id'], body.version)
    return {'locationConsent': {'version': row[0], 'agreedAt': row[1].isoformat()}}


@router.put('')
def save_survey(body: SurveyInput, response: Response, user: dict = Depends(require_auth_user)):
    response.headers['Cache-Control'] = 'no-store'
    answers, profile, updated = _store_survey(user['id'], body)
    return {'survey': {'version': body.version, 'status': body.status, 'answers': answers,
                       'profile': profile, 'updatedAt': updated.isoformat()}}
