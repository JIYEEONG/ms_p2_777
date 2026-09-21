const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = name => fs.readFileSync(path.join(__dirname, '../public/moov-home/js', name), 'utf8');
const roadSource = source('road-data.js');
const distance = (a, b) => {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lng-a.lng)*rad/2)**2;
  return 6371*2*Math.asin(Math.min(1, Math.sqrt(h)));
};
function harness(graphSource = roadSource) {
  let now = 1000000;
  const elements = new Map();
  const stops = [
    {name:'성수역', lat:37.5446, lng:127.0557},
    {name:'서울숲', lat:37.5445, lng:127.0374},
    {name:'디뮤지엄', lat:37.5445, lng:127.0443},
  ];
  const state = {tripActive:true, rentalFlowStep:'driving', rentalVehicleType:'standard', usageStartedAt:900000, rentalEndsAt:11800000,
    rentalUX:{route:{stops}, dispatch:{vehicle:{id:'standard', plate:'MOOV 24', battery:78}}}};
  const context = vm.createContext({state, Date:class extends Date {static now(){return now;}},
    rentalDistance:distance, rentalClone:x=>JSON.parse(JSON.stringify(x)), ensureRentalRoute:()=>state.rentalUX.route,
    cleanupRunning:()=>state.securityCleanup?.status==='running', getRentalRemaining:()=>state.rentalEndsAt-now,
    persist:()=>{}, render:()=>{}, toast:()=>{}, content:{scrollTop:0}, requestAnimationFrame:()=>{},
    document:{querySelector:selector=>{if(!elements.has(selector))elements.set(selector,{textContent:''});return elements.get(selector);}},
    rentalModalKind:null, rentalSearchToken:0, rentalCarMarker:null, rentalApproachLine:null,
    RENTAL_PLACES:stops.map((s,i)=>({...s,id:String(i),category:'체험'})), rentalVehicles:[{id:'standard',name:'MOOV 컴팩트'}],
    escapeHtml:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;'), icon:()=>'', renderUsageStatus:()=>'',
    openModal:options=>{context.modalOptions=options;},
  });
  vm.runInContext(graphSource+'\n'+source('road-routing.js')+'\n'+source('rental-outing.js'),context);
  return {state, context, elements, run:code=>vm.runInContext(code,context), advance:ms=>{now+=ms;},
    call:point=>{context.openRentalRecallPicker();context.state.rentalUX.draftPickup=point;return context.startRentalRecall();}};
}
const exit = {name:'서울숲 카페거리', lat:37.5461, lng:127.0430};

