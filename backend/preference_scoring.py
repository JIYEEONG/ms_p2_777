"""Deterministic long-term preference scoring for MOOV recommendations."""

from __future__ import annotations

import math
import os
from datetime import datetime, timezone
from typing import Any

CATEGORY_DIMENSIONS = ("음식점", "카페", "전시", "쇼핑", "관광", "체험")
POSITIVE_BEHAVIOR_EVENTS = (
    "course_select",
    "course_like",
    "course_save",
    "follow_intent",
    "follow_route_applied",
)
STATE_CANCEL_EVENTS = {
    "course_unlike": "course_like",
    "course_unsave": "course_save",
}
RI_BY_SIZE = {
    1: 0.0,
    2: 0.0,
    3: 0.58,
    4: 0.90,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
}
DEFAULT_RECENCY_LAMBDA = float(os.getenv("MOOV_RECENCY_LAMBDA", "0.035"))

DEFAULT_AHP_CONFIG: dict[str, Any] = {
    "version": "behavior-ahp-v1",
    "criteria": ["explicitness", "cost", "persistence"],
    "alternatives": list(POSITIVE_BEHAVIOR_EVENTS),
    "criteria_matrix": [
        [1, 3, 1],
        [1 / 3, 1, 1 / 3],
        [1, 3, 1],
    ],
    "alternative_matrices": {
        "explicitness": [
            [1, 1 / 3, 1 / 3, 1 / 2, 1 / 2],
            [3, 1, 1 / 2, 2, 1],
            [3, 2, 1, 3, 2],
            [2, 1 / 2, 1 / 3, 1, 1 / 2],
            [2, 1, 1 / 2, 2, 1],
        ],
        "cost": [
            [1, 1 / 3, 1 / 4, 1 / 2, 1 / 5],
            [3, 1, 1 / 2, 2, 1 / 3],
            [4, 2, 1, 3, 1 / 2],
            [2, 1 / 2, 1 / 3, 1, 1 / 4],
            [5, 3, 2, 4, 1],
        ],
        "persistence": [
            [1, 1 / 4, 1 / 5, 1 / 2, 1 / 3],
            [4, 1, 1 / 2, 3, 1],
            [5, 2, 1, 4, 2],
            [2, 1 / 3, 1 / 4, 1, 1 / 2],
            [3, 1, 1 / 2, 2, 1],
        ],
    },
}


def _blank_vector() -> dict[str, float]:
    return {category: 0.0 for category in CATEGORY_DIMENSIONS}


def _normalise(vector: dict[str, float]) -> dict[str, float]:
    cleaned = {key: max(0.0, float(value or 0.0)) for key, value in vector.items()}
    total = sum(cleaned.values())
    if total <= 0:
        return {key: 0.0 for key in cleaned}
    return {key: value / total for key, value in cleaned.items()}


def build_survey_vector(selected_categories: list[str] | tuple[str, ...] | set[str]) -> dict[str, float]:
    vector = _blank_vector()
    selected = []
    seen = set()
    for category in selected_categories or []:
        clean = str(category).strip()
        if clean in CATEGORY_DIMENSIONS and clean not in seen:
            selected.append(clean)
            seen.add(clean)
    if not selected:
        return vector
    weight = 1.0 / len(selected)
    for category in selected:
        vector[category] = weight
    return vector


def _validate_square_matrix(matrix: list[list[float]]) -> None:
    size = len(matrix)
    if size == 0 or any(len(row) != size for row in matrix):
        raise ValueError("AHP matrix must be non-empty and square")
    for row in matrix:
        for value in row:
            if float(value) <= 0:
                raise ValueError("AHP matrix values must be positive")


def _geometric_weights(matrix: list[list[float]]) -> list[float]:
    _validate_square_matrix(matrix)
    products = []
    size = len(matrix)
    for row in matrix:
        product = 1.0
        for value in row:
            product *= float(value)
        products.append(product ** (1.0 / size))
    total = sum(products)
    if total <= 0:
        raise ValueError("AHP matrix produced zero total weight")
    return [value / total for value in products]


def calculate_consistency_ratio(matrix: list[list[float]]) -> float:
    _validate_square_matrix(matrix)
    size = len(matrix)
    if size <= 2:
        return 0.0
    weights = _geometric_weights(matrix)
    weighted_sums = []
    for row in matrix:
        weighted_sums.append(sum(float(value) * weights[index] for index, value in enumerate(row)))
    lambda_max = sum(weighted_sums[index] / weights[index] for index in range(size)) / size
    consistency_index = (lambda_max - size) / (size - 1)
    random_index = RI_BY_SIZE.get(size)
    if not random_index:
        return 0.0
    return max(0.0, consistency_index / random_index)


def calculate_ahp_weights(pairwise_matrices: dict[str, Any] | None = None) -> dict[str, Any]:
    config = pairwise_matrices or DEFAULT_AHP_CONFIG
    criteria = [str(item) for item in config.get("criteria", [])]
    alternatives = [str(item) for item in config.get("alternatives", [])]
    if not criteria or not alternatives:
        raise ValueError("AHP config requires criteria and alternatives")
    criteria_matrix = config.get("criteria_matrix")
    alternative_matrices = config.get("alternative_matrices") or {}
    criteria_weights = _geometric_weights(criteria_matrix)
    cr_results = {"criteria": calculate_consistency_ratio(criteria_matrix)}
    if cr_results["criteria"] > 0.10:
        raise ValueError(f"AHP criteria consistency ratio {cr_results['criteria']:.4f} exceeds 0.10")

    totals = {alternative: 0.0 for alternative in alternatives}
    for criterion, criterion_weight in zip(criteria, criteria_weights):
        matrix = alternative_matrices.get(criterion)
        if matrix is None:
            raise ValueError(f"AHP alternative matrix is missing for {criterion}")
        cr = calculate_consistency_ratio(matrix)
        cr_results[criterion] = cr
        if cr > 0.10:
            raise ValueError(f"AHP {criterion} consistency ratio {cr:.4f} exceeds 0.10")
        alt_weights = _geometric_weights(matrix)
        if len(alt_weights) != len(alternatives):
            raise ValueError("AHP alternative matrix size must match alternatives")
        for alternative, alt_weight in zip(alternatives, alt_weights):
            totals[alternative] += criterion_weight * alt_weight
    return {
        "version": str(config.get("version") or "unknown"),
        "weights": _normalise(totals),
        "consistency_ratio": cr_results,
    }


