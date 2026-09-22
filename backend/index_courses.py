# backend/index_courses.py
# 링고 코스를 AI Search에 "찾기 좋은 요약"으로 색인한다. 실제 답변에 쓰는 정확한 값(소요시간·주소 등)은
# rag.py가 매번 DB에서 다시 읽으므로, 여기서는 검색이 잘 걸리게 하는 설명 텍스트만 만들면 된다.
# 코스가 새로 등록되거나 Databricks 재발행으로 course_points가 바뀌면 다시 실행한다.
#
#   python index_courses.py          # 전체 재색인
#   python index_courses.py --dry-run  # 색인 없이 몇 건이 만들어지는지만 확인
import json
import sys

import config  # noqa: F401  # .env 로드 및 클라이언트 초기화
from db import query_lingo_courses
from search_admin import admin_key, call, BASE, API_VERSION
from rag import get_embedding


def build_doc(course: dict) -> dict:
    names_kr = [p["name_kr"] for p in course["points"]]
    # 검색에 걸리기 좋은 한 줄 설명 (제목 + 경유지 이름 나열). 실제 값은 content(JSON)에 그대로 둔다.
    title = course.get("title") or " · ".join(names_kr)
    summary = f"{title}. 경유지: {', '.join(names_kr)}."
    return {
        "doc_id": f"lingo-course-{course['course_id']}",
        "title": title,
        "content": json.dumps(course, ensure_ascii=False),
        "keywords": names_kr,
        "source_type": "D",
        "persona_scope": ["lingo"],
        "topic": "course",
        "language": "ko",
        "version": "1.0",
        "effective_date": "2026-09-21",
        "status": "approved",
        "source_ref": "moov.courses / moov.course_points",
        "embedding": get_embedding(summary),
        "@search.action": "mergeOrUpload",
    }


def main(dry_run: bool):
    courses = query_lingo_courses()  # 이름 있는 공개 코스 전체
    print(len(courses), "건 코스 확인")
    if dry_run:
        for c in courses:
            print("-", c["course_id"], c.get("title"))
        return
    docs = [build_doc(c) for c in courses]
    status, text = call("POST", f"{BASE}/docs/index?api-version={API_VERSION}", admin_key(), {"value": docs})
    print(status, len(docs), "건 색인")
    print(text[:600])


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