test('disembarking keeps the rented vehicle parked until an explicit recall', () => {
  const h=harness(), identity=JSON.stringify(h.state.rentalUX.dispatch.vehicle);
  h.context.disembarkRentalOuting();
  const outing=h.state.rentalUX.outing, parked=JSON.stringify(outing.carPosition);
  assert.equal(outing.phase,'walking');assert.equal(outing.completedStops,1);
  h.advance(60000);h.context.tickRentalOuting();
  assert.equal(JSON.stringify(outing.carPosition),parked);assert.equal(outing.recall,null);
  assert.equal(JSON.stringify(h.state.rentalUX.dispatch.vehicle),identity);
  assert.equal(h.state.usageStartedAt,900000);assert.equal(h.state.rentalEndsAt,11800000);
});
test('recall moves the same car, blocks early boarding, resumes the next unvisited stop', () => {
  const h=harness();h.context.disembarkRentalOuting();assert.equal(h.call(exit),true);
  const outing=h.state.rentalUX.outing;
  h.context.boardRentalRecall();assert.equal(outing.phase,'approaching');
  h.advance(9000);h.context.tickRentalOuting();assert.ok(h.context.rentalRecallPosition().remainingMeters>0);
  h.advance(9000);h.context.tickRentalOuting();assert.equal(outing.phase,'arrived');
  h.context.boardRentalRecall();assert.equal(outing.phase,'driving');
  assert.equal(h.context.rentalOutingNext().name,'디뮤지엄');assert.equal(outing.completedStops,1);
  h.context.boardRentalRecall();assert.equal(outing.completedStops,1);
  assert.equal(h.state.rentalUX.dispatch.vehicle.plate,'MOOV 24');
  assert.equal(h.state.usageStartedAt,900000);assert.equal(h.state.rentalEndsAt,11800000);
});
test('duplicate recalls are ignored; cancelling freezes the car and the next call starts there', () => {
  const h=harness();h.context.disembarkRentalOuting();h.call(exit);
  const outing=h.state.rentalUX.outing, started=outing.recall.startedAt;
  h.advance(7000);assert.equal(h.context.startRentalRecall(),false);assert.equal(outing.recall.startedAt,started);
  const position=h.context.rentalRecallPosition();h.context.cancelRentalRecall();
  assert.equal(outing.phase,'walking');assert.ok(distance(position,outing.carPosition)<0.000001);
  const parked=JSON.stringify(outing.carPosition);h.advance(20000);h.context.tickRentalOuting();
  assert.equal(JSON.stringify(outing.carPosition),parked);
  h.call(exit);const first=outing.recall.route.points[0];
  assert.ok(distance(position,{lat:first[0],lng:first[1]})<0.001);
});
test('serialized recall resumes by its timestamp after an iframe remount', () => {
  const h=harness();h.context.disembarkRentalOuting();h.call(exit);h.advance(6000);
  const saved=JSON.parse(JSON.stringify(h.state)), restored=harness();
  Object.assign(restored.state,saved);restored.advance(6000);
  const before=h.context.rentalRecallPosition(),after=restored.context.rentalRecallPosition();
  assert.ok(distance(before,after)<0.000001);
  restored.advance(12000);restored.context.tickRentalOuting();assert.equal(restored.state.rentalUX.outing.phase,'arrived');
  restored.context.boardRentalRecall();assert.equal(restored.context.rentalOutingNext().name,'디뮤지엄');
});
test('last stop finishes the course without wrapping or ending the rental clock', () => {
  const h=harness();h.context.disembarkRentalOuting();h.call(exit);h.advance(18000);h.context.tickRentalOuting();h.context.boardRentalRecall();
  h.context.disembarkRentalOuting();assert.equal(h.state.rentalUX.outing.completedStops,2);
  h.call(exit);h.advance(18000);h.context.tickRentalOuting();h.context.boardRentalRecall();
  assert.equal(h.state.rentalUX.outing.phase,'complete');assert.equal(h.context.rentalOutingNext(),null);
  assert.equal(h.state.tripActive,true);assert.equal(h.state.rentalEndsAt,11800000);
});
test('unroutable pickup and cancelled location choice preserve the itinerary and car', () => {
  const h=harness();h.context.disembarkRentalOuting();const before=JSON.stringify(h.state.rentalUX.outing);
  h.context.openRentalRecallPicker();assert.equal(JSON.stringify(h.state.rentalUX.outing),before);
  assert.equal(h.call({name:'서비스 지역 밖',lat:0,lng:0}),false);
  assert.equal(JSON.stringify(h.state.rentalUX.outing),before);
  assert.match(h.elements.get('#recall-picker-error').textContent,/도로/);
});
test('expiry or cleanup blocks recall and boarding', () => {
  const h=harness();h.context.disembarkRentalOuting();h.call(exit);h.advance(18000);h.context.tickRentalOuting();
  h.state.securityCleanup={status:'running'};h.context.boardRentalRecall();assert.equal(h.state.rentalUX.outing.phase,'arrived');
  h.state.securityCleanup=null;h.state.rentalEndsAt=0;h.context.boardRentalRecall();assert.equal(h.state.rentalUX.outing.phase,'arrived');
});
test('directed recall routes cannot run backwards on a one-way dead end', () => {
  const h=harness('const MOOV_ROAD_GRAPH={nodes:[[37,127],[37,127.01]],edges:[[0,1,888,1]]};');
  const forward=h.run('roadNetwork.buildRecall({lat:37,lng:127.002},{lat:37,lng:127.008})');
  assert.ok(forward.totalMeters>0);assert.equal(forward.points.length,2);
  assert.throws(()=>h.run('roadNetwork.buildRecall({lat:37,lng:127.008},{lat:37,lng:127.002})'),/도로/);
  const same=h.run('roadNetwork.buildRecall({lat:37,lng:127.002},{lat:37,lng:127.002})');
  assert.equal(same.totalMeters,0);assert.equal(h.run('approachAt(roadNetwork.buildRecall({lat:37,lng:127.002},{lat:37,lng:127.002}),1).remainingMeters'),0);
});

test('a car at an intersection can take another outgoing road without traversing the snapped edge', () => {
  const h=harness('const MOOV_ROAD_GRAPH={nodes:[[37,127],[37,127.01],[37.01,127]],edges:[[0,1,888,1],[0,2,1112,1]]};');
  const route=h.run('roadNetwork.buildRecall({lat:37,lng:127},{lat:37.005,lng:127})');
  assert.ok(route.totalMeters>500&&route.totalMeters<600);
});

