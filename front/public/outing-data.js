(function (root) {
  "use strict";

  const RULE_VERSION = "demo-category-v1";
  // Existing home demo coordinates. These are stable demo points, not verified venue data.
  const DEMO_PLACES = Object.freeze({
    "어니언 성수": { id: "demo-onion", lat: 37.5446, lng: 127.0580 },
    "대림창고 갤러리": { id: "demo-daelim", lat: 37.5418, lng: 127.0562 },
    "서울숲 카페거리": { id: "demo-forest-cafes", lat: 37.5461, lng: 127.0430 },
    "서울숲": { id: "demo-forest", lat: 37.5445, lng: 127.0374 },
    "디뮤지엄": { id: "demo-museum", lat: 37.5445, lng: 127.0443 },
    "한강공원 반포지구": { id: "demo-banpo", lat: 37.5104, lng: 126.9960 },
    "익선동 한옥거리": { id: "demo-ikseon", lat: 37.5740, lng: 126.9898 },
    "블루보틀 성수": { id: "demo-bluebottle", lat: 37.5480, lng: 127.0457 },
  });

  function pointForStop(course, index) {
    const detail = course.stopDetails?.[index];
    if (detail && Number.isFinite(detail.lat) && Number.isFinite(detail.lng)) {
      return { id: detail.placeId || `${course.id}-stop-${index}`, name: course.stops[index], lat: detail.lat, lng: detail.lng, source: detail.source || "provided" };
    }
    const name = course.stops[index];
    const stored = course._dbPoints?.[index];
    if (stored?.latitude != null && stored?.longitude != null && String(stored.latitude).trim() && String(stored.longitude).trim()) {
      const lat = Number(stored.latitude), lng = Number(stored.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { id: stored.id || `${course.id}-stop-${index}`, name, lat, lng, source: "provided" };
      }
    }
    const demo = DEMO_PLACES[name];
    return demo ? { ...demo, name, source: "bundled-demo" } : { id: `${course.id}-stop-${index}`, name, lat: null, lng: null, source: "unverified" };
  }

  function normalized(value) {
    return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("ko-KR");
  }

  function distanceKm(course) {
    const value = course.distance_m != null && String(course.distance_m).trim() !== ''
      ? Number(course.distance_m) / 1000
      : course.distance != null && String(course.distance).trim() !== '' ? Number(course.distance) : NaN;
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  function fromDatabase(course) {
    const points = [...(course.points || [])].sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no));
    const seconds = Number(course.duration_seconds);
    const originalName = course.title || '';
    const stopNames = points.map(point => point.place_name || `지점 ${point.sequence_no}`);
    const generic = !originalName || /^(?:(?:감성|활기참|트렌디|조용함|힐링)\s+)?(?:전시|관광|카페|음식점|체험|쇼핑|나들이)\s*코스$/.test(originalName.trim());
    const namedStops = stopNames.filter(name => !/^지점\s*\d+$/.test(name));
    return {
      id: course.id, name: generic && namedStops.length ? namedStops.join(' → ') : originalName || '나들이 코스',
      _originalName: originalName,
      desc: course.description || '', image: course.image_url || null, author: course.author || 'MOOV', createdAt: course.created_at,
      stops: stopNames,
      duration_seconds: course.duration_seconds, distance_m: course.distance_m,
      distance: distanceKm(course), time: seconds > 0 && Number.isFinite(seconds) ? `약 ${Math.ceil(seconds / 60)}분` : `${points.length}곳`,
      _dbPoints: points, _dbTags: course.tags || {},
    };
  }

  function uniqueCourses(courses) {
    const seen = new Set();
    const keyText = value => normalized(value).replace(/[\s\p{P}\p{S}]+/gu, '');
    return courses.filter(course => {
      if (!course) return false;
      const keys = course.id == null ? [] : ['id:' + course.id];
      const names = (course.stops || []).map(keyText);
      if (names.length >= 2 && names.every(name => name && !/^지점\d+$/.test(name))) keys.push('stops:' + names.join('>'));
      if (names.length === 1 && names[0] && !/^지점\d+$/.test(names[0]) && keyText(course.name)) keys.push('single:' + names[0] + '|' + keyText(course.name));
      const points = (course.stops || []).map((_, index) => pointForStop(course, index));
      if (points.length >= 2 && points.every(point => Number.isFinite(point.lat) && Number.isFinite(point.lng))) {
        keys.push('route:' + points.map(point => point.lat.toFixed(4) + ',' + point.lng.toFixed(4)).join('>'));
      }
      const duplicate = keys.some(key => seen.has(key));
      if (!duplicate) keys.forEach(key => seen.add(key));
      return !duplicate;
    });
  }

  function distinguishNames(courses) {
    const counts = new Map();
    courses.forEach(course => counts.set(normalized(course.name), (counts.get(normalized(course.name)) || 0) + 1));
    return courses.map(course => {
      if (counts.get(normalized(course.name)) < 2 || !course.stops?.length) return course;
      const route = course.stops.join(' → ');
      return { ...course, name: course.name === route ? route : `${course.name} · ${route}` };
    });
  }

  // Keep score/price/filter priorities; spread repeated places within equal ranks.
  function diversifyTies(items, priorityFor, courseFor = item => item) {
    const output = [], usage = new Map();
    const stopKeys = item => [...new Set((courseFor(item).stops || []).map(normalized))];
    let start = 0;
    while (start < items.length) {
      let end = start + 1;
      while (end < items.length && priorityFor(items[end]) === priorityFor(items[start])) end++;
      const group = items.slice(start, end);
      while (group.length) {
        let best = 0, penalty = Infinity;
        group.forEach((item, index) => {
          const stops = stopKeys(item);
          const overlap = stops.reduce((sum, stop) => sum + (usage.get(stop) || 0), 0) / Math.max(1, stops.length);
          if (overlap < penalty) { best = index; penalty = overlap; }
        });
        const item = group.splice(best, 1)[0];
        output.push(item);
        stopKeys(item).forEach(stop => usage.set(stop, (usage.get(stop) || 0) + 1));
      }
      start = end;
    }
    return output;
  }

  function matches(course, query, filters, tags) {
    const q = normalized(query);
    if (q && ![course.name, course.desc, ...(course.stops || []), ...(tags.category || [])].some((field) => normalized(field).includes(q))) return false;
    for (const key of ["category", "mood", "companion", "purpose"]) {
      const selected = filters[key] || "전체";
      if (selected !== "전체" && !(tags[key] || []).includes(selected)) return false;
    }
    const price = Number(tags.price);
    // Demo price is indicative; an unknown price must stay visible for review.
    return !Number.isFinite(price) || price <= 0 || price <= Number(filters.budget || Infinity);
  }

  // course_points의 좌표들(현재는 START/END 2개) 평균을 코스의 대표 위치로 삼는다.
  function courseCentroid(points) {
    const lat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
    const lng = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
    return { lat, lng };
  }

  // 두 좌표 간 거리(km), 하버사인 공식.
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0088;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  // 사용자/차량 위치가 없으면 계산하지 않는다(geo_score 미반영, 다른 점수만 사용).
  function calcGeoScore(points, userLat, userLon) {
    if (userLat == null || userLon == null) return null;
    const center = courseCentroid(points);
    const distanceKm = haversineKm(userLat, userLon, center.lat, center.lng);
    return Math.max(0, 1 - distanceKm / 20);
  }

  // courses.duration_seconds(초)와 남은 이용 시간(ms)을 비교한다.
  // 남은 시간보다 코스가 더 길면 못 끝내는 거니까 0점.
  // 남은 시간 안에서는, 그 시간을 알차게 쓸수록(코스 시간이 남은 시간에 가까울수록) 높은 점수.
  function calcDurationScore(course, remainingMs) {
    if (remainingMs == null) return null; // 택시 모드 등 "남은 시간" 개념이 없을 때는 계산 안 함
    const remainingSeconds = remainingMs / 1000;
    if (remainingSeconds <= 0) return 0;
    if (course.duration_seconds > remainingSeconds) return 0;
    return course.duration_seconds / remainingSeconds;
  }
 
  // 양지영님 기획서 기준 시간대 구간 (분 단위, 자정 기준)
const TIME_RANGES = {
  아침: [6 * 60, 10 * 60],
  점심: [10 * 60, 14 * 60],
  오후: [14 * 60, 18 * 60],
  저녁: [18 * 60, 22 * 60],
  야간: [22 * 60, 24 * 60],
};

// "09:30" 같은 문자열을 자정 기준 분(minutes)으로 변환
function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

// 지점 하나가 선택한 시간대에 열려 있는지
function isOpenDuring(point, timeSlot) {
  if (!point.open_time || !point.close_time) return null; // 영업시간 정보가 없으면 판단 불가
  const range = TIME_RANGES[timeSlot];
  if (!range) return null; // "전체" 선택 시에는 계산 안 함
  const open = timeToMinutes(point.open_time);
  const close = timeToMinutes(point.close_time);
  return open <= range[1] && close >= range[0]; // 구간이 겹치는지
}

// 코스 지점들 중 선택한 시간대에 열려 있는 비율
function calcTimeScore(points, timeSlot) {
  if (!timeSlot || timeSlot === "전체") return null;
  const checkable = points.filter((p) => p.open_time && p.close_time);
  if (checkable.length === 0) return null; // 영업시간 정보가 하나도 없으면 계산 안 함
  const openCount = checkable.filter((p) => isOpenDuring(p, timeSlot)).length;
  return openCount / checkable.length;

// 렌트 요금 정책(moov-home/js/shared.js의 rentalFareForHours)으로 예상 렌트비를 계산해서
// 사용자 참고 예산과 비교한다. 지금은 코스가 전부 3시간 미만이라 값이 항상 똑같이 나오는
// 상태라 score()에는 아직 연결하지 않고, 함수만 준비해둔다.
function calcPriceFit(course, vehicleId, budget) {
  if (!budget || typeof rentalFareForHours !== "function") return null;
  const hours = Math.max(3, Math.ceil(course.duration_seconds / 3600));
  const estimatedFare = rentalFareForHours(vehicleId, hours);
  return Math.max(0, 1 - Math.abs(estimatedFare - budget) / budget);
}

}
function calcTagScore(preference, tags) {
  const weights = { category: 0.7, mood: 0.2, companion: 0.1 };
  let earned = 0, possible = 0;
  for (const [key, w] of Object.entries(weights)) {
    if (!preference[key] || preference[key] === "전체") continue;
    possible += w;
    if ((tags[key] || []).includes(preference[key])) earned += w;
  }
  return possible ? earned / possible : null; // 아무것도 안 골랐으면 태그 점수 제외
}

function scoreBreakdown(course, preference, tags, context = {}) {
  const rawPoints = (course.stops || []).map((_, i) => pointForStop(course, i));
  const geoPoints = rawPoints
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ latitude: p.lat, longitude: p.lng }));
  return {
    tagScore: calcTagScore(preference, tags),
    geoScore: geoPoints.length ? calcGeoScore(geoPoints, context.userLat, context.userLon) : null,
    durationScore: calcDurationScore(course, context.remainingMs),
    timeScore: calcTimeScore(rawPoints, preference.time),
  };
}

