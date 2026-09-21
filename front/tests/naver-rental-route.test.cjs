const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load(directions) {
  const context = vm.createContext({
    state: { rentalHours: 3, rentalFlowStep: 'setup' }, saved: {},
    document: { addEventListener() {}, documentElement:{lang:'ko'} }, window: {},
    MoovNaverMap: { directions },
    MoovLocationPicker: { configureRouteSearch(handlers) { context.routeHandlers = handlers; } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/naver-map.js'), 'utf8'), context);
  context.MoovNaverMap=context.window.MoovNaverMap;
  context.MoovNaverMap.directions=directions;
  context.MoovNaverMap.approachRoute=directions;
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

test('name-only saved course resolves missing stops with NAVER while keeping order, names and dwell', async () => {
  const context=load(async()=>{});
  const stops=prepareEditableRoute(context);
  stops[1]={name:'숭례문',lat:null,lng:null,dwell:40};
  stops[2]={name:'경복궁',lat:null,lng:null,dwell:20};
  const queries=[];
  context.MoovNaverMap.searchPlaces=async name=>{queries.push(name);return [{name,lat:37.56+queries.length/1000,lng:126.98}];};
  const route=context.calculateRentalRoute(stops);context.state.rentalUX.route=route;
  await context.resolveRentalRouteStops(route);
  const result=context.state.rentalUX.route;
  assert.equal(result.unresolved,undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(result.stops.map(p=>[p.name,p.dwell]))),stops.map(p=>[p.name,p.dwell]));
  assert.deepEqual(JSON.parse(JSON.stringify(result.stops[0])),stops[0]);
  assert.deepEqual(queries,['숭례문','경복궁']);
  assert.ok(result.stops.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)));
});

test('ambiguous names and failed searches stay unresolved with retry guidance instead of invented locations',async()=>{
  const context=load(async()=>{}),stops=prepareEditableRoute(context);
  stops[1]={name:'Same name',lat:null,lng:null};stops[2]={name:'Unavailable',lat:null,lng:null};
  context.MoovNaverMap.searchPlaces=async name=>{if(name==='Unavailable')throw Error('offline');return [{name,lat:37.5,lng:127},{name,lat:37.6,lng:127}];};
  const route=context.calculateRentalRoute(stops);context.state.rentalUX.route=route;
  await context.resolveRentalRouteStops(route);
  assert.equal(context.state.rentalUX.route.unresolved,true);
  assert.equal(context.state.rentalUX.route.locationLookupDone,true);
  assert.equal(context.state.rentalUX.route.stops[1].locationIssue,'choose');
  assert.equal(context.state.rentalUX.route.stops[2].locationIssue,'retry');
});

test('a late name lookup cannot overwrite a newer waypoint selection',async()=>{
  const context=load(async()=>{}),stops=prepareEditableRoute(context);
  stops[1]={name:'Old stop',lat:null,lng:null};
  let finish;context.MoovNaverMap.searchPlaces=()=>new Promise(resolve=>{finish=resolve;});
  const route=context.calculateRentalRoute(stops);context.state.rentalUX.route=route;
  const pending=context.resolveRentalRouteStops(route);
  const newer=context.calculateRentalRoute([stops[0],stops[2]]);context.state.rentalUX.route=newer;
  finish([{name:'Old stop',lat:37.57,lng:127}]);await pending;
  assert.equal(context.state.rentalUX.route,newer);
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

test('moving pickup preserves searched destination coordinates and invalidates the old road route', () => {
  const context = load(async () => {});
  Object.assign(context, { persist() {}, render() {} });
  Object.assign(context.state, {
    pickupLocation: 'Old pickup', rentalPickupCoords: { lat: 37.5, lng: 127 },
    rentalRecentPickups: [], routeStops: ['Old pickup', 'Newly searched destination'],
  });
  const goal = { id: 'search-result', name: 'Newly searched destination', lat: 37.5666103, lng: 126.9783882, dwell: 15 };
  context.state.rentalUX.route = { provider: 'naver', stops: [context.rentalPickup(), goal] };
  context.applyPickupLocation('Dragged pickup', { lat: 37.55, lng: 127.02 });
  const next = context.ensureRentalRoute();
  assert.deepEqual(JSON.parse(JSON.stringify(next.stops[1])), goal);
  assert.equal(next.stops[0].lat, 37.55);
  assert.notEqual(next.provider, 'naver');
  assert.equal(next.unresolved, undefined);
});

function prepareEditableRoute(context) {
  Object.assign(context, { persist() {}, render() {} });
  const stops = [
    { id: 'pickup', name: 'Pickup', lat: 37.5, lng: 127, dwell: 0 },
    { id: 'searched-stop', name: 'Searched stop', lat: 37.54, lng: 127.03, dwell: 40 },
    { id: 'imported-goal', name: 'Imported destination', lat: 37.59, lng: 127.1, dwell: 20 },
  ];
  Object.assign(context.state, {
    pickupLocation: stops[0].name, rentalPickupCoords: { lat: stops[0].lat, lng: stops[0].lng },
    rentalRecentPickups: [], routeStops: stops.map(p => p.name), selectedCourse: { id: 'original-course' },
  });
  context.state.rentalUX.route = context.calculateRentalRoute(stops);
  return stops;
}

test('pending and failed routes never expose local distance, duration or a straight-line path', async () => {
  const context = load(async () => { throw new Error('NAVER unavailable'); });
  prepareEditableRoute(context);
  const route = context.ensureRentalRoute();
  assert.equal(route.distance, null);
  assert.equal(route.minutes, null);
  assert.equal(route.points.length, 0);
  context.updateRentalRoadRoute(route);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(route.routeError, true);
  assert.equal(route.distance, null);
  assert.equal(route.points.length, 0);
});

test('saved old map geometry is discarded while stops and dwell times survive migration', () => {
  const context = load(async () => {});
  const stops = prepareEditableRoute(context);
  context.state.rentalUX.route = { stops, points: [[1, 2], [3, 4]], distance: 999, minutes: 999, provider: 'old-map' };
  const migrated = context.ensureRentalRoute();
  assert.deepEqual(JSON.parse(JSON.stringify(migrated.stops)), stops);
  assert.equal(migrated.distance, null);
  assert.equal(migrated.minutes, null);
  assert.equal(migrated.points.length, 0);
});

test('place search uses NAVER results and propagates failure instead of returning bundled places', async () => {
  const context = load(async () => {});
  const service = vm.runInContext('rentalServices', context);
  context.MoovNaverMap.searchPlaces = async () => { throw new Error('NAVER unavailable'); };
  await assert.rejects(service.search('어니언 성수'), /NAVER unavailable/);
  const expected = [{ name: 'NAVER result', lat: 37.56, lng: 127.03 }];
  context.MoovNaverMap.searchPlaces = async () => expected;
  assert.equal(await service.search('성수'), expected);
});

test('demo vehicle approaches and moves only along NAVER geometry without an offline graph', async () => {
  const context = load(async request => ({ points: [[37.546, 127.058], [request.goal.lat, request.goal.lng]], distanceMeters: 400, durationSeconds: 75 }));
  const route = await context.naverRentalApproach({ lat: 37.5446, lng: 127.0557 });
  assert.equal(route.provider, 'naver');
  assert.equal(route.points.length, 2);
  assert.equal(context.approachAt(route, .5).remainingMeters, 200);
  let displayedEta;
  context.updateVehiclePosition = (_, eta) => { displayedEta = eta; };
  context.tickRoadApproach({ approachRoute: route }, route.durationMs / 2);
  assert.equal(displayedEta, 38); // Half of NAVER's 75 seconds, rounded up.
  const end = context.approachAt(route, 1);
  assert.equal(end.lat, 37.5446);
  assert.equal(end.lng, 127.0557);
  assert.equal(end.remainingMeters, 0);
});

test('dragging a waypoint or destination changes only that stop and preserves dwell time', () => {
  for (const index of [1, 2]) {
    const context = load(async () => {});
    const original = prepareEditableRoute(context);
    context.applyRentalStopLocation(index, { id: 'dragged', name: 'Dragged point', lat: 37.56, lng: 127.08, dwell: 0 });
    const route = context.ensureRentalRoute();
    const stops = JSON.parse(JSON.stringify(route.stops));
    assert.deepEqual(stops[index], { id: 'dragged', name: 'Dragged point', lat: 37.56, lng: 127.08, dwell: original[index].dwell });
    for (let i = 0; i < stops.length; i++) if (i !== index) assert.deepEqual(stops[i], original[i]);
    assert.deepEqual(JSON.parse(JSON.stringify(context.state.routeStops)), stops.map(p => p.name));
    assert.equal(context.state.selectedCourse, null);
    assert.equal(context.state.rentalCourseModified, true);
    assert.notEqual(route.provider, 'naver');
  }
});

test('an older road response cannot replace a route changed by marker dragging', async () => {
  const pending = [];
  const context = load(request => new Promise(resolve => pending.push({ request, resolve })));
  prepareEditableRoute(context);
  const oldRoute = context.state.rentalUX.route;
  context.updateRentalRoadRoute(oldRoute);
  context.applyRentalStopLocation(2, { id: 'new-goal', name: 'New destination', lat: 37.61, lng: 127.12 });
  const draggedRoute = context.state.rentalUX.route;
  context.updateRentalRoadRoute(draggedRoute);
  assert.equal(pending.length, 2);
  const answer = pending => ({
    points: [pending.request.start, ...pending.request.waypoints, pending.request.goal].map(p => [p.lat, p.lng]),
    distanceMeters: 1200, durationSeconds: 200,
  });
  pending[1].resolve(answer(pending[1]));
  await new Promise(resolve => setImmediate(resolve));
  const latest = context.state.rentalUX.route;
  assert.equal(latest.provider, 'naver');
  assert.equal(latest.stops[2].name, 'New destination');
  pending[0].resolve(answer(pending[0]));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.state.rentalUX.route, latest);
  assert.equal(latest.stops[2].lng, 127.12);
});

test('marker edits cannot change a route after vehicle dispatch or during cleanup', () => {
  for (const change of [{ rentalFlowStep: 'matching' }, { tripActive: true }, { securityCleanup: { status: 'running' } }]) {
    const context = load(async () => {});
    prepareEditableRoute(context);
    const oldRoute = context.state.rentalUX.route;
    Object.assign(context.state, change);
    context.applyRentalStopLocation(1, { name: 'Unexpected edit', lat: 37.61, lng: 127.12 });
    assert.equal(context.state.rentalUX.route, oldRoute);
    assert.equal(context.state.selectedCourse.id, 'original-course');
  }
});

test('search selection applies immediately while an older road request is still pending', async () => {
  let finishOldRequest;
  const context = load(request => new Promise(resolve => { finishOldRequest = () => resolve({
    points: [request.start, ...request.waypoints, request.goal].map(p => [p.lat, p.lng]),
    distanceMeters: 1000, durationSeconds: 120,
  }); }));
  const original = prepareEditableRoute(context);
  context.updateRentalRoadRoute(context.state.rentalUX.route);
  context.routeHandlers.onSelect({ id: 'search-new', name: 'Search choice', lat: 37.61, lng: 127.12 }, 2, () => true);
  const selectedRoute = context.state.rentalUX.route;
  assert.equal(selectedRoute.stops[2].name, 'Search choice');
  assert.equal(selectedRoute.stops[2].dwell, original[2].dwell);
  assert.deepEqual(JSON.parse(JSON.stringify(selectedRoute.stops[1])), original[1]);
  finishOldRequest();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.state.rentalUX.route, selectedRoute);
});
