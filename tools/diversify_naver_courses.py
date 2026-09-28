"""Make duplicate CSV routes distinct while preserving every first venue.

Reads public venue metadata from PostgreSQL in a read-only transaction. Writes a
separate plan; it never edits the collector's plan or the database. New routes
use three distinct nearby venues, with at most 2.5 km between adjacent points.
These are straight-line screening distances, not claimed road travel lengths.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from copy import deepcopy
from itertools import combinations
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "artifacts/naver-course-images"
TAG_KEYS = ("category", "subcategory", "sub_category", "region", "purpose", "mood", "companion")
TAG_TYPES = {
    "CATEGORY": "category", "SUB_CATEGORY": "subcategory", "REGION": "region",
    "PURPOSE": "purpose", "PURPOSE1": "purpose", "MOOD": "mood", "COMPANION": "companion",
}
MAX_LEG_KM = 2.5
MAX_RADIUS_KM = 3.0
MAX_TOTAL_KM = 4.5
ACTIVITY_CATEGORIES = ("음식점", "카페", "전시", "쇼핑", "관광", "체험")
REBUILT_SOURCE = "duplicate-rebuilt-from-nearby-database-venues"
REPORT_NAME = "MOOV_개인화_코스추천_기획보고서_V1.11_AHP가중치정책_Codex구현프롬프트.docx"


def normalized_name(point):
    return "".join(point["place_name"].split()).casefold()


def route_key(points):
    # Venue names also distinguish routes in human-readable course titles.
    return tuple(normalized_name(point) for point in points)


def distance_km(a, b):
    values = (a.get("latitude"), a.get("longitude"), b.get("latitude"), b.get("longitude"))
    if any(value is None for value in values):
        return None
    lat1, lon1, lat2, lon2 = map(math.radians, map(float, values))
    hav = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371.0088 * 2 * math.asin(min(1, math.sqrt(hav)))


def role(point):
    # The catalog's six-category matching key is shared with personalization.
    # Do not silently relabel bakeries or assign a service-wide category rank.
    return point.get("category")


def is_visit_destination(point):
    """Drop service points and restricted/institutional records from new stops."""
    if not point.get("place_name") or not point.get("address") or role(point) not in ACTIVITY_CATEGORIES:
        return False
    name = point["place_name"]
    if any(word in name for word in (
        "안내데스크", "주차장", "지원센터", "인증센터", "영어체험", "교육청",
        "학원가", "청소년", "고객체험센터", "연구개발협회", "체험농장리조트",
    )) or re.search(r"\d+번출구", name):
        return False
    # The source catalog's unclassified experiences include service offices,
    # tutoring businesses, promotional showrooms and online channel names.
    if point["category"] == "체험" and point.get("sub_category") in (None, "", "기타"):
        return False
    return True


def load_places():
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend/.env")
    sys.path.insert(0, str(ROOT / "backend"))
    from db import get_conn, release_conn
    connection = get_conn()
    try:
        connection.set_session(readonly=True)
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT p.place_id, p.place_name_kr, p.latitude, p.longitude,
                       p.category, p.sub_category, p.address_kr,
                       p.open_time, p.close_time, p.image_url,
                       pt.tag_type, pt.tag_name
                FROM moov.places p
                LEFT JOIN moov.place_tags pt ON pt.place_id = p.place_id
                ORDER BY p.place_id, pt.tag_type, pt.tag_name
            """)
            rows = cursor.fetchall()
    finally:
        connection.rollback()
        release_conn(connection)
    places = {}
    for place_id, name, lat, lon, category, subcategory, address, opened, closed, image, tag_type, tag_name in rows:
        point = places.setdefault(place_id, {
            "sequence_no": 0, "latitude": float(lat) if lat is not None else None,
            "longitude": float(lon) if lon is not None else None,
            "place_name_kr": name, "course_point_place_name_kr": name,
            "place_name": name, "matched_place_id": place_id,
            "matched_place_name_kr": name, "category": category, "sub_category": subcategory,
            "place_image_url": image, "open_time": str(opened) if opened is not None else None,
            "close_time": str(closed) if closed is not None else None,
            "address": address, "name_source": "database-place-record", "tags": defaultdict(set),
        })
        key = TAG_TYPES.get(str(tag_type).upper())
        if key and tag_name:
            point["tags"][key].add(tag_name)
    for point in places.values():
        point["tags"] = {key: sorted(values) for key, values in point["tags"].items()}
    return places


