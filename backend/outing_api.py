"""Outing event log — writes to moov.app_events (shared Azure Postgres).

Likes/unlikes and recommendation exposures are both just "events" tied to a
course, so they share one table instead of separate local-only ones.
"""

from __future__ import annotations

import json
import math
import mimetypes
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from dotenv import load_dotenv
from pydantic import BaseModel, Field

if __package__:
    from .db import get_conn, release_conn
    from .google_auth_api import require_auth_user
else:
    from db import get_conn, release_conn
    from google_auth_api import require_auth_user

router = APIRouter(prefix="/api/outing", tags=["outing"])

UPLOAD_DIR = Path(__file__).parent / "uploads"
load_dotenv(dotenv_path=Path(__file__).parent / ".env")
UPLOAD_DIR.mkdir(exist_ok=True)
AZURE_LLM_USAGE_PATH = Path(__file__).parent / ".moov-azure-openai-usage.json"
PIXABAY_CACHE_PATH = Path(__file__).parent / ".moov-pixabay-image-cache.json"


def _looks_like_storage_connection(value: str | None) -> bool:
    if not value:
        return False
    required = ("DefaultEndpointsProtocol=", "AccountName=", "AccountKey=", "EndpointSuffix=")
    return all(part in value for part in required)


def _storage_connection_string() -> str | None:
    current = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if _looks_like_storage_connection(current):
        return current
    env_path = Path(__file__).parent / ".env"
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if not line.startswith("AZURE_STORAGE_CONNECTION_STRING="):
                continue
            value = line.split("=", 1)[1].strip().strip('"').strip("'")
            if _looks_like_storage_connection(value):
                return value
    except OSError:
        return None
    return None


def _blob_container():
    from azure.storage.blob import BlobServiceClient

    conn_str = _storage_connection_string()
    if not conn_str:
        return None
    container_name = os.getenv("AZURE_STORAGE_CONTAINER", "course-images")
    try:
        client = BlobServiceClient.from_connection_string(conn_str)
        container = client.get_container_client(container_name)
        try:
            container.create_container()
        except Exception:
            pass
        return container
    except Exception:
        return None


class OutingEvent(BaseModel):
    event_id: str = Field(min_length=1, max_length=120)
    user_id: str = Field(min_length=1, max_length=64)
    session_id: str = Field(min_length=1, max_length=120)
    request_id: str | None = None
    event_type: str = Field(min_length=1, max_length=80)
    target_type: str = Field(min_length=1, max_length=80)
    target_id: str = Field(min_length=1, max_length=120)
    occurred_at: datetime
    rule_version: str = Field(min_length=1, max_length=80)
    test_mode: str = "free"
    details: dict[str, Any] = Field(default_factory=dict)


class RecommendationInput(BaseModel):
    user_id: str | None = Field(default=None, min_length=1, max_length=64)
    preference: dict[str, Any] = Field(default_factory=dict)
    user_lat: float | None = None
    user_lon: float | None = None
    limit: int = Field(default=3, ge=1, le=6)


class CourseImageInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    stops: list[str] = Field(default_factory=list, max_length=8)
    place_names_kr: list[str] = Field(default_factory=list, max_length=8)
    tags: dict[str, Any] = Field(default_factory=dict)
    exclude_original_urls: list[str] = Field(default_factory=list, max_length=80)
    exclude_page_urls: list[str] = Field(default_factory=list, max_length=80)


FLOW_ORDER = {
    "cafe": 10, "카페": 10,
    "exhibition": 20, "전시": 20, "museum": 20, "gallery": 20, "art": 20,
    "walk": 30, "산책": 30, "park": 30, "관광": 30,
    "food": 40, "restaurant": 40, "음식점": 40, "맛집": 40,
    "shopping": 50, "쇼핑": 50,
    "experience": 60, "체험": 60,
}


def _json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return None


def _flatten_strings(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, dict):
        out: list[str] = []
        for item in value.values():
            out.extend(_flatten_strings(item))
        return out
    if isinstance(value, (list, tuple, set)):
        out: list[str] = []
        for item in value:
            out.extend(_flatten_strings(item))
        return out
    return [str(value)]


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        clean = str(value).strip()
        if not clean:
            continue
        key = clean.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(clean)
    return result


def _course_title_from_place_names(place_names: list[str]) -> str:
    names = _dedupe([str(name).strip() for name in place_names if str(name or "").strip()])
    if not names:
        return "나들이 코스"
    if len(names) == 1:
        return f"{names[0]} 코스"[:200]
    if len(names) == 2:
        return f"{names[0]} → {names[1]} 코스"[:200]
    return f"{names[0]} → {names[1]} → {names[-1]} 코스"[:200]


def _resolved_course_title(title: str | None, points: dict[Any, dict[str, Any]]) -> str:
    names = [
        point.get("place_name_kr") or point.get("place_name")
        for point in sorted(points.values(), key=lambda p: p["sequence_no"])
    ]
    generated = _course_title_from_place_names(names)
    return generated if generated != "나들이 코스" else (title or generated)


