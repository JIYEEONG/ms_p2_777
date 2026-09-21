/* Shared NAVER Maps adapter. REST credentials remain in the backend. */
(() => {
  'use strict';
  let readyPromise = null;
  let sdkFailed = false;
  const routes = new Map();
  const views = new Set();
  const english = () => document.documentElement.lang === 'en';
  const message = (ko, en) => english() ? en : ko;
  function failure(code) {
    const messages = {
      point: ['유효한 위치를 선택해 주세요.', 'Please select a valid location.'],
      query: ['주소를 2~200자로 입력해 주세요.', 'Enter an address between 2 and 200 characters.'],
      waypoints: ['경유지는 최대 5개까지 선택할 수 있어요.', 'You can select up to five stops.'],
      config: ['지도 연결 설정을 확인해 주세요.', 'Please check the map connection settings.'],
      auth: ['지도 인증을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.', 'Map authorization failed. Please try again later.'],
      timeout: ['지도 응답이 지연되고 있어요. 다시 시도해 주세요.', 'The map request timed out. Please try again.'],
      connection: ['지도를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.', 'Could not load the map. Check your connection and try again.'],
      service: ['지도 서비스를 이용할 수 없어요. 잠시 후 다시 시도해 주세요.', 'The map service is unavailable. Please try again later.'],
      route: ['자동차 경로를 찾지 못했어요. 도로 가까운 위치를 선택해 주세요.', 'No driving route was found. Please choose locations near a road.'],
      response: ['지도 응답을 확인하지 못했어요. 다시 시도해 주세요.', 'The map returned an invalid response. Please try again.'],
    };
    const error = new Error(message(...messages[code]));
    error.code = code;
    return error;
  }
  function point(value) {
    const lat = Array.isArray(value) ? value[0] : value?.lat;
    const lng = Array.isArray(value) ? value[1] : value?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw failure('point');
    return { lat, lng };
  }
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 16000);
    try {
      const response = await fetch('/api/maps/' + path, { ...options, signal: controller.signal });
      if (!response.ok) {
        if (response.status === 422 && path === 'directions') throw failure('route');
        if (response.status === 401 || response.status === 403) throw failure('auth');
        throw failure('service');
      }
      try { return await response.json(); }
      catch (_) { throw failure('response'); }
    } catch (error) {
      if (error.name === 'AbortError') throw failure('timeout');
      if (error.code) throw error;
      throw failure('connection');
    } finally { clearTimeout(timer); }
  }
  function sdk() {
    if (!window.naver?.maps?.Map || sdkFailed) throw failure('connection');
    return window.naver.maps;
  }
  function ready() {
    if (readyPromise) return readyPromise;
    if (window.naver?.maps?.Map && !sdkFailed) return Promise.resolve(window.naver.maps);
    readyPromise = (async () => {
      const config = await api('config', { cache: 'no-store' });
      if (typeof config.clientId !== 'string' || !config.clientId.trim()) throw failure('config');
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const oldAuthFailure = window.navermap_authFailure;
        let settled = false;
        const cleanup = () => {
          clearTimeout(timer);
          script.onerror = null;
          script.onload = null;
          if (window.navermap_authFailure === authFailed) window.navermap_authFailure = oldAuthFailure;
        };
        const fail = code => {
          if (settled) return;
          settled = true;
          sdkFailed = true;
          cleanup();
          script.remove();
          reject(failure(code));
        };
        const loaded = () => {
          if (settled) return;
          if (!window.naver?.maps?.Map) return fail('connection');
          settled = true;
          sdkFailed = false;
          cleanup();
          resolve(window.naver.maps);
        };
        const authFailed = () => fail('auth');
        const timer = setTimeout(() => fail('timeout'), 18000);
        window.navermap_authFailure = authFailed;
        script.async = true;
        script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + encodeURIComponent(config.clientId.trim());
        // Wait for the base script to finish assigning the naver.maps namespace.
        script.onload = loaded;
        script.onerror = () => fail('connection');
        document.head.append(script);
      });
    })().catch(error => { readyPromise = null; throw error; });
    return readyPromise;
  }
  function latLng(value) {
    const p = point(value);
    return new (sdk().LatLng)(p.lat, p.lng);
  }
  function createMap(element, center, zoom = 15) {
    const maps = sdk();
    element.dataset.mapProvider = 'naver';
    return new maps.Map(element, {
      center: latLng(center), zoom, zoomControl: true, scrollWheel: false,
      zoomControlOptions: { position: maps.Position.LEFT_CENTER, style: maps.ZoomControlStyle.SMALL },
      logoControl: true, mapDataControl: true,
      // Keep NAVER attribution in the native map controls.
      logoControlOptions: { position: maps.Position.BOTTOM_LEFT },
      mapDataControlOptions: { position: maps.Position.BOTTOM_LEFT },
      scaleControl: true,
    });
  }
  function eventFor(event) {
    return event?.coord ? { ...event, latlng: { lat: event.coord.lat(), lng: event.coord.lng() } } : event;
  }
  function createView(element, center, zoom = 15) {
    const native = createMap(element, center, zoom);
    const listeners = [];
    const layers = new Set();
    let removed = false;
    const view = {
      native,
      _layers: layers,
      setView(value, nextZoom) { if (!removed) native.updateBy(latLng(value), nextZoom ?? native.getZoom()); return view; },
      panTo(value, options = {}) { if (!removed) options.animate === false ? native.setCenter(latLng(value)) : native.panTo(latLng(value)); return view; },
      fitBounds(points, options = {}) {
        if (removed || !points.length) return view;
        const padding = options.padding || [0, 0];
        const tl = options.paddingTopLeft || padding, br = options.paddingBottomRight || padding;
        const bounds = { top: tl[1], left: tl[0], bottom: br[1], right: br[0] };
        if (Number.isFinite(options.maxZoom)) bounds.maxZoom = options.maxZoom;
        native.fitBounds(points.map(latLng), bounds);
        return view;
      },
      on(type, handler) { if (!removed) listeners.push(sdk().Event.addListener(native, type, event => handler(eventFor(event)))); return view; },
      stop() { if (!removed) native.stop(); return view; },
      invalidateSize() { if (!removed) native.autoResize(); return view; },
      remove() {
        if (removed) return;
        removed = true;
        for (const layer of [...layers]) layer.remove();
        listeners.forEach(listener => sdk().Event.removeListener(listener));
        native.destroy();
        views.delete(view);
      },
      zoomControl: { setPosition(position) {
        const positions = { topleft: 'TOP_LEFT', topright: 'TOP_RIGHT', bottomleft: 'BOTTOM_LEFT', bottomright: 'BOTTOM_RIGHT' };
        if (!removed) native.setOptions({ zoomControlOptions: { position: sdk().Position[positions[position] || 'TOP_LEFT'] } });
      } },
    };
    views.add(view);
    return view;
  }
  function layer(native) {
    let owner = null;
    const listeners = [];
    const wrapper = {
      native,
      addTo(view) {
        owner?._layers.delete(wrapper);
        owner = view;
        view._layers?.add(wrapper);
        native.setMap(view.native || view);
        return wrapper;
      },
      on(type, handler) { listeners.push(sdk().Event.addListener(native, type, event => handler(eventFor(event)))); return wrapper; },
      remove() {
        listeners.splice(0).forEach(listener => sdk().Event.removeListener(listener));
        native.setMap(null);
        owner?._layers.delete(wrapper);
        owner = null;
        wrapper._cleanup?.();
        return wrapper;
      },
    };
    return wrapper;
  }
  function marker(value, options = {}) {
    const maps = sdk();
    const element = options.element || document.createElement('div');
    if (!options.element) { element.textContent = '●'; element.style.cssText = 'color:#28754e;font-size:30px;text-align:center;'; }
    const size = options.size || [44, 44];
    const anchor = options.anchor || [size[0] / 2, size[1] / 2];
    const native = new maps.Marker({
      position: latLng(value), title: options.title || '', clickable: true,
      icon: { content: element, size: new maps.Size(...size), anchor: new maps.Point(...anchor) },
    });
    const wrapper = layer(native);
    let tooltip = null;
    let keyboardHandler = null;
    const elementListeners = [];
    wrapper.setLatLng = next => { native.setPosition(latLng(next)); return wrapper; };
    wrapper.getElement = () => element;
    const on = wrapper.on;
    wrapper.on = (type, handler) => {
      if (type === 'click') {
        element.tabIndex = 0;
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', options.title || element.textContent || '');
        keyboardHandler = event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handler(event); }
        };
        element.addEventListener('keydown', keyboardHandler);
        elementListeners.push(['keydown', keyboardHandler]);
      }
      return on(type, handler);
    };
    wrapper.bindTooltip = (html, tooltipOptions = {}) => {
      tooltip?.remove();
      const template = document.createElement('template');
      template.innerHTML = String(html);
      tooltip = document.createElement('div');
      tooltip.textContent = template.content.textContent;
      tooltip.className = tooltipOptions.className || '';
      tooltip.style.cssText = 'position:absolute;top:50%;transform:translateY(-50%);white-space:nowrap;pointer-events:none;background:white;color:#243429;border:1px solid #d8dfda;border-radius:8px;padding:5px 8px;font-size:12px;box-shadow:0 2px 8px #0002;';
      tooltip.style[tooltipOptions.direction === 'left' ? 'right' : 'left'] = 'calc(100% + 8px)';
      tooltip.hidden = !tooltipOptions.permanent;
      element.append(tooltip);
      const show = () => { if (tooltip) tooltip.hidden = false; };
      const hide = () => { if (tooltip && !tooltipOptions.permanent) tooltip.hidden = true; };
      for (const [type, handler] of [['mouseenter', show], ['focus', show], ['mouseleave', hide], ['blur', hide]]) {
        element.addEventListener(type, handler);
        elementListeners.push([type, handler]);
      }
      return wrapper;
    };
    wrapper._cleanup = () => {
      elementListeners.splice(0).forEach(([type, handler]) => element.removeEventListener(type, handler));
      tooltip?.remove();
    };
    return wrapper;
  }
  function polyline(points, options = {}) {
    const native = new (sdk().Polyline)({ path: points.map(latLng), strokeColor: options.color || '#28754e', strokeWeight: options.weight ?? 5, strokeOpacity: options.opacity ?? 1, strokeStyle: options.dashArray ? 'dash' : 'solid' });
    const wrapper = layer(native);
    wrapper.setLatLngs = values => { native.setPath(values.map(latLng)); return wrapper; };
    return wrapper;
  }
  function circle(center, options = {}) {
    return layer(new (sdk().Circle)({ center: latLng(center), radius: options.radius ?? 500, strokeColor: options.color || '#28754e', fillColor: options.color || '#28754e', fillOpacity: options.fillOpacity ?? 0.1, strokeWeight: 2 }));
  }
  async function geocode(query) {
    query = String(query || '').trim();
    if (query.length < 2 || query.length > 200) throw failure('query');
    const data = await api('geocode?query=' + encodeURIComponent(query));
    if (!Array.isArray(data.addresses)) throw failure('response');
    for (const item of data.addresses) point(item);
    return data;
  }
  async function reverseGeocode(lat, lng) {
    const p = point({ lat, lng });
    const data = await api('reverse?lat=' + p.lat + '&lng=' + p.lng);
    if (!Array.isArray(data.results)) throw failure('response');
    return data;
  }
  async function directions({ start, goal, waypoints = [] }) {
    if (!Array.isArray(waypoints) || waypoints.length > 5) throw failure('waypoints');
    const body = JSON.stringify({ start: point(start), goal: point(goal), waypoints: waypoints.map(point) });
    const now = Date.now();
    for (const [key, entry] of routes) if (entry.expires < now) routes.delete(key);
    const existing = routes.get(body);
    if (existing) return existing.promise;
    const entry = { expires: now + 60000 };
    entry.promise = api('directions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then(route => {
      if (!Array.isArray(route.points) || route.points.length < 2 || !Number.isFinite(route.distanceMeters) || route.distanceMeters < 0 || !Number.isFinite(route.durationSeconds) || route.durationSeconds < 0) throw failure('response');
      route.points.forEach(point);
      entry.expires = Date.now() + 60000;
      return route;
    }).catch(error => { if (routes.get(body) === entry) routes.delete(body); throw error; });
    routes.set(body, entry);
    return entry.promise;
  }
  window.MoovNaverMap = { ready, createMap, createView, marker, polyline, circle, geocode, reverseGeocode, directions };
})();