def course_tags(points, places):
    tags = {key: set() for key in TAG_KEYS}
    for point in points:
        if point.get("category"):
            tags["category"].add(point["category"])
        if point.get("sub_category"):
            tags["subcategory"].add(point["sub_category"])
        place = places.get(point.get("matched_place_id"), {})
        for key, values in place.get("tags", {}).items():
            if key in tags:
                tags[key].update(values)
    tags["sub_category"] = tags["subcategory"].copy()
    return {key: sorted(values) for key, values in tags.items()}


def place_profile(point):
    """One factual catalog profile, with unsupported facts explicitly unknown."""
    detail = point.get("sub_category")
    area = re.search(r"(?:서울(?:특별시)?\s+)(\S+구)", point.get("address") or "")
    return {
        "place_id": point.get("matched_place_id"), "place_name": point.get("place_name"),
        "activity_category": role(point), "sub_category": detail,
        # Only a stored provider hierarchy is presented as raw_category. A
        # normalized subcategory such as '커피' is not reconstructed into raw data.
        "raw_category": detail if detail and ">" in detail else None,
        "area": area.group(1) if area else None, "address": point.get("address"),
        "latitude": point.get("latitude"), "longitude": point.get("longitude"),
        "open_time": point.get("open_time"), "close_time": point.get("close_time"),
        "price": None, "reservation_available": None,
        "features": deepcopy(point.get("tags") or {}),
        "source": "moov.places + moov.place_tags",
        "feature_evidence": "existing-catalog-values; source evidence not independently audited",
    }


def candidate_routes(first, places):
    """Return different venue sets, with the shorter visit order for each set."""
    nearby = []
    for place in places.values():
        if not is_visit_destination(place):
            continue
        if normalized_name(place) == normalized_name(first):
            continue
        radius = distance_km(first, place)
        if radius is not None and radius <= MAX_RADIUS_KM:
            nearby.append((radius, place))
    # Include both close venues and category variety in dense downtown areas.
    nearby.sort(key=lambda entry: (entry[0], normalized_name(entry[1]), entry[1]["matched_place_id"]))
    selected = {point["matched_place_id"]: point for _, point in nearby[:60]}
    per_role = Counter()
    for _, point in nearby:
        group = role(point)
        if per_role[group] < 12:
            selected[point["matched_place_id"]] = point
            per_role[group] += 1
    output = []
    seen = set()
    for a, b in combinations(selected.values(), 2):
        if normalized_name(a) == normalized_name(b):
            continue
        # Section 9: static community templates vary activities. No category is
        # preferred over another, and the stored Place Profile remains intact.
        categories = {role(first), role(a), role(b)}
        if len(categories) != 3 or not categories <= set(ACTIVITY_CATEGORIES):
            continue
        between = distance_km(a, b)
        first_a, first_b = distance_km(first, a), distance_km(first, b)
        if first_b < first_a:
            a, b, first_a = b, a, first_b
        if max(first_a, between) > MAX_LEG_KM or first_a + between > MAX_TOTAL_KM:
            continue
        key = route_key((first, a, b))
        if key in seen:
            continue
        seen.add(key)
        total_distance = first_a + between
        output.append((total_distance, total_distance, key, a, b))
    output.sort(key=lambda entry: (entry[0], entry[2]))
    return output


