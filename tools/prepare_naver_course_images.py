"""Prepare 1,000 CSV courses and collect distinct first-place NAVER photos.

No database writes. Collection prepares a review catalog; publishing requires
every selected course to have a reviewed, distinct image. Re-runs resume caches.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
import csv
import hashlib
import html
import io
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "artifacts/naver-course-images"
ASSETS = ROOT / "front/public/assets/naver-courses"
MANIFEST = ROOT / "backend/data/naver-course-images.json"
SEARCH = "https://naverapihub.apigw.ntruss.com/search/v1/image"


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    for attempt in range(12):
        try:
            temp.replace(path)
            return
        except PermissionError:
            if attempt == 11:
                raise
            time.sleep(0.1 * (attempt + 1))


def plain(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()


def normalized(value):
    return re.sub(r"[^\w가-힣]", "", plain(value)).lower()


def read_rows(path, count):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if len(rows) < count:
        raise ValueError(f"Expected at least {count} CSV rows, got {len(rows)}")
    rows = rows[:count]
    if len({row["course_id"] for row in rows}) != count:
        raise ValueError("Duplicate course IDs in CSV")
    return rows


def prepare(path, count):
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend/.env")
    sys.path.insert(0, str(ROOT / "backend"))
    from db import get_conn, release_conn
    from outing_api import _load_courses
    rows = read_rows(path, count)
    conn = get_conn()
    try:
        conn.set_session(readonly=True)
        courses = {course["id"]: course for course in _load_courses(conn)}
    finally:
        conn.rollback()
        release_conn(conn)
    planned = []
    for row in rows:
        course = courses.get(row["course_id"])
        if not course or not course["points"]:
            raise ValueError(f"No route for {row['course_id']}")
        csv_names = [x.strip() for x in row.get("장소들", "").split("→") if x.strip()]
        points = []
        for index, point in enumerate(course["points"]):
            explicit = csv_names[index] if index < len(csv_names) else point.get("course_point_place_name_kr")
            name = explicit or point.get("matched_place_name_kr")
            if not name:
                raise ValueError(f"Unresolved place: {row['course_id']} sequence {index}")
            points.append({**point, "place_name": name, "place_name_kr": name,
                           "name_source": "csv-or-stored-name" if explicit else "existing-service-coordinate-match"})
        first = points[0]
        planned.append({"id": row["course_id"], "original_title": row["title"],
                        "title": " → ".join(p["place_name"] for p in points) + " 코스",
                        "first_place": first["place_name"], "address": first.get("address") or "",
                        "points": points, "tags": course["tags"]})
    titles = Counter(course["title"] for course in planned)
    for course in planned:
        if titles[course["title"]] > 1:
            course["title"] += " · " + course["id"]
    write_json(WORK / "plan.json", {"source_csv": path.name, "count": count, "courses": planned})
    print(json.dumps({"courses": len(planned), "first_places": dict(Counter(c["first_place"] for c in planned)),
                      "coordinate_matched_points": sum(p["name_source"] == "existing-service-coordinate-match" for c in planned for p in c["points"])}, ensure_ascii=False), flush=True)


class SearchUnavailable(RuntimeError):
    pass


def diagnose():
    """Compare enabled APIs without printing credentials or cached responses."""
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend/.env")
    client = os.getenv("NAVER_SEARCH_CLIENT_ID", "").strip()
    secret = os.getenv("NAVER_SEARCH_CLIENT_SECRET", "").strip()
    print("Configured search Client ID: " + "*" * max(0, len(client) - 4) + client[-4:], flush=True)
    for service in ("image", "local", "blog"):
        url = SEARCH.rsplit("/", 1)[0] + "/" + service + "?" + urllib.parse.urlencode({"query": "Seoul", "display": 1, "format": "json"})
        request = urllib.request.Request(url, headers={"X-NCP-APIGW-API-KEY-ID": client, "X-NCP-APIGW-API-KEY": secret})
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                data = json.load(response)
                print(service, "HTTP", response.status, "items", len(data.get("items", [])), flush=True)
        except urllib.error.HTTPError as error:
            # Only print the provider's status text, never request headers.
            data = json.loads(error.read())
            print(service, "HTTP", error.code, data.get("error", {}).get("message", "Request rejected"), flush=True)


def search(query, start=1):
    key = hashlib.sha256(f"{query}:{start}".encode()).hexdigest()
    cache = WORK / "search" / (key + ".json")
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    client = os.getenv("NAVER_SEARCH_CLIENT_ID", "").strip()
    secret = os.getenv("NAVER_SEARCH_CLIENT_SECRET", "").strip()
    if not client or not secret:
        raise SearchUnavailable("NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET are required")
    params = urllib.parse.urlencode({"query": query, "display": 100, "start": start, "sort": "sim", "format": "json"})
    request = urllib.request.Request(SEARCH + "?" + params, headers={
        "X-NCP-APIGW-API-KEY-ID": client, "X-NCP-APIGW-API-KEY": secret})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                data = json.load(response)
            break
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                raise SearchUnavailable("NAVER API HUB rejected this image request (HTTP " + str(error.code) + "). Check the saved Application settings and that its credentials match backend/.env; run diagnose to compare APIs.") from None
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(2 ** attempt)
    if not isinstance(data.get("items"), list):
        raise SearchUnavailable("NAVER returned an invalid image response")
    write_json(cache, data)
    time.sleep(0.15)
    return data


def relevant(place, title):
    """Reject results without venue identity, rather than use category photos."""
    title = normalized(title)
    name = normalized(place)
    if name and name in title:
        return True
    parts = place.split()
    # For branch names, require BOTH brand and branch after common suffix removal.
    if len(parts) > 1:
        tokens = [normalized(p).removesuffix("점") for p in parts]
        return all(token and token in title for token in tokens)
    return False


def canonical_url(url):
    parsed = urllib.parse.urlsplit(url)
    params = urllib.parse.parse_qs(parsed.query)
    if parsed.hostname == "search.pstatic.net" and params.get("src"):
        return canonical_url(params["src"][0])
    # NAVER blog image size options do not make a new photograph.
    if parsed.hostname and parsed.hostname.endswith("pstatic.net"):
        return urllib.parse.urlunsplit(("https", parsed.netloc, parsed.path, "", ""))
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, ""))


def download(item):
    from PIL import Image, ImageOps
    url = item.get("link", "")
    if urllib.parse.urlsplit(url).scheme not in ("http", "https"):
        raise ValueError("Invalid image URL")
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=15) as response:
        data = response.read(15_000_001)
    if len(data) > 15_000_000:
        raise ValueError("Image exceeds 15 MB")
    with Image.open(io.BytesIO(data)) as raw:
        if raw.width * raw.height > 40_000_000:
            raise ValueError("Image exceeds 40 megapixels")
        photo = ImageOps.exif_transpose(raw).convert("RGB")
        if min(photo.size) < 250 or not 0.5 <= photo.width / photo.height <= 3:
            raise ValueError("Image too small or unsuitable aspect ratio")
        small = photo.resize((9, 8)).convert("L")
        pixels = list(small.getdata())
        dhash = sum((pixels[y*9+x] > pixels[y*9+x+1]) << (y*8+x) for y in range(8) for x in range(8))
        photo.thumbnail((1200, 1200))
        output = io.BytesIO()
        photo.save(output, "JPEG", quality=88)
    data = output.getvalue()
    return data, hashlib.sha256(data).hexdigest(), dhash


def cached_download(item):
    key = hashlib.sha256(canonical_url(item.get("link", "")).encode()).hexdigest()
    metadata = WORK / "downloads" / (key + ".json")
    filename = metadata.with_suffix(".jpg")
    if metadata.exists():
        stored = json.loads(metadata.read_text(encoding="utf-8"))
        if stored.get("invalid"):
            return None
        if filename.exists():
            return filename.read_bytes(), stored["sha256"], int(stored["dhash"], 16)
    try:
        data, digest, dhash = download(item)
    except (OSError, ValueError, urllib.error.URLError):
        # Failed servers may recover; don't permanently blacklist network errors.
        return None
    metadata.parent.mkdir(parents=True, exist_ok=True)
    filename.write_bytes(data)
    write_json(metadata, {"sha256": digest, "dhash": f"{dhash:016x}"})
    return data, digest, dhash


def allowed_missing():
    path = WORK / "allowed-missing.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def review_catalog(plan, records):
    permitted = allowed_missing()
    completed = []
    for course in plan["courses"]:
        if course["id"] in records:
            completed.append({**course, **records[course["id"]]})
        elif course["id"] in permitted:
            completed.append({**course, "image_url": None, "sha256": None,
                              "review": "missing-by-user-request", "missing_reason": permitted[course["id"]]})
    write_json(WORK / "review-catalog.json", {"version": 1, "count": plan["count"], "courses": completed,
               "generation_policy": plan.get("generation_policy", {}), "place_profiles": plan.get("place_profiles", {})})


def merge_reviews():
    records = json.loads((WORK / "progress.json").read_text(encoding="utf-8"))
    rejected_path = WORK / "rejected.json"
    rejected = json.loads(rejected_path.read_text(encoding="utf-8")) if rejected_path.exists() else {}
    approved = {}
    for path in WORK.glob("review-*.json"):
        if path.name == "review-catalog.json":
            continue
        for key, decision in json.loads(path.read_text(encoding="utf-8")).items():
            if not isinstance(decision, dict) or "decision" not in decision:
                continue
            if decision["decision"] == "reject":
                rejected[decision["sha256"]] = decision.get("reason", "Visual review")
            elif records.get(key, {}).get("sha256") == decision["sha256"]:
                approved[key] = decision["sha256"]
    approved = {key: digest for key, digest in approved.items() if digest not in rejected}
    write_json(WORK / "rejected.json", rejected)
    write_json(WORK / "reviewed.json", approved)
    print(f"Reviewed: {len(approved)} approved current photos; {len(rejected)} rejected hashes", flush=True)


def collect():
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend/.env")
    plan = json.loads((WORK / "plan.json").read_text(encoding="utf-8"))
    progress_path = WORK / "progress.json"
    records = json.loads(progress_path.read_text(encoding="utf-8")) if progress_path.exists() else {}
    ids = {course["id"] for course in plan["courses"]}
    planned = {course["id"]: course for course in plan["courses"]}
    records = {key: value for key, value in records.items() if key in ids and value["first_place"] == planned[key]["first_place"] and (ROOT / "front/public" / value["image_url"].lstrip("/")).exists()}
    rejected_path = WORK / "rejected.json"
    rejected = json.loads(rejected_path.read_text(encoding="utf-8")) if rejected_path.exists() else {}
    records = {key: value for key, value in records.items() if value["sha256"] not in rejected}
    used_urls = {record["canonical_url"] for record in records.values()}
    used_hashes = {record["sha256"] for record in records.values()}
    used_visual = [int(record["dhash"], 16) for record in records.values()]
    groups = defaultdict(list)
    permitted_missing = allowed_missing()
    for course in plan["courses"]:
        if course["id"] not in records and course["id"] not in permitted_missing:
            groups[course["first_place"]].append(course)
    ASSETS.mkdir(parents=True, exist_ok=True)
    for place, pending in groups.items():
        rejected_urls = set()
        try:
            from naver_place_queries import relevant as place_relevant, search_queries
        except ImportError:
            place_relevant = lambda venue, title, address="": relevant(venue, title)
            search_queries = lambda venue, address="": [venue, venue + " 외관", venue + " 내부", venue + " 방문"]
        address = pending[0].get("address", "")
        queries = search_queries(place, address)
        for query in queries:
            if not pending:
                break
            for start in range(1, 1000, 100):
                result = search(query, start)
                items = []
                for item in result["items"]:
                    url = canonical_url(item.get("link", ""))
                    if url in used_urls or url in rejected_urls or not place_relevant(place, item.get("title", ""), address):
                        continue
                    rejected_urls.add(url)
                    items.append(item)
                # Bound both downloads and open sockets; assignment stays serial.
                for offset in range(0, len(items), 12):
                    if not pending:
                        break
                    batch = items[offset:offset + 12]
                    with ThreadPoolExecutor(max_workers=6) as pool:
                        downloads = list(pool.map(cached_download, batch))
                    for item, downloaded in zip(batch, downloads):
                        if not pending:
                            break
                        if downloaded is None:
                            continue
                        data, digest, dhash = downloaded
                        if digest in rejected or digest in used_hashes or any((dhash ^ previous).bit_count() <= 4 for previous in used_visual):
                            continue
                        course = pending.pop(0)
                        filename = digest[:24] + ".jpg"
                        (ASSETS / filename).write_bytes(data)
                        url = canonical_url(item["link"])
                        records[course["id"]] = {"image_url": "/assets/naver-courses/" + filename,
                            "first_place": place, "query": query, "source": "naver-image-search",
                            "search_url": "https://search.naver.com/search.naver?where=image&query=" + urllib.parse.quote(query),
                            "original_url": item["link"], "canonical_url": url, "source_title": plain(item["title"]),
                            "sha256": digest, "dhash": f"{dhash:016x}", "review": "venue-title-match; visual-review-pending"}
                        used_urls.add(url)
                        used_hashes.add(digest)
                        used_visual.append(dhash)
                    write_json(progress_path, records)
                    print(f"{place}: {len(records)}/{plan['count']}", flush=True)
                if not pending or start + 100 > result.get("total", 0):
                    break
        print(f"{place}: {len(records)}/{plan['count']} collected; {len(pending)} still missing here", flush=True)
    missing = [course["id"] for course in plan["courses"] if course["id"] not in records and course["id"] not in permitted_missing]
    write_json(WORK / "report.json", {"requested": plan["count"], "collected": len(records), "missing": missing})
    if missing:
        raise RuntimeError(f"{len(missing)} courses still need relevant distinct photos. Manifest not published.")
    # Route edits may finish while first-place photographs are being collected.
    plan = json.loads((WORK / "plan.json").read_text(encoding="utf-8"))
    review_catalog(plan, records)
    print(f"Collected {len(records)} course photos. Review photos before publishing.", flush=True)


def publish():
    data = json.loads((WORK / "review-catalog.json").read_text(encoding="utf-8"))
    completed = data["courses"]
    approved = json.loads((WORK / "reviewed.json").read_text(encoding="utf-8"))
    if len(completed) != data["count"] or len({c["id"] for c in completed}) != data["count"]:
        raise ValueError("Incomplete review catalog")
    photographed = [course for course in completed if course.get("image_url")]
    if len({c["sha256"] for c in photographed}) != len(photographed):
        raise ValueError("Duplicate photo content")
    permitted_missing = allowed_missing()
    for course in completed:
        if not course.get("image_url"):
            if course["id"] not in permitted_missing or course.get("review") != "missing-by-user-request":
                raise ValueError(f"Unexpected missing photo: {course['id']}")
            continue
        if approved.get(course["id"]) != course["sha256"]:
            raise ValueError(f"Visual review missing or stale: {course['id']}")
        asset = ROOT / "front/public" / course["image_url"].lstrip("/")
        if hashlib.sha256(asset.read_bytes()).hexdigest() != course["sha256"]:
            raise ValueError(f"Image changed after review: {course['id']}")
        course["review"] = "venue-source-match; visual-reviewed"
    with (WORK / "courses-with-images.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["course_id", "title", "image_url", "장소들", "카테고리", "검색어", "원본이미지"])
        writer.writeheader()
        for course in completed:
            writer.writerow({"course_id": course["id"], "title": course["title"], "image_url": course["image_url"],
                             "장소들": " → ".join(p["place_name"] for p in course["points"]),
                             "카테고리": ", ".join(course["tags"]["category"]), "검색어": course.get("query", ""), "원본이미지": course.get("original_url", "")})
    write_json(MANIFEST, data)
    print(f"Published {len(completed)} courses with {len(photographed)} reviewed photos: {MANIFEST}", flush=True)


def fill_sources():
    """Supplement scarce image results with venue photos from NAVER source posts."""
    plan = json.loads((WORK / "plan.json").read_text(encoding="utf-8"))
    source_path = WORK / "source-candidates.json"
    sources = json.loads(source_path.read_text(encoding="utf-8"))["candidates"]
    progress_path = WORK / "progress.json"
    records = json.loads(progress_path.read_text(encoding="utf-8"))
    rejected_path = WORK / "rejected.json"
    rejected = json.loads(rejected_path.read_text(encoding="utf-8")) if rejected_path.exists() else {}
    records = {key: value for key, value in records.items() if value["sha256"] not in rejected}
    used_urls = {record["canonical_url"] for record in records.values()}
    used_hashes = {record["sha256"] for record in records.values()}
    used_visual = [int(record["dhash"], 16) for record in records.values()]
    groups = defaultdict(list)
    permitted_missing = allowed_missing()
    for course in plan["courses"]:
        if course["id"] not in records and course["id"] not in permitted_missing:
            groups[course["first_place"]].append(course)
    for place, pending in groups.items():
        items = [item for item in sources if item["first_place"] == place and canonical_url(item["link"]) not in used_urls]
        for offset in range(0, len(items), 12):
            if not pending:
                break
            batch = items[offset:offset + 12]
            with ThreadPoolExecutor(max_workers=6) as pool:
                downloads = list(pool.map(cached_download, batch))
            for item, downloaded in zip(batch, downloads):
                if not pending:
                    break
                if downloaded is None:
                    continue
                data, digest, dhash = downloaded
                if digest in rejected or digest in used_hashes or any((dhash ^ previous).bit_count() <= 4 for previous in used_visual):
                    continue
                course = pending.pop(0)
                filename = digest[:24] + ".jpg"
                (ASSETS / filename).write_bytes(data)
                url = canonical_url(item["link"])
                records[course["id"]] = {"image_url": "/assets/naver-courses/" + filename,
                    "first_place": place, "query": item["query"], "source": item["source"],
                    "search_url": item["search_url"], "original_post_url": item["original_post_url"],
                    "original_url": item["link"], "canonical_url": url, "source_title": plain(item["title"]),
                    "sha256": digest, "dhash": f"{dhash:016x}", "review": "venue-source-match; visual-review-pending"}
                used_urls.add(url)
                used_hashes.add(digest)
                used_visual.append(dhash)
            write_json(progress_path, records)
            print(f"Source photos {place}: {len(records)}/{plan['count']}", flush=True)
    missing = [course["id"] for course in plan["courses"] if course["id"] not in records and course["id"] not in permitted_missing]
    write_json(WORK / "report.json", {"requested": plan["count"], "collected": len(records), "missing": missing, "missing_by_user_request": list(permitted_missing)})
    review_catalog(plan, records)
    print(f"Source fill finished: {len(records)} collected, {len(missing)} missing", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "collect", "publish", "diagnose", "fill-sources", "merge-reviews"])
    parser.add_argument("--csv", type=Path)
    parser.add_argument("--count", type=int, default=1000)
    args = parser.parse_args()
    try:
        if args.command == "prepare":
            if not args.csv:
                parser.error("prepare requires --csv")
            prepare(args.csv, args.count)
        elif args.command == "collect":
            collect()
        elif args.command == "publish":
            publish()
        elif args.command == "fill-sources":
            fill_sources()
        elif args.command == "merge-reviews":
            merge_reviews()
        else:
            diagnose()
    except (SearchUnavailable, RuntimeError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
