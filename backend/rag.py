# backend/rag.py
import json
import os
import urllib.request

from config import client, AZURE_EMBEDDING_DEPLOYMENT_NAME
from db import query_lingo_courses

# --- RAG 연결 지점 ---
# 페르소나별 근거 자료 (설계서 V1.2 260918 기준)
#   링고     : AI Search(moov-knowledge, persona_scope='lingo')에서 관련 코스 상위 LINGO_TOP개를 먼저 찾고,
#              그 course_id들만 db.query_lingo_courses()로 다시 읽어 정확한 값을 [D#]로 만든다.
#              -> 코스가 1만 개로 늘어도 프롬프트에는 몇 개만 들어간다. 색인은 index_courses.py로 만든다.
#              검색 결과가 없으면(색인이 비었거나 설정 안 됨) 예전 방식대로 전체를 통째로 읽는다.
#   무브·토닥이·척척박사 : 같은 인덱스에서 D#(source_type='D')와 S#(source_type='S')를 각각 하이브리드 검색
#              (키워드 + 벡터, persona_scope·status 필터). 승인된 문서만 검색된다.
#   공통     : 검색 점수가 SCORE_THRESHOLD 미만인 결과는 버린다. 그래야 "오늘 날씨 좋네" 같은 잡담에
#              억지로 걸린 무관한 문서가 근거로 끼어들지 않는다.
#
# 로깅 연동: ai_sessions.rag_used(BOOLEAN), ai_sessions.rag_source_ids(STRING) — 신찬규님 공식 스키마 컬럼명

LINGO_PERSONA = "lingo"  # main.py에서 링고에 쓰는 persona 값과 반드시 같아야 함
SEARCH_PERSONAS = {"moove", "todaki", "expert"}  # AI Search를 쓰는 페르소나 (필터 값으로 쓰므로 화이트리스트로 제한)
SEARCH_API_VERSION = "2024-07-01"
SEARCH_TOP = 3       # 무브·토닥이·척척박사: D#/S# 각각 상위 몇 건
LINGO_TOP = 5        # 링고: 검색으로 좁힐 코스 개수
# RRF(하이브리드 순위 합산) 점수 기준. 실측: 실제 질문 0.0325~0.0331, 잡담 0.0161~0.0167 (2026-09-21).
# 그 사이인 0.022로 잡았다. 낮추면 더 많이 걸리고(오탐 위험), 올리면 더 깐깐해진다(누락 위험).
# 문서가 늘어나면 점수 분포가 바뀔 수 있으니 search_admin.py test로 주기적으로 재확인한다.
SCORE_THRESHOLD = 0.022


def get_embedding(text: str) -> list[float]:
    """텍스트를 임베딩 벡터로 변환 (luna-embedding-dev 배포 사용)"""
    response = client.embeddings.create(
        model=AZURE_EMBEDDING_DEPLOYMENT_NAME,
        input=text,
    )
    return response.data[0].embedding


def _search(query: str, vector: list[float], persona: str, source_type: str, top: int) -> list[dict]:
    """AI Search 하이브리드 검색. 점수가 SCORE_THRESHOLD 미만인 결과는 버린다.
    설정이 없으면 빈 목록 (서버가 죽지 않게)."""
    endpoint = os.environ.get("AZURE_SEARCH_ENDPOINT")
    key = os.environ.get("AZURE_SEARCH_QUERY_KEY")
    index = os.environ.get("AZURE_SEARCH_INDEX", "moov-knowledge")
    if not endpoint or not key:
        return []
    body = {
        "search": query,
        "vectorQueries": [{"kind": "vector", "vector": vector, "fields": "embedding", "k": top}],
        "filter": f"status eq 'approved' and source_type eq '{source_type}' and persona_scope/any(p: p eq '{persona}')",
        "select": "doc_id,title,content,topic,version,effective_date,source_ref",
        "top": top,
    }
    request = urllib.request.Request(
        f"{endpoint.rstrip('/')}/indexes/{index}/docs/search?api-version={SEARCH_API_VERSION}",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "api-key": key},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        results = json.loads(response.read().decode("utf-8")).get("value", [])
    return [r for r in results if r.get("@search.score", 0) >= SCORE_THRESHOLD]


