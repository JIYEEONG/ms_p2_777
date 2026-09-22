# backend/approve_docs.py
# 검수를 통과한 문서만 status="approved"로 바꿔 새 JSONL을 만든다. 보류할 doc_id는 뒤에 나열한다.
#
#   python approve_docs.py moov_knowledge_docs_v3_all.jsonl approved_docs.jsonl 보류할doc_id1 보류할doc_id2
#   python search_admin.py upload approved_docs.jsonl
import json
import sys

src, dst, hold = sys.argv[1], sys.argv[2], set(sys.argv[3:])
count = 0
with open(src, encoding="utf-8") as f, open(dst, "w", encoding="utf-8") as out:
    for line in f:
        if not line.strip():
            continue
        doc = json.loads(line)
        if doc["doc_id"] in hold:
            print("보류:", doc["doc_id"])
            continue
        doc["status"] = "approved"
        out.write(json.dumps(doc, ensure_ascii=False) + "\n")
        count += 1
print(count, "건 approved 파일 생성:", dst)
