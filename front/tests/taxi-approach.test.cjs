const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('front/public/taxi-fare-ui.js', 'utf8');

function setup(pickupApproach) {
  const quote = Object.freeze({total:14424,distanceMeters:18281});
  const state = {tripActive:true,homeMode:'taxi',taxiTrip:{id:'trip-1',quote},taxiDispatch:{tripId:'trip-1',status:'loading',route:null}};
  const document = {addEventListener(){},querySelector(){return null;}};
  const context = vm.createContext({state,document,window:{naver:{maps:{}}},MoovNaverMap:{pickupApproach},taxiMapMarker(){},persist(){},render(){},Date,console});
  vm.runInContext(source, context);
  context.activeTaxiTrip = () => state.tripActive ? state.taxiTrip : null;
  return {context,state,quote};
}
const pickup = {lat:37.5,lng:127};

test('legacy active trips without a dispatch record do not enter or crash the arrival flow', () => {
  const {context,state}=setup(async()=>{});
  state.taxiDispatch=null;
  assert.equal(context.taxiApproachPending(),false);
  state.taxiTrip=null;
  assert.equal(context.taxiApproachPending(),false);
});

test('cancelling a pending taxi dispatch discards its late response and preserves no active trip', async () => {
  let resolve;
  const {context,state} = setup(() => new Promise(done => {resolve=done;}));
  const pending = context.initTaxiApproachMap({},pickup,()=>false,{});
  context.handleTaxiApproachAction('taxi-cancel-approach');
  resolve({points:[[37.51,127],[37.5,127]],distanceMeters:500});
  await pending;
  assert.equal(state.tripActive,false);
  assert.equal(state.taxiDispatch,null);
  assert.equal(state.taxiTrip,null);
  assert.equal(state.homeStep,'setup');
});

test('a failed arrival lookup retains the reviewed passenger fare and permits a fresh retry', async () => {
  const {context,state,quote} = setup(async()=>{throw Error('route unavailable');});
  await context.initTaxiApproachMap({},pickup,()=>false,{});
  assert.equal(state.taxiDispatch.status,'error');
  assert.equal(state.taxiDispatch.error,'route unavailable');
  assert.equal(state.taxiDispatch.route,null);
  assert.equal(state.taxiTrip.quote,quote);
  const failed=state.taxiDispatch;
  context.handleTaxiApproachAction('taxi-retry-approach');
  assert.notEqual(state.taxiDispatch,failed);
  assert.equal(state.taxiDispatch.status,'loading');
  assert.equal(state.taxiTrip.quote,quote);
});

test('consecutive map renders share the pending approach lookup', async () => {
  let resolve,calls=0;
  const {context,state} = setup(()=>{calls++;return new Promise(done=>{resolve=done;});});
  const first=context.initTaxiApproachMap({},pickup,()=>false,{});
  const second=context.initTaxiApproachMap({},pickup,()=>false,{});
  const route={points:[[37.51,127],[37.5,127]],distanceMeters:500};
  resolve(route);await Promise.all([first,second]);
  assert.equal(calls,1);
  assert.equal(state.taxiDispatch.status,'approaching');
  assert.equal(state.taxiDispatch.route,route);
});

test('boarding is blocked until arrival and never rewrites the passenger fare', () => {
  const {context,state,quote}=setup(async()=>{});
  context.handleTaxiApproachAction('taxi-boarded');
  assert.equal(state.taxiDispatch.status,'loading');
  state.taxiDispatch.status='arrived';
  context.handleTaxiApproachAction('taxi-boarded');
  assert.equal(state.taxiDispatch.status,'driving');
  assert.equal(context.taxiApproachPending(),false);
  assert.equal(state.taxiTrip.quote,quote);
});