def frequency_factor(count: int | float) -> float:
    return math.log1p(max(0.0, float(count or 0.0)))


def recency_factor(age_days: int | float, lambda_value: float = DEFAULT_RECENCY_LAMBDA) -> float:
    return math.exp(-float(lambda_value) * max(0.0, float(age_days or 0.0)))


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _event_target(event: dict[str, Any]) -> str:
    return str(event.get("course_id") or event.get("target_id") or event.get("aggregate_id") or "")


def _event_categories(event: dict[str, Any]) -> list[str]:
    values = []
    tags = event.get("tags")
    if isinstance(tags, dict):
        values.extend(tags.get("category") or tags.get("CATEGORY") or [])
    values.extend(event.get("categories") or [])
    return [category for category in dict.fromkeys(str(item).strip() for item in values) if category in CATEGORY_DIMENSIONS]


def aggregate_behavior_vector(
    events: list[dict[str, Any]],
    ahp_weights: dict[str, float],
    lambda_value: float | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    active_like: dict[str, dict[str, Any]] = {}
    active_save: dict[str, dict[str, Any]] = {}
    direct_events: list[dict[str, Any]] = []
    for event in sorted(events or [], key=lambda item: str(item.get("occurred_at") or "")):
        event_type = str(event.get("event_type") or "")
        target = _event_target(event)
        if not target:
            continue
        if event_type == "course_like":
            active_like[target] = event
        elif event_type == "course_unlike":
            active_like.pop(target, None)
        elif event_type == "course_save":
            active_save[target] = event
        elif event_type == "course_unsave":
            active_save.pop(target, None)
        elif event_type in POSITIVE_BEHAVIOR_EVENTS:
            direct_events.append(event)

    active_events = direct_events + list(active_like.values()) + list(active_save.values())
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    valid_event_count = 0
    for event in active_events:
        event_type = str(event.get("event_type") or "")
        if event_type not in ahp_weights:
            continue
        categories = _event_categories(event)
        if not categories:
            continue
        valid_event_count += 1
        key = (event_type, _event_target(event))
        occurred_at = _parse_datetime(event.get("occurred_at"))
        group = grouped.setdefault(key, {"count": 0, "latest_at": occurred_at, "categories": set()})
        group["count"] += 1
        group["latest_at"] = max(group["latest_at"], occurred_at)
        group["categories"].update(categories)

    raw = _blank_vector()
    recency_lambda = DEFAULT_RECENCY_LAMBDA if lambda_value is None else float(lambda_value)
    for event_type, _target in grouped:
        group = grouped[(event_type, _target)]
        age_days = (current - group["latest_at"]).total_seconds() / 86400
        contribution = float(ahp_weights[event_type]) * frequency_factor(group["count"]) * recency_factor(age_days, recency_lambda)
        categories = sorted(group["categories"])
        for category in categories:
            raw[category] += contribution / len(categories)
    return {
        "vector": _normalise(raw),
        "raw_vector": raw,
        "valid_event_count": valid_event_count,
    }


def build_user_preference_vector(
    survey_vector: dict[str, float],
    behavior_vector: dict[str, float],
    prior_strength: float,
) -> dict[str, float]:
    prior = max(0.0, float(prior_strength or 0.0))
    combined = _blank_vector()
    for category in CATEGORY_DIMENSIONS:
        combined[category] = (float(survey_vector.get(category, 0.0)) * prior) + float(behavior_vector.get(category, 0.0))
    return _normalise(combined)


def build_place_vector(place_tags: dict[str, Any]) -> dict[str, float]:
    categories = []
    for key, values in (place_tags or {}).items():
        if str(key).lower() == "category":
            categories.extend(values or [])
    return build_survey_vector(categories)


def cosine_similarity(user_vector: dict[str, float], place_vector: dict[str, float]) -> float:
    keys = sorted(set(user_vector) | set(place_vector))
    numerator = sum(float(user_vector.get(key, 0.0)) * float(place_vector.get(key, 0.0)) for key in keys)
    user_norm = math.sqrt(sum(float(user_vector.get(key, 0.0)) ** 2 for key in keys))
    place_norm = math.sqrt(sum(float(place_vector.get(key, 0.0)) ** 2 for key in keys))
    if user_norm == 0 or place_norm == 0:
        return 0.0
    return numerator / (user_norm * place_norm)


def rank_candidates(candidates: list[dict[str, Any]], user_vector: dict[str, float]) -> list[dict[str, Any]]:
    ranked = []
    for candidate in candidates:
        item = dict(candidate)
        place_vector = item.get("place_vector") or build_place_vector(item.get("tags") or {})
        score = cosine_similarity(user_vector, place_vector)
        item["place_vector"] = place_vector
        item["score"] = score
        item["match_score"] = round(score * 100)
        ranked.append(item)
    ranked.sort(key=lambda item: (-item["score"], item.get("distance_km") if item.get("distance_km") is not None else 999, item.get("name") or ""))
    return ranked
