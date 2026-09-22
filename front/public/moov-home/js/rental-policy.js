/* MOOV rental UX policy R-01–R-15. Existing booking fields remain authoritative.
   rentalUX holds dispatch, coordinate route, drafts and async state. Replace
   rentalServices.search/calculateRoute/requestVehicle for production APIs. */
const RENTAL_MIN_HOURS = 3, RENTAL_MAX_HOURS = 24;
const RENTAL_PLACES = [
  {id:'onion',name:'어니언 성수',category:'카페',lat:37.5446,lng:127.0580,dwell:40},
  {id:'daelim',name:'대림창고 갤러리',category:'카페 · 전시',lat:37.5418,lng:127.0562,dwell:40},
  {id:'forest-cafes',name:'서울숲 카페거리',category:'카페거리',lat:37.5461,lng:127.0430,dwell:40},
  {id:'seongsu',name:'성수역 3번 출구',category:'지하철역',lat:37.5446,lng:127.0557,dwell:0},
  {id:'forest-gate',name:'서울숲 남문',category:'공원',lat:37.5440,lng:127.0374,dwell:40},
  {id:'ttukseom',name:'뚝섬역 5번 출구',category:'지하철역',lat:37.5472,lng:127.0472,dwell:0},
  {id:'forest',name:'서울숲',category:'공원',lat:37.5445,lng:127.0374,dwell:40},
  {id:'museum',name:'디뮤지엄',category:'전시',lat:37.5445,lng:127.0443,dwell:60},
  {id:'banpo',name:'한강공원 반포지구',category:'공원 · 야경',lat:37.5104,lng:126.9960,dwell:30},
  {id:'ikseon',name:'익선동 한옥거리',category:'문화 · 산책',lat:37.5740,lng:126.9898,dwell:40},
  {id:'bluebottle',name:'블루보틀 성수',category:'카페',lat:37.5480,lng:127.0457,dwell:30}
];
const rentalReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rentalClone = value => JSON.parse(JSON.stringify(value));
const rentalMoney = value => Number(value).toLocaleString('ko-KR') + '원';
state.rentalHours = Math.max(RENTAL_MIN_HOURS, Math.min(RENTAL_MAX_HOURS, Number(state.rentalHours) || 3));
state.rentalUX = Object.assign({dispatch:{status:'idle'}, route:null, recent:[], draftPickup:null, routeEdit:null}, saved.rentalUX || {});
state.rentalUX.draftPickup = null;
state.rentalUX.routeEdit = null;
if(state.rentalUX.dispatch.approachRoute?.provider!=='naver')delete state.rentalUX.dispatch.approachRoute;
let rentalPickerMap = null, rentalPickerMarker = null, rentalCarMarker = null, rentalApproachLine = null;
let rentalMapLoadId = 0;
const rentalRouteRequests = new WeakSet();
function rentalMapText(ko,en) { return window.MoovI18n?.getLanguage()==='en'?en:ko; }
async function readyRentalMap(el) {
  const id=String(++rentalMapLoadId);el.dataset.mapLoadId=id;
  delete el.dataset.mapError;
  el.setAttribute('data-i18n-skip','');
  if(!window.naver?.maps?.Map)el.textContent=rentalMapText('지도를 불러오는 중…','Loading map…');
  try {
    await MoovNaverMap.ready();
    return el.isConnected&&el.dataset.mapLoadId===id;
  } catch(error) {
    el.dataset.mapError=error.code||'unavailable';
    if(el.isConnected&&el.dataset.mapLoadId===id){
      el.replaceChildren();const message=document.createElement('p'),retry=document.createElement('button');
      message.className='rux-map-status';message.textContent=rentalMapText('지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.','Could not load the map. Please try again.');
      retry.type='button';retry.className='ghost-button';retry.textContent=rentalMapText('지도 다시 불러오기','Reload map');
      retry.onclick=()=>{if(rentalModalKind==='pickup')initRentalPickerMap();else if(rentalModalKind==='route')initRentalRoutePickerMap();else render();};el.append(message,retry);
    }
    return false;
  }
}
let rentalRequestToken = 0, rentalSearchToken = 0, rentalLocationToken = 0;
let rentalModalKind = null, rentalModalFocus = null;
let rentalLastRenderedStep = null;
function rentalPickup() { return {id:'pickup',name:state.pickupLocation,category:'출발',...state.rentalPickupCoords,dwell:0}; }
function rentalCanEditRoute() { return !state.tripActive&&['setup','pickup'].includes(state.rentalFlowStep)&&state.securityCleanup?.status!=='running'; }
function rentalKnownPlace(name) { return RENTAL_PLACES.find(p=>p.name===name || (name.includes('반포') && p.id==='banpo') || (name.includes('현재 위치') && p.id==='seongsu')); }
function rentalPoint(lat,lng) { return {id:'pin-'+lat.toFixed(6)+'-'+lng.toFixed(6),name:`${rentalMapText('지도 선택','Map selection')} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`,lat,lng,category:rentalMapText('지도 선택','Map selection'),dwell:0}; }
function fitRentalRoute(map,route,options={}) {
  map.stop();
  const points=[...(route.points||[]),...(route.stops||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)).map(p=>[p.lat,p.lng])];
  const key=JSON.stringify((route.stops||[]).map(p=>[p.lat,p.lng]));
  if(map.native)map.native.moovRouteKey=key;
  if(typeof rentalCamera!=='undefined'&&rentalCamera?.key===key&&map.native){map.native.updateBy(rentalCamera.center,rentalCamera.zoom);map.native.moovInteracted=true;rentalCamera=null;return;}
  if(typeof rentalCamera!=='undefined')rentalCamera=null;
  MoovNaverMap.fitRoute(map,points,options);
}
function rentalDistance(a,b) {
  const rad = Math.PI/180, dLat=(b.lat-a.lat)*rad, dLng=(b.lng-a.lng)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
function calculateRentalRoute(stops) {
  if (stops.length < 2) throw Error('목적지를 선택해 주세요.');
  // Keep stop coordinates while NAVER verifies the road geometry and travel time.
  const pending={stops:rentalClone(stops),points:[],distance:null,minutes:null,nextMinutes:null,dwellMinutes:stops.slice(1).reduce((a,p)=>a+(p.dwell||0),0),provider:null};
  if (stops.some(p=>p.lat==null||p.lng==null)) return {...pending,unresolved:true};
  if (stops.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng))) throw Error('위치를 지도에서 확인해 주세요.');
  return pending;
}
let rentalSearchResults = [];
const rentalServices = {
  // Search results always come from NAVER; saved course coordinates remain app data.
  async search(query) {
    if(String(query||'').trim().length<2)return [];
    return MoovNaverMap.searchPlaces(query);
  },
  async calculateRoute(stops) { return calculateNaverRentalRoute(stops); },
  async requestVehicle(id) { return {id,plate:'MOOV 24',color:'화이트',battery:78}; }
};
async function calculateNaverRentalRoute(stops) {
  const route=calculateRentalRoute(stops);
  if(route.unresolved)return route;
  const result=await MoovNaverMap.directionsForStops(stops);
  return {...route,points:result.points,distance:Number((result.distanceMeters/1000).toFixed(1)),minutes:Math.max(1,Math.ceil(result.durationSeconds/60)),nextMinutes:stops.length===2?Math.max(1,Math.ceil(result.durationSeconds/60)):null,provider:'naver',demo:false,routeError:false};
}
function updateRentalRoadRoute(route) {
  if(route.unresolved||route.stops.some(rentalNeedsPlaceLabel)){resolveRentalRouteStops(route);return;}
  if(route.provider==='naver'||route.routeError||rentalRouteRequests.has(route))return;
  rentalRouteRequests.add(route);
  rentalServices.calculateRoute(route.stops).then(next=>{
    if(state.rentalUX.route!==route)return;
    state.rentalUX.route=next;persist();refreshRentalRouteScreen();
  }).catch(()=>{
    if(state.rentalUX.route!==route)return;
    route.routeError=true;refreshRentalRouteScreen();
  });
}
const rentalLocationRequests=new WeakSet();
function rentalNeedsPlaceLabel(stop){
  return !stop.locationLabelChecked&&/^(?:지도 선택|Map selection)\s*·/.test(stop.name);
}
async function resolveRentalRouteStops(route) {
  if(route.locationLookupDone||rentalLocationRequests.has(route))return;
  rentalLocationRequests.add(route);
  const lookups=new Map();
  const stops=await Promise.all(route.stops.map(async stop=>{
    if(Number.isFinite(stop.lat)&&Number.isFinite(stop.lng)){
      if(!rentalNeedsPlaceLabel(stop))return stop;
      try{
        const place=await MoovNaverMap.describePoint(stop);
        return {...stop,name:place.landmark||place.address||place.name,address:place.address,locationLabelChecked:true};
      }catch{return {...stop,locationLabelChecked:true};}
    }
    try{
      if(!lookups.has(stop.name))lookups.set(stop.name,rentalServices.search(stop.name));
      const results=await lookups.get(stop.name);
      let place=MoovNaverMap.matchPlace(stop.name,results);
      // Some saved labels differ from NAVER's indexed spelling (e.g. 서호).
      const queries=stop.name==='석촌호수 서호'?['석촌호수서호 서울']:[stop.name.replace(/\s+/g,'')];
      for(const query of queries){
        if(place||query===stop.name)break;
        if(!lookups.has(query))lookups.set(query,rentalServices.search(query));
        place=MoovNaverMap.matchPlace(stop.name,await lookups.get(query));
      }
      if(!place)return {...stop,locationIssue:'choose'};
      return {...stop,lat:place.lat,lng:place.lng,address:place.address,source:'naver',locationIssue:null};
    }catch{return {...stop,locationIssue:'retry'};}
  }));
  if(state.rentalUX.route!==route)return;
  const next=calculateRentalRoute(stops);next.locationLookupDone=true;
  state.routeStops=stops.map(p=>p.name);
  state.rentalUX.route=next;resetRentalRouteCamera();persist();refreshRentalRouteScreen();
}
function resetRentalRouteCamera(){
  if(typeof rentalCamera!=='undefined')rentalCamera=null;
  if(typeof rentalMapView!=='undefined'&&rentalMapView?.native)rentalMapView.native.moovInteracted=false;
}
let rentalRouteRefreshPending=false;
function refreshRentalRouteScreen(){
  if(MoovLocationPicker.isSelectingPickup?.()){rentalRouteRefreshPending=true;return;}
  rentalRouteRefreshPending=false;render();
}
document.addEventListener('moov:pickup-selection-end',()=>{
  if(rentalRouteRefreshPending){rentalRouteRefreshPending=false;setTimeout(()=>{if(!MoovLocationPicker.isSelectingPickup())render();},0);}
});
function retryRentalRoadRoute() {
  const route=ensureRentalRoute();
  if(route.unresolved){delete route.locationLookupDone;rentalLocationRequests.delete(route);persist();render();return;}
  if(!route.routeError)return;
  route.routeError=false;
  rentalRouteRequests.delete(route);
  persist();render();updateRentalRoadRoute(route);
}
function renderRentalRouteRetry(route) {
  if(route.unresolved){
    const missing=route.stops.filter(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng)).map(p=>p.name).join(' · ');
    const text=route.locationLookupDone?rentalMapText(`위치를 확인하지 못한 장소: ${missing}. 해당 입력칸에서 검색 결과를 선택해 주세요.`,`Location needed: ${missing}. Select a search result in its field.`):rentalMapText('경유지·목적지 위치를 확인하고 경로를 불러오는 중…','Finding stops and loading your route…');
    return `<div class="rux-note" role="status" data-i18n-skip><p>${escapeHtml(text)}</p>${route.locationLookupDone?`<button class="ghost-button" data-action="retry-rental-route">${rentalMapText('위치 다시 확인','Retry locations')}</button>`:''}</div>`;
  }
  if(!route.routeError)return '';
  return `<div class="rux-note" role="status" data-i18n-skip><p>${rentalRouteNote(route)}</p><button class="ghost-button" data-action="retry-rental-route">${rentalMapText('도로 경로 다시 조회','Retry driving route')}</button></div>`;
}
async function naverRentalApproach(pickup) {
  return MoovNaverMap.pickupApproach(pickup);
}
function ensureRentalRoute() {
  const u=state.rentalUX, current=u.route;
  const names=state.routeStops;
  if (current && current.stops?.map(p=>p.name).join('|')===names.join('|') && current.stops[0].lat===state.rentalPickupCoords.lat && current.stops[0].lng===state.rentalPickupCoords.lng) {
    if(current.provider!=='naver'&&(current.points?.length||current.distance!=null||current.minutes!=null))u.route=calculateRentalRoute(current.stops);
    return u.route;
  }
  const stops=[rentalPickup(),...names.slice(1).map((name,i)=>{
    const known=rentalKnownPlace(name), prior=current?.stops?.find(p=>p.name===name);
    return prior || known && {...known,name} || {id:'unresolved-'+i,name,category:'위치 확인 필요',lat:null,lng:null,dwell:0};
  })];
  if (stops.length===1) stops.push(rentalClone(RENTAL_PLACES.find(p=>p.id==='banpo')));
  u.route=calculateRentalRoute(stops);
  state.routeStops=stops.map(p=>p.name);
  return u.route;
}
function rentalRouteMetrics() { const r=ensureRentalRoute(); return {distance:r.distance==null?'—':r.distance.toFixed(1),minutes:r.minutes??'—'}; }
function rentalRouteNote(route=ensureRentalRoute()) {
  if(route.provider==='naver')return rentalMapText('네이버 자동차 경로 · 체류 시간 제외','NAVER driving route · stopover time excluded');
  if(route.unresolved)return rentalMapText('장소의 위치를 먼저 확인해 주세요.','Confirm the locations of your stops first.');
  return route.routeError?rentalMapText('도로 경로를 불러오지 못했어요. 다시 조회해 주세요.','Could not load the driving route. Please retry.'):rentalMapText('도로 경로를 조회하고 있어요.','Loading the driving route.');
}
function rentalSetStep(step) {
  if (state.rentalFlowStep===step) return;
  state.rentalFlowStep=step;
  state.rentalStopPopup=null;
  state.rentalUX.dispatch.enteredAt=Date.now();
  const statuses={matching:'requesting',assigned:'matched',approaching:'approaching',arrived:'arrived',boarded:'startTransition',driving:'driving',error:'error'};
  state.rentalUX.dispatch.status=statuses[step]||'idle';
  persist();render();
  if (state.activeTab==='home') content.scrollTop=0;
}
function cancelRentalDispatch() {
  if (state.tripActive) return;
  rentalRequestToken++;
  clearTimeout(rentalFlowTimer);
  state.rentalUX.dispatch={status:'cancelled',enteredAt:Date.now()};
  state.rentalFlowStep='pickup';
  persist();render();content.scrollTop=0;toast('요청을 취소했어요. 시간·차량·출발 위치는 유지됩니다.');
}
async function requestRentalVehicle() {
  if (state.tripActive || ['matching','assigned','approaching','arrived'].includes(state.rentalFlowStep)) return;
  const token=++rentalRequestToken;
  state.rentalUX.dispatch={status:'requesting',enteredAt:Date.now(),deadline:Date.now()+30000,vehicle:null};
  rentalSetStep('matching');
  try {
    const approachRoute=await naverRentalApproach(rentalPickup());
    if(token!==rentalRequestToken||state.rentalFlowStep!=='matching')return;
    state.rentalUX.dispatch.approachRoute=approachRoute;
    const result=await rentalServices.requestVehicle(state.rentalVehicleType);
    if (token!==rentalRequestToken || state.rentalFlowStep!=='matching') return;
    if (result.id!==state.rentalVehicleType) throw Error('선택한 차량을 배정하지 못했어요.');
    state.rentalUX.dispatch.response=result;
  } catch(error) {
    if(token!==rentalRequestToken)return;
    state.rentalUX.dispatch.message=error.message || '배차 연결을 확인해 주세요.';
    rentalSetStep('error');
  }
}
function scheduleRentalFlowTransitions() {
  // One persistent clock; re-rendering never restarts a dispatch or boarding timer.
  if (!state.rentalUX.dispatch.enteredAt && ['matching','assigned','approaching','boarded'].includes(state.rentalFlowStep)) state.rentalUX.dispatch.enteredAt=Date.now();
}
function rentalTick() {
  const d=state.rentalUX.dispatch, step=state.rentalFlowStep, elapsed=Date.now()-(d.enteredAt||Date.now());
  if (step==='matching') {
    if (d.response && elapsed>=2200) {d.vehicle=d.response;delete d.response;rentalSetStep('assigned');}
    else if (Date.now()>(d.deadline||Infinity)) {d.message='차량을 찾는 데 시간이 걸리고 있어요. 다시 요청해 주세요.';rentalRequestToken++;rentalSetStep('error');}
  } else if(step==='assigned' && elapsed>=1500) rentalSetStep('approaching');
  else if(step==='approaching') {
    tickRoadApproach(d,elapsed);
  } else if(step==='boarded' && elapsed>=(rentalReducedMotion()?250:3000)) rentalSetStep('driving');
}
function updateVehiclePosition(position,etaSeconds) {
  state.rentalUX.dispatch.position=position;
  state.rentalUX.dispatch.etaSeconds=etaSeconds;
  if(rentalCarMarker) rentalCarMarker.setLatLng([position.lat,position.lng]);
  if(rentalApproachLine) rentalApproachLine.setLatLngs(state.rentalUX.dispatch.remainingPoints||[]);
  const eta=document.querySelector('[data-rental-eta]'), distance=document.querySelector('[data-rental-distance]');
  if(eta)eta.textContent=etaSeconds>60?`${Math.ceil(etaSeconds/60)}분`:`${etaSeconds}초`;
  if(distance)distance.textContent=`${((state.rentalUX.dispatch.remainingMeters||0)/1000).toFixed(1)} km 남음`;
}
function boardRentalVehicle() {
  if(state.rentalFlowStep!=='arrived'||state.tripActive)return;
  ensureRentalRoute();state.tripActive=true;state.homeStep='service';state.usageStartedAt=Date.now();
  state.rentalEndsAt=state.usageStartedAt+state.rentalHours*3600000;rentalSetStep('boarded');
}

