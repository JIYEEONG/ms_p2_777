# backend/search_admin.py
# Azure AI Search 관리용 스크립트 (서버 실행과 무관). backend 폴더에서 실행한다.
# 관리자 키는 .env의 AZURE_SEARCH_ADMIN_KEY에서 읽는다.
#
#   python search_admin.py create-index
#   python search_admin.py upload test_doc.jsonl
#   python search_admin.py test "음악 어떻게 틀어요?" moove
#   python search_admin.py delete test-S-001
import json
import os
import sys
import urllib.error
import urllib.request

import config  # noqa: F401  # .env 로드 및 클라이언트 초기화
from rag import get_embedding

API_VERSION = "2024-07-01"
ENDPOINT = os.environ["AZURE_SEARCH_ENDPOINT"].rstrip("/")
INDEX = os.environ.get("AZURE_SEARCH_INDEX", "moov-knowledge")
BASE = f"{ENDPOINT}/indexes/{INDEX}"

# 색인에 올릴 필드 (JSONL의 review_required 같은 나머지 키는 버린다: 색인에 없는 필드는 오류)
FIELDS = ["doc_id", "title", "content", "keywords", "source_type", "persona_scope",
          "topic", "language", "version", "effective_date", "status", "source_ref"]


def call(method, url, key, body=None, timeout=60):
    """JSON 요청을 보내고 (상태코드, 응답 텍스트)를 돌려준다. HTTP 오류도 예외 없이 반환."""
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json", "api-key": key},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8")


def admin_key():
    return os.environ["AZURE_SEARCH_ADMIN_KEY"]


def create_index():
    def text(name, searchable=False):
        field = {"name": name, "type": "Edm.String", "searchable": searchable, "filterable": not searchable}
        if searchable:
            field["analyzer"] = "ko.microsoft"
        return field

    body = {
        "name": INDEX,
        "fields": [
            {"name": "doc_id", "type": "Edm.String", "key": True, "filterable": True, "searchable": False},
            text("title", True),
            text("content", True),
            {"name": "keywords", "type": "Collection(Edm.String)", "searchable": True, "analyzer": "ko.microsoft"},
            text("source_type"),
            {"name": "persona_scope", "type": "Collection(Edm.String)", "searchable": False, "filterable": True},
            text("topic"),
            text("language"),
            text("version"),
            text("effective_date"),
            text("status"),
            {"name": "source_ref", "type": "Edm.String", "searchable": False, "filterable": False},
            {"name": "embedding", "type": "Collection(Edm.Single)", "searchable": True, "retrievable": False,
             "dimensions": 1536, "vectorSearchProfile": "vec-profile"},
        ],
        "vectorSearch": {
            "algorithms": [{"name": "hnsw", "kind": "hnsw", "hnswParameters": {"metric": "cosine"}}],
            "profiles": [{"name": "vec-profile", "algorithm": "hnsw"}],
        },
    }
    status, text_body = call("PUT", f"{BASE}?api-version={API_VERSION}", admin_key(), body)
    print(status, text_body[:600])


def upload(path):
    docs = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            raw = json.loads(line)
            if raw.get("status") != "approved":
                print("건너뜀(approved 아님):", raw.get("doc_id"))
                continue
            doc = {k: raw[k] for k in FIELDS if k in raw}
            doc["embedding"] = get_embedding(raw["title"] + "\n" + raw["content"])
            doc["@search.action"] = "mergeOrUpload"  # 같은 doc_id는 덮어씀
            docs.append(doc)
    if not docs:
        print("올릴 문서가 없어요.")
        return
    status, text_body = call("POST", f"{BASE}/docs/index?api-version={API_VERSION}", admin_key(), {"value": docs})
    print(status, len(docs), "건 전송")
    print(text_body[:600])


def search(query, persona):
    body = {
        "search": query,
        "vectorQueries": [{"kind": "vector", "vector": get_embedding(query), "fields": "embedding", "k": 3}],
        "filter": f"status eq 'approved' and persona_scope/any(p: p eq '{persona}')",
        "select": "doc_id,title,content,source_type,topic,source_ref",
        "top": 3,
    }
    status, text_body = call("POST", f"{BASE}/docs/search?api-version={API_VERSION}",
                             os.environ["AZURE_SEARCH_QUERY_KEY"], body, timeout=30)
    print(status)
    if status != 200:
        print(text_body[:600])
        return
    for item in json.loads(text_body).get("value", []):
        print("-", item["doc_id"], "|", item["title"], "| score", round(item["@search.score"], 4))
        print("   ", item["content"][:120])


def delete(doc_id):
    body = {"value": [{"@search.action": "delete", "doc_id": doc_id}]}
    status, text_body = call("POST", f"{BASE}/docs/index?api-version={API_VERSION}", admin_key(), body, timeout=30)
    print(status, text_body[:300])


if __name__ == "__main__":
    command, args = sys.argv[1], sys.argv[2:]
    if command == "create-index":
        create_index()
    elif command == "upload":
        upload(args[0])
    elif command == "test":
        search(args[0], args[1])
    elif command == "delete":
        delete(args[0])
    else:
        print("명령: create-index | upload <파일> | test <질문> <페르소나> | delete <doc_id>")