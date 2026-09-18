# backend/rag.py
from config import client, AZURE_EMBEDDING_DEPLOYMENT_NAME

# --- RAG 연결 지점 (뼈대) ---
# TODO: 데이터 담당자(신찬규)의 service_knowledge_docs 테이블(원본 문서 아직 0건)
# 준비 완료 후 실제 검색 로직으로 교체.
#
# 예정 데이터 소스 (신찬규님 통합본 260918 기준):
#   - 척척박사: service_knowledge_docs (doc_id, title, content, source_type[D/S], topic, updated_at)
#          → MOOV 서비스 안내·FAQ RAG는 척척박사 담당. content를 임베딩해 pgvector에 색인 예정.
#          → (보류) 신찬규님 아키텍처는 Azure AI Search 기준으로 설계돼 있어, pgvector 전환 여부 확인 필요.
#   - 링고: course_points (place_name_en, address_en, address_source, category) + courses(duration_seconds, distance_m)
#          → 코스 대표 이미지·타이틀 컬럼은 계획에 없어 요청하지 않음. 코스 명칭은 경유지 장소명 조합으로 대체.
#   - 무브: RAG 대상 아님 (일반 대화 페르소나)
#
# 로깅 연동: ai_sessions.rag_used(BOOLEAN), ai_sessions.rag_source_ids(STRING) — 신찬규님 공식 스키마 컬럼명

def get_embedding(text: str) -> list[float]:
    """텍스트를 임베딩 벡터로 변환 (luna-embedding-dev 배포 사용)"""
    response = client.embeddings.create(
        model=AZURE_EMBEDDING_DEPLOYMENT_NAME,
        input=text,
    )
    return response.data[0].embedding


def search_local_knowledge(query: str, persona: str) -> dict | None:
    """
    RAG 검색 — 아직 미구현 (테이블/인덱스 준비 전).
    반환 예정 형태: {"content": str, "source_type": "D" | "S", "doc_id": str}
    """
    return None