// Run the real module scripts together. DOM stand-ins deliberately do not claim
// layout coverage; this catches integration errors in booking, storage and edits.
function integratedHome(savedState) {
  let now=1000000;
  class Element {
    constructor(){const classes=new Set();this.classList={contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:()=>{}};this.dataset={};this.innerHTML='';this.textContent='';this.scrollTop=0;this.isConnected=true;}
    querySelector(){return null;}querySelectorAll(){return [];}
    addEventListener(){}removeEventListener(){}setAttribute(){}focus(){}scrollIntoView(){}
  }
  const elements=new Map(),get=selector=>{if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);};
  const storage=new Map(savedState?[['moov-home-policy-design-v1',JSON.stringify(savedState)]]:[]);
  const context=vm.createContext({URLSearchParams,Date:class extends Date {static now(){return now;}},
    location:{origin:'http://localhost',search:''},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{body:get('body'),documentElement:{lang:'ko'},activeElement:null,querySelector:get,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}},
    CustomEvent:class {},setInterval:()=>1,clearInterval(){},setTimeout:fn=>{fn();return 1;},clearTimeout(){},requestAnimationFrame(){},navigator:{},
    addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false}),moovMapDownloadUrl:null,
  });
  context.window=context;context.parent=context;
  const modules=['data.js','road-data.js','road-routing.js','shared.js','state.js','rental-policy.js','secure-cleanup.js','rental-outing.js','home.js'];
  for(const name of modules)vm.runInContext(source(name),context,{filename:name});
  return {context,elements,run:code=>vm.runInContext(code,context),advance:ms=>{now+=ms;},saved:()=>JSON.parse(storage.get('moov-home-policy-design-v1'))};
}
test('real home integration: imported course, initial booking, recall, editing, remount and cleanup', async () => {
  const h=integratedHome();
  h.context.importRoute([{name:'성수역',lat:37.5446,lng:127.0557},{name:'서울숲',lat:37.5445,lng:127.0374},{name:'디뮤지엄',lat:37.5445,lng:127.0443}]);
  h.context.rentalSetStep('pickup');await h.context.requestRentalVehicle();
  h.advance(2200);h.context.rentalTick();h.advance(1500);h.context.rentalTick();h.advance(18000);h.context.rentalTick();
  assert.equal(h.run('state.rentalFlowStep'),'arrived');
  h.context.boardRentalVehicle();h.advance(3000);h.context.rentalTick();
  const started=h.run('state.usageStartedAt'),ends=h.run('state.rentalEndsAt');
  h.context.disembarkRentalOuting();
  h.context.openRentalDestinationSearch(1);assert.equal(h.run('state.rentalUX.routeEdit'),null);
  h.context.openRentalDestinationSearch(2);
  await h.context.previewRentalRoute({name:'블루보틀 성수',lat:37.5480,lng:127.0457,dwell:30});
  h.context.applyRentalRoutePreview();h.context.closeModal();
  assert.equal(h.context.rentalOutingNext().name,'블루보틀 성수');
  h.context.openRentalRecallPicker();h.context.chooseRentalRecallPlace(exit);assert.equal(h.context.startRentalRecall(),true);h.context.closeModal();
  assert.match(h.elements.get('#app-content').innerHTML,/data-action="recall-board" disabled/);
  const restored=integratedHome(h.saved());restored.advance(24700+18000);restored.context.tickRentalOuting();
  assert.equal(restored.run('state.rentalUX.outing.phase'),'arrived');
  restored.context.boardRentalRecall();
  assert.equal(restored.run('state.usageStartedAt'),started);assert.equal(restored.run('state.rentalEndsAt'),ends);
  assert.equal(restored.context.rentalOutingNext().name,'블루보틀 성수');
  restored.context.disembarkRentalOuting();restored.context.openRentalRecallPicker();restored.context.chooseRentalRecallPlace(exit);restored.context.startRentalRecall();restored.context.closeModal();
  restored.advance(18000);restored.context.tickRentalOuting();restored.context.boardRentalRecall();
  assert.equal(restored.run('state.rentalUX.outing.phase'),'complete');
  restored.context.openRentalDestinationSearch(-1);
  await restored.context.previewRentalRoute({name:'추가 목적지',lat:37.5446,lng:127.058,dwell:0});restored.context.applyRentalRoutePreview();restored.context.closeModal();
  assert.equal(restored.run('state.rentalUX.outing.phase'),'driving');assert.equal(restored.context.rentalOutingNext().name,'추가 목적지');
  assert.equal(restored.run('state.rentalUX.outing.completedStops'),2);
  restored.context.runSecureCleanup();restored.advance(5000);restored.context.tickSecureCleanup();
  assert.equal(restored.run('state.tripActive'),false);assert.equal(restored.run('state.rentalUX.outing'),undefined);
});