function renderRentalProgress(step) {
  const index=step==='time'?0:step==='vehicle'?1:step==='pickup'?2:3;
  return `<ol class="rux-progress" aria-label="렌트 이용 단계">${['시간','차량','출발','이용'].map((label,i)=>`<li class="${i===index?'current':i<index?'complete':''}" ${i===index?'aria-current="step"':''}><span aria-hidden="true">${i<index?'✓':i+1}</span><b>${label}</b>${i===index?'<span class="sr-only">현재 단계</span>':''}</li>`).join('')}</ol>`;
}

function rentalSetupFooter(step,v) {
  if(!['time','vehicle','pickup'].includes(step))return '';
  const action=step==='pickup'?'request-rent-flow':'rental-flow-next',value=step==='time'?'vehicle':'pickup';
  const label={time:'차량 선택하기',vehicle:'이 차량으로 선택',pickup:'이 위치로 차량 요청'}[step];
  return `<div class="rux-setup-footer"><span>${state.rentalHours}시간 · <b>${rentalMoney(rentalTotalFare())}</b></span><button class="primary-button full" data-action="${action}" data-value="${value}">${label}</button></div>`;
}
function renderRentalVehicleCards(selectedId) {
  const v=rentalVehicles.find(v=>v.id===selectedId)||rentalVehicles[0],i=rentalVehicles.indexOf(v), fare=rentalFareForHours(v.id,state.rentalHours);
  return `<div class="vehicle-selection-shell">
    <div class="vehicle-detail-hero refined"><span class="vehicle-detail-badge">${escapeHtml(v.name.replace(/^MOOV\s+/,''))}</span><img src="${v.image}" alt="${escapeHtml(v.name)}"/><span class="vehicle-detail-index">${i+1} / ${rentalVehicles.length}</span></div>
    <div class="rux-thumbnails" role="group" aria-label="차량 비교">${rentalVehicles.map(x=>`<button class="${x.id===v.id?'selected':''}" aria-pressed="${x.id===v.id}" data-action="rental-vehicle" data-value="${x.id}" aria-label="${escapeHtml(x.name)} 선택"><img src="${x.image}" alt=""/><span>${x.id===v.id?'✓ ':''}${escapeHtml(x.name.replace(/^MOOV\s+/,''))}</span></button>`).join('')}</div>
    <div class="vehicle-detail-body"><h3>${escapeHtml(v.name)}</h3><p>${escapeHtml(v.desc)}</p><div class="vehicle-spec-grid">${[['user',v.seats,'탑승 인원'],['bag',v.baggage,'수하물'],['car','전기차','동력'],['shield','자율주행','이동 방식']].map(([ic,value,label])=>`<div class="vehicle-spec-box">${icon(ic)}<strong>${escapeHtml(value)}</strong><small>${label}</small></div>`).join('')}</div>
    <div class="rux-price-row" aria-live="polite"><span><small>${state.rentalHours}시간 · 차량 요금</small><strong>${rentalMoney(fare)}</strong><small>시간당 약 ${rentalMoney(Math.round(fare/state.rentalHours))}</small></span></div></div></div>`;
}
function rentalIdentity(vehicle) {
  const d=state.rentalUX.dispatch.vehicle;
  if(!d)return '';
  return `<div class="vehicle-identity-card"><img src="${vehicle.image}" alt="${escapeHtml(vehicle.name)}"/><div><strong>${escapeHtml(vehicle.name)}</strong><span>${escapeHtml(d.color)} · 배터리 ${d.battery}%</span><span class="identity-plate">${escapeHtml(d.plate)}</span></div></div>`;
}
function renderRentalJourneyStep(step,v) {
  if(step==='time') {
    const price=rentalTotalFare(), delta=rentalFareDelta(v.id,state.rentalHours);
    return `<section class="rental-step-card"><h3>얼마나 함께할까요?</h3><p>3~24시간, 일정에 맞게 선택해 주세요.</p><div class="rux-fare" aria-live="polite"><small>${escapeHtml(v.name)} · 총 예상 요금</small><strong>${rentalMoney(price)}</strong><span>시간당 약 ${rentalMoney(Math.round(price/state.rentalHours))}</span></div><div class="rental-time-control aligned"><button data-action="rent-minus" aria-label="이용 시간 1시간 줄이기" ${state.rentalHours<=3?'disabled':''}>−</button><div class="rental-time-control-value"><strong>${state.rentalHours}</strong><span>시간</span></div><button data-action="rent-plus" aria-label="이용 시간 1시간 늘리기" ${state.rentalHours>=24?'disabled':''}>＋</button></div><p class="rux-delta">${state.rentalHours>=24?'최대 24시간까지 선택할 수 있어요.':delta>=0?`1시간 추가 시 ${rentalMoney(delta)} 추가`:`1시간 추가 시 패키지 할인으로 ${rentalMoney(-delta)} 절약`}</p><div class="rental-preset-row" role="group" aria-label="이용 시간 빠른 선택">${[
  {h:RENTAL_MIN_HOURS,label:'최소'},
  {h:6,label:'6시간'},
  {h:10,label:'10시간'},
  {h:15,label:'15시간'},
  {h:RENTAL_MAX_HOURS,label:'최대'}
].map(p=>`<button aria-pressed="${state.rentalHours===p.h}" class="${state.rentalHours===p.h?'active':''}" data-action="rent-set-hours" data-value="${p.h}">${p.label}</button>`).join('')}</div><p class="rux-note">주행요금 포함 · 장시간 패키지 할인 자동 적용</p></section>`;
  }
  if(step==='vehicle')return `<section class="rental-step-card vehicle-select-card">${renderRentalVehicleCards(v.id)}</section>`;
  if(step==='pickup')return `<section class="rental-step-card rux-map-card"><div class="rux-card-title"><h3>어디에서 만날까요?</h3><p>위치를 확인하고 차량을 요청해 주세요.</p></div><div id="rental-pickup-naver" class="rental-naver-map" aria-label="출발 위치 지도"></div><div class="pickup-confirm-sheet"><div class="pickup-location-line"><span class="pickup-location-icon">${icon('pin')}</span><div><small>확정된 출발 위치</small><strong>${escapeHtml(state.pickupLocation)}</strong></div><button data-action="open-pin-picker">수정</button></div><p class="rux-note">${escapeHtml(v.name)} · ${state.rentalHours}시간 · ${rentalMoney(rentalTotalFare())}</p><div class="pickup-secondary-actions"><button class="ghost-button" data-action="locate-rental">현재 위치</button><button class="ghost-button" data-action="open-pin-picker">검색·최근 위치</button></div><small class="rux-note">체험 배차이며 실제 차량 호출·결제는 발생하지 않습니다.</small></div></section>`;
  if(step==='matching')return `<section class="rental-step-card rux-map-card"><div id="rental-matching-naver" class="rental-naver-map" aria-label="출발 주변 지도"></div><div class="system-status-sheet" role="status"><span class="rux-spinner" aria-hidden="true"></span><h3>가까운 차량을 찾고 있어요</h3><p>${escapeHtml(state.pickupLocation)} 주변의 ${escapeHtml(v.category)} 차량을 확인하고 있어요.</p><div class="matching-progress" aria-hidden="true"><span></span></div><p class="rux-note">체험 배차 진행 중</p><button class="ghost-button full" data-action="cancel-rent-match">요청 취소</button></div></section>`;
  if(step==='error')return `<section class="rental-step-card rux-error" role="alert"><span aria-hidden="true">!</span><h3>배차를 완료하지 못했어요</h3><p>${escapeHtml(state.rentalUX.dispatch.message||'잠시 후 다시 요청해 주세요.')}</p><button class="primary-button full" data-action="request-rent-flow">다시 요청</button><button class="ghost-button full" data-action="cancel-rent-match">출발 위치로 돌아가기</button></section>`;
  if(step==='assigned')return `<section class="rental-step-card"><span class="dispatch-complete-label">✓ 배차 완료</span><h3>차량이 배정됐어요</h3>${rentalIdentity(v)}<p>잠시 후 차량 접근 화면으로 이동합니다.</p><button class="ghost-button full" data-action="cancel-rent-match">배차 취소</button></section>`;
  if(step==='approaching'||step==='arrived')return `<section class="rental-step-card rux-map-card"><div id="rental-approach-naver" class="rental-naver-map" aria-label="차량 접근 지도"></div><div class="system-status-sheet"><div class="arrival-hero" role="status"><div><small>${step==='arrived'?'✓ 출발 위치 도착':'도착 예상'}</small><strong data-rental-eta>${step==='arrived'?'도착했어요':Math.ceil(state.rentalUX.dispatch.approachRoute.durationSeconds/60)+'분'}</strong></div><span data-rental-distance>${step==='arrived'?'탑승을 기다리고 있어요':'이동 중'}</span></div>${rentalIdentity(v)}${renderRoadPickupNote()}<p class="rux-note" data-i18n-skip>${step==='arrived'?rentalMapText('차량 번호를 확인한 뒤 탑승해 주세요.','Check the vehicle number before boarding.'):rentalMapText('차량 접근을 약 18초로 줄여 보여주는 체험입니다.','This demo shows the vehicle approaching in about 18 seconds.')}</p><button class="primary-button full" data-action="rental-boarded" ${step==='arrived'?'':'disabled'}>${step==='arrived'?'차량에 탑승했어요':'차량이 도착하면 탑승할 수 있어요'}</button><button class="ghost-button full" data-action="cancel-rent-match">배차 취소</button></div></section>`;
  if(step==='boarded')return `<section class="rental-step-card boarded-transition" role="status"><div class="rental-boarded-hero sparkle"><div><div class="rental-boarded-car" aria-hidden="true">${icon('car')}</div><span class="boarded-check">✓ 탑승 완료</span><h3>나만의 여정을 시작해요</h3><p>이용 시간이 시작됐어요.<br/>${rentalReducedMotion()?'곧':'약 3초 후'} 코스 지도로 이동합니다.</p></div></div></section>`;
  return renderRentalDrivingScreen();
}
function rentalStopPopover() {
  const index=state.rentalStopPopup, p=ensureRentalRoute().stops[index];
  return p?`<div class="rental-stop-popover" role="region" aria-label="선택한 장소 정보" tabindex="-1"><button class="rental-stop-close" data-action="rental-stop-close" aria-label="장소 정보 닫기">${icon('x')}</button><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)} · 체류 ${p.dwell||0}분</small><button class="rux-link" data-action="rental-change-stop" data-value="${index}">이 지점 변경</button></div>`:'';
}
function showRentalStop(index) {
  const previous=state.rentalStopPopup; state.rentalStopPopup=index;
  const target=document.querySelector('#rux-stop-popover');if(target){target.innerHTML=rentalStopPopover();if(index!=null)target.firstElementChild?.focus({preventScroll:true});else document.querySelectorAll('#rental-driving-naver .rux-map-marker')[previous]?.focus({preventScroll:true});}
}

