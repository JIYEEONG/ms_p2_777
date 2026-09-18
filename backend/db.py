# backend/db.py
import os
import json
import uuid
import psycopg2
from psycopg2.pool import SimpleConnectionPool

_pool: SimpleConnectionPool | None = None


def init_pool():
    global _pool
    if _pool is None:
        _pool = SimpleConnectionPool(
            minconn=1, maxconn=5,
            host=os.environ["POSTGRES_HOST"],
            port=os.environ["POSTGRES_PORT"],
            dbname=os.environ["POSTGRES_DB"],
            user=os.environ["POSTGRES_USER"],
            password=os.environ["POSTGRES_PASSWORD"],
            sslmode=os.environ.get("POSTGRES_SSLMODE", "require"),
        )
    return _pool


def get_conn():
    return init_pool().getconn()


def release_conn(conn):
    init_pool().putconn(conn)


def ensure_session(conversation_id: str, user_id: str, persona: str, locale: str | None):
    """세션이 없으면 새로 만들고, 있으면 통과 (신찬규님 ai_sessions 공식 스키마 기준)"""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_sessions (conversation_id, user_id, persona, locale, transcript_save_consent, is_synthetic)
                VALUES (%s, %s, %s, %s, %s, false)
                ON CONFLICT (conversation_id) DO NOTHING
                """,
                (conversation_id, user_id, persona, locale, True),
            )
        conn.commit()
    finally:
        release_conn(conn)


def log_turn_event(conversation_id: str, role: str, content: str, user_id: str | None = None):
    """메시지 한 턴을 app_events에 기록 (aggregate_type='ai_session')"""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_events (event_id, event_type, aggregate_type, aggregate_id, user_id, attributes_json, is_synthetic)
                VALUES (%s, %s, 'ai_session', %s, %s, %s, false)
                """,
                (
                    str(uuid.uuid4()),
                    f"ai_message_{role}",
                    conversation_id,
                    user_id,
                    json.dumps({"role": role, "content": content}),
                ),
            )
        conn.commit()
    finally:
        release_conn(conn)


def log_crisis_event(conversation_id: str | None, user_id: str, persona: str, message_content: str):
    """위기 감지를 app_events에 기록 + ai_sessions의 safety_event/forced_persona_switch 갱신"""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_events (event_id, event_type, aggregate_type, aggregate_id, user_id, attributes_json, is_synthetic)
                VALUES (%s, 'ai_crisis_detected', 'ai_session', %s, %s, %s, false)
                """,
                (
                    str(uuid.uuid4()),
                    conversation_id,
                    user_id,
                    json.dumps({"persona": persona, "message": message_content}),
                ),
            )
            if conversation_id:
                cur.execute(
                    """
                    UPDATE ai_sessions
                    SET safety_event = 'high',
                        forced_persona_switch = true,
                        persona_before_switch = %s
                    WHERE conversation_id = %s
                    """,
                    (persona, conversation_id),
                )
        conn.commit()
    finally:
        release_conn(conn)