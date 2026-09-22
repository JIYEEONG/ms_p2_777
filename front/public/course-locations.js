(function (root) {
  'use strict';
  const cache = new Map();
  const valid = p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  async function resolvePoint(point, maps, context = '') {
    if (valid(point)) return point;
    const name = String(point.name || '').trim();
    if (name.length < 2 || /^지점\s*\d+$/.test(name)) return point;
    const key = context + '|' + name + '|' + (point.address || '');
    if (cache.has(key)) return { ...point, ...cache.get(key) };
    // Only an unambiguous name/address match can supply missing coordinates.
    const contextual = context && !name.includes(context) ? `${context} ${name}` : null;
    for (const query of [...new Set([point.address, contextual, name].filter(Boolean))]) {
      try {
        const places = await maps.searchPlaces(query);
        const match = maps.matchPlace(query, places);
        if (!valid(match)) continue;
        const location = { lat: match.lat, lng: match.lng, source: 'naver-search' };
        cache.set(key, location);
        if (cache.size > 300) cache.delete(cache.keys().next().value);
        return { ...point, ...location };
      } catch { /* A failed lookup remains retryable; other stops can still render. */ }
    }
    return point;
  }
  async function resolveCourses(courses, maps, current = () => true) {
    const resolved = courses.map(course => ({ ...course, points: course.points.map(p => ({ ...p })) }));
    const jobs = resolved.flatMap(course => course.points.map((point, index) => ({ course, point, index })));
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
      while (current() && next < jobs.length) {
        const { course, point, index } = jobs[next++];
        const context = String(course.name || '').match(/^(.+?)\s+(?:투어|나들이|여행|산책|코스)(?:\s|$)/)?.[1] || '';
        course.points[index] = await resolvePoint(point, maps, context);
      }
    }));
    return resolved;
  }
  const api = { valid, resolveCourses };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MoovCourseLocations = api;
})(typeof window !== 'undefined' ? window : globalThis);
