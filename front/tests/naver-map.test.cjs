const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../public/naver-map.js'), 'utf8');
function node(tag = 'div') {
  const listeners = new Map();
  return {
    tagName: tag, children: [], style: {}, dataset: {}, textContent: '', content: { textContent: '' },
    setAttribute(name, value) { this[name] = value; },
    append(child) { this.children.push(child); },
    remove() { this.removed = true; },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    listeners,
  };
}
function setup({ fetch: respond, loaded = true, lang = 'ko' } = {}) {
  const calls = [], scripts = [], removedListeners = [];
  class LatLng { constructor(lat, lng) { this.latitude = lat; this.longitude = lng; } lat() { return this.latitude; } lng() { return this.longitude; } }
  class LatLngBounds {
    constructor(sw, ne) { this.coordinates = [sw, ne]; }
    extend(coordinate) { this.coordinates.push(coordinate); return this; }
  }
  class NativeMap {
    constructor(element, options) { this.element = element; this.options = options; this.center = options.center; this.zoom = options.zoom; }
    updateBy(center, zoom) { this.center = center; this.zoom = zoom; }
    getZoom() { return this.zoom; }
    setCenter(center) { this.center = center; }
    panTo(center) { this.center = center; }
    fitBounds(points, options) { this.fit = { points, options }; }
    setOptions(options) { Object.assign(this.options, options); }
    stop() { this.stopped = true; }
    autoResize() { this.resized = true; }
    destroy() { this.destroyed = true; }
  }
  class Shape {
    constructor(options) { this.options = options; }
    setMap(map) { this.map = map; }
    setPath(path) { this.path = path; }
    setPosition(position) { this.position = position; }
    getPosition() { return this.position || this.options.position; }
  }
  const maps = {
    Map: NativeMap, LatLng, LatLngBounds, Marker: Shape, Polyline: Shape, Circle: Shape,
    Position: { TOP_LEFT: 1, BOTTOM_LEFT: 2, LEFT_CENTER: 3 },
    ZoomControlStyle: { SMALL: 1 },
    Size: class { constructor(width, height) { this.width = width; this.height = height; } },
    Point: class { constructor(x, y) { this.x = x; this.y = y; } },
    Event: { addListener(target, type, handler) { return { target, type, handler }; }, removeListener(listener) { removedListeners.push(listener); } },
  };
  const document = { documentElement: { lang }, createElement: node, head: { append(script) { scripts.push(script); } } };
  const window = loaded ? { naver: { maps } } : {};
  const fetch = async (url, options) => {
    calls.push({ url, options });
    return respond ? respond(url, options, calls.length) : { ok: true, json: async () => ({ clientId: 'public-client-id' }) };
  };
  vm.runInNewContext(source, { window, document, fetch, AbortController, setTimeout, clearTimeout, Date });
  return { provider: window.MoovNaverMap, window, document, maps, calls, scripts, removedListeners };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const route = () => ({ points: [[37.5, 127], [37.6, 127.1]], distanceMeters: 1200, durationSeconds: 180 });
const request = () => ({ start: [37.5, 127], goal: [37.6, 127.1], waypoints: [[37.55, 127.03], [37.57, 127.05]] });

test('taxi and rental match venue names with spacing variations without choosing an unrelated top result',()=>{
  const {provider}=setup();
  const actual={name:'예술의전당오페라하우스',lat:37.479396,lng:127.0140848};
  assert.equal(provider.matchPlace('예술의전당 오페라하우스',[{name:'오페라하우스 아파트',lat:37.48,lng:127.02},actual]),actual);
  assert.equal(provider.matchPlace('한옥',[{name:'숙소 A',lat:37.5,lng:127}]),null);
  assert.equal(provider.matchPlace('Same',[{name:'Same',lat:37.5,lng:127},{name:'Same',lat:37.6,lng:127}]),null);
  const address={name:'서울특별시 중구 세종대로 110',category:'주소',lat:37.56,lng:126.97};
  assert.equal(provider.matchPlace('세종대로 110',[address]),address);
});

test('shared full-course directions combine distance and time across API batches in order',async()=>{
  const {provider}=setup(),calls=[];
  provider.directions=async r=>{calls.push(r);return {points:[r.start,...r.waypoints,r.goal].map(p=>[p.lat,p.lng]),distanceMeters:1234,durationSeconds:101};};
  const stops=Array.from({length:9},(_,i)=>({lat:37.5+i/1000,lng:127}));
  const result=await provider.directionsForStops(stops);
  assert.equal(calls.length,2);assert.ok(calls.every(r=>r.waypoints.length<=5));
  assert.equal(result.distanceMeters,2468);assert.equal(result.durationSeconds,202);
  assert.deepEqual(JSON.parse(JSON.stringify(result.points)),stops.map(p=>[p.lat,p.lng]));
  await assert.rejects(provider.directionsForStops([...stops,{lat:NaN,lng:127}]),e=>e.code==='point');
  assert.equal(calls.length,2);
});

test('pickup description uses a nearby business but retains the exact selected coordinate and address', async () => {
  const env = setup({ fetch: async url => ({ ok: true, json: async () => url.includes('/reverse?') ? {
    results: [{ name: 'roadaddr', region: { area1: { name: '서울' } }, land: { name: '테스트로', number1: '10' } }],
  } : { places: [
    { name: 'Far away', category: '카페', lat: 37.7, lng: 127.2 },
    { name: 'Nearby cafe', category: '카페', lat: 37.5002, lng: 127 },
    { name: 'Nearest shop', category: '가게', lat: 37.5001, lng: 127 },
  ] } }) });
  const result = await env.provider.describePoint({ lat: 37.5, lng: 127 });
  assert.equal(result.name, 'Nearest shop');
  assert.equal(result.address, '서울 테스트로 10');
  assert.equal(result.lat, 37.5); assert.equal(result.lng, 127);
  assert.equal(result.landmarkDistance, 11);
});

test('pickup description rejects distant businesses and keeps the address when search fails', async () => {
  for (const failed of [false, true]) {
    const env = setup({ fetch: async url => {
      if (url.includes('/reverse?')) return { ok: true, json: async () => ({ results: [{ name: 'addr', region: { area3: { name: '성수동' } }, land: { number1: '10' } }] }) };
      if (failed) throw new Error('offline');
      return { ok: true, json: async () => ({ places: [{ name: 'Far shop', category: '카페', lat: 37.6, lng: 127 }] }) };
    } });
    const result = await env.provider.describePoint([37.5, 127]);
    assert.equal(result.name, '성수동 10'); assert.equal(result.landmark, '');
  }
});

test('reverse geocoding building names avoid an additional search and omit the proximity prefix', async () => {
  const env = setup({ lang: 'en', fetch: async () => ({ ok: true, json: async () => ({ results: [{ name: 'roadaddr', land: { name: 'Road', number1: '1', addition0: { type: 'building', value: 'Building A' } } }] }) }) });
  const result = await env.provider.describePoint([37.5, 127]);
  assert.equal(result.name, 'Building A'); assert.equal(result.address, 'Road 1');
  assert.equal(env.calls.length, 1);
});

test('maps allow mouse and touch panning and reserve pinch gestures for map zoom', () => {
  const env = setup();
  const element = node();
  const map = env.provider.createMap(element, [37.5, 127]);
  assert.equal(map.options.draggable, true);
  assert.equal(map.options.pinchZoom, true);
  assert.equal(map.options.disableDoubleTapZoom, false);
  assert.equal(map.options.disableTwoFingerTapZoom, false);
  assert.equal(element.style.touchAction, 'none');
});

test('route fitting includes off-route waypoints without moving their coordinates', () => {
  const env = setup();
  const map = env.provider.createMap(node(), [37.5, 127]);
  const points = [[37.5, 127], { lat: 37.52, lng: 127.01 }, [37.7, 126.8]];
  assert.equal(env.provider.fitRoute(map, points), map);
  assert.ok(map.fit.points instanceof env.maps.LatLngBounds);
  assert.deepEqual(map.fit.points.coordinates.map(p => [p.lat(), p.lng()]), [points[0], points[0], [37.52, 127.01], points[2]]);
  assert.deepEqual(JSON.parse(JSON.stringify(map.fit.options)), { top: 40, left: 36, bottom: 50, right: 36, maxZoom: 18 });
  assert.deepEqual(points, [[37.5, 127], { lat: 37.52, lng: 127.01 }, [37.7, 126.8]]);
});

test('coincident pickup and destination retain a usable maximum zoom and configurable padding', () => {
  const env = setup();
  const view = env.provider.createView(node(), [37.5, 127]);
  assert.equal(env.provider.fitRoute(view, [[37.5, 127], [37.5, 127]], { padding: [28, 32], bottom: 60, maxZoom: 17 }), view);
  assert.deepEqual(JSON.parse(JSON.stringify(view.native.fit.options)), { top: 32, left: 28, bottom: 60, right: 28, maxZoom: 17 });
  assert.ok(view.native.fit.points.coordinates.every(p => p.lat() === 37.5 && p.lng() === 127));
  const previousFit = view.native.fit;
  env.provider.fitRoute(view, []);
  assert.equal(view.native.fit, previousFit);
  assert.throws(() => env.provider.fitRoute(view, [[37.5, 127], [NaN, 127]]), error => error.code === 'point');
  assert.equal(view.native.fit, previousFit);
  view.remove();
  env.provider.fitRoute(view, [[37.6, 127.1]]);
  assert.equal(view.native.fit, previousFit);
});

test('draggable marker exposes its new coordinates and disposes drag listeners', () => {
  const env = setup();
  const view = env.provider.createView(node(), [37.5, 127]);
  const marker = env.provider.marker([37.5, 127], { draggable: true }).addTo(view);
  assert.equal(marker.native.options.draggable, true);
  marker.on('dragend', () => {});
  marker.native.setPosition(new env.maps.LatLng(37.6, 126.9));
  assert.deepEqual(JSON.parse(JSON.stringify(marker.getLatLng())), { lat: 37.6, lng: 126.9 });
  view.remove();
  assert.ok(env.removedListeners.some(listener => listener.type === 'dragend'));
});

test('a temporary selection marker can be removed from an existing native map', () => {
  const env = setup();
  const map = env.provider.createMap(node(), [37.5, 127]);
  const marker = env.provider.marker([37.5, 127], { draggable: true }).addTo(map);
  marker.on('dragend', () => {});
  assert.doesNotThrow(() => marker.remove());
  assert.equal(marker.native.map, null);
  assert.equal(env.removedListeners.length, 1);
  assert.doesNotThrow(() => marker.remove());
});

test('search validates coordinates and preserves exact result identity', async () => {
  const place = { id: 'custom-place', name: 'Custom place', lat: 37.56, lng: 126.97 };
  const env = setup({ fetch: async () => ({ ok: true, json: async () => ({ places: [place] }) }) });
  assert.equal((await env.provider.searchPlaces('Seoul'))[0].id, place.id);
  assert.match(env.calls[0].url, /search\?query=Seoul/);
  place.lat = 100;
  await assert.rejects(env.provider.searchPlaces('Seoul'), error => error.code === 'point');
});

test('concurrent SDK users share one config request and script, containing only the public key', async () => {
  const env = setup({ loaded: false });
  const first = env.provider.ready(), second = env.provider.ready();
  assert.equal(first, second);
  await tick();
  assert.equal(env.calls.length, 1);
  assert.equal(env.scripts.length, 1);
  assert.match(env.scripts[0].src, /ncpKeyId=public-client-id/);
  assert.doesNotMatch(env.scripts[0].src, /secret/i);
  env.window.naver = { maps: env.maps };
  assert.doesNotMatch(env.scripts[0].src, /callback=/);
  env.scripts[0].onload();
  assert.equal(await first, env.maps);
  assert.equal(env.scripts[0].onload, null);
});

test('authentication failure clears failed loading state so a later attempt can succeed', async () => {
  const env = setup({ loaded: false, lang: 'en' });
  const first = env.provider.ready();
  await tick();
  env.window.naver = { maps: env.maps }; // SDK namespace can exist even when authorization fails.
  env.window.navermap_authFailure();
  await assert.rejects(first, /authorization/);
  assert.equal(env.scripts[0].removed, true);
  const retry = env.provider.ready();
  await tick();
  assert.equal(env.scripts.length, 2);
  env.scripts[1].onload();
  assert.equal(await retry, env.maps);
});

test('invalid coordinates and too many stops never reach the backend', async () => {
  const env = setup();
  for (const invalid of [[NaN, 127], [37, Infinity], [91, 127], [37, 181], [null, 127]]) {
    await assert.rejects(env.provider.directions({ start: invalid, goal: [37, 127] }), error => error.code === 'point');
  }
  await assert.rejects(env.provider.reverseGeocode(NaN, 127), error => error.code === 'point');
  await assert.rejects(env.provider.directions({ ...request(), waypoints: Array(6).fill([37.5, 127]) }), error => error.code === 'waypoints');
  assert.equal(env.calls.length, 0);
});

test('route deduplication retains all waypoint ordering and the backend coordinate/time conventions', async () => {
  const env = setup({ fetch: async () => ({ ok: true, json: async () => route() }) });
  const [a, b] = await Promise.all([env.provider.directions(request()), env.provider.directions(request())]);
  assert.equal(env.calls.length, 1);
  assert.equal(a, b);
  assert.equal(a.durationSeconds, 180);
  assert.deepEqual(a.points[0], [37.5, 127]);
  assert.deepEqual(JSON.parse(env.calls[0].options.body), {
    start: { lat: 37.5, lng: 127 }, goal: { lat: 37.6, lng: 127.1 },
    waypoints: [{ lat: 37.55, lng: 127.03 }, { lat: 37.57, lng: 127.05 }],
  });
  await env.provider.directions(request());
  assert.equal(env.calls.length, 1);
  await env.provider.directions({ ...request(), waypoints: request().waypoints.reverse() });
  assert.equal(env.calls.length, 2);
});

test('failed and malformed routes are not cached or silently replaced with straight lines', async () => {
  const env = setup({ lang: 'en', fetch: async (_, __, count) => count === 1
    ? { ok: false, status: 422 }
    : { ok: true, json: async () => count === 2 ? { ...route(), durationSeconds: Infinity } : route() } });
  await assert.rejects(env.provider.directions(request()), /No driving route/);
  await assert.rejects(env.provider.directions(request()), /invalid response/);
  assert.equal((await env.provider.directions(request())).distanceMeters, 1200);
  assert.equal(env.calls.length, 3);
});

test('approach requests omit passenger stops and simulated dispatch chooses the shortest road route', async () => {
  const distances = [3300, 500, 1100, 700];
  const env = setup({ fetch: async (_, options, count) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ['goal', 'start']);
    assert.deepEqual(body.goal, {lat:37.5,lng:127});
    return {ok:true,json:async()=>({points:[[body.start.lat,body.start.lng],[37.5,127]],distanceMeters:distances[count-1],durationSeconds:count*100})};
  }});
  const approach = await env.provider.pickupApproach({lat:37.5,lng:127});
  assert.equal(env.calls.length,4);
  assert.ok(env.calls.every(call => call.url.endsWith('/approach')));
  assert.equal(approach.distanceMeters,500);
  assert.equal(approach.durationSeconds,200);
  assert.equal(approach.demo,true);
  assert.equal(env.provider.approachPosition(approach,.5).remainingMeters,250);
  const end=env.provider.approachPosition(approach,1);
  assert.equal(end.lat,37.5);assert.equal(end.lng,127);
});