function score(course, preference, tags, context = {}) {
  const geoPoints = course._dbPoints
    ? course._dbPoints.filter((p) => p.latitude != null && p.longitude != null)
    : (course.stops || []).map((_, i) => pointForStop(course, i))
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({ latitude: p.lat, longitude: p.lng }));

  const timePoints = course._dbPoints || (course.stops || []).map((_, i) => pointForStop(course, i));

  const tagScore = calcTagScore(preference, tags);
  const geoScore = geoPoints.length ? calcGeoScore(geoPoints, context.userLat, context.userLon) : null;
  const durationScore = calcDurationScore(course, context.remainingMs);
  const timeScore = calcTimeScore(timePoints, preference.time);

  const weighted = [
    [tagScore, 0.5],
    [geoScore, 0.2],
    [durationScore, 0.2],
    [timeScore, 0.1],
  ].filter(([value]) => value != null);

  if (weighted.length === 0) return 0;
  const weightSum = weighted.reduce((sum, [, w]) => sum + w, 0);
  return weighted.reduce((sum, [value, w]) => sum + value * w, 0) / weightSum;
}

function scoreBreakdown(course, preference, tags, context = {}) {
  const geoPoints = course._dbPoints
    ? course._dbPoints.filter((p) => p.latitude != null && p.longitude != null)
    : (course.stops || []).map((_, i) => pointForStop(course, i))
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({ latitude: p.lat, longitude: p.lng }));

  const timePoints = course._dbPoints || (course.stops || []).map((_, i) => pointForStop(course, i));

  return {
    tagScore: calcTagScore(preference, tags),
    geoScore: geoPoints.length ? calcGeoScore(geoPoints, context.userLat, context.userLon) : null,
    durationScore: calcDurationScore(course, context.remainingMs),
    timeScore: calcTimeScore(timePoints, preference.time),
  };
}

  function tasteSignals(preference, history = []) {
    const signals = new Map();
    const add = (field, value, weight) => {
      if (!value || value === "전체") return;
      const key = `${field}:${value}`;
      const current = signals.get(key);
      signals.set(key, { field, value, weight: Math.min(4, (current?.weight || 0) + weight) });
    };
    for (const [field, weight] of [["category", 4], ["mood", 3], ["companion", 2], ["time", 2]]) {
      add(field, preference[field], weight);
    }
    for (const item of history) {
      const weight = Number(item.weight) || 0;
      if (weight <= 0) continue;
      for (const [field, share] of [["category", 1], ["mood", 0.5], ["purpose", 0.5]]) {
        const values = item.tags?.[field] || [];
        for (const value of values) add(field, value, weight * share / values.length);
      }
    }
    return [...signals.values()];
  }

  function tasteMatch(tags, signals) {
    const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
    if (!totalWeight) return { percent: null, matched: 0, total: 0 };
    const matching = signals.filter(({ field, value }) => (tags[field] || []).includes(value));
    const matchedWeight = matching.reduce((sum, signal) => sum + signal.weight, 0);
    return { percent: Math.round(100 * matchedWeight / totalWeight), matched: matching.length, total: signals.length };
  }

  function tieBreak(a, b) {
    const dates = String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    return dates || String(a.id).localeCompare(String(b.id));
  }

  function rank(courses, preference, tagsFor, context = {}) {
    const eligible = courses.filter((course) => {
      const tags = tagsFor(course);
      const price = Number(tags.price);
      return !Number.isFinite(price) || price <= 0 || price <= Number(preference.budget || Infinity);
    });
    const ranked = eligible.map((course) => ({ course, score: score(course, preference, tagsFor(course), context) }))
      .sort((a, b) => b.score - a.score || tieBreak(a.course, b.course));
    return diversifyTies(ranked, item => item.score, item => item.course);
  }

  function sort(courses, sortBy, preference, tagsFor, likesFor, context = {}) {
    const sorted = [...courses].sort((a, b) => {
      if (sortBy === "preference") return score(b, preference, tagsFor(b), context) - score(a, preference, tagsFor(a), context) || tieBreak(a, b);
      if (sortBy === "popular") return likesFor(b) - likesFor(a) || tieBreak(a, b);
      if (sortBy === "nearby") return (Number(a.distance_m) || Infinity) - (Number(b.distance_m) || Infinity) || tieBreak(a, b);
      return tieBreak(a, b);
    });
    return diversifyTies(sorted, course => sortBy === 'preference' ? score(course, preference, tagsFor(course), context)
      : sortBy === 'popular' ? likesFor(course) : sortBy === 'nearby' ? (Number(course.distance_m) || Infinity) : course.createdAt || '');
  }
  function newId() {
    return root.crypto?.randomUUID?.() || `moov-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const api = {distanceKm, fromDatabase, uniqueCourses, distinguishNames, diversifyTies, RULE_VERSION, DEMO_PLACES, pointForStop, matches, score, scoreBreakdown, tasteSignals, tasteMatch, rank, sort, newId, courseCentroid, haversineKm, calcGeoScore, calcDurationScore, calcTimeScore};  if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.MoovOutingData = api;
  })(typeof window !== "undefined" ? window : globalThis);
