/* Shared NAVER Maps adapter. REST credentials remain in the backend. */
(() => {
  'use strict';
  let readyPromise = null;
  let sdkFailed = false;
  const routes = new Map();
  const views = new Set();
  const deviceLocations = new WeakMap();
  const english = () => document.documentElement.lang === 'en';
  const message = (ko, en) => english() ? en : ko;
  // Current-location demo fixture shared by taxi, rental and pickup selection.
  // Uses the existing Seongsu Station exit 3 test coordinates, never device GPS.
  function getCurrentPosition(success) {
    const place = { name: '성수역 3번 출구', category: '지하철역', lat: 37.5446, lng: 127.0557 };
    Promise.resolve().then(() => success({
      coords: { latitude: place.lat, longitude: place.lng, accuracy: 0 },
      place, simulated: true, timestamp: Date.now(),
    }));
  }
  function failure(code) {
    const messages = {
      point: ['유효한 위치를 선택해 주세요.', 'Please select a valid location.'],
      query: ['주소를 2~200자로 입력해 주세요.', 'Enter an address between 2 and 200 characters.'],
      waypoints: ['경유지는 최대 5개까지 선택할 수 있어요.', 'You can select up to five stops.'],
      stops: ['출발지와 목적지를 포함해 2~20개 장소를 선택해 주세요.', 'Choose 2–20 locations including pickup and destination.'],
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
    const timer = setTimeout(() => controller.abort(), path === 'approach' ? 26000 : 16000);
    try {
      const response = await fetch('/api/maps/' + path, { ...options, signal: controller.signal });
      if (!response.ok) {
        if (response.status === 422 && ['directions','approach'].includes(path)) throw failure('route');
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
    // Touch gestures inside the map belong to NAVER, including two-finger zoom.
    element.style.touchAction = 'none';
    const map = new maps.Map(element, {
      center: latLng(center), zoom, zoomControl: true, scrollWheel: true,
      draggable: true, pinchZoom: true, disableDoubleTapZoom: false,
      disableTwoFingerTapZoom: false,
      zoomControlOptions: { position: maps.Position.LEFT_CENTER, style: maps.ZoomControlStyle.SMALL },
      logoControl: true, mapDataControl: true,
      // Keep NAVER attribution in the native map controls.
      logoControlOptions: { position: maps.Position.BOTTOM_LEFT },
      mapDataControlOptions: { position: maps.Position.BOTTOM_LEFT },
      scaleControl: true,
    });
    element.addEventListener('pointerdown', () => { map.moovInteracted = true; }, { passive: true });
    element.addEventListener('touchstart', () => { map.moovInteracted = true; }, { passive: true });
    element.addEventListener('wheel', () => { map.moovInteracted = true; }, { passive: true, capture: true });
    const location = { token: 0, removed: false, marker: null };
    deviceLocations.set(map, location);
    const destroy = map.destroy.bind(map);
    map.destroy = () => {
      location.removed = true;
      location.token++;
      location.marker?.setMap(null);
      destroy();
    };
    return map;
  }
  function locateOnMap(view, button, notify = () => {}) {
    const map = view?.native || view;
    const location = map && deviceLocations.get(map);
    if (!location || location.removed) {
      notify(message('지도를 불러오는 중이에요. 잠시 후 다시 눌러 주세요.', 'The map is loading. Please try again shortly.'));
      return;
    }
    const token = ++location.token;
    const current = () => !location.removed && location.token === token && button?.isConnected;
    const finish = () => { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } };
    const fail = error => {
      finish();
      if (!current()) return;
      notify(error?.code === 1
        ? message('브라우저와 기기의 위치 권한을 허용한 뒤 다시 눌러 주세요.', 'Allow location access in your browser and device, then try again.')
        : message('현재 위치를 찾지 못했어요. 기기의 위치 기능을 켜고 다시 시도해 주세요.', 'Could not find your location. Enable device location and try again.'));
    };
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    notify(message('테스트 위치를 표시하고 있어요…', 'Showing the demo location…'));
    window.MoovNaverMap.getCurrentPosition(position => {
      finish();
      if (!current()) return;
      const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (!Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) { fail(); return; }
      window.MoovLocationPicker?.cancelSelection();
      const title = position.simulated ? message('성수역 · 테스트 위치', 'Seongsu Station · Demo') : message('내 위치', 'My location');
      const content = document.createElement('div');
      content.className = 'moov-current-location';
      content.setAttribute('role', 'img');
      content.setAttribute('aria-label', title);
      content.style.cssText = 'position:relative;width:22px;height:22px;border:3px solid white;border-radius:50%;background:#287bea;box-shadow:0 0 0 8px rgba(40,123,234,.18),0 2px 8px #0003;';
      const label = document.createElement('span');
      label.textContent = title;
      label.style.cssText = 'position:absolute;top:28px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:3px 7px;border-radius:8px;background:white;color:#2364b7;font-size:12px;font-weight:800;box-shadow:0 1px 5px #0002;';
      content.append(label);
      location.marker?.setMap(null);
      const maps = sdk();
      location.marker = new maps.Marker({ map, position: latLng(coordinates), title, zIndex: 1000,
        icon: { content, size: new maps.Size(22,22), anchor: new maps.Point(11,11) } });
      // A route request may still be running; it must not recenter over the GPS action.
      map.moovInteracted = true;
      map.updateBy(latLng(coordinates), Math.max(16, map.getZoom()));
      notify(position.simulated ? message('성수역을 테스트용 내 위치로 표시했어요.', 'Seongsu Station is shown as your demo location.') : message('파란 점이 현재 위치예요.', 'The blue dot shows your current location.'));
    }, fail, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  }
  function eventFor(event) {
    return event?.coord ? { ...event, latlng: { lat: event.coord.lat(), lng: event.coord.lng() } } : event;
  }
  function fitPoints(native, points, options = {}) {
    if (!points.length) return;
    const coordinates = points.map(latLng);
    const bounds = new (sdk().LatLngBounds)(coordinates[0], coordinates[0]);
    for (const coordinate of coordinates.slice(1)) bounds.extend(coordinate);
    const padding = options.padding || [0, 0];
    const tl = options.paddingTopLeft || padding, br = options.paddingBottomRight || padding;
    const margin = {
      top: options.top ?? tl[1], left: options.left ?? tl[0],
      bottom: options.bottom ?? br[1], right: options.right ?? br[0],
    };
    if (Number.isFinite(options.maxZoom)) margin.maxZoom = options.maxZoom;
    native.fitBounds(bounds, margin);
  }
  function fitRoute(map, points, options = {}) {
    if (!map || !points.length) return map;
    // The SDK selects the closest zoom that contains every real route coordinate.
    // Keep room for the marker icons and attribution, even on the short map panel.
    const padding = options.padding || [36, 40];
    const margins = {
      paddingTopLeft: options.paddingTopLeft || padding,
      paddingBottomRight: options.paddingBottomRight || options.padding || [36, 50],
      maxZoom: 18,
      ...options,
    };
    if (map.native) map.fitBounds(points, margins);
    else fitPoints(map, points, margins);
    return map;
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
        fitPoints(native, points, options);
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
        owner?._layers?.delete(wrapper);
        owner = view;
        view._layers?.add(wrapper);
        native.setMap(view.native || view);
        return wrapper;
      },
      on(type, handler) { listeners.push(sdk().Event.addListener(native, type, event => handler(eventFor(event)))); return wrapper; },
      remove() {
        listeners.splice(0).forEach(listener => sdk().Event.removeListener(listener));
        native.setMap(null);
        owner?._layers?.delete(wrapper);
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
      position: latLng(value), title: options.title || '', clickable: true, draggable: options.draggable === true,
      icon: { content: element, size: new maps.Size(...size), anchor: new maps.Point(...anchor) },
    });
    const wrapper = layer(native);
    let tooltip = null;
    let keyboardHandler = null;
    const elementListeners = [];
    wrapper.setLatLng = next => { native.setPosition(latLng(next)); return wrapper; };
    wrapper.getLatLng = () => { const p = native.getPosition(); return { lat: p.lat(), lng: p.lng() }; };
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
  async function searchPlaces(query) {
    query = String(query || '').trim();
    if (query.length < 2 || query.length > 200) throw failure('query');
    const data = await api('search?query=' + encodeURIComponent(query));
    if (!Array.isArray(data.places)) throw failure('response');
    data.places.forEach(point);
    return data.places;
  }
  function matchPlace(query, places) {
    const normalize=value=>String(value||'').normalize('NFKC').replace(/[\s()]+/g,'').toLocaleLowerCase();
    const valid=places.filter(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lng));
    const exact=valid.filter(item=>normalize(item.name)===normalize(query));
    const distinct=items=>[...new Map(items.map(item=>[`${item.lat},${item.lng}`,item])).values()];
    const matches=distinct(exact);
    if(matches.length)return matches.length===1?matches[0]:null;
    // A single geocoded street/parcel address is usable, but never guess a POI
    // from search ranking when several similarly named businesses exist.
    const addresses=distinct(valid.filter(item=>item.category==='주소'));
    return addresses.length===1?addresses[0]:null;
  }
  async function describePoint(value) {
    const p = point(value);
    let name = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    let address = '', landmark = '', landmarkDistance = null;
    try {
      const data = await reverseGeocode(p.lat, p.lng);
      const r = data.results.find(item => item.name === 'roadaddr') || data.results[0];
      if (r) {
        const region = ['area1', 'area2', 'area3', 'area4'].map(key => r.region?.[key]?.name).filter(Boolean);
        const land = r.land || {};
        const number = [land.number1, land.number2].filter(Boolean).join('-');
        address = [...region, land.name, number].filter(Boolean).join(' ');
        name = address || name;
        const building = Object.values(land).find(item => item?.type === 'building' && item.value?.trim());
        if (building) landmark = building.value.trim();
        else if (address) {
          // Local Search has no radius parameter. Verify distance ourselves and
          // never replace the passenger's selected coordinate with a POI point.
          try {
            const candidates = await searchPlaces(address);
            const nearest = candidates.filter(item => item.name && item.category !== '주소').map(item => {
              const rad = Math.PI / 180;
              const a = Math.sin((item.lat - p.lat) * rad / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(item.lat * rad) * Math.sin((item.lng - p.lng) * rad / 2) ** 2;
              return { ...item, meters: 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(a))) };
            }).filter(item => item.meters <= 80).sort((a, b) => a.meters - b.meters)[0];
            if (nearest) { landmark = nearest.name; landmarkDistance = Math.round(nearest.meters); }
          } catch { /* Address remains available if Local Search is unavailable. */ }
        }
        if (landmark) name = landmark;
      }
    } catch { /* The selected coordinates remain usable without an address. */ }
    return { ...p, name, address, landmark, landmarkDistance, id: `map-${p.lat}-${p.lng}`, category: message('지도 선택', 'Map selection'), dwell: 0 };
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
  async function directionsForStops(stops) {
    if(!Array.isArray(stops)||stops.length<2||stops.length>20)throw failure('stops');
    stops.forEach(point);
    const route={points:[],distanceMeters:0,durationSeconds:0};
    for(let i=0;i<stops.length-1;i+=6){
      const part=stops.slice(i,i+7);
      const leg=await window.MoovNaverMap.directions({start:part[0],goal:part.at(-1),waypoints:part.slice(1,-1)});
      route.points.push(...(route.points.length?leg.points.slice(1):leg.points));
      route.distanceMeters+=leg.distanceMeters;route.durationSeconds+=leg.durationSeconds;
    }
    return route;
  }
  const metersBetween=(a,b)=>{
    const r=Math.PI/180,h=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;
    return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
  };
  async function approachRoute({start,goal}){
    const route=await api('approach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:point(start),goal:point(goal)})});
    if(!Array.isArray(route.points)||route.points.length<2||!Number.isFinite(route.distanceMeters)||route.distanceMeters<0||!Number.isFinite(route.durationSeconds)||route.durationSeconds<0)throw failure('response');
    route.points.forEach(point);return route;
  }
  async function pickupApproach(pickup,vehiclePosition=null){
    pickup=point(pickup);
    // There is no live fleet in this demo. Compare nearby simulated vehicles;
    // a real vehicle position, when supplied, is never replaced or relocated.
    const starts=vehiclePosition?[point(vehiclePosition)]:[[.003,.003],[-.003,-.003],[.003,-.003],[-.003,.003]].map(([lat,lng])=>({lat:pickup.lat+lat,lng:pickup.lng+lng}));
    const results=await Promise.allSettled(starts.map(start=>window.MoovNaverMap.approachRoute({start,goal:pickup})));
    const candidates=results.filter(r=>r.status==='fulfilled').map(r=>r.value).sort((a,b)=>a.distanceMeters-b.distanceMeters||a.durationSeconds-b.durationSeconds);
    if(!candidates.length)throw results.find(r=>r.status==='rejected')?.reason||failure('route');
    const route=candidates[0],cumulative=[0];
    for(let i=1;i<route.points.length;i++)cumulative.push(cumulative.at(-1)+metersBetween(point(route.points[i-1]),point(route.points[i])));
    const last=point(route.points.at(-1));
    return {...route,cumulative,totalMeters:cumulative.at(-1),pickupSnap:{...last,distanceMeters:Math.round(metersBetween(pickup,last))},durationMs:18000,provider:'naver',demo:!vehiclePosition};
  }
  function approachPosition(route,progress){
    progress=Math.max(0,Math.min(1,progress));
    const distance=progress*route.totalMeters,c=route.cumulative;
    let i=1;while(i<c.length-1&&c[i]<distance)i++;
    const a=route.points[i-1],b=route.points[i],t=(distance-c[i-1])/(c[i]-c[i-1]||1);
    const lat=a[0]+(b[0]-a[0])*t,lng=a[1]+(b[1]-a[1])*t;
    return {lat,lng,remainingMeters:Math.max(0,route.distanceMeters*(1-progress)),remainingPoints:[[lat,lng],...route.points.slice(i)]};
  }
  window.MoovNaverMap = { ready, createMap, createView, fitRoute, locateOnMap, getCurrentPosition, marker, polyline, circle, geocode, searchPlaces, matchPlace, describePoint, reverseGeocode, directions, directionsForStops, approachRoute, pickupApproach, approachPosition };
})();
