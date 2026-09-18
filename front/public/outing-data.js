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
    if (detail && Number.isFinite(detail.lat) && Number.isFinite(detail.lng) && detail.placeId) {
      return { id: detail.placeId, name: course.stops[index], lat: detail.lat, lng: detail.lng, source: detail.source || "provided" };
    }
    const name = course.stops[index];
    const demo = DEMO_PLACES[name];
    return demo ? { ...demo, name, source: "bundled-demo" } : { id: `${course.id}-stop-${index}`, name, lat: null, lng: null, source: "unverified" };
  }

  function normalized(value) {
    return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("ko-KR");
  }

  function matches(course, query, filters, tags) {
    const q = normalized(query);
    if (q && ![course.name, course.desc, ...(course.stops || [])].some((field) => normalized(field).includes(q))) return false;
    for (const key of ["category", "mood", "companion", "purpose", "time"]) {
      const selected = filters[key] || "전체";
      if (selected !== "전체" && !(tags[key] || []).includes(selected)) return false;
    }
    const price = Number(tags.price);
    // Demo price is indicative; an unknown price must stay visible for review.
    return !Number.isFinite(price) || price <= 0 || price <= Number(filters.budget || Infinity);
  }

  function score(course, preference, tags) {
    let points = 0;
    if (preference.category !== "전체" && (tags.category || []).includes(preference.category)) points += 100;
    if (preference.mood !== "전체" && (tags.mood || []).includes(preference.mood)) points += 20;
    if (preference.companion !== "전체" && (tags.companion || []).includes(preference.companion)) points += 10;
    return points;
  }

  function tieBreak(a, b) {
    const dates = String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    return dates || String(a.id).localeCompare(String(b.id));
  }

  function rank(courses, preference, tagsFor) {
    const eligible = courses.filter((course) => {
      const tags = tagsFor(course);
      const price = Number(tags.price);
      return !Number.isFinite(price) || price <= 0 || price <= Number(preference.budget || Infinity);
    });
    return eligible.map((course) => ({ course, score: score(course, preference, tagsFor(course)) }))
      .sort((a, b) => b.score - a.score || tieBreak(a.course, b.course));
  }

  function sort(courses, sortBy, preference, tagsFor, likesFor) {
    return [...courses].sort((a, b) => {
      if (sortBy === "preference") return score(b, preference, tagsFor(b)) - score(a, preference, tagsFor(a)) || tieBreak(a, b);
      if (sortBy === "popular") return likesFor(b) - likesFor(a) || tieBreak(a, b);
      if (sortBy === "nearby") return (Number(a.distance) || Infinity) - (Number(b.distance) || Infinity) || tieBreak(a, b);
      return tieBreak(a, b);
    });
  }

  function newId() {
    return root.crypto?.randomUUID?.() || `moov-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const api = { RULE_VERSION, DEMO_PLACES, pointForStop, matches, score, rank, sort, newId };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MoovOutingData = api;
})(typeof window !== "undefined" ? window : globalThis);