def diversify(plan, places):
    courses = deepcopy(plan["courses"])
    first_original = {}
    for index, course in enumerate(courses):
        if course.get("route_source") != REBUILT_SOURCE:
            first_original.setdefault(route_key(course["points"]), index)
    # Reserve all originals before processing duplicates, even originals later
    # in the CSV; a generated route must never displace an original route.
    used_routes = set(first_original)
    pools = {}
    place_usage = Counter()
    modified = 0
    max_new_leg = 0.0
    for index, course in enumerate(courses):
        original_points = deepcopy(course["points"])
        original_key = route_key(original_points)
        if course.get("route_source") != REBUILT_SOURCE and first_original.get(original_key) == index:
            course["route_source"] = "original-first-occurrence"
        else:
            first = original_points[0]
            first_key = (normalized_name(first), first["latitude"], first["longitude"])
            if first_key not in pools:
                pools[first_key] = candidate_routes(first, places)
            available = [entry for entry in pools[first_key] if entry[2] not in used_routes]
            if not available:
                raise ValueError(f"Not enough nearby distinct routes for {course['first_place']}")
            # Deterministic geographic ordering only. Reuse breaks distance
            # ties; this is route assembly, never an AHP/taste/match score.
            selected = min(available, key=lambda entry: (
                entry[0],
                place_usage[entry[3]["matched_place_id"]] + place_usage[entry[4]["matched_place_id"]],
                entry[2],
            ))
            _, _, key, a, b = selected
            course["points"] = [first, deepcopy(a), deepcopy(b)]
            for seq, point in enumerate(course["points"]):
                if seq:
                    point["sequence_no"] = original_points[0]["sequence_no"] + seq
                    place_usage[point["matched_place_id"]] += 1
            used_routes.add(key)
            max_new_leg = max(max_new_leg, *(distance_km(a, b) for a, b in zip(course["points"], course["points"][1:])))
            course["route_source"] = REBUILT_SOURCE
            course.setdefault("original_route", [point["place_name"] for point in original_points])
            modified += 1
        course["title"] = " → ".join(point["place_name"] for point in course["points"]) + " 코스"
        course["tags"] = course_tags(course["points"], places)
        course["duration_seconds"] = None
        course["distance_m"] = None
        course["travel_metrics_source"] = "unknown-no-road-routing-requested"
        course["estimated_total_price"] = None
        course["operational_validation"] = {
            "opening_hours": "not-evaluated-without-visit-date-and-time",
            "budget": "unknown-place-prices-and-no-user-budget",
            "reservation": "unknown-reservation-availability",
            "road_route": "unverified-straight-line-screen-only",
        }
        legs = [distance_km(a, b) for a, b in zip(course["points"], course["points"][1:])]
        course["straight_line_distance_m"] = round(sum(legs) * 1000) if all(leg is not None for leg in legs) else None
    if len({course["id"] for course in courses}) != len(courses):
        raise ValueError("Duplicate course ID")
    if len({route_key(course["points"]) for course in courses}) != len(courses):
        raise ValueError("Duplicate route")
    if len({course["title"] for course in courses}) != len(courses):
        raise ValueError("Duplicate human-readable title")
    for before, after in zip(plan["courses"], courses):
        if before["points"][0] != after["points"][0] or before["first_place"] != after["first_place"]:
            raise ValueError("First venue was changed")
    stats = {
        "courses": len(courses), "unique_routes": len(used_routes), "unique_titles": len({course["title"] for course in courses}),
        "original_unique_routes_preserved": len(first_original), "duplicate_routes_rebuilt": modified,
        "first_points_preserved": len(courses), "source_places": len(places),
        "distinct_places_used": len({point.get("matched_place_id") for course in courses for point in course["points"]}),
        "maximum_new_leg_straight_line_km": round(max_new_leg, 3),
        "new_route_maximum_leg_limit_km": MAX_LEG_KM,
        "point_counts": dict(Counter(len(course["points"]) for course in courses)),
        "rebuilt_routes_with_three_distinct_activity_categories": sum(
            course["route_source"] == REBUILT_SOURCE and len({role(point) for point in course["points"]}) == 3
            for course in courses
        ),
    }
    used_ids = {point.get("matched_place_id") for course in courses for point in course["points"]}
    profiles = {place_id: place_profile(places[place_id]) for place_id in sorted(used_ids) if place_id in places}
    return {
        **deepcopy(plan), "count": len(courses), "courses": courses, "route_diversification": stats,
        "place_profiles": profiles,
        "generation_policy": {
            "reference_document": REPORT_NAME,
            "reference_sections": ["3.1–3.3 single Place Profile", "9 course generation", "15.3–15.4 filtering and deterministic ranking", "16 category neutrality", "17.2 AHP scope"],
            "mode": "static-community-course-composition",
            "current_filters": None, "user_preference": None,
            "personalization_score": None,
            "filter_policy": "Persistent exclusions, current filters and operating constraints must precede preference ranking at recommendation time; no user context was supplied for these static templates.",
            "diversity_policy": "Rebuilt three-stop templates use three distinct stored activity categories; original unique routes and every first point are preserved.",
            "ordering_policy": "Deterministic shortest straight-line visit order from the fixed first venue; no common category ranking or generated taste weights.",
            "unknown_policy": "No prices, opening availability, road durations, reservation states, user vectors or AHP weights are invented.",
            "ahp_scope": "AHP weights behavior evidence; it is not used to assign category priorities or assemble anonymous static routes.",
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=WORK / "plan.json")
    parser.add_argument("--output", type=Path, default=WORK / "routes-plan.json")
    args = parser.parse_args()
    if args.plan.resolve() == args.output.resolve():
        parser.error("Output must be a separate file from the collector's plan")
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    if plan.get("count") != 1000 or len(plan["courses"]) != 1000:
        parser.error("Expected the approved 1,000-course source plan")
    output = diversify(plan, load_places())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output["route_diversification"], ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