test('an assigned vehicle keeps its actual location and failed approach never falls back to passenger geometry', async () => {
  const env=setup({fetch:async()=>({ok:true,json:async()=>route()})});
  const approach=await env.provider.pickupApproach({lat:37.6,lng:127.1},{lat:37.5,lng:127});
  assert.equal(env.calls.length,1);
  assert.deepEqual(JSON.parse(env.calls[0].options.body),{start:{lat:37.5,lng:127},goal:{lat:37.6,lng:127.1}});
  assert.equal(approach.demo,false);
  const failed=setup({fetch:async()=>({ok:false,status:422})});
  await assert.rejects(failed.provider.pickupApproach({lat:37.6,lng:127.1}));
});

test('removing a view detaches overlays and listeners while keeping native map attribution enabled', () => {
  const env = setup();
  const view = env.provider.createView(node(), [37.5, 127], 15);
  assert.equal(view.native.options.logoControl, true);
  assert.equal(view.native.options.mapDataControl, true);
  const element = node();
  const pin = env.provider.marker([37.5, 127], { element, title: 'Pickup' }).addTo(view).on('click', () => {});
  const line = env.provider.polyline([[37.5, 127], [37.6, 127.1]]).addTo(view);
  view.on('click', () => {});
  assert.equal(pin.getElement(), element);
  view.fitBounds([[37.5, 127], [37.6, 127.1]], { paddingTopLeft: [48, 62], paddingBottomRight: [48, 100], maxZoom: 16 });
  assert.deepEqual(JSON.parse(JSON.stringify(view.native.fit.options)), { top: 62, left: 48, bottom: 100, right: 48, maxZoom: 16 });
  view.remove();
  assert.equal(view.native.destroyed, true);
  assert.equal(pin.native.map, null);
  assert.equal(line.native.map, null);
  assert.equal(element.listeners.size, 0);
  assert.equal(env.removedListeners.length, 2);
  view.remove(); // Cleanup is safe during consecutive re-renders.
  assert.equal(env.removedListeners.length, 2);
});
