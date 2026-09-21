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
  }
  const maps = {
    Map: NativeMap, LatLng, Marker: Shape, Polyline: Shape, Circle: Shape,
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
