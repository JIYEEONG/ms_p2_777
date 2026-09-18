# backend/db.py
import os
import psycopg2
from psycopg2.pool import SimpleConnectionPool

_pool: SimpleConnectionPool | None = None


def init_pool():
    global _pool
    if _pool is None:
        _pool = SimpleConnectionPool(
            minconn=1,
            maxconn=5,
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


def ensure_session(session_id: str, user_id: str, persona: str, detected_language: str | None):
    """세션이 없으면 새로 만들고, 있으면 그냥 통과 (ON CONFLICT DO NOTHING)"""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_sessions (session_id, user_id, persona, detected_language)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (session_id) DO NOTHING
                """,
                (session_id, user_id, persona, detected_language),
            )
        conn.commit()
    finally:
        release_conn(conn)


def log_message(session_id: str, role: str, content: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO ai_messages (session_id, role, content) VALUES (%s, %s, %s)",
                (session_id, role, content),
            )
        conn.commit()
    finally:
        release_conn(conn)


def log_crisis(session_id: str | None, user_id: str, persona: str, safety_level: str, message_content: str):
    """위기 감지 시 동의 여부와 무관하게 항상 기록 (감사·안전 목적)"""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_crisis_logs (session_id, user_id, persona, safety_level, message_content)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (session_id, user_id, persona, safety_level, message_content),
            )
        conn.commit()
    finally:
        release_conn(conn)