/* NAVER maps for course browsing and detail; course records belong to MOOV. */
(() => {
  'use strict';
  const sessions = new Set();
  const text = (ko, en) => document.documentElement.lang === 'en' ? en : ko;
  const valid = p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng);
  function disposeWithin(root) {
    for (const session of [...sessions]) {
      if (root === session.element || root.contains(session.element)) {
        session.active = false;
        session.map?.remove();
        session.status.remove();
        sessions.delete(session);
      }
    }
  }
  async function mount(element, courses, { route = false, onSelect } = {}) {
    disposeWithin(element);
    const status = document.createElement('p');
    status.className = 'course-map-status small muted';
    status.setAttribute('role', 'status');
    status.setAttribute('data-i18n-skip', '');
    element.after(status);
    element.setAttribute('data-i18n-skip', '');
    delete element.dataset.routeProvider;
    element.dataset.mapState = 'loading';
    const session = { element, status, map: null, active: true };
    sessions.add(session);
    const current = () => session.active && element.isConnected;
    const records = courses.flatMap(course => course.points.map((point, index) => ({ point, index, course })));
    const points = records.map(record => record.point).filter(valid);
    status.textContent = text('지도를 불러오는 중…', 'Loading map…');
    try {
      await MoovNaverMap.ready();
      if (!current()) return;
      element.replaceChildren();
      const map = session.map = MoovNaverMap.createView(element, points[0] || { lat: 37.5666, lng: 126.9784 }, 13);
      for (const { point, index, course } of records) {
        if (!valid(point)) continue;
        const pin = document.createElement('div');
        pin.className = 'naver-course-marker' + (index === course.points.length - 1 ? ' destination' : '');
        pin.dataset.courseId = course.id;
        pin.textContent = String(index + 1);
        const marker = MoovNaverMap.marker(point, { element: pin, size: [30, 30], title: `${course.name} · ${point.name}` }).addTo(map);
        if (onSelect) marker.on('click', () => { if (current()) onSelect(course.id); });
        marker.bindTooltip(`${course.name} · ${point.name}`);
      }
      MoovNaverMap.fitRoute(map, points);
      element.dataset.mapState = 'ready';
      const missing = records.length - points.length;
      status.textContent = missing
        ? text(`위치 미확인 장소 ${missing}곳은 지도에서 제외했어요.`, `${missing} places need location confirmation.`)
        : text('장소를 누르면 코스 상세를 볼 수 있어요.', 'Select a place to view its course.');
      if (!route || !records.length || missing || points.length < 2) return;
      status.textContent = text('자동차 경로를 조회하는 중…', 'Finding a driving route…');
      let path = [], distance = 0, seconds = 0;
      for (let index = 0; index < points.length - 1; index += 6) {
        const part = points.slice(index, index + 7);
        const road = await MoovNaverMap.directions({ start: part[0], goal: part.at(-1), waypoints: part.slice(1, -1) });
        if (!current()) return;
        path.push(...(path.length ? road.points.slice(1) : road.points));
        distance += road.distanceMeters;
        seconds += road.durationSeconds;
      }
      MoovNaverMap.polyline(path, { color: '#28754e', weight: 5 }).addTo(map);
      MoovNaverMap.fitRoute(map, [...path, ...points]);
      element.dataset.routeProvider = 'naver';
      status.textContent = text(`자동차 ${(distance / 1000).toFixed(1)} km · 약 ${Math.ceil(seconds / 60)}분`, `Driving ${(distance / 1000).toFixed(1)} km · about ${Math.ceil(seconds / 60)} min`);
    } catch (error) {
      if (!current()) return;
      element.dataset.mapState = session.map ? 'route-error' : 'error';
      status.textContent = error.message + ' ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'mini-action';
      retry.textContent = text('다시 시도', 'Retry');
      retry.onclick = () => { if (current()) void mount(element, courses, { route, onSelect }); };
      status.append(retry);
    }
  }
  window.MoovCourseMap = { mount, disposeWithin };
})();
