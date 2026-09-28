"""Export the user's approved photo subset and the manual-search handoff.

Offline only. No searching, downloading, or database writes.
"""
import csv
from collections import Counter
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
    missing = {course["id"]: "첫 장소·도착지·경유지 사진 검색 후 미완료: 다른 담당자에게 수동 검색 인계" for course in plan["courses"] if course["id"] not in accepted}
    catalog.write_json(work / "allowed-missing.json", missing)
    catalog.review_catalog(plan, accepted)
    catalog.publish()
    headers = ["course_id", "코스명", "첫_장소", "주소", "방문지", "카테고리", "추천_검색어", "네이버_이미지_검색", "image_url", "사진_장소", "사진_역할", "사진_방문순서", "원본이미지", "상태"]
    manual_path = work / "사진_미완료_인계.csv"
    all_path = work / "가상코스_1000_최종.csv"
    manual_temp = manual_path.with_name(manual_path.name + ".tmp")
    all_temp = all_path.with_name(all_path.name + ".tmp")
    with manual_temp.open("w", encoding="utf-8-sig", newline="") as manual_file, all_temp.open("w", encoding="utf-8-sig", newline="") as all_file:
        manual_writer = csv.DictWriter(manual_file, fieldnames=headers)
        all_writer = csv.DictWriter(all_file, fieldnames=headers)
        manual_writer.writeheader()
        all_writer.writeheader()
        for course in plan["courses"]:
            photo = accepted.get(course["id"], {})
            if photo:
                queries = [photo["query"]]
            else:
                # Search all actual stops, trying destination then waypoints.
                queries = list(dict.fromkeys(query for point in reversed(course["points"])
                                             for query in search_queries(point["place_name"], point.get("address") or "")[:2]))
            row = {"course_id": course["id"], "코스명": course["title"], "첫_장소": course["first_place"],
                   "주소": course.get("address", ""), "방문지": " → ".join(p["place_name"] for p in course["points"]),
                   "카테고리": ", ".join(course["tags"]["category"]), "추천_검색어": " | ".join(queries),
                   "네이버_이미지_검색": "https://search.naver.com/search.naver?where=image&query=" + urllib.parse.quote(queries[0]),
                   "image_url": photo.get("image_url", ""),
                   "사진_장소": photo.get("image_place", course["first_place"]) if photo else "",
                   "사진_역할": {"first": "첫 장소", "destination": "도착지", "waypoint": "경유지"}.get(photo.get("cover_role", "first"), "") if photo else "",
                   "사진_방문순서": photo.get("cover_stop_index", 0) + 1 if photo else "",
                   "원본이미지": photo.get("original_url", ""),
                   "상태": "검수완료" if course["id"] in accepted else "사진 미완료 · 수동 검색 인계"}
            all_writer.writerow(row)
            if course["id"] in missing:
                manual_writer.writerow(row)
    manual_temp.replace(manual_path)
    all_temp.replace(all_path)
    roles = Counter(photo.get("cover_role", "first") for photo in accepted.values())
    report = {"courses": len(plan["courses"]), "unique_routes": len({tuple(p["place_name"] for p in c["points"]) for c in plan["courses"]}),
              "reviewed_photos": len(accepted), "manual_photo_handoff": len(missing),
              "photo_roles": {role: roles[role] for role in ("first", "destination", "waypoint")},
              "images_generated": 0, "database_writes": 0,
              "first_places_preserved": True, "source_policy": "Keep existing first-place photographs; fill missing covers with visually reviewed NAVER image-search photographs of actual destinations or waypoints. Unresolved photos remain a manual handoff."}
    catalog.write_json(work / "final-report.json", report)
    catalog.write_json(work / "report.json", {"requested": len(plan["courses"]), "collected": len(accepted), "missing": list(missing), "photo_roles": report["photo_roles"]})
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