function rentalMarker(map,p,label,click,draggable=false) {
  const element=document.createElement('div');element.className='rux-map-marker';
  if(label==='도착')element.classList.add('goal');
  else if(/^\d+$/.test(label))element.classList.add('waypoint');
  const shortEnglish={'출발':'Start','도착':'End','차량':'Car','후보':'Pin'};
  const text=document.createElement('span');text.textContent=window.MoovI18n?.getLanguage()==='en'?(shortEnglish[label]||window.MoovI18n.translate(label)):label;element.append(text);
  const marker=MoovNaverMap.marker([p.lat,p.lng],{element,title:p.name||label,draggable}).addTo(map);
  if(click)marker.on('click',click);
  return marker;
}
function createRentalMap(el,center,zoom=15) {
  if(!el)return null;
  el.replaceChildren();
  const map=MoovNaverMap.createView(el,center,zoom);
  el.dataset.mapProvider='naver';
  return map;
}
function rentalMapBase(el,center,zoom=15) {
  if(rentalMapView){rentalMapView.stop(); rentalMapView.remove();rentalMapView=null;}
  rentalCarMarker=null;rentalApproachLine=null;
  rentalMapView=createRentalMap(el,center,zoom);return rentalMapView;
}
async function initRentalFlowMap() {
  const el=document.querySelector('.rux .rental-naver-map');if(!el)return;
  if(!await readyRentalMap(el))return;
  const c=rentalPickup(), step=state.rentalFlowStep;
  const map=rentalMapBase(el,[c.lat,c.lng],step==='driving'?13:15);if(!map)return;
  if(step==='driving') {
    const route=ensureRentalRoute();
    if(!route.unresolved)MoovNaverMap.polyline(route.points,{color:'#22744c',weight:5,opacity:.9,dashArray:'8 5'}).addTo(map);
    route.stops.forEach((p,i)=>{if(p.lat==null)return;rentalMarker(map,p,i===0?'출발':i===route.stops.length-1?'도착':String(i),i===0?null:()=>showRentalStop(i));});
    fitRentalRoute(map,route);
  } else {
    const pickupMarker=rentalMarker(map,c,'출발',step==='pickup'?()=>selectRentalPointOnMap(0):null,step==='pickup');
    pickupMarker.getElement()?.classList.add('pickup-origin');
    if(step==='pickup'){
      pickupMarker.on('dragend',()=>{const point=pickupMarker.getLatLng();pickupMarker.setLatLng(c);selectRentalPointOnMap(0,point);});
      const route=ensureRentalRoute();
      route.stops.slice(1).forEach((p,i)=>{
        if(p.lat==null||p.lng==null)return;
        rentalMarker(map,p,i===route.stops.length-2?'도착':String(i+1),()=>toast(p.name));
      });
      if(route.points.length)MoovNaverMap.polyline(route.points,{color:'#28754e',weight:5}).addTo(map);
      fitRentalRoute(map,route);updateRentalRoadRoute(route);
    }
    if(step==='pickup')map.on('click',e=>{if(!document.querySelector('.inplace-map-selection'))selectRentalPointOnMap(0,e.latlng);});
    if(step==='matching')MoovNaverMap.circle([c.lat,c.lng],{radius:500,color:'#28754e',fillOpacity:.1}).addTo(map);
    if(['approaching','arrived'].includes(step)) {
      const d=state.rentalUX.dispatch,route=d.approachRoute;
      if(!route)return;
      const p=step==='arrived'?route.pickupSnap:d.position||{lat:route.points[0][0],lng:route.points[0][1]};
      rentalApproachLine=MoovNaverMap.polyline(step==='arrived'?[]:d.remainingPoints||route.points,{color:'#28754e',weight:5}).addTo(map);
      rentalCarMarker=rentalMarker(map,{...p,name:'배정 차량 MOOV 24'},'차량');
      rentalCarMarker.getElement()?.classList.add('home-car');
      fitRentalRoute(map,route);
    }
  }
}
function openMapPinPicker(candidate=null) {
  state.rentalUX.draftPickup=candidate?rentalClone(candidate):rentalPickup();
  rentalModalKind='pickup';
  const recents=(state.rentalUX.recent.length?state.rentalUX.recent:state.rentalRecentPickups.map(rentalKnownPlace).filter(Boolean)).slice(0,5);
  openModal({title:'출발 위치 수정',iconName:'pin',body:`<form id="rux-pickup-form" class="rux-search-form"><label class="sr-only" for="rental-pickup-search">주소 또는 장소 검색</label><input id="rental-pickup-search" type="search" placeholder="도로명·지번 주소 검색"/><button class="ghost-button" type="submit">검색</button></form><p class="rux-note">주소 검색 · 지도에서 직접 선택 가능</p><div id="rux-pickup-results" class="rental-search-results" aria-live="polite"></div><div id="rental-picker-osm" class="rental-naver-map picker" aria-label="출발 후보 선택 지도"></div><p id="rux-draft-label" class="rux-draft-label" aria-live="polite">선택 후보: ${escapeHtml(state.rentalUX.draftPickup.name)}</p><h4>최근 위치</h4><div class="rental-search-results">${recents.map(p=>`<button data-action="rux-recent" data-id="${escapeHtml(p.id)}"><strong>${escapeHtml(p.name)}</strong><small>이 위치 미리보기</small></button>`).join('')}</div>`,primary:'이 위치로 확정',secondary:'취소',onConfirm:()=>{const p=state.rentalUX.draftPickup;if(!p)return false;applyPickupLocation(p.name,p);toast('출발 위치를 확정했어요.');}});
  requestAnimationFrame(initRentalPickerMap);
}
async function initRentalPickerMap() {
  const el=document.querySelector('#rental-picker-osm');if(!state.rentalUX.draftPickup||!el)return;
  if(!await readyRentalMap(el)||rentalModalKind!=='pickup')return;
  const p=state.rentalUX.draftPickup;if(!p)return;
  if(rentalPickerMap)rentalPickerMap.remove();
  rentalPickerMap=createRentalMap(el,[p.lat,p.lng]);if(!rentalPickerMap)return;
  rentalPickerMarker=rentalMarker(rentalPickerMap,p,'후보',null,true);
  rentalPickerMarker.on('dragend',()=>{const p=rentalPickerMarker.getLatLng();setRentalDraftPickup(rentalPoint(p.lat,p.lng));});
  rentalPickerMap.on('click',e=>setRentalDraftPickup(rentalPoint(e.latlng.lat,e.latlng.lng)));
}
function setRentalDraftPickup(p) {
  state.rentalUX.draftPickup=rentalClone(p);
  const label=document.querySelector('#rux-draft-label');if(label)label.textContent=`선택 후보: ${p.name}`;
  if(rentalPickerMarker)rentalPickerMarker.setLatLng([p.lat,p.lng]);
  if(rentalPickerMap)rentalPickerMap.panTo([p.lat,p.lng],{animate:!rentalReducedMotion()});
}
function applyPickupLocation(label,coords=null) {
  const p=coords || rentalKnownPlace(label);
  if(!rentalCanEditRoute())return;
  resetRentalRouteCamera();
  rentalLocationToken++;
  state.pickupLocation=label;if(p)state.rentalPickupCoords={lat:p.lat,lng:p.lng};state.locationReady=true;
  state.pickupDetails=p?.address?{name:label,address:p.address}:null;
  state.rentalRecentPickups=[label,...state.rentalRecentPickups.filter(x=>x!==label)].slice(0,5);
  const selected={...rentalPickup(),id:p?.id||'pickup-'+Date.now()};
  state.rentalUX.recent=[selected,...state.rentalUX.recent.filter(x=>x.name!==label)].slice(0,5);
  if(state.routeStops.length)state.routeStops[0]=label;else state.routeStops=[label];
  if(state.rentalUX.route?.stops?.length>1){
    const stops=rentalClone(state.rentalUX.route.stops);stops[0]=rentalPickup();
    state.rentalUX.route=calculateRentalRoute(stops);
  }
  persist();render();
}
function applyRentalStopLocation(index,place) {
  if(!rentalCanEditRoute()||!Number.isInteger(index)||!Number.isFinite(place?.lat)||!Number.isFinite(place?.lng))return;
  const old=ensureRentalRoute();
  if(index<0||index>=old.stops.length)return;
  resetRentalRouteCamera();
  state.selectedCourse=null;state.rentalCourseModified=true;state.rentalStopPopup=null;
  if(index===0)return applyPickupLocation(place.name,place);
  const stops=rentalClone(old.stops);
  stops[index]={...place,dwell:old.stops[index].dwell||0};
  state.rentalUX.route=calculateRentalRoute(stops);state.routeStops=stops.map(p=>p.name);
  persist();render();
}
function locateRentalUser() {
  if(!rentalCanEditRoute())return;
  const token=++rentalLocationToken;
  const buttons=[...document.querySelectorAll('[data-action="locate-rental"]')];
  const finish=()=>buttons.forEach(button=>{button.disabled=false;button.removeAttribute('aria-busy');});
  const fail=error=>{
    finish();if(token!==rentalLocationToken||!rentalCanEditRoute())return;
    toast(error?.code===1?rentalMapText('위치 권한을 허용하거나 출발지를 직접 입력해 주세요.','Allow location access or enter your pickup location.'):rentalMapText('내 위치를 찾지 못했어요. 출발지를 입력하거나 지도에서 선택해 주세요.','Could not find your location. Enter a pickup location or choose it on the map.'));
  };
  buttons.forEach(button=>{button.disabled=true;button.setAttribute('aria-busy','true');});
  toast(rentalMapText('내 위치를 확인하고 있어요…','Finding your location…'));
  MoovNaverMap.getCurrentPosition(pos=>{
    finish();if(token!==rentalLocationToken||!rentalCanEditRoute())return;
    const point=rentalPoint(pos.coords.latitude,pos.coords.longitude);
    point.name=`${rentalMapText('내 위치','My location')} · ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
    selectRentalPointOnMap(0,{...pos.place,lat:point.lat,lng:point.lng});
    toast(rentalMapText('지도에서 승차 위치를 확인해 주세요.','Check your pickup point on the map.'));
  },fail,{enableHighAccuracy:true,maximumAge:30000,timeout:10000});
}
async function searchRentalPlaces(kind,query) {
  const token=++rentalSearchToken, el=document.querySelector(kind==='pickup'?'#rux-pickup-results':'#rux-route-results');
  if(!el)return;el.textContent='장소를 찾고 있어요…';
  try {
    const results=await rentalServices.search(query);
    if(token!==rentalSearchToken||!el.isConnected)return;
    rentalSearchResults=results;
    el.innerHTML=results.length?results.map(p=>`<button data-action="rux-select-place" data-kind="${kind}" data-id="${escapeHtml(p.id)}"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)}</small></button>`).join(''):'<p>검색 결과가 없어요. 다른 검색어를 입력하거나 지도에서 직접 선택해 주세요.</p>';
  } catch(e) {if(token===rentalSearchToken&&el.isConnected)el.innerHTML='<p role="alert">검색을 완료하지 못했어요. 다시 검색하거나 지도에서 선택해 주세요.</p>';}
}
function openRentalDestinationSearch(targetIndex=null) {
  const route=ensureRentalRoute(),index=targetIndex==null?route.stops.length-1:Number(targetIndex);
  state.rentalUX.routeEdit={index:Math.max(1,index),add:targetIndex===-1,candidate:null,preview:null,status:'idle',token:0};
  state.rentalStopPopup=null;rentalModalKind='route';
  openModal({title:'코스 변경',iconName:'search',body:`<p class="rux-note">${targetIndex===-1?'목적지 앞에 새 경유지를 추가합니다.':'변경할 장소: '+escapeHtml(route.stops[index]?.name||'목적지')}</p><form id="rux-route-form" class="rux-search-form"><label for="rux-route-query" class="sr-only">코스 장소 검색</label><input id="rux-route-query" type="search" placeholder="주소 또는 장소 검색"/><button class="ghost-button" type="submit">검색</button></form><div id="rux-route-results" class="rental-search-results" aria-live="polite"></div><div id="rux-route-preview-map" class="rental-naver-map picker" aria-label="변경 전후 코스 미리보기 지도"></div><p class="rux-note">주소 검색 · 지도 터치로 후보 선택</p><div id="rux-route-preview" aria-live="polite">새 장소를 선택하면 거리와 시간 변화를 보여드려요.</div>`,primary:'변경 적용',secondary:'취소',onConfirm:applyRentalRoutePreview});
  document.querySelector('[data-modal-confirm]').disabled=true;
  searchRentalPlaces('route','');
  requestAnimationFrame(initRentalRoutePickerMap);
}
async function initRentalRoutePickerMap() {
  const el=document.querySelector('#rux-route-preview-map');if(!el||rentalModalKind!=='route')return;
  if(!await readyRentalMap(el)||rentalModalKind!=='route')return;
  if(rentalPickerMap)rentalPickerMap.remove();
  rentalPreviewLayer=null;
  const route=ensureRentalRoute();
  rentalPickerMap=createRentalMap(el,[state.rentalPickupCoords.lat,state.rentalPickupCoords.lng],13);
  if(route.points.length>1){MoovNaverMap.polyline(route.points,{color:'#63736b',weight:4,dashArray:'5 6'}).addTo(rentalPickerMap);fitRentalRoute(rentalPickerMap,route,{padding:[25,30]});}
  rentalPickerMap.on('click',e=>previewRentalRoute(rentalPoint(e.latlng.lat,e.latlng.lng)));
  const edit=state.rentalUX.routeEdit;
  if(edit?.status==='ready'&&edit.preview)drawRentalRoutePreview(edit.preview);
}
let rentalPreviewLayer=null;
function drawRentalRoutePreview(route) {
  if(!rentalPickerMap)return;
  if(rentalPreviewLayer)rentalPreviewLayer.remove();
  rentalPreviewLayer=MoovNaverMap.polyline(route.points,{color:'#28754e',weight:5}).addTo(rentalPickerMap);
  fitRentalRoute(rentalPickerMap,route,{padding:[25,30]});
}
async function previewRentalRoute(p) {
  const edit=state.rentalUX.routeEdit;if(!edit)return;
  const token=++edit.token;edit.candidate=p;edit.status='loading';edit.preview=null;
  const container=document.querySelector('#rux-route-preview'),confirm=document.querySelector('[data-modal-confirm]');
  container.textContent='변경 경로를 계산하고 있어요…';confirm.disabled=true;
  const stops=rentalClone(ensureRentalRoute().stops);if(edit.add)stops.splice(stops.length-1,0,p);else stops[edit.index]=p;
  try {
    const next=await rentalServices.calculateRoute(stops);
    if(state.rentalUX.routeEdit!==edit||edit.token!==token)return;
    edit.preview=next;edit.status='ready';const old=ensureRentalRoute();
    container.innerHTML=`<strong>${escapeHtml(p.name)}</strong><table class="rux-preview-table"><caption>코스 변경 미리보기</caption><thead><tr><th>항목</th><th>현재</th><th>변경 후</th></tr></thead><tbody><tr><th>거리</th><td>${old.distance??'—'} km</td><td>${next.distance??'—'} km</td></tr><tr><th>이동 시간</th><td>${old.minutes??'—'}분</td><td>${next.minutes??'—'}분</td></tr></tbody></table><p>${rentalRouteDelta(old,next)}</p><small class="rux-note">${rentalRouteNote(next)}</small>`;
    confirm.disabled=false;
    drawRentalRoutePreview(next);
    container.scrollIntoView({block:'nearest',behavior:rentalReducedMotion()?'instant':'smooth'});
  } catch(e) {if(state.rentalUX.routeEdit===edit&&edit.token===token){edit.status='error';container.innerHTML='<p role="alert">경로를 계산하지 못했어요. 기존 코스는 유지됩니다. 다른 위치를 선택해 주세요.</p>';}}
}
function rentalRouteDelta(old,next) {
  if(next.unresolved)return `위치 확인이 필요한 장소 ${next.stops.filter(p=>p.lat==null).length}곳 · 장소 목록에서 나머지 위치를 지정해 주세요.`;
  if(old.distance==null)return '확인된 위치로 경로를 계산했어요.';
  const km=Number((next.distance-old.distance).toFixed(1)),minutes=next.minutes-old.minutes;
  return `${km>0?'+':''}${km.toFixed(1)} km / ${minutes>0?'+':''}${minutes}분`;
}
function applyRentalRoutePreview() {
  const edit=state.rentalUX.routeEdit;if(edit?.status!=='ready'||!edit.preview)return false;
  const old=ensureRentalRoute(),next=edit.preview;
  state.rentalUX.route=next;state.routeStops=next.stops.map(p=>p.name);state.selectedCourse=null;state.rentalCourseModified=true;state.rentalStopPopup=null;
  persist();render();toast(`코스를 변경했어요. ${rentalRouteDelta(old,next)}`);
}
function openRentalStopList() {
  const route=ensureRentalRoute();
  openModal({title:'코스 장소',iconName:'pin',body:`<div class="rental-search-results">${route.stops.slice(1).map((p,i)=>`<button data-action="rux-open-stop" data-value="${i+1}"><strong>${i+1}. ${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)} · 체류 ${p.dwell||0}분</small></button>`).join('')}</div>`,primary:null,secondary:'닫기'});
}
function handleRentalAction(button) {
  const action=button.dataset.action,value=button.dataset.value;
  const actions={
    'retry-rental-route':retryRentalRoadRoute,
    'rental-flow-back':rentalBack,'request-rent-flow':requestRentalVehicle,'cancel-rent-match':cancelRentalDispatch,'rental-boarded':boardRentalVehicle,
    'rental-flow-next':()=>{if((state.rentalFlowStep==='time'&&value==='vehicle')||(state.rentalFlowStep==='vehicle'&&value==='pickup'))rentalSetStep(value);},
    'rental-stop-popup':()=>showRentalStop(Number(value)), 'rental-stop-close':()=>showRentalStop(null),
    'rental-stops-list':openRentalStopList, 'rental-add-stop':()=>openRentalDestinationSearch(-1), 'locate-rental':locateRentalUser,
    'rux-open-stop':()=>{closeModal();showRentalStop(Number(value));},
    'rux-select-place':()=>{const p=rentalSearchResults.find(p=>p.id===button.dataset.id);if(p)button.dataset.kind==='pickup'?setRentalDraftPickup(p):previewRentalRoute(p);},
    'rux-recent':()=>{const p=[...state.rentalUX.recent,...RENTAL_PLACES].find(p=>p.id===button.dataset.id);if(p)setRentalDraftPickup(p);},
'rent-set-hours':()=>{state.rentalHours=Math.max(RENTAL_MIN_HOURS,Math.min(RENTAL_MAX_HOURS,Number(value)));persist();render();}
  };
  if(!actions[action])return false;actions[action]();return true;
}
// Persisted in-flight requests cannot be restored as real server requests in this demo.
if(['matching','assigned','approaching','arrived','error'].includes(state.rentalFlowStep)) {state.rentalFlowStep='pickup';state.rentalUX.dispatch={status:'idle'};}
if(state.rentalFlowStep==='boarded')state.rentalFlowStep='driving';


let activeModalCancel = null;
function openModal({title:modalTitle,body,iconName='shield',primary='확인',secondary='닫기',onConfirm=null,onCancel=null}) {
  if(rentalPickerMap){rentalPickerMap.stop(); rentalPickerMap.remove();rentalPickerMap=null;rentalPickerMarker=null;rentalPreviewLayer=null;}
  modal.dataset.kind='';
  rentalModalFocus=document.activeElement;
  activeModalCancel=onCancel;
  rentalModalKind=modalTitle==='출발 위치 수정'?'pickup':modalTitle==='코스 변경'?'route':null;
  document.querySelector('.modal-card').classList.toggle('rux-modal',!!rentalModalKind||state.homeMode==='rent');
  document.querySelector('#modal-title').textContent=modalTitle;
  const bodyEl=document.querySelector('#modal-body');bodyEl.innerHTML=body;bodyEl.scrollTop=0;
  document.querySelector('#modal-icon').innerHTML=icon(iconName);
  const actions=document.querySelector('#modal-actions');
  actions.innerHTML=`${secondary?`<button class="ghost-button" data-modal-cancel>${escapeHtml(secondary)}</button>`:''}${primary?`<button class="primary-button" data-modal-confirm>${escapeHtml(primary)}</button>`:''}`;
  actions.querySelector('[data-modal-cancel]')?.addEventListener('click',()=>closeModal());
  actions.querySelector('[data-modal-confirm]')?.addEventListener('click',()=>{const result=onConfirm?onConfirm():true;if(result!==false){activeModalCancel=null;closeModal();}});
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  document.querySelectorAll('.screen').forEach(el=>el.inert=true);
  requestAnimationFrame(()=>modal.querySelector('input,button:not([disabled])')?.focus({preventScroll:true}));
}
function closeModal() {
  if(!modal.classList.contains('open'))return;
  if(typeof onSecurityModalClose==='function')onSecurityModalClose();
  const callback=activeModalCancel;activeModalCancel=null;
  if(callback)callback();

  rentalSearchToken++;
  state.rentalUX.draftPickup=null;state.rentalUX.routeEdit=null;rentalModalKind=null;
  if(rentalPickerMap){rentalPickerMap.stop(); rentalPickerMap.remove();rentalPickerMap=null;}
  rentalPickerMarker=null;rentalPreviewLayer=null;
  modal.classList.remove('open');modal.setAttribute('aria-hidden','true');
  document.querySelectorAll('.screen').forEach(el=>el.inert=false);
  const focus=rentalModalFocus?.isConnected?rentalModalFocus:content.querySelector('.rux-heading')||content;
  focus?.focus({preventScroll:true});
}
function trapRentalModalFocus(event){
  if(!modal.classList.contains('open')||event.key!=='Tab')return;
  const buttons=[...modal.querySelectorAll('button:not([disabled]),input,textarea,select,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
  if(!buttons.length)return;
  if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}
  else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}
}
document.addEventListener('keydown',trapRentalModalFocus);

MoovLocationPicker.configureRouteSearch({
  search: query => rentalServices.search(query),
  onPreviewPickup: place => selectRentalPointOnMap(0,place),
  onSelect: (place,index,current) => {
    if(current&&!current())return;
    // Commit the selected point before requesting directions, so a road-route
    // refresh cannot discard the selection while its request is in flight.
    applyRentalStopLocation(index,place);
  },
});

// Animate the demo vehicle only along the route returned by NAVER.
function approachAt(route,progress){return MoovNaverMap.approachPosition(route,progress);}
function tickRoadApproach(dispatch,elapsed){
  const route=dispatch.approachRoute;
  if(!route){dispatch.message='차량 경로를 확인하지 못했어요. 다시 요청해 주세요.';rentalSetStep('error');return;}
  const progress=Math.min(1,elapsed/route.durationMs),position=approachAt(route,progress);
  dispatch.remainingMeters=position.remainingMeters;dispatch.remainingPoints=position.remainingPoints;
  const eta=Math.ceil(route.durationSeconds*(1-progress));updateVehiclePosition(position,eta);
  if(progress===1)rentalSetStep('arrived');
}
function renderRoadPickupNote(){
  const p=state.rentalUX.dispatch.approachRoute?.pickupSnap;
  return p&&p.distanceMeters>20?`<p class="rux-note">선택 위치에서 약 ${p.distanceMeters}m 떨어진 인근 도로의 승차 지점에서 만나요.</p>`:'';
}
