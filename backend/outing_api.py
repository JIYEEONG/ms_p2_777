"""Small, idempotent outing test log API.

Set MOOV_OUTING_DATABASE_URL to a team PostgreSQL database for shared tests.
Without it, records stay in a local SQLite file on this machine only.
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from datetime import timedelta
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/outing", tags=["outing"])


class RecommendationResult(BaseModel):
    course_id: str = Field(min_length=1, max_length=120)
    rank: int = Field(ge=1)
    score: float


class RecommendationRecord(BaseModel):
    request_id: str = Field(min_length=1, max_length=120)
    previous_request_id: str | None = None
    user_id: str = Field(min_length=1, max_length=64)
    session_id: str = Field(min_length=1, max_length=120)
    occurred_at: datetime
    rule_version: str = Field(min_length=1, max_length=80)
    test_mode: str = "free"
    conditions: dict[str, Any]
    results: list[RecommendationResult]


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


def _postgres_url() -> str | None:
    return os.getenv("MOOV_OUTING_DATABASE_URL") or None


@contextmanager
def _connection():
    if database_url := _postgres_url():
        import psycopg2

        connection = psycopg2.connect(database_url, connect_timeout=5)
        postgres = True
    else:
        path = Path(os.getenv("MOOV_OUTING_DB_PATH", Path(__file__).with_name(".outing-events.sqlite3")))
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=10)
        postgres = False
    try:
        yield connection, postgres
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _execute(connection, postgres: bool, sql: str, values: tuple = ()) -> int:
    cursor = connection.cursor()
    try:
        cursor.execute(sql.replace("?", "%s") if postgres else sql, values)
        return cursor.rowcount
    finally:
        cursor.close()


def _ensure_tables(connection, postgres: bool) -> None:
    _execute(connection, postgres, """
        CREATE TABLE IF NOT EXISTS outing_recommendations (
            request_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            previous_request_id TEXT,
            occurred_at TEXT NOT NULL,
            received_at TEXT NOT NULL,
            rule_version TEXT NOT NULL,
            test_mode TEXT NOT NULL,
            conditions_json TEXT NOT NULL,
            results_json TEXT NOT NULL
        )
    """)
    _execute(connection, postgres, """
        CREATE TABLE IF NOT EXISTS outing_events (
            event_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            request_id TEXT,
            event_type TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            occurred_at TEXT NOT NULL,
            received_at TEXT NOT NULL,
            rule_version TEXT NOT NULL,
            test_mode TEXT NOT NULL,
            details_json TEXT NOT NULL
        )
    """)


@router.post("/recommendations")
def record_recommendation(record: RecommendationRecord):
    received_at = datetime.now(timezone.utc).isoformat()
    with _connection() as (connection, postgres):
        _ensure_tables(connection, postgres)
        inserted = _execute(connection, postgres, """
            INSERT INTO outing_recommendations
              (request_id, user_id, session_id, previous_request_id, occurred_at, received_at,
               rule_version, test_mode, conditions_json, results_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (request_id) DO NOTHING
        """, (
            record.request_id, record.user_id, record.session_id, record.previous_request_id,
            record.occurred_at.isoformat(), received_at, record.rule_version, record.test_mode,
            json.dumps(record.conditions, ensure_ascii=False),
            json.dumps([item.model_dump() for item in record.results], ensure_ascii=False),
        ))
    return {"ok": True, "inserted": bool(inserted), "request_id": record.request_id}


@router.post("/events")
def record_event(event: OutingEvent):
    received_at = datetime.now(timezone.utc).isoformat()
    with _connection() as (connection, postgres):
        _ensure_tables(connection, postgres)
        inserted = _execute(connection, postgres, """
            INSERT INTO outing_events
              (event_id, user_id, session_id, request_id, event_type, target_type, target_id,
               occurred_at, received_at, rule_version, test_mode, details_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (event_id) DO NOTHING
        """, (
            event.event_id, event.user_id, event.session_id, event.request_id, event.event_type,
            event.target_type, event.target_id, event.occurred_at.isoformat(), received_at,
            event.rule_version, event.test_mode, json.dumps(event.details, ensure_ascii=False),
        ))
    return {"ok": True, "inserted": bool(inserted), "event_id": event.event_id}


@router.get("/health")
def outing_health():
    with _connection() as (connection, postgres):
        _ensure_tables(connection, postgres)
    return {"ok": True, "storage": "postgresql" if postgres else "local-sqlite"}


@router.get("/popularity")
def outing_popularity():
    """Count unique users whose latest like action in the last seven days is active."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    with _connection() as (connection, postgres):
        _ensure_tables(connection, postgres)
        cursor = connection.cursor()
        try:
            cursor.execute(
                """SELECT event_id, user_id, target_id, event_type, occurred_at
                   FROM outing_events
                   WHERE event_type IN ('course_like', 'course_unlike') AND occurred_at >= ?""".replace("?", "%s") if postgres else
                """SELECT event_id, user_id, target_id, event_type, occurred_at
                   FROM outing_events
                   WHERE event_type IN ('course_like', 'course_unlike') AND occurred_at >= ?""",
                (cutoff,),
            )
            rows = cursor.fetchall()
        finally:
            cursor.close()
    latest = {}
    for event_id, user_id, target_id, event_type, occurred_at in rows:
        key = (user_id, target_id)
        candidate = (occurred_at, event_id, event_type)
        if key not in latest or candidate[:2] > latest[key][:2]:
            latest[key] = candidate
    counts = {}
    for (_, target_id), (_, _, event_type) in latest.items():
        if event_type == "course_like":
            counts[target_id] = counts.get(target_id, 0) + 1
    return {"counts": counts, "window_days": 7, "aggregated_at": datetime.now(timezone.utc).isoformat()}
