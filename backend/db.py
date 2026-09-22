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


def query_lingo_courses(course_ids: list[str] | None = None) -> list[dict]:
    """링고 D#: 이름 있는 공개 코스 + 경유지/목적지 정보.
    course_ids를 주면 그 코스만(검색으로 좁힌 결과), 안 주면 전체를 읽는다(코스가 적을 때 또는 검색 실패 시 대체용).
    영문 이름·주소는 juso로 검증된 지점(address_source='juso_verified')만 포함한다.
    검증 안 된 영문명(romanized_fallback)은 뺀다 -> 링고가 로마자 표기법으로 직접 음차하고 근거 ID에서 제외."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.course_id, c.title, c.duration_seconds, c.distance_m,
                       cp.sequence_no, cp.point_type, cp.place_name_kr,
                       cp.place_name_en, cp.address_en, cp.address_source, cp.category
                FROM moov.courses c
                JOIN moov.course_points cp ON cp.course_id = c.course_id
                WHERE c.visibility = 'public'
                  AND cp.place_name_kr IS NOT NULL
                  AND (%(course_ids)s IS NULL OR c.course_id = ANY(%(course_ids)s))
                ORDER BY c.course_id, cp.sequence_no
                """,
                {"course_ids": course_ids},
            )
            rows = cur.fetchall()
    finally:
        release_conn(conn)

    courses = {}
    for course_id, title, duration, distance, seq, point_type, name_kr, name_en, address_en, source, category in rows:
        course = courses.setdefault(course_id, {
            "course_id": course_id,
            "title": title,
            "duration_min": round(float(duration) / 60) if duration else None,
            "distance_km": round(float(distance) / 1000, 1) if distance else None,
            "points": [],
        })
        point = {"order": seq + 1, "type": point_type, "name_kr": name_kr, "category": category}
        if source == "juso_verified":
            point["name_en"] = name_en
            point["address_en"] = address_en
        course["points"].append({k: v for k, v in point.items() if v is not None})
    return [{k: v for k, v in c.items() if v is not None} for c in courses.values()]


def log_rag_usage(conversation_id: str, source_ids: str):
    """ai_sessions에 RAG 근거 제공 기록 (rag_used=true, rag_source_ids=최근 턴의 근거 ID).
    실제로 답변에 쓴 근거가 아니라 프롬프트에 제공된 근거 ID다 (모델 출력이 아직 JSON 계약이 아니라서)."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE ai_sessions SET rag_used = true, rag_source_ids = %s WHERE conversation_id = %s",
                (source_ids, conversation_id),
            )
        conn.commit()
    finally:
        release_conn(conn)