const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load(directions) {
  const context = vm.createContext({
    state: { rentalHours: 3, rentalFlowStep: 'setup' }, saved: {},
    document: { addEventListener() {} }, window: {},
    MoovNaverMap: { directions },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/moov-home/js/rental-policy.js'), 'utf8'), context);
  return context;
}

test('long rental courses keep their stop order across Directions 5 batches', async () => {
  const calls = [];
  const context = load(async request => {
    calls.push(request);
    return { points: [request.start, ...request.waypoints, request.goal].map(p => [p.lat, p.lng]), distanceMeters: 1000, durationSeconds: 120 };
  });
  const stops = Array.from({ length: 15 }, (_, i) => ({ id: String(i), name: 'Stop ' + i, lat: 37.5 + i / 1000, lng: 127, dwell: 5 }));
  const result = await context.calculateNaverRentalRoute(stops);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(c => c.waypoints.length <= 5));
  assert.deepEqual(JSON.parse(JSON.stringify(result.points)), stops.map(p => [p.lat, p.lng]));
  assert.equal(result.distance, 3);
  assert.equal(result.minutes, 6);
  assert.equal(result.dwellMinutes, 70);
  assert.equal(result.nextMinutes, null);
  assert.equal(result.provider, 'naver');
});

test('unresolved imported stops never generate invented coordinates or API calls', async () => {
  const context = load(async () => { throw new Error('Must not call routing API'); });
  const result = await context.calculateNaverRentalRoute([{ name: 'Start', lat: 37.5, lng: 127 }, { name: 'Unknown', lat: null, lng: null }]);
  assert.equal(result.unresolved, true);
  assert.equal(result.distance, null);
});

test('single-leg route uses actual seconds and keeps failed routing visible to caller', async () => {
  const context = load(async () => ({ points: [[37.5, 127], [37.6, 127]], distanceMeters: 1234, durationSeconds: 91 }));
  const stops = [{ name: 'A', lat: 37.5, lng: 127 }, { name: 'B', lat: 37.6, lng: 127 }];
  const result = await context.calculateNaverRentalRoute(stops);
  assert.equal(result.nextMinutes, 2);
  assert.equal(result.distance, 1.2);
  context.MoovNaverMap.directions = async () => { throw new Error('route unavailable'); };
  await assert.rejects(context.calculateNaverRentalRoute(stops), /route unavailable/);
});