def _search_knowledge(query: str, persona: str) -> dict | None:
    """무브·토닥이·척척박사: D#(정확한 값)와 S#(보완 설명)를 각각 검색해 설계서 7.3 형식으로 만든다."""
    if not query.strip():
        return None
    try:
        vector = get_embedding(query)
        d_docs = _search(query, vector, persona, "D", SEARCH_TOP)
        s_docs = _search(query, vector, persona, "S", SEARCH_TOP)
    except Exception as error:  # 검색 실패가 대화를 막지 않게 한다
        print(f"[rag] AI Search 조회 실패: {error}")
        return None
    if not d_docs and not s_docs:
        return None

    d_text = "\n".join(f"[D{i}] {doc['content']}" for i, doc in enumerate(d_docs, 1))
    s_text = "\n\n".join(
        f"[S{i}] source={doc['source_ref']}, metadata="
        + json.dumps({k: doc[k] for k in ("doc_id", "topic", "version", "effective_date")}, ensure_ascii=False)
        + f"\n{doc['content']}"
        for i, doc in enumerate(s_docs, 1)
    )
    return {
        "content": "\n\n".join(t for t in (d_text, s_text) if t),  # D#·S#를 합친 텍스트 (기존 호환)
        "structured": d_text,  # <structured_data>에 넣을 D# 블록
        "vector": s_text,      # <vector_sources>에 넣을 S# 블록
        "source_type": "+".join(t for t, docs in (("D", d_docs), ("S", s_docs)) if docs),
        "doc_id": ",".join(doc["doc_id"] for doc in d_docs + s_docs),
        "d_ids": [doc["doc_id"] for doc in d_docs],
        "s_ids": [doc["doc_id"] for doc in s_docs],
    }


def _lingo_course_ids(query: str) -> list[str] | None:
    """AI Search에서 질문과 관련된 코스 id를 찾는다. 색인이 비었거나 검색 결과가 없으면 None(=전체 읽기로 대체)."""
    if not query.strip():
        return None
    try:
        vector = get_embedding(query)
        docs = _search(query, vector, LINGO_PERSONA, "D", LINGO_TOP)
    except Exception as error:
        print(f"[rag] 링고 코스 검색 실패: {error}")
        return None
    # doc_id 형식: lingo-course-{course_id} (index_courses.py에서 이렇게 만든다)
    ids = [doc["doc_id"].removeprefix("lingo-course-") for doc in docs if doc["doc_id"].startswith("lingo-course-")]
    return ids or None


def search_local_knowledge(query: str, persona: str) -> dict | None:
    """
    RAG 검색. 반환: {"content": str, "source_type": ..., "doc_id": str, ...} 또는 None
    - 링고: 검색으로 관련 코스를 좁힌 뒤 DB에서 정확한 값을 다시 읽어 [D#] {json}으로 반환.
            검색이 비어 있으면(색인 없음/실패) 이름 있는 공개 코스 전체를 반환(코스가 적을 때의 대체 경로).
    - 무브·토닥이·척척박사: AI Search에서 D#/S# 검색
    - 그 외: None
    """
    if persona == LINGO_PERSONA:
        course_ids = _lingo_course_ids(query)
        courses = query_lingo_courses(course_ids)  # course_ids가 None이면 전체 읽기
        if courses:
            content = "\n".join(
                f"[D{i}] " + json.dumps(course, ensure_ascii=False)
                for i, course in enumerate(courses, 1)
            )
            return {
                "content": content,
                "source_type": "D",
                "doc_id": ",".join(course["course_id"] for course in courses),
            }
        return None
    if persona in SEARCH_PERSONAS:
        return _search_knowledge(query, persona)
    return None