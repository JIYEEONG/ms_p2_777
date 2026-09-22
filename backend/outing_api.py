"""Outing event log — writes to moov.app_events (shared Azure Postgres).

Likes/unlikes and recommendation exposures are both just "events" tied to a
course, so they share one table instead of separate local-only ones.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

if __package__:
    from .db import get_conn, release_conn
    from .google_auth_api import require_auth_user
else:
    from db import get_conn, release_conn
    from google_auth_api import require_auth_user

router = APIRouter(prefix="/api/outing", tags=["outing"])

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


class OutingEvent(BaseModel):
    event_id: str = Field(min_length=1, max_length=120)
    user_id: str = Field(min_length=1, max_length=64)
    session_id: str = Field(min_length=1, max_length=120)
    request_id: str | None = None
    event_type: str = Field(min_length=1, max_length=80)
    target_type: str = Field(min_length=1, max_length=80)
    target_id: str = Field(min_length=1, max_length=120)
    occurred_at: datetime
    rule_version: str = Field(min_length=1, max_length=80)
    test_mode: str = "free"
    details: dict[str, Any] = Field(default_factory=dict)


@router.post("/events")
def record_event(event: OutingEvent, user: dict = Depends(require_auth_user)):
    if event.user_id != user['id']:
        raise HTTPException(403, 'The event must belong to the signed-in account.')
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO moov.app_events
                    (event_id, user_id, event_type, occurred_at, aggregate_type, aggregate_id, idempotency_key, attributes_json, is_synthetic)
                SELECT %s, %s, %s, %s, %s, %s, %s, %s, false
                WHERE NOT EXISTS (SELECT 1 FROM moov.app_events WHERE idempotency_key = %s)
            """, (
                event.event_id, user['id'], event.event_type, event.occurred_at,
                event.target_type, event.target_id, event.event_id,
                json.dumps({
                    "session_id": event.session_id,
                    "request_id": event.request_id,
                    "rule_version": event.rule_version,
                    "test_mode": event.test_mode,
                    **event.details,
                }, ensure_ascii=False),
                event.event_id,
            ))
        conn.commit()
    finally:
        release_conn(conn)
    return {"ok": True, "event_id": event.event_id}


@router.get("/popularity")
def outing_popularity():
    """Count courses whose latest like/unlike action in the last 7 days is 'like'."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT ON (user_id, aggregate_id) aggregate_id, event_type
                FROM moov.app_events
                WHERE aggregate_type = 'course'
                  AND event_type IN ('course_like', 'course_unlike')
                  AND occurred_at >= now() - interval '7 days'
                ORDER BY user_id, aggregate_id, occurred_at DESC
            """)
            rows = cur.fetchall()
    finally:
        release_conn(conn)
    counts: dict[str, int] = {}
    for aggregate_id, event_type in rows:
        if event_type == "course_like":
            counts[aggregate_id] = counts.get(aggregate_id, 0) + 1
    return {"counts": counts, "window_days": 7, "aggregated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/health")
def outing_health():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
    finally:
        release_conn(conn)
    return {"ok": True, "storage": "moov-postgres"}


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(require_auth_user)):
    from azure.storage.blob import BlobServiceClient
    import os
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    container_name = os.getenv("AZURE_STORAGE_CONTAINER", "course-images")
    client = BlobServiceClient.from_connection_string(conn_str)
    container = client.get_container_client(container_name)
    ext = Path(file.filename or "").suffix or ".jpg"
    blob_name = f"{uuid4().hex}{ext}"
    container.upload_blob(name=blob_name, data=await file.read(), overwrite=True)
    return {"url": f"{container.url}/{blob_name}"}


class CourseStopInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class CourseRegisterInput(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    image_url: str | None = None
    stops: list[CourseStopInput] = Field(min_length=1)


@router.post("/courses")
def register_course(payload: CourseRegisterInput, user: dict = Depends(require_auth_user)):
    if payload.user_id != user['id']:
        raise HTTPException(403, 'The course must belong to the signed-in account.')
    course_id = f"user-{uuid4().hex}"
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO moov.courses (course_id, user_id, title, image_url, visibility, is_synthetic, created_at)
                VALUES (%s, %s, %s, %s, 'public', false, now())
            """, (course_id, user['id'], payload.title, payload.image_url))
            for i, stop in enumerate(payload.stops):
                cur.execute("""
                    INSERT INTO moov.course_points (course_id, sequence_no, place_name_kr, point_type, is_synthetic)
                    VALUES (%s, %s, %s, %s, false)
                """, (course_id, i, stop.name, "목적지" if i == len(payload.stops) - 1 else "경유지"))
        conn.commit()
    finally:
        release_conn(conn)
    return {"ok": True, "course_id": course_id}


def _load_courses(conn):
    with conn.cursor() as cur:
        cur.execute("""
                SELECT
                    c.course_id,
                    c.title,
                    c.image_url,
                    c.created_at,
                    c.duration_seconds,
                    c.distance_m,
                    cp.sequence_no,
                    cp.latitude,
                    cp.longitude,
                    COALESCE(NULLIF(cp.place_name_kr, ''), nearest.place_name_kr),
                    nearest.open_time,
                    nearest.close_time,
                    nearest.category,
                    nearest.sub_category,
                    nearest.address_kr,
                    pt.tag_type,
                    pt.tag_name
                FROM moov.courses c
                JOIN moov.course_points cp ON cp.course_id = c.course_id
                LEFT JOIN LATERAL (
                    SELECT p.place_id, p.place_name_kr, p.open_time, p.close_time,
                        p.category, p.sub_category, p.address_kr,
                        6371 * acos(
                            cos(radians(cp.latitude)) * cos(radians(p.latitude)) *
                            cos(radians(p.longitude) - radians(cp.longitude)) +
                            sin(radians(cp.latitude)) * sin(radians(p.latitude))
                        ) AS distance_km
                    FROM moov.places p
                    ORDER BY distance_km ASC
                    LIMIT 1
                ) nearest ON nearest.distance_km < 0.5
                LEFT JOIN moov.place_tags pt ON pt.place_id = nearest.place_id
                ORDER BY c.course_id, cp.sequence_no
            """)
        rows = cur.fetchall()

    courses = {}
    tag_keys = {
        'CATEGORY': 'category', 'SUB_CATEGORY': 'subcategory', 'REGION': 'region',
        'PURPOSE': 'purpose', 'PURPOSE1': 'purpose', 'MOOD': 'mood', 'COMPANION': 'companion',
    }
    for (course_id, title, image_url, created_at, duration, distance, seq, lat, lng,
         place_name, open_time, close_time, category, sub_category, address, tag_type, tag_name) in rows:
        course = courses.setdefault(course_id, {
            "id": course_id,
            "title": title,
            "image_url": image_url,
            "created_at": created_at.isoformat() if created_at else None,
            "duration_seconds": duration,
            "distance_m": distance,
            "points": {},
            "tags": {key: set() for key in ('category', 'subcategory', 'region', 'purpose', 'mood', 'companion')},
        })
        point = course["points"].setdefault(seq, {
            "sequence_no": seq, "latitude": lat, "longitude": lng,
            "place_name": place_name, "open_time": open_time, "close_time": close_time,
            "address": address,
        })
        if category:
            course['tags']['category'].add(category)
        if sub_category:
            course['tags']['subcategory'].add(sub_category)
        if tag_type and tag_name:
            key = tag_keys.get(str(tag_type).upper())
            if key:
                course["tags"][key].add(tag_name)

    result = []
    for course in courses.values():
        result.append({
            **course,
            "points": sorted(course["points"].values(), key=lambda p: p["sequence_no"]),
            "tags": {k: sorted(v) for k, v in course["tags"].items()},
        })
    return result


@router.get("/courses")
def get_courses():
    conn = get_conn()
    try:
        return {"courses": _load_courses(conn)}
    finally:
        release_conn(conn)


def _time_score(points, slot):
    ranges = {'아침': (360, 600), '점심': (600, 840), '오후': (840, 1080),
              '저녁': (1080, 1320), '야간': (1320, 1440)}
    if slot not in ranges:
        return 0
    start, end = ranges[slot]
    checkable, open_count = 0, 0
    for point in points:
        try:
            opened = [int(value) for value in str(point.get('open_time')).split(':')[:2]]
            closed = [int(value) for value in str(point.get('close_time')).split(':')[:2]]
            opened, closed = opened[0] * 60 + opened[1], closed[0] * 60 + closed[1]
        except (TypeError, ValueError, IndexError):
            continue
        checkable += 1
        open_count += opened <= end and closed >= start
    return open_count / checkable if checkable else 0


def _rank_courses(courses, preferences, filters, popularity):
    selected = {
        'category': set(preferences.get('CATEGORY', [])),
        'subcategory': set(preferences.get('SUB_CATEGORY', [])),
        'region': set(preferences.get('REGION', [])),
    }
    excluded_regions = set(preferences.get('EXCLUDED_REGION', []))
    excluded_tags = set(preferences.get('EXCLUDED_TAG', []))
    ranked = []
    for course in courses:
        tags = {key: set(values) for key, values in course['tags'].items()}
        all_tags = set().union(*tags.values()) if tags else set()
        text = ' '.join([course.get('title') or '', *[p.get('address') or '' for p in course['points']]])
        if excluded_tags & all_tags or any(region in text or region in tags['region'] for region in excluded_regions):
            continue
        if any(value and value != '전체' and value not in tags.get(key, set())
               for key, value in filters.items() if key in ('category', 'mood', 'companion')):
            continue
        category_score = len(selected['category'] & tags['category']) / max(1, len(selected['category']))
        subcategory_score = len(selected['subcategory'] & tags['subcategory']) / max(1, len(selected['subcategory']))
        region_score = sum(region in text or region in tags['region'] for region in selected['region'])
        time_score = _time_score(course['points'], filters.get('time'))
        matched = sorted((selected['category'] & tags['category']) |
                         (selected['subcategory'] & tags['subcategory']) |
                         (selected['region'] & tags['region']))
        ranked.append({
            'course': course,
            'sort': (category_score, subcategory_score, region_score, time_score,
                     popularity.get(course['id'], 0), course.get('created_at') or '', course['id']),
            'score': round(category_score * 45 + subcategory_score * 25 +
                           min(region_score, 1) * 20 + time_score * 10, 2),
            'matched_tags': matched,
        })
    return sorted(ranked, key=lambda item: item['sort'], reverse=True)


@router.get('/recommendations')
def recommend_courses(
    category: str | None = None,
    mood: str | None = None,
    companion: str | None = None,
    time: str | None = None,
    limit: int = Query(3, ge=1, le=20),
    user: dict = Depends(require_auth_user),
):
    conn = get_conn()
    try:
        courses = _load_courses(conn)
        with conn.cursor() as cur:
            cur.execute('''SELECT tag_type, tag_name FROM moov.user_preference
                WHERE user_id=%s AND upper(coalesce(source,''))='SURVEY' ''', (user['id'],))
            preferences = {}
            for tag_type, tag_name in cur.fetchall():
                preferences.setdefault(str(tag_type).upper(), []).append(tag_name)
            cur.execute('''SELECT aggregate_id, count(*) FROM moov.app_events
                WHERE aggregate_type='course' AND event_type='course_like'
                  AND occurred_at >= now() - interval '7 days'
                GROUP BY aggregate_id''')
            popularity = dict(cur.fetchall())
    finally:
        release_conn(conn)
    ranked = _rank_courses(courses, preferences, {
        'category': category, 'mood': mood, 'companion': companion, 'time': time,
    }, popularity)[:limit]
    request_id = uuid4().hex
    return {
        'request_id': request_id,
        'rule_version': 'survey-content-v1.8-server',
        'items': [{
            'course_id': item['course']['id'],
            'score': item['score'],
            'matched_tags': item['matched_tags'],
        } for item in ranked],
    }
