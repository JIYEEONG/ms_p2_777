"""Merge only visually approved destination/waypoint photos into photo progress.

Offline; preserves existing photos and every planned route. Run the handoff
exporter afterwards to publish the catalog and CSVs.
"""
import hashlib
import json

import prepare_naver_course_images as catalog


def merge(plan, existing, candidates, decisions, rejected, asset_root):
    courses = {course["id"]: course for course in plan["courses"]}
    result = dict(existing)
    used_hashes = {row["sha256"] for row in existing.values()}
    used_urls = {catalog.canonical_url(row["original_url"]) for row in existing.values()}
    used_visual = [int(row["dhash"], 16) for row in existing.values()]
    for course_id, photo in candidates.items():
        if course_id in existing:
            continue
        digest = photo["sha256"]
        if decisions.get(course_id) != digest or digest in rejected:
            continue
        course = courses[course_id]
        index = photo.get("cover_stop_index")
        if type(index) is not int or not 0 < index < len(course["points"]):
            raise ValueError(f"Invalid fallback stop: {course_id}")
        role = "destination" if index == len(course["points"]) - 1 else "waypoint"
        if (photo.get("first_place") != course["first_place"]
                or photo.get("image_place") != course["points"][index]["place_name"]
                or photo.get("cover_role") != role):
            raise ValueError(f"Fallback photo ownership mismatch: {course_id}")
        image_url = photo["image_url"]
        asset = (asset_root / image_url.lstrip("/")).resolve()
        expected_root = (asset_root / "assets/naver-courses").resolve()
        if not asset.is_relative_to(expected_root) or asset.suffix != ".jpg":
            raise ValueError(f"Invalid fallback asset path: {course_id}")
        if hashlib.sha256(asset.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Fallback photo changed after review: {course_id}")
        url = catalog.canonical_url(photo["original_url"])
        visual = int(photo["dhash"], 16)
        if digest in used_hashes or url in used_urls or any((visual ^ old).bit_count() <= 4 for old in used_visual):
            raise ValueError(f"Duplicate fallback photo: {course_id}")
        result[course_id] = photo
        used_hashes.add(digest)
        used_urls.add(url)
        used_visual.append(visual)
    return result


def main():
    work = catalog.WORK
    read = lambda name: json.loads((work / name).read_text(encoding="utf-8"))
    existing = read("progress.json")
    candidates = read("fallback-progress.json")
    rejected = read("rejected.json")
    if (work / "fallback-rejected.json").exists():
        rejected.update(read("fallback-rejected.json"))
    approved = {}
    for path in sorted(work.glob("review-fallback*.json")):
        for course_id, decision in json.loads(path.read_text(encoding="utf-8")).items():
            if decision["decision"] == "reject":
                rejected[decision["sha256"]] = decision.get("reason", "Visual review")
            elif decision["decision"] == "approve" and candidates.get(course_id, {}).get("sha256") == decision["sha256"]:
                approved[course_id] = decision["sha256"]
    merged = merge(read("plan.json"), existing, candidates, approved,
                   rejected, catalog.ROOT / "front/public")
    catalog.write_json(work / "rejected.json", rejected)
    catalog.write_json(work / "progress.json", merged)
    print(json.dumps({"existing_photos_preserved": len(existing), "fallback_photos_added": len(merged) - len(existing), "total": len(merged)}))


if __name__ == "__main__":
    main()