def _normalize_profile(raw: dict[str, Any] | None, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    source = raw or fallback or {}
    categories = source.get("categories", [])
    if isinstance(categories, dict):
        categories = list(categories.keys())
    tags = []
    for key in ("activity", "activities", "category", "categories", "mood", "moods", "companion", "purpose", "time"):
        tags.extend(_flatten_strings(source.get(key)))
    tags.extend(_flatten_strings(source.get("subcategories")))
    return {
        "tags": _dedupe(tags),
        "preferred_regions": _dedupe(_flatten_strings(source.get("preferredRegions") or source.get("preferred_regions") or source.get("region"))),
        "excluded_regions": _dedupe(_flatten_strings(source.get("excludedRegions") or source.get("avoidedRegions") or source.get("excluded_regions"))),
        "excluded_tags": _dedupe(_flatten_strings(source.get("excludedTags") or source.get("excluded_tags") or source.get("avoid") or source.get("avoidances"))),
        "raw": source,
    }


def _load_user_preference(user_id: str, fallback: dict[str, Any]) -> dict[str, Any]:
    preference_queries = [
        ("moov.user_preference.profile_json", "SELECT profile_json FROM moov.user_preference WHERE user_id = %s"),
        ("user_preference.profile_json", "SELECT profile_json FROM user_preference WHERE user_id = %s"),
        ("moov.user_preference.preference_json", "SELECT preference_json FROM moov.user_preference WHERE user_id = %s"),
        ("user_preference.preference_json", "SELECT preference_json FROM user_preference WHERE user_id = %s"),
    ]
    survey_queries = [
        ("moov.user_survey.answers_json", "SELECT answers_json FROM moov.user_survey WHERE user_id = %s"),
        ("user_survey.answers_json", "SELECT answers_json FROM user_survey WHERE user_id = %s"),
        ("moov.user_survey.survey_json", "SELECT survey_json FROM moov.user_survey WHERE user_id = %s"),
        ("user_survey.survey_json", "SELECT survey_json FROM user_survey WHERE user_id = %s"),
    ]
    conn = get_conn()
    try:
        preference_raw = None
        survey_raw = None
        source_names: list[str] = []
        with conn.cursor() as cur:
            for source_name, query in preference_queries:
                try:
                    cur.execute(query, (user_id,))
                    row = cur.fetchone()
                    if row:
                        preference_raw = _json_value(row[0])
                        source_names.append(source_name)
                        break
                except Exception:
                    conn.rollback()
            for source_name, query in survey_queries:
                try:
                    cur.execute(query, (user_id,))
                    row = cur.fetchone()
                    if row:
                        survey_raw = _json_value(row[0])
                        source_names.append(source_name)
                        break
                except Exception:
                    conn.rollback()
        if preference_raw or survey_raw:
            combined: dict[str, Any] = {}
            if isinstance(survey_raw, dict):
                combined.update(survey_raw.get("answers", survey_raw))
                combined["survey"] = survey_raw
            if isinstance(preference_raw, dict):
                combined.update(preference_raw)
                combined["preference"] = preference_raw
            profile = _normalize_profile(combined, None)
            profile["source"] = "postgres"
            profile["source_tables"] = source_names
            return profile
        profile = _normalize_profile(None, fallback)
        profile["source"] = "request_fallback" if fallback else "empty"
        profile["source_tables"] = []
        return profile
    finally:
        release_conn(conn)


def _haversine_km(lat1: float | None, lon1: float | None, lat2: float | None, lon2: float | None) -> float | None:
    if None in (lat1, lon1, lat2, lon2):
        return None
    r = 6371.0088
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = math.radians(float(lat2) - float(lat1))
    dl = math.radians(float(lon2) - float(lon1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


def _load_candidate_places(profile: dict[str, Any], user_lat: float | None, user_lon: float | None) -> tuple[list[dict[str, Any]], list[str]]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    p.place_id,
                    p.place_name_kr,
                    p.latitude,
                    p.longitude,
                    p.open_time,
                    p.close_time,
                    pt.tag_type,
                    pt.tag_name
                FROM moov.places p
                LEFT JOIN moov.place_tags pt ON pt.place_id = p.place_id
                ORDER BY p.place_id
            """)
            rows = cur.fetchall()
    finally:
        release_conn(conn)

    by_place: dict[str, dict[str, Any]] = {}
    available_tags: set[str] = set()
    for place_id, name, lat, lon, open_time, close_time, tag_type, tag_name in rows:
        place = by_place.setdefault(str(place_id), {
            "place_id": str(place_id),
            "name": name or "이름 없는 장소",
            "address": "",
            "latitude": float(lat) if lat is not None else None,
            "longitude": float(lon) if lon is not None else None,
            "open_time": str(open_time) if open_time else None,
            "close_time": str(close_time) if close_time else None,
            "tags": {},
            "tag_names": [],
        })
        if tag_type and tag_name:
            key = str(tag_type).lower()
            value = str(tag_name)
            place["tags"].setdefault(key, set()).add(value)
            place["tag_names"].append(value)
            available_tags.add(value)

    preferred = {tag.casefold() for tag in profile["tags"]}
    activity_tag_weights = {
        str(tag).casefold(): float(weight or 0)
        for tag, weight in (profile.get("activity_weights", {}).get("tag_weights") or {}).items()
    }
    activity_type_weights = {
        str(tag_type).casefold(): float(weight or 0)
        for tag_type, weight in (profile.get("activity_weights", {}).get("tag_type_weights") or {}).items()
    }
    excluded = {tag.casefold() for tag in profile["excluded_tags"]}
    excluded_regions = profile["excluded_regions"]
    preferred_regions = profile["preferred_regions"]
    max_distance_km = float(os.getenv("MOOV_RECOMMEND_MAX_DISTANCE_KM", "25"))

    scored: list[dict[str, Any]] = []
    for place in by_place.values():
        haystack = " ".join([place["name"], place["address"], *place["tag_names"]]).casefold()
        if any(region.casefold() in haystack for region in excluded_regions):
            continue
        if any(tag.casefold() in haystack for tag in excluded):
            continue
        distance_km = _haversine_km(user_lat, user_lon, place["latitude"], place["longitude"])
        if distance_km is not None and distance_km > max_distance_km:
            continue
        matched_tags = [tag for tag in place["tag_names"] if tag.casefold() in preferred]
        region_match = [region for region in preferred_regions if region.casefold() in haystack]
        tag_score = len(set(matched_tags)) * 10
        activity_score = sum(activity_tag_weights.get(tag.casefold(), 0) for tag in place["tag_names"])
        activity_score += sum(activity_type_weights.get(str(tag_type).casefold(), 0) for tag_type in place["tags"].keys())
        region_score = 5 if region_match else 0
        distance_score = max(0, 8 - distance_km) if distance_km is not None else 0
        place["matched_tags"] = _dedupe(matched_tags)
        place["activity_weight_score"] = round(activity_score, 2)
        place["region_match"] = region_match
        place["distance_km"] = round(distance_km, 2) if distance_km is not None else None
        place["score"] = tag_score + activity_score + region_score + distance_score
        if place["score"] > 0 or not preferred:
            scored.append(place)

    scored.sort(key=lambda item: (-item["score"], item["distance_km"] if item["distance_km"] is not None else 999, item["name"]))
    return scored[:30], sorted(available_tags)


def _category_order(place: dict[str, Any]) -> int:
    values = [*place.get("tag_names", []), *place.get("tags", {}).get("category", [])]
    text = " ".join(values).casefold()
    for key, order in FLOW_ORDER.items():
        if key.casefold() in text:
            return order
    return 35


def _rule_based_route(profile: dict[str, Any], candidates: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    used_categories: set[int] = set()
    for place in sorted(candidates, key=lambda item: (_category_order(item), -item["score"])):
        order = _category_order(place)
        if order in used_categories and len(selected) < 3:
            continue
        selected.append(place)
        used_categories.add(order)
        if len(selected) >= min(4, max(2, len(candidates))):
            break
    if len(selected) < min(4, len(candidates)):
        for place in candidates:
            if place not in selected:
                selected.append(place)
            if len(selected) >= 4:
                break
    return selected[:limit + 1]


def _ollama_json(prompt: str, timeout: float = 3.5) -> dict[str, Any] | None:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.2},
    }).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
            return json.loads(data.get("response") or "{}")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def _pixabay_cache() -> dict[str, Any]:
    if not PIXABAY_CACHE_PATH.is_file():
        return {}
    try:
        return json.loads(PIXABAY_CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _write_pixabay_cache(cache: dict[str, Any]) -> None:
    try:
        PIXABAY_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def _pixabay_category(terms: list[str]) -> str:
    source = " ".join(terms).casefold()
    if any(word in source for word in ("cafe", "coffee", "restaurant", "food", "dining", "맛집", "카페", "음식")):
        return "food"
    if any(word in source for word in ("museum", "gallery", "exhibition", "art", "전시", "미술", "공연")):
        return "buildings"
    if any(word in source for word in ("park", "forest", "river", "walk", "nature", "공원", "산책", "숲", "강")):
        return "nature"
    return "travel"


def _pixabay_queries(payload: CourseImageInput) -> list[str]:
    tag_terms = _flatten_strings(payload.tags)
    db_place_names = _dedupe(payload.place_names_kr)
    display_stops = _dedupe(payload.stops)
    stop_terms = db_place_names or display_stops
    terms = _dedupe([*db_place_names, payload.title, *display_stops, *tag_terms])
    queries: list[str] = []
    # Course images should be anchored to the actual places first.
    # The title is only a fallback/context term because it may be synthetic.
    queries.extend(db_place_names)
    queries.extend(display_stops)
    if len(stop_terms) >= 2:
        queries.extend([f"{stop_terms[0]} {stop_terms[-1]}", f"{stop_terms[0]} {stop_terms[1]}"])
    for stop in stop_terms[:3]:
        queries.append(f"{stop} Seoul")
        queries.append(f"{stop} Korea")
    if payload.title and stop_terms:
        queries.extend([f"{stop} {payload.title}" for stop in stop_terms[:2]])
    if payload.title:
        queries.append(payload.title)
    source = " ".join([payload.title, *db_place_names, *display_stops, *tag_terms])
    alias_queries = [
        (("카페", "커피", "cafe", "coffee"), ["Seoul cafe", "Korea cafe", "coffee shop"]),
        (("음식점", "맛집", "식당", "food", "restaurant"), ["Seoul restaurant", "Korean food", "restaurant interior"]),
        (("전시", "미술", "박물관", "gallery", "museum", "exhibition"), ["museum exhibition", "art gallery", "Seoul museum"]),
        (("관광", "산책", "공원", "travel", "tourism", "park"), ["Seoul travel", "Korea travel", "city park"]),
        (("쇼핑", "시장", "거리", "shopping", "market"), ["Seoul shopping street", "Korea market", "shopping street"]),
        (("체험", "공방", "workshop", "experience"), ["craft workshop", "Korea workshop", "hands craft"]),
    ]
    for needles, aliases in alias_queries:
        if any(needle in source for needle in needles):
            queries.extend(aliases)
    for term in terms:
        clean = " ".join(str(term).replace("|", " ").split())
        if len(clean) < 2:
            continue
        queries.append(clean[:100])
    return _dedupe(queries)[:12]


def _pixabay_specific_terms(payload: CourseImageInput) -> list[str]:
    generic = {
        "course", "trip", "travel", "city", "street", "place", "walk", "walking",
        "cafe", "coffee", "food", "restaurant", "tour", "tourism", "photo",
        "코스", "추천", "나들이", "카페", "관광", "장소", "거리", "산책", "맛집",
    }
    values = [*payload.place_names_kr, payload.title, *payload.stops]
    terms: list[str] = []
    for value in values:
        for token in str(value).replace("|", " ").replace("-", " ").split():
            clean = token.strip(" ,./()[]{}").casefold()
            if len(clean) < 2 or clean in generic:
                continue
            terms.append(clean)
    return _dedupe(terms)


def _pixabay_score(hit: dict[str, Any], query: str, payload: CourseImageInput) -> float:
    haystack = " ".join([
        str(hit.get("tags") or ""),
        str(hit.get("pageURL") or ""),
        str(hit.get("user") or ""),
    ]).casefold()
    terms = _dedupe([query, payload.title, *payload.stops, *_flatten_strings(payload.tags)])
    specific_terms = _pixabay_specific_terms(payload)
    score = 0.0
    query_clean = query.casefold().strip()
    if query_clean and query_clean in haystack:
        score += 8
    for term in terms:
        clean = str(term).casefold().strip()
        if len(clean) < 2:
            continue
        if clean in haystack:
            score += 3 if clean == query_clean else 1
    specific_hits = 0
    for term in specific_terms:
        if term in haystack:
            specific_hits += 1
            score += 6
    if specific_terms and specific_hits == 0:
        score -= 7
    if any(word in haystack for word in ("logo", "icon", "background", "texture", "pattern")):
        score -= 6
    score += min(float(hit.get("likes") or 0), 100.0) / 100.0
    score += min(float(hit.get("views") or 0), 10000.0) / 10000.0
    return score


def _store_remote_course_image(image_url: str, source: str) -> str | None:
    if not image_url:
        return None
    container = _blob_container()
    if container is None:
        return None
    max_bytes = int(os.getenv("MOOV_COURSE_IMAGE_MAX_BYTES", str(6 * 1024 * 1024)))
    request = urllib.request.Request(image_url, headers={"User-Agent": "MOOV/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=6) as response:
            content_type = response.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
            if not content_type.startswith("image/"):
                return None
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                return None
    except (urllib.error.URLError, TimeoutError, OSError):
        return None

    ext = mimetypes.guess_extension(content_type) or Path(urllib.parse.urlparse(image_url).path).suffix or ".jpg"
    if ext == ".jpe":
        ext = ".jpg"
    blob_name = f"external/{source.lower()}-{uuid4().hex}{ext}"
    try:
        from azure.storage.blob import ContentSettings

        container.upload_blob(
            name=blob_name,
            data=body,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
    except Exception:
        return None
    return f"{container.url}/{blob_name}"


def _fetch_pixabay_image(payload: CourseImageInput) -> dict[str, Any] | None:
    api_key = (os.getenv("PIXABAY_API_KEY") or "").strip()
    if not api_key:
        return None
    queries = _pixabay_queries(payload)
    if not queries:
        return None
    cache = _pixabay_cache()
    excluded_originals = {url for url in payload.exclude_original_urls if url}
    excluded_pages = {url for url in payload.exclude_page_urls if url}
    excluded_urls = excluded_originals | excluded_pages
    cache_key = json.dumps({
        "queries": queries,
        "tags": payload.tags,
        "exclude_original_urls": sorted(excluded_originals),
        "exclude_page_urls": sorted(excluded_pages),
        "version": 2,
    }, ensure_ascii=False, sort_keys=True)
    cached = cache.get(cache_key)
    now = datetime.now(timezone.utc)
    if cached:
        try:
            cached_at = datetime.fromisoformat(cached.get("cached_at", ""))
            if now - cached_at < timedelta(hours=24):
                result = cached.get("result")
                if result and result.get("storage") != "azure-blob":
                    blob_url = _store_remote_course_image(result.get("original_url") or result.get("url"), "pixabay")
                    if blob_url:
                        result = {**result, "url": blob_url, "storage": "azure-blob"}
                        cache[cache_key] = {"cached_at": now.isoformat(), "result": result}
                        _write_pixabay_cache(cache)
                return result
        except (TypeError, ValueError):
            pass

    category = _pixabay_category(queries + _flatten_strings(payload.tags))
    best: dict[str, Any] | None = None
    best_score = -1.0
    for query in queries:
        params = urllib.parse.urlencode({
            "key": api_key,
            "q": query,
            "lang": "ko",
            "image_type": "photo",
            "orientation": "horizontal",
            "category": category,
            "safesearch": "true",
            "order": "popular",
            "min_width": 640,
            "per_page": 30,
        })
        request = urllib.request.Request(f"https://pixabay.com/api/?{params}", headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=3.5) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
            continue
        for hit in data.get("hits") or []:
            url = hit.get("largeImageURL") or hit.get("webformatURL") or hit.get("previewURL")
            if not url:
                continue
            page_url = hit.get("pageURL") or "https://pixabay.com/"
            if url in excluded_urls or page_url in excluded_urls:
                continue
            score = _pixabay_score(hit, query, payload)
            if score > best_score:
                best_score = score
                best = {
                    "url": url,
                    "original_url": url,
                    "source": "Pixabay",
                    "storage": "remote",
                    "page_url": page_url,
                    "tags": hit.get("tags") or "",
                    "query": query,
                    "match_score": round(score, 2),
                }

    min_score = float(os.getenv("MOOV_PIXABAY_MIN_MATCH_SCORE", "3"))
    if best and best_score < min_score:
        best = None

    if best:
        blob_url = _store_remote_course_image(best["original_url"], "pixabay")
        if blob_url:
            best = {**best, "url": blob_url, "storage": "azure-blob"}
        elif os.getenv("MOOV_PIXABAY_REQUIRE_BLOB", "true").lower() == "true":
            best = None

    cache[cache_key] = {"cached_at": now.isoformat(), "result": best}
    _write_pixabay_cache(cache)
    return best


def _estimate_tokens(text: str) -> int:
    # Conservative enough for Korean mixed text without adding a tokenizer dependency.
    return max(1, math.ceil(len(text) / 2))


def _azure_price_krw(input_tokens: int, output_tokens: int) -> float:
    usd_krw = float(os.getenv("MOOV_USD_KRW", "1400"))
    input_per_m = float(os.getenv("MOOV_AZURE_GPT41_MINI_INPUT_USD_PER_M", "0.40"))
    output_per_m = float(os.getenv("MOOV_AZURE_GPT41_MINI_OUTPUT_USD_PER_M", "1.60"))
    return ((input_tokens / 1_000_000) * input_per_m + (output_tokens / 1_000_000) * output_per_m) * usd_krw


def _azure_budget_limit_krw() -> float:
    return float(os.getenv("MOOV_AZURE_LLM_BUDGET_KRW", "1000"))


def _azure_usage_state() -> dict[str, Any]:
    if not AZURE_LLM_USAGE_PATH.is_file():
        return {"total_krw": 0.0, "calls": []}
    try:
        state = json.loads(AZURE_LLM_USAGE_PATH.read_text(encoding="utf-8"))
        return {"total_krw": float(state.get("total_krw") or 0), "calls": state.get("calls") or []}
    except (OSError, ValueError, TypeError):
        return {"total_krw": 0.0, "calls": []}


def _write_azure_usage_state(state: dict[str, Any]) -> None:
    try:
        AZURE_LLM_USAGE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def _azure_budget_allows(estimated_input_tokens: int, max_output_tokens: int) -> bool:
    state = _azure_usage_state()
    projected = _azure_price_krw(estimated_input_tokens, max_output_tokens)
    return state["total_krw"] + projected <= _azure_budget_limit_krw()


def _record_azure_usage(prompt_tokens: int, completion_tokens: int, deployment: str) -> None:
    cost = _azure_price_krw(prompt_tokens, completion_tokens)
    state = _azure_usage_state()
    state["total_krw"] = round(float(state["total_krw"]) + cost, 6)
    state["calls"] = (state.get("calls") or [])[-99:] + [{
        "at": datetime.now(timezone.utc).isoformat(),
        "deployment": deployment,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "estimated_krw": round(cost, 6),
    }]
    _write_azure_usage_state(state)


def _azure_openai_json(prompt: str, system_content: str | None = None, max_tokens_override: int | None = None) -> dict[str, Any] | None:
    endpoint = (os.getenv("AZURE_OPENAI_ENDPOINT") or os.getenv("AZURE_FOUNDRY_ENDPOINT") or "").strip()
    api_key = (os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_FOUNDRY_API_KEY") or "").strip()
    deployment = (
        os.getenv("AZURE_OPENAI_RECOMMENDATION_DEPLOYMENT_NAME")
        or os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
        or ""
    ).strip()
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview").strip()
    if not endpoint or not api_key or not deployment:
        return None
    max_tokens = max_tokens_override or int(os.getenv("MOOV_AZURE_RECOMMENDATION_MAX_TOKENS", "700"))
    estimated_input = _estimate_tokens(prompt) + 80
    if not _azure_budget_allows(estimated_input, max_tokens):
        return None
    try:
        from openai import AzureOpenAI

        client = AzureOpenAI(azure_endpoint=endpoint, api_key=api_key, api_version=api_version)
        response = client.chat.completions.create(
            model=deployment,
            messages=[
                {
                    "role": "system",
                    "content": system_content or (
                        "You are a Korean travel course recommender. "
                        "Return JSON only. Use only given place_id values."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=max_tokens,
        )
        usage = getattr(response, "usage", None)
        if usage:
            _record_azure_usage(
                int(getattr(usage, "prompt_tokens", 0) or 0),
                int(getattr(usage, "completion_tokens", 0) or 0),
                deployment,
            )
        content = response.choices[0].message.content if response.choices else ""
        return json.loads(content or "{}")
    except Exception:
        return None


def _week_start_utc(now: datetime | None = None) -> datetime:
    current = now or datetime.now(timezone.utc)
    current = current.astimezone(timezone.utc)
    start = current - timedelta(days=current.weekday())
    return start.replace(hour=0, minute=0, second=0, microsecond=0)


def _ensure_weekly_activity_table(conn) -> bool:
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS moov.user_activity_preference_weekly (
                    user_id TEXT NOT NULL,
                    week_start DATE NOT NULL,
                    weights_json JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    PRIMARY KEY (user_id, week_start)
                )
            """)
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False


def _activity_event_weight(event_type: str) -> float:
    return {
        "course_select": 1.0,
        "course_like": 3.0,
        "course_unlike": -2.0,
        "course_save": 4.0,
        "course_unsave": -3.0,
        "follow_intent": 2.0,
        "follow_route_applied": 5.0,
        "course_publish": 5.0,
    }.get(event_type, 0.0)


def _rule_weekly_activity_weights(activity_signals: list[dict[str, Any]], week_start: datetime) -> dict[str, Any]:
    tag_weights: dict[str, float] = {}
    tag_type_weights: dict[str, float] = {}
    event_count = 0
    for signal in activity_signals:
        weight = float(signal.get("weight") or 0)
        if weight == 0:
            continue
        event_count += int(signal.get("count") or 1)
        tag = str(signal.get("tag_name") or "").strip()
        tag_type = str(signal.get("tag_type") or "").strip().lower()
        if tag:
            tag_weights[tag] = tag_weights.get(tag, 0.0) + weight
        if tag_type:
            tag_type_weights[tag_type] = tag_type_weights.get(tag_type, 0.0) + weight
    return {
        "source": "rule",
        "week_start": week_start.date().isoformat(),
        "tag_weights": {k: round(max(0.0, v), 2) for k, v in sorted(tag_weights.items(), key=lambda item: -item[1]) if v > 0},
        "tag_type_weights": {k: round(max(0.0, v), 2) for k, v in sorted(tag_type_weights.items(), key=lambda item: -item[1]) if v > 0},
        "event_count": event_count,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _azure_weekly_activity_weights(profile: dict[str, Any], activity_signals: list[dict[str, Any]], week_start: datetime) -> dict[str, Any] | None:
    if not activity_signals:
        return None
    prompt = f"""
Create weekly recommendation weights for one MOOV user.
Use user_profile and weekly_activity_signals. Activity signals come from app_events joined to place_tags.
Return JSON only with keys: tag_weights, tag_type_weights, activity_summary.
tag_weights must be an object of tag name to numeric weight from 0 to 10.
tag_type_weights must be an object of tag_type to numeric weight from 0 to 10.
activity_summary must be a short Korean array explaining what changed this week.
Do not invent tags that are not present in weekly_activity_signals.

week_start={week_start.date().isoformat()}
user_profile={json.dumps(profile, ensure_ascii=False)}
weekly_activity_signals={json.dumps(activity_signals[:120], ensure_ascii=False)}
"""
    result = _azure_openai_json(prompt)
    if not result:
        return None
    tag_weights = result.get("tag_weights") if isinstance(result.get("tag_weights"), dict) else {}
    tag_type_weights = result.get("tag_type_weights") if isinstance(result.get("tag_type_weights"), dict) else {}
    return {
        "source": "azure-openai",
        "week_start": week_start.date().isoformat(),
        "tag_weights": {str(k): max(0.0, min(10.0, float(v or 0))) for k, v in tag_weights.items()},
        "tag_type_weights": {str(k): max(0.0, min(10.0, float(v or 0))) for k, v in tag_type_weights.items()},
        "activity_summary": _flatten_strings(result.get("activity_summary"))[:5],
        "event_count": sum(int(item.get("count") or 1) for item in activity_signals),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _load_activity_signals(conn, user_id: str, since: datetime) -> list[dict[str, Any]]:
    try:
        with conn.cursor() as cur:
            cur.execute("""
                WITH events AS (
                    SELECT event_type, aggregate_id, COUNT(*) AS event_count
                    FROM moov.app_events
                    WHERE user_id = %s
                      AND aggregate_type = 'course'
                      AND occurred_at >= %s
                      AND event_type IN (
                          'course_select', 'course_like', 'course_unlike',
                          'course_save', 'course_unsave', 'follow_intent',
                          'follow_route_applied', 'course_publish'
                      )
                    GROUP BY event_type, aggregate_id
                )
                SELECT e.event_type, e.aggregate_id, e.event_count, pt.tag_type, pt.tag_name
                FROM events e
                LEFT JOIN moov.course_points cp ON cp.course_id = e.aggregate_id
                LEFT JOIN LATERAL (
                    SELECT p.place_id,
                        6371 * acos(
                            cos(radians(cp.latitude)) * cos(radians(p.latitude)) *
                            cos(radians(p.longitude) - radians(cp.longitude)) +
                            sin(radians(cp.latitude)) * sin(radians(p.latitude))
                        ) AS distance_km
                    FROM moov.places p
                    WHERE cp.latitude IS NOT NULL AND cp.longitude IS NOT NULL
                    ORDER BY distance_km ASC
                    LIMIT 1
                ) nearest ON nearest.distance_km < 0.5
                LEFT JOIN moov.place_tags pt ON pt.place_id = nearest.place_id
            """, (user_id, since))
            rows = cur.fetchall()
    except Exception:
        conn.rollback()
        return []

    signals = []
    for event_type, course_id, count, tag_type, tag_name in rows:
        base_weight = _activity_event_weight(event_type)
        if base_weight == 0:
            continue
        signals.append({
            "event_type": event_type,
            "course_id": str(course_id),
            "count": int(count or 1),
            "tag_type": tag_type,
            "tag_name": tag_name,
            "weight": round(base_weight * int(count or 1), 2),
        })
    return signals


def _load_weekly_activity_weights(user_id: str, profile: dict[str, Any]) -> dict[str, Any]:
    week_start = _week_start_utc()
    conn = get_conn()
    try:
        table_ready = _ensure_weekly_activity_table(conn)
        if table_ready:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT weights_json
                    FROM moov.user_activity_preference_weekly
                    WHERE user_id = %s AND week_start = %s
                """, (user_id, week_start.date()))
                row = cur.fetchone()
                if row:
                    cached = _json_value(row[0])
                    if isinstance(cached, dict):
                        cached["cache"] = "hit"
                        return cached

        signals = _load_activity_signals(conn, user_id, week_start)
        weights = _azure_weekly_activity_weights(profile, signals, week_start) or _rule_weekly_activity_weights(signals, week_start)
        weights["cache"] = "miss"
        if table_ready:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO moov.user_activity_preference_weekly (user_id, week_start, weights_json, updated_at)
                    VALUES (%s, %s, %s::jsonb, now())
                    ON CONFLICT (user_id, week_start)
                    DO UPDATE SET weights_json = EXCLUDED.weights_json, updated_at = now()
                """, (user_id, week_start.date(), json.dumps(weights, ensure_ascii=False)))
            conn.commit()
        return weights
    finally:
        release_conn(conn)


def _llm_route(profile: dict[str, Any], candidates: list[dict[str, Any]], available_tags: list[str], limit: int) -> dict[str, Any] | None:
    compact_places = [{
        "place_id": p["place_id"],
        "name": p["name"],
        "address": p["address"],
        "tags": p["tag_names"][:10],
        "matched_tags": p["matched_tags"],
        "activity_weight_score": p.get("activity_weight_score", 0),
        "distance_km": p["distance_km"],
        "score": round(p["score"], 2),
    } for p in candidates[:20]]
    prompt = f"""
Score candidate_places for this specific user, then choose 3-4 places.
Do not use a fixed global flow. Create a personalized flow_order from user_preference, tags, matched_tags, distance_km, and available categories.
Use only given place_id values.
Calculate match_score from 0 to 100 for each useful candidate. The score must reflect user_preference versus place tags, weekly activity_weights, exclusions, distance, and how well the place fits the personalized flow.
Return JSON only with keys: title, summary, flow_order, scored_places, place_ids, reasons.
flow_order must be an array of Korean category/tag names in the chosen visit order.
scored_places must be an array of objects: place_id, match_score, matched_tags, reason.
reasons must be an object keyed by place_id in Korean.

user_preference={json.dumps(profile, ensure_ascii=False)}
available_tags={json.dumps(available_tags[:120], ensure_ascii=False)}
candidate_places={json.dumps(compact_places, ensure_ascii=False)}
max_places={limit + 1}
"""
    provider = "azure-openai"
    result = _azure_openai_json(prompt)
    if not result:
        provider = "ollama"
        result = _ollama_json(prompt)
    if not result or not isinstance(result.get("place_ids"), list):
        return None
    allowed = {p["place_id"] for p in candidates}
    place_ids = [str(pid) for pid in result["place_ids"] if str(pid) in allowed]
    if len(place_ids) < 2:
        return None
    scored_places = []
    if isinstance(result.get("scored_places"), list):
        for item in result["scored_places"]:
            if not isinstance(item, dict):
                continue
            place_id = str(item.get("place_id") or "")
            if place_id not in allowed:
                continue
            try:
                match_score = max(0.0, min(100.0, float(item.get("match_score") or 0)))
            except (TypeError, ValueError):
                match_score = 0.0
            scored_places.append({
                "place_id": place_id,
                "match_score": match_score,
                "matched_tags": _dedupe(_flatten_strings(item.get("matched_tags"))),
                "reason": str(item.get("reason") or "")[:300],
            })
    return {
        "title": str(result.get("title") or "내 취향을 반영한 코스")[:120],
        "summary": str(result.get("summary") or "설문 취향과 장소 태그를 바탕으로 구성한 코스입니다.")[:300],
        "flow_order": result.get("flow_order") if isinstance(result.get("flow_order"), list) else [],
        "place_ids": place_ids[:limit + 1],
        "scored_places": scored_places,
        "reasons": result.get("reasons") if isinstance(result.get("reasons"), dict) else {},
        "provider": provider,
    }


def _build_recommended_course(profile: dict[str, Any], candidates: list[dict[str, Any]], available_tags: list[str], limit: int) -> dict[str, Any]:
    llm = _llm_route(profile, candidates, available_tags, limit)
    selected = []
    reasons = {}
    if llm:
        by_id = {place["place_id"]: place for place in candidates}
        for scored in llm.get("scored_places", []):
            place = by_id.get(scored["place_id"])
            if not place:
                continue
            place["llm_match_score"] = scored["match_score"]
            if scored["matched_tags"]:
                place["matched_tags"] = scored["matched_tags"]
            if scored["reason"]:
                reasons[scored["place_id"]] = scored["reason"]
        selected = [by_id[place_id] for place_id in llm["place_ids"] if place_id in by_id]
        title = llm["title"]
        summary = llm["summary"]
        reasons = {**llm["reasons"], **reasons}
        provider = llm.get("provider", "llm")
        flow_order = [str(item) for item in llm.get("flow_order", []) if str(item).strip()]
    else:
        selected = _rule_based_route(profile, candidates, limit)
        first_tag = profile["tags"][0] if profile["tags"] else "오늘의 취향"
        title = f"{first_tag} 맞춤 코스"
        summary = "설문 취향과 place_tags 매칭 점수를 기준으로 가까운 장소를 자연스러운 순서로 묶었어요."
        provider = "rule"
        flow_order = []
    tags_by_type: dict[str, set[str]] = {"category": set(), "purpose": set(), "mood": set(), "companion": set(), "time": set()}
    matched_tag_values: set[str] = set()
    match_score = 0.0
    points = []
    for index, place in enumerate(selected):
        for key, values in place["tags"].items():
            if key in tags_by_type:
                tags_by_type[key].update(values)
        matched_tag_values.update(place["matched_tags"])
        match_score += float(place.get("llm_match_score") if place.get("llm_match_score") is not None else place.get("score") or 0)
        reason = reasons.get(place["place_id"]) or ", ".join(place["matched_tags"][:3]) or "취향 태그와 위치 조건을 기준으로 선택했어요."
        points.append({
            "sequence_no": index,
            "latitude": place["latitude"],
            "longitude": place["longitude"],
            "place_name_kr": place["name"],
            "place_name": place["name"],
            "open_time": place["open_time"],
            "close_time": place["close_time"],
            "reason": reason,
            "matched_tags": place["matched_tags"],
            "match_score": round(float(place.get("llm_match_score") if place.get("llm_match_score") is not None else place.get("score") or 0), 2),
        })
    distance_values = [p["distance_km"] for p in selected if p["distance_km"] is not None]
    now = datetime.now(timezone.utc)
    return {
        "id": f"pref-{uuid4().hex}",
        "title": title,
        "image_url": None,
        "created_at": now.isoformat(),
        "duration_seconds": max(1, len(points)) * 3600,
        "distance_m": round(max(distance_values) * 1000) if distance_values else None,
        "points": points,
        "tags": {key: sorted(values) for key, values in tags_by_type.items()},
        "recommend": summary,
        "provider": provider,
        "match_basis": {
            "source": "place_tags",
            "matched_tags": sorted(matched_tag_values),
            "score": round(match_score, 2),
            "scoring_provider": provider,
            "flow_order": flow_order,
        },
    }


@router.post("/events")
def record_event(event: OutingEvent, user: dict = Depends(require_auth_user)):
    if event.user_id != user['id']:
        raise HTTPException(403, 'The event must belong to the signed-in account.')
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO moov.app_events
                    (event_id, user_id, event_type, occurred_at, aggregate_type, aggregate_id, idempotency_key, attributes_json, is_synthetic)
                SELECT %s, %s, %s, %s, %s, %s, %s, %s, false
                WHERE NOT EXISTS (SELECT 1 FROM moov.app_events WHERE idempotency_key = %s)
            """, (
                event.event_id, user['id'], event.event_type, event.occurred_at,
                event.target_type, event.target_id, event.event_id,
                json.dumps({
                    "session_id": event.session_id,
                    "request_id": event.request_id,
                    "rule_version": event.rule_version,
                    "test_mode": event.test_mode,
                    **event.details,
                }, ensure_ascii=False),
                event.event_id,
            ))
        conn.commit()
    finally:
        release_conn(conn)
    return {"ok": True, "event_id": event.event_id}


@router.get("/popularity")
def outing_popularity():
    """Count courses whose latest like/unlike action in the last 7 days is 'like'."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT ON (user_id, aggregate_id) aggregate_id, event_type
                FROM moov.app_events
                WHERE aggregate_type = 'course'
                  AND event_type IN ('course_like', 'course_unlike')
                  AND occurred_at >= now() - interval '7 days'
                ORDER BY user_id, aggregate_id, occurred_at DESC
            """)
            rows = cur.fetchall()
    finally:
        release_conn(conn)
    counts: dict[str, int] = {}
    for aggregate_id, event_type in rows:
        if event_type == "course_like":
            counts[aggregate_id] = counts.get(aggregate_id, 0) + 1
    return {"counts": counts, "window_days": 7, "aggregated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/health")
def outing_health():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
    finally:
        release_conn(conn)
    return {"ok": True, "storage": "moov-postgres"}


@router.post("/course-image")
def course_image(payload: CourseImageInput):
    image = _fetch_pixabay_image(payload)
    if not image:
        return {"image": None, "provider": "pixabay", "message": "No matching Pixabay image was found or PIXABAY_API_KEY is not configured."}
    return {"image": image, "provider": "pixabay"}


@router.post("/recommendations")
def outing_recommendations(payload: RecommendationInput, user: dict = Depends(require_auth_user)):
    if payload.user_id and payload.user_id != user["id"]:
        raise HTTPException(403, "The recommendation must belong to the signed-in account.")
    profile = _load_user_preference(user["id"], payload.preference)
    profile["activity_weights"] = _load_weekly_activity_weights(user["id"], profile)
    candidates, available_tags = _load_candidate_places(profile, payload.user_lat, payload.user_lon)
    if not candidates:
        return {
            "request_id": f"rec-{uuid4().hex}",
            "courses": [],
            "profile": profile,
            "available_tags": available_tags,
            "provider": "empty",
            "message": "No matching places were found in places/place_tags.",
        }
    course = _build_recommended_course(profile, candidates, available_tags, payload.limit)
    return {
        "request_id": f"rec-{uuid4().hex}",
        "courses": [course],
        "profile": profile,
        "available_tags": available_tags,
        "provider": course.get("provider", "rule"),
    }


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(require_auth_user)):
    container = _blob_container()
    if container is None:
        raise HTTPException(503, "Azure Blob Storage is not configured.")
    ext = Path(file.filename or "").suffix or ".jpg"
    blob_name = f"uploads/{uuid4().hex}{ext}"
    container.upload_blob(name=blob_name, data=await file.read(), overwrite=True)
    return {"url": f"{container.url}/{blob_name}"}


class CourseStopInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    category: str | None = Field(default=None, max_length=80)


class CourseRegisterInput(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    image_url: str | None = None
    stops: list[CourseStopInput] = Field(min_length=1)


class CourseTitleSuggestionInput(BaseModel):
    stops: list[CourseStopInput] = Field(min_length=1, max_length=8)
    current_title: str | None = Field(default=None, max_length=200)
    limit: int = Field(default=3, ge=1, le=5)


def _fallback_course_title_suggestions(place_names: list[str], limit: int) -> list[str]:
    base = _course_title_from_place_names(place_names)
    names = _dedupe(place_names)
    suggestions = [base]
    if len(names) >= 2:
        suggestions.append(f"{names[0]}에서 {names[-1]}까지 나들이")
    if names:
        suggestions.append(f"{names[0]} 중심 코스")
    return _dedupe(suggestions)[:limit]


def _llm_course_title_suggestions(place_names: list[str], current_title: str | None, limit: int) -> tuple[list[str], str]:
    names = _dedupe(place_names)
    fallback = _fallback_course_title_suggestions(names, limit)
    if not names:
        return fallback, "fallback"
    prompt = f"""
Generate concise Korean course title candidates for a MOOV outing course.
Use only these course places and do not invent new places.
Return JSON only with key "titles" as an array of {limit} strings.
Each title must be 12 to 34 Korean characters when possible, natural for a travel course, and must not include emoji.

current_title={current_title or ""}
places={json.dumps(names, ensure_ascii=False)}
"""
    estimated_input = _estimate_tokens(prompt) + 80
    max_tokens = 260
    title_budget = float(os.getenv("MOOV_AZURE_TITLE_BUDGET_KRW", "100"))
    if _azure_usage_state()["total_krw"] + _azure_price_krw(estimated_input, max_tokens) > title_budget:
        return fallback, "budget-fallback"
    result = _azure_openai_json(
        prompt,
        system_content="You write short Korean travel course names. Return JSON only.",
        max_tokens_override=max_tokens,
    )
    titles = _dedupe(_flatten_strings(result.get("titles") if isinstance(result, dict) else [])) if result else []
    valid = [title[:80] for title in titles if title and len(title.strip()) >= 2]
    return (valid or fallback)[:limit], "azure-openai" if valid else "fallback"


@router.post("/course-title-suggestions")
def course_title_suggestions(payload: CourseTitleSuggestionInput, user: dict = Depends(require_auth_user)):
    names = [stop.name for stop in payload.stops if stop.name.strip()]
    titles, provider = _llm_course_title_suggestions(names, payload.current_title, payload.limit)
    return {"titles": titles, "provider": provider}


@router.get("/places")
def outing_places():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    p.place_id,
                    p.place_name_kr,
                    p.category,
                    p.sub_category,
                    p.latitude,
                    p.longitude,
                    p.image_url,
                    COALESCE(array_remove(array_agg(DISTINCT pt.tag_name), NULL), ARRAY[]::text[]) AS tags
                FROM moov.places p
                LEFT JOIN moov.place_tags pt ON pt.place_id = p.place_id
                WHERE COALESCE(p.active, true) IS TRUE
                  AND p.place_name_kr IS NOT NULL
                  AND trim(p.place_name_kr) <> ''
                GROUP BY p.place_id, p.place_name_kr, p.category, p.sub_category, p.latitude, p.longitude, p.image_url
                ORDER BY p.place_name_kr
            """)
            rows = cur.fetchall()
    finally:
        release_conn(conn)
    return {
        "places": [
            {
                "place_id": place_id,
                "place_name_kr": name,
                "category": category,
                "sub_category": sub_category,
                "latitude": lat,
                "longitude": lon,
                "image_url": image_url,
                "tags": tags or [],
            }
            for place_id, name, category, sub_category, lat, lon, image_url, tags in rows
        ]
    }


@router.post("/courses")
def register_course(payload: CourseRegisterInput, user: dict = Depends(require_auth_user)):
    if payload.user_id != user['id']:
        raise HTTPException(403, 'The course must belong to the signed-in account.')
    course_id = f"user-{uuid4().hex}"
    title = payload.title.strip() or _course_title_from_place_names([stop.name for stop in payload.stops])
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO moov.courses (course_id, user_id, title, image_url, visibility, is_synthetic, created_at)
                VALUES (%s, %s, %s, %s, 'public', false, now())
            """, (course_id, user['id'], title, payload.image_url))
            for i, stop in enumerate(payload.stops):
                cur.execute("""
                    INSERT INTO moov.course_points
                        (course_id, sequence_no, place_name_kr, latitude, longitude, category, point_type, is_synthetic)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, false)
                """, (course_id, i, stop.name, stop.latitude, stop.longitude, stop.category, "목적지" if i == len(payload.stops) - 1 else "경유지"))
        conn.commit()
    finally:
        release_conn(conn)
    return {"ok": True, "course_id": course_id}


@router.get("/courses")
def get_courses():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    c.course_id,
                    c.title,
                    c.image_url,
                    c.created_at,
                    c.duration_seconds,
                    c.distance_m,
                    cp.sequence_no,
                    cp.place_name_kr AS course_point_place_name_kr,
                    cp.latitude,
                    cp.longitude,
                    nearest.place_id,
                    nearest.place_name_kr,
                    nearest.category,
                    nearest.sub_category,
                    nearest.image_url AS place_image_url,
                    nearest.open_time,
                    nearest.close_time,
                    pt.tag_type,
                    pt.tag_name
                FROM moov.courses c
                JOIN moov.course_points cp ON cp.course_id = c.course_id
                LEFT JOIN LATERAL (
                    SELECT p.place_id, p.place_name_kr, p.category, p.sub_category, p.image_url, p.open_time, p.close_time,
                        CASE
                            WHEN cp.latitude IS NOT NULL AND cp.longitude IS NOT NULL AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN
                                6371 * acos(
                                    LEAST(1, GREATEST(-1,
                                        cos(radians(cp.latitude)) * cos(radians(p.latitude)) *
                                        cos(radians(p.longitude) - radians(cp.longitude)) +
                                        sin(radians(cp.latitude)) * sin(radians(p.latitude))
                                    ))
                                )
                            ELSE NULL
                        END AS distance_km,
                        CASE
                            WHEN cp.place_name_kr IS NOT NULL AND trim(p.place_name_kr) = trim(cp.place_name_kr) THEN 0
                            ELSE 1
                        END AS name_rank
                    FROM moov.places p
                    WHERE (cp.place_name_kr IS NOT NULL AND trim(p.place_name_kr) = trim(cp.place_name_kr))
                       OR (cp.latitude IS NOT NULL AND cp.longitude IS NOT NULL AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL)
                    ORDER BY name_rank ASC, distance_km ASC NULLS LAST
                    LIMIT 1
                ) nearest ON nearest.name_rank = 0 OR nearest.distance_km < 0.5
                LEFT JOIN moov.place_tags pt ON pt.place_id = nearest.place_id
                ORDER BY c.course_id, cp.sequence_no
            """)
            rows = cur.fetchall()
    finally:
        release_conn(conn)

    courses = {}
    for course_id, title, image_url, created_at, duration, distance, seq, point_place_name, lat, lng, place_id, place_name, place_category, place_sub_category, place_image_url, open_time, close_time, tag_type, tag_name in rows:
        course = courses.setdefault(course_id, {
            "id": course_id,
            "title": title,
            "image_url": image_url,
            "created_at": created_at.isoformat() if created_at else None,
            "duration_seconds": duration,
            "distance_m": distance,
            "points": {},
            "tags": {"category": set(), "sub_category": set(), "purpose": set(), "mood": set(), "companion": set()},
        })
        point = course["points"].setdefault(seq, {
            "sequence_no": seq, "latitude": lat, "longitude": lng,
            "place_name_kr": place_name or point_place_name,
            "course_point_place_name_kr": point_place_name,
            "place_name": place_name or point_place_name,
            "matched_place_id": place_id,
            "matched_place_name_kr": place_name,
            "category": place_category,
            "sub_category": place_sub_category,
            "place_image_url": place_image_url,
            "open_time": open_time, "close_time": close_time,
        })
        if place_category:
            course["tags"]["category"].add(place_category)
        if place_sub_category:
            course["tags"].setdefault("sub_category", set()).add(place_sub_category)
        if tag_type and tag_name:
            key = tag_type.lower()
            if key in course["tags"]:
                course["tags"][key].add(tag_name)

    result = []
    for course in courses.values():
        resolved_title = _resolved_course_title(course.get("title"), course["points"])
        resolved_image_url = course.get("image_url") or next(
            (point.get("place_image_url") for point in sorted(course["points"].values(), key=lambda p: p["sequence_no"]) if point.get("place_image_url")),
            None,
        )
        result.append({
            **course,
            "title": resolved_title,
            "image_url": resolved_image_url,
            "points": sorted(course["points"].values(), key=lambda p: p["sequence_no"]),
            "tags": {k: sorted(v) for k, v in course["tags"].items()},
        })
    return {"courses": result}
