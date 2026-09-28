"""Export the user's approved photo subset and the manual-search handoff.

Offline only. No searching, downloading, or database writes.
"""
import csv
import json
from pathlib import Path
import sys
import urllib.parse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare_naver_course_images as catalog
from naver_place_queries import search_queries


def main():
    catalog.merge_reviews()
    work = catalog.WORK
    plan = json.loads((work / "plan.json").read_text(encoding="utf-8"))
    records = json.loads((work / "progress.json").read_text(encoding="utf-8"))
    approved = json.loads((work / "reviewed.json").read_text(encoding="utf-8"))
    accepted = {key: row for key, row in records.items() if approved.get(key) == row["sha256"]}
    missing = {course["id"]: "사용자 요청: 미완료 사진은 다른 담당자가 직접 검색" for course in plan["courses"] if course["id"] not in accepted}
    catalog.write_json(work / "allowed-missing.json", missing)
    catalog.review_catalog(plan, accepted)
    catalog.publish()
    headers = ["course_id", "코스명", "첫_장소", "주소", "방문지", "카테고리", "추천_검색어", "네이버_이미지_검색", "image_url", "상태"]
    manual_path = work / "사진_미완료_인계.csv"
    all_path = work / "가상코스_1000_최종.csv"
    with manual_path.open("w", encoding="utf-8-sig", newline="") as manual_file, all_path.open("w", encoding="utf-8-sig", newline="") as all_file:
        manual_writer = csv.DictWriter(manual_file, fieldnames=headers)
        all_writer = csv.DictWriter(all_file, fieldnames=headers)
        manual_writer.writeheader()
        all_writer.writeheader()
        for course in plan["courses"]:
            queries = search_queries(course["first_place"], course.get("address", ""))
            row = {"course_id": course["id"], "코스명": course["title"], "첫_장소": course["first_place"],
                   "주소": course.get("address", ""), "방문지": " → ".join(p["place_name"] for p in course["points"]),
                   "카테고리": ", ".join(course["tags"]["category"]), "추천_검색어": " | ".join(queries),
                   "네이버_이미지_검색": "https://search.naver.com/search.naver?where=image&query=" + urllib.parse.quote(queries[0]),
                   "image_url": accepted.get(course["id"], {}).get("image_url", ""),
                   "상태": "검수완료" if course["id"] in accepted else "사진 미완료 · 수동 검색 인계"}
            all_writer.writerow(row)
            if course["id"] in missing:
                manual_writer.writerow(row)
    report = {"courses": len(plan["courses"]), "unique_routes": len({tuple(p["place_name"] for p in c["points"]) for c in plan["courses"]}),
              "reviewed_photos": len(accepted), "manual_photo_handoff": len(missing),
              "images_generated": 0, "database_writes": 0,
              "first_places_preserved": True, "source_policy": "First-place NAVER image-search photographs; incomplete photos deferred by user"}
    catalog.write_json(work / "final-report.json", report)
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
