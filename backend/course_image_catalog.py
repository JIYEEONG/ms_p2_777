"""Apply the completed NAVER photo catalog without mutating shared course data."""
from functools import lru_cache
import json
from pathlib import Path

CATALOG_PATH = Path(__file__).parent / "data/naver-course-images.json"


@lru_cache(maxsize=1)
def _read_catalog(path, modified):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = data["courses"]
    if len(rows) != data["count"] or len({row["id"] for row in rows}) != len(rows):
        raise ValueError("Incomplete NAVER course image catalog")
    photographed = [row for row in rows if row.get("image_url")]
    if len({row["sha256"] for row in photographed}) != len(photographed):
        raise ValueError("Duplicate NAVER course photographs")
    if any(not row["points"] or (row.get("image_url") and not row["image_url"].startswith("/assets/naver-courses/"))
           or (not row.get("image_url") and row.get("review") != "missing-by-user-request") for row in rows):
        raise ValueError("Invalid NAVER course image catalog")
    return {row["id"]: row for row in rows}


def apply_course_images(courses, path=None):
    path = Path(path or CATALOG_PATH)
    if not path.exists():
        return courses
    catalog = _read_catalog(str(path), path.stat().st_mtime_ns)
    result = []
    for course in courses:
        photo = catalog.get(course["id"])
        if photo is None:
            result.append(course)
            continue
        # Stable per-course photos also serve as the first stop's detail image.
        points = [{**point, "place_image_url": photo["image_url"] if index == 0 else None}
                  for index, point in enumerate(photo["points"])]
        result.append({**course, "title": photo["title"], "image_url": photo["image_url"],
                       "tags": photo.get("tags", course.get("tags", {})),
                       "duration_seconds": photo.get("duration_seconds", course.get("duration_seconds")),
                       "distance_m": photo.get("distance_m", course.get("distance_m")),
                       "points": points, "first_place_cover": True, "preserve_course_identity": True,
                       "image_source": {key: photo.get(key) for key in ("source", "first_place", "query", "search_url", "original_url", "original_post_url", "source_title", "review")}})
    return result
