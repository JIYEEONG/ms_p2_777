/*
 * Home composition: MOOV10 design + policy pickup / dispatch / course controls.
 * No authentication, content player, AI, outing or profile implementation is included.
 */
function rentalOptionFee(){return rentalOptionCatalog.filter(x=>state.rentalOptions.has(x.id)).reduce((sum,x)=>sum+x.price,0);}
function rentalTotalFare(){return rentalFareForHours(state.rentalVehicleType,state.rentalHours)+rentalOptionFee();}
function showHomeModeChoice(){
  if(!state.tripActive){
    rentalRequestToken++;
    state.homeStep='mode';state.rentalFlowStep='setup';state.rentalUX.dispatch={status:'idle'};
    persist();render();
  }
  content.scrollTop=0;
}
function rentalBack(){
  if(['matching','assigned','approaching','arrived','error'].includes(state.rentalFlowStep))return cancelRentalDispatch();
  if(state.tripActive)return;
  if(state.rentalFlowStep==='pickup')rentalSetStep('setup');
  else showHomeModeChoice();
}
function renderRentalJourney(){
  const step=state.rentalFlowStep;
  if(step==='setup')return renderBooking();
  if(step==='driving')return renderRentalDrivingScreen();
  const vehicle=rentalVehicles.find(v=>v.id===state.rentalVehicleType);
  const heading={pickup:'출발 위치',matching:'차량 찾는 중',assigned:'배차 완료',approaching:'차량 접근 중',arrived:'차량 도착',boarded:'탑승 완료',error:'배차 확인 필요'}[step];
  return `<div class="rental-journey rux" data-rental-step="${step}"><div class="rental-flow-head">${!state.tripActive?`<button class="mode-back" data-action="rental-flow-back" aria-label="${['matching','assigned','approaching','arrived','error'].includes(step)?'배차 취소 후 출발지로 돌아가기':'이전 단계로 돌아가기'}">${icon('back')}</button>`:''}<h2 class="rux-heading" tabindex="-1"><small>MOOV 렌트</small>${heading}</h2><span class="rux-demo">체험</span></div>${renderRentalProgress(step)}${renderRentalJourneyStep(step,vehicle)}${rentalSetupFooter(step,vehicle)}</div>`;
}
function renderHomeMap(driving=false){
  const r=ensureRentalRoute(),end=r.stops.at(-1);
  const notice=driving?`${end.name} 방면 · 다음 지점 약 ${r.nextMinutes??'—'}분`:state.locationReady?'차량이 정차할 수 있는 승차 지점을 확인해 주세요.':'출발지를 확인하면 가까운 무인차를 찾을게요.';
  return `<section class="mobility-map" aria-label="${driving?'이용 중인 코스':'예약 코스'} 지도"><div id="${driving?'rental-driving-naver':'home-booking-map'}" class="home-live-map rental-naver-map"></div><button class="map-locate" data-action="locate-rental-map" aria-label="현재 위치 찾기">${icon('pin')}</button>${driving?`<div id="rux-stop-popover">${rentalStopPopover()}</div>`:''}</section><div class="map-safety map-route-status ${driving||state.locationReady?'ready':''}">${icon(driving?'shield':'pin')}<span>${escapeHtml(notice)}</span><button type="button" class="route-overview" data-action="center-route" data-i18n-skip>${rentalMapText('전체 경로','Full route')}</button></div>${renderRentalRouteRetry(r)}`;
}
function renderRoutePlanner(){
  const route=ensureRentalRoute();
  return `<div class="route-tools"><button type="button" data-action="locate-rental">${icon('pin')} ${rentalMapText('내 위치','My location')}</button><button type="button" data-action="choose-saved-course">${icon('bookmark')} ${rentalMapText('관심 코스','Saved courses')}</button><button type="button" data-action="browse-courses-home">${icon('compass')} ${rentalMapText('나들이 코스','Outing courses')}</button></div><div class="route-planner">${route.stops.map((p,index)=>MoovLocationPicker.field({
    index,value:p.name,kind:index===0?'pickup':index===route.stops.length-1?'destination':'waypoint',
    address:index===0&&state.pickupDetails?.name===p.name?state.pickupDetails.address:'',
    label:index===0?rentalMapText('출발지','Pickup'):index===route.stops.length-1?rentalMapText('목적지','Destination'):rentalMapText(`경유지 ${index}`,`Stop ${index}`),
    mapAction:index===0?'open-pin-picker':'edit-route-stop',
  })).join('')}</div>`;
}

function renderBooking(){
  const v=rentalVehicles.find(v=>v.id===state.rentalVehicleType);
  return `<div class="mobility-screen rent" data-rental-step="setup"><div class="mobility-mode-bar"><button class="mode-back" data-action="rental-flow-back" aria-label="이동 모드 선택">${icon('back')}</button><span class="mode-current">${icon('key')} 렌트</span></div>${renderHomeMap()}<section class="mobility-sheet"><div class="sheet-handle"></div><div class="sheet-title"><div><span>나만의 이동 공간</span><h3 class="rux-heading" tabindex="-1">어떤 차량을 이용할까요?</h3></div><span class="mode-symbol">${icon('key')}</span></div>${renderRoutePlanner()}<div class="rent-config"><div class="section-row"><strong>차량 선택</strong><span>아래 차량을 눌러 비교</span></div><section class="vehicle-detail-picker rux" aria-label="차량 선택">${renderRentalVehicleCards(state.rentalVehicleType)}</section><div class="rent-control-row"><div><small>이용 시간</small><strong>3~24시간</strong></div><div class="hour-control"><button data-action="rent-minus" aria-label="이용 시간 1시간 줄이기" ${state.rentalHours<=3?'disabled':''}>−</button><strong aria-live="polite">${state.rentalHours}시간</strong><button data-action="rent-plus" aria-label="이용 시간 1시간 늘리기" ${state.rentalHours>=24?'disabled':''}>＋</button></div></div><div class="rental-preset-row" role="group" aria-label="이용 시간 빠른 선택">${[
  {h:RENTAL_MIN_HOURS,label:'최소'},
  {h:6,label:'6시간'},
  {h:10,label:'10시간'},
  {h:15,label:'15시간'},
  {h:RENTAL_MAX_HOURS,label:'최대'}
].map(p=>`<button class="${p.h===state.rentalHours?'active':''}" aria-pressed="${p.h===state.rentalHours}" data-action="rent-set-hours" data-value="${p.h}">${p.label}</button>`).join('')}</div><div class="section-row option-heading"><strong>공간 옵션</strong><span>선택 사항 · 복수 선택</span></div><div class="rental-options">${rentalOptionCatalog.map(x=>`<button class="rental-option ${state.rentalOptions.has(x.id)?'selected':''}" data-action="rental-option" data-value="${x.id}" aria-pressed="${state.rentalOptions.has(x.id)}">${icon(state.rentalOptions.has(x.id)?'bookmark':'plus')}<span>${escapeHtml(x.name)}</span><strong>+${rentalMoney(x.price)}</strong></button>`).join('')}</div><div class="rent-total" aria-live="polite"><span><small>총 예상 요금</small><strong>${rentalMoney(rentalTotalFare())}</strong></span><span>${state.rentalHours}시간</span></div><p class="fare-breakdown">차량 ${rentalMoney(rentalFareForHours(v.id,state.rentalHours))} + 옵션 ${rentalMoney(rentalOptionFee())}<br/>주행요금 포함 · 장시간 패키지 할인 자동 적용</p><button class="primary-button full call-button" data-action="setup-next" data-i18n-skip>${rentalMapText('렌트 시작','Start rental')}</button></div></section></div>`;
}
function renderRentalDrivingScreen(){
  const r=ensureRentalRoute(),m=rentalRouteMetrics(),v=rentalVehicles.find(x=>x.id===state.rentalVehicleType);
  return `<div class="mobility-screen rent rux rux-driving" data-rental-step="driving"><div class="mobility-mode-bar"><span class="mode-current">${icon('key')} 렌트 이용 중</span><span class="live-indicator"><i></i>LIVE</span></div>${renderHomeMap(true)}${renderUsageStatus()}<section class="mobility-sheet"><div class="sheet-handle"></div><div class="sheet-title"><div><span>나만의 이동 공간</span><h3 class="rux-heading" tabindex="-1">현재 이용 현황</h3></div><span class="mode-symbol">${icon('key')}</span></div><div class="active-route">${r.stops.map((p,i)=>`<button class="active-route-line ${i===r.stops.length-1?'destination':i>0?'waypoint':''}" data-action="${i===0?'center-route':'rental-stop-popup'}" data-value="${i}"><span class="route-mark"></span><span><small>${i===0?'출발 위치':i===r.stops.length-1?'목적지':'경유지 '+i}</small><strong>${escapeHtml(p.name)}</strong></span></button>`).join('')}</div><div class="vehicle-health"><span>${icon('car')} ${escapeHtml(v.name)}</span><span>충전량 <strong>${state.rentalUX.dispatch.vehicle?.battery??78}%</strong></span></div><div class="rux-route-summary"><strong>${m.distance} km <span>· 약 ${m.minutes}분</span></strong><small>${rentalRouteNote(r)}</small></div>${r.unresolved?'<p class="rux-error-text">위치 미확인 장소가 있어요. 코스 장소에서 위치를 지정해 주세요.</p>':''}<div class="drive-edit-row"><button class="ghost-button" data-action="rental-search-destination">${icon('search')} 코스 변경</button><button class="ghost-button" data-action="rental-stops-list">${icon('pin')} 장소 목록</button></div><button class="ghost-button full" data-action="rental-add-stop">${icon('plus')} 경유지 추가</button><button class="danger-text-button" data-action="finish-trip">렌트 이용 종료</button></section></div>`;
}
let renderToken=0;
let rentalCamera = null;
function render(){
  const scroll=content.scrollTop,thumbScroll=content.querySelector('.rux-thumbnails')?.scrollLeft||0;
  const selectedFocus=document.activeElement?.closest('.rux-thumbnails [data-action="rental-vehicle"]')?.dataset.value;
  if(rentalMapView){
    const map=rentalMapView.native;
    if(map.moovInteracted&&!MoovLocationPicker.isSelectingPickup())rentalCamera={key:map.moovRouteKey,center:map.getCenter(),zoom:map.getZoom()};
    rentalMapView.stop();rentalMapView.remove();rentalMapView=null;
  }
  rentalCarMarker=null;rentalApproachLine=null;
  const token=++renderToken;
  content.innerHTML=renderCleanupBanner()+(!state.tripActive&&state.homeStep==='mode'?renderHomeModeChoice():renderRentalJourney());
  content.scrollTop=scroll;
  if(content.querySelector('.rux-thumbnails'))content.querySelector('.rux-thumbnails').scrollLeft=thumbScroll;
  if(selectedFocus)content.querySelector(`.rux-thumbnails [data-value="${selectedFocus}"]`)?.focus({preventScroll:true});
  requestAnimationFrame(()=>{
    if(token!==renderToken)return;
    if(state.homeStep==='mode'&&!state.tripActive)return;
    if(['setup','driving'].includes(state.rentalFlowStep))initHomeRouteMap();else initRentalFlowMap();
    scheduleRentalFlowTransitions();
    if(rentalLastRenderedStep!==state.rentalFlowStep){rentalLastRenderedStep=state.rentalFlowStep;content.querySelector('.rux-heading')?.focus({preventScroll:true});}
  });
}
async function initHomeRouteMap(){
  const driving=state.rentalFlowStep==='driving',el=document.querySelector(driving?'#rental-driving-naver':'#home-booking-map');
  if(!el)return;
  if(!await readyRentalMap(el))return;
  const route=ensureRentalRoute(),p=rentalPickup();
  const map=rentalMapBase(el,[p.lat,p.lng],15);if(!map)return;
  if(!route.unresolved)MoovNaverMap.polyline(route.points,{color:'#28754e',weight:5,dashArray:route.provider==='naver'?undefined:'7 6'}).addTo(map);
  updateRentalRoadRoute(route);
  route.stops.forEach((p,i)=>{
    if(p.lat==null||p.lng==null)return;
    const label=i===0?'출발':i===route.stops.length-1?'도착':String(i);
    const marker=rentalMarker(map,p,label,()=>{
      if(driving){if(i>0)showRentalStop(i);else toast('출발 위치 · '+p.name);}
      else if(i===0){if(!MoovLocationPicker.selectExistingPoint(p))selectRentalPointOnMap(0);}
      else toast(p.name);
    },i===0&&rentalCanEditRoute());
    if(i===0&&rentalCanEditRoute())marker.on('dragend',()=>{const point=marker.getLatLng();marker.setLatLng(p);selectRentalPointOnMap(0,point);});
    marker.getElement()?.classList.add('home-pin',i===0?'start':i===route.stops.length-1?'goal':'waypoint');
    marker.bindTooltip(escapeHtml(p.name.replace('현재 위치 · ','')),{direction:i%2?'right':'left',className:'home-map-label',offset:[16,0]});
  });
  if(driving&&route.points.length){
    // Demo vehicle starts on the verified NAVER road path.
    const marker=rentalMarker(map,{...route.stops[0],name:'이용 차량 · 체험 위치'},'차량');
    marker.getElement()?.classList.add('home-car');
    marker.setLatLng(route.points[0]);
  }
  fitRentalRoute(map,route);
}
function renderSearchField(){return `<form class="home-search-form" id="home-search-form"><label class="sr-only" for="home-search">장소 검색</label><input id="home-search" type="search" placeholder="원하는 곳, 코스를 검색하세요"/><button class="ghost-button" type="submit">검색</button></form>`;}

const demoCourses=[
  {id:'seongsu',name:'성수동 감성 카페 투어',ids:['onion','daelim','forest-cafes'],desc:'어니언 성수 · 대림창고 · 서울숲 카페거리'},
  {id:'forest',name:'서울숲 문화 산책',ids:['forest','museum'],desc:'서울숲 · 디뮤지엄'},
  {id:'night',name:'한강과 도심 나들이',ids:['banpo','ikseon'],desc:'반포 한강공원 · 익선동 한옥거리'}
];
function chooseCourse(){
  if(!rentalCanEditRoute())return;
  if(window.parent!==window)return navigateHost('outing',{section:'saved',mode:'rent'});
  openModal({title:'관심 코스',iconName:'bookmark',body:`<p>등록된 체험 코스 중 선택해 보세요.</p><div class="rental-search-results">${demoCourses.map(c=>`<button data-action="choose-course" data-value="${c.id}"><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.desc)}</small></button>`).join('')}</div>`,primary:null,secondary:'닫기'});
}
function applyCourse(id){
  if(!rentalCanEditRoute())return;
  const c=demoCourses.find(c=>c.id===id);if(!c)return;
  const stops=[rentalPickup(),...c.ids.map(id=>rentalClone(RENTAL_PLACES.find(p=>p.id===id)))];
  state.rentalUX.route=calculateRentalRoute(stops);state.routeStops=stops.map(p=>p.name);state.selectedCourse={id:c.id,name:c.name};state.homeStep='booking';state.rentalFlowStep='setup';
  closeModal();persist();render();content.scrollTop=0;toast('선택한 코스를 불러왔어요.');
}
function navigateHost(tab,options={}){
  emitHome('navigate',{tab,returnTo:'home',...options});
  if(window.parent===window)toast(`${{ai:'AI 말동무',space:'공간',outing:'나들이',profile:'내 정보',taxi:'택시'}[tab]||tab} 화면은 통합 앱에서 연결합니다.`);
}
function updateUsageTimer(){
  document.querySelectorAll('[data-live-remaining]').forEach(el=>el.textContent=formatElapsed(getRentalRemaining()));
  if(state.tripActive&&!cleanupRunning()&&getRentalRemaining()<=0){closeModal();runSecureCleanup('time-expired');}
}
function handleHomeClick(event){
  if(!event.target.isConnected)return;
  if(cleanupRunning()){
    if(event.target.closest('[data-action="open-cleanup"],[data-action="open-status"]'))return openCleanupStatus();
    if(!event.target.closest('#modal')){if(event.target.closest('button,a')){event.preventDefault();toast('차량 기록 정리가 끝난 뒤 이용해 주세요.');}return;}
  }
  const nav=event.target.closest('[data-tab]');
  if(nav){if(nav.dataset.tab==='home')showHomeModeChoice();else navigateHost(nav.dataset.tab);return;}
  if(event.target.closest('.home-logo')){event.preventDefault();showHomeModeChoice();return;}
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action,value=button.dataset.value;
  if(handleRentalAction(button))return;
  if(action==='close-modal')return closeModal();
  if(action==='open-cleanup')return openCleanupStatus();
  if(action==='notice-detail'){const n=appNotices.find(x=>x.id===value);if(n)return openModal({title:n.title,iconName:'bell',body:`<p>${escapeHtml(n.text)}</p>`,primary:'확인',secondary:null});return;}
  if(action==='home-notices')return openModal({title:'공지·이벤트',iconName:'bell',body:`<div class="rental-search-results">${appNotices.map(n=>`<button data-action="notice-detail" data-value="${escapeHtml(n.id)}"><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.tag)} · ${escapeHtml(n.date)}</small></button>`).join('')}</div>`,primary:null,secondary:'닫기'});
  if(action==='open-pin-picker')return selectRentalPointOnMap(0);
  if(action==='edit-route-stop')return selectRentalPointOnMap(Number(value));
  if(action==='rental-change-stop')return openRentalDestinationSearch(Number(value));
  if(action==='rental-search-destination')return openRentalDestinationSearch();
  if(action==='locate-rental-map'){MoovNaverMap.locateOnMap(rentalMapView,button,toast);return;}
  if(action==='center-route'){MoovLocationPicker.cancelSelection();resetRentalRouteCamera();render();return;}
  if(action==='select-home-mode'){
    if(value==='taxi')return navigateHost('taxi');
    state.homeMode='rent';state.homeStep='booking';state.rentalFlowStep='setup';persist();render();content.scrollTop=0;return;
  }
  if(action==='setup-next'){if(ensureRentalRoute().unresolved)return toast('코스 장소의 위치를 먼저 확인해 주세요.');return rentalSetStep('pickup');}
  if(action==='rental-vehicle'){
    if(!rentalVehicles.some(v=>v.id===value))return;
    state.rentalVehicleType=value;persist();render();return;
  }
  if(action==='rent-minus'||action==='rent-plus'||action==='rent-set-hours'){
    state.rentalHours=Math.max(3,Math.min(24,action==='rent-set-hours'?Number(value):state.rentalHours+(action==='rent-plus'?1:-1)));persist();render();return;
  }
  if(action==='rental-option'){
    if(!rentalOptionCatalog.some(x=>x.id===value))return;
    state.rentalOptions.has(value)?state.rentalOptions.delete(value):state.rentalOptions.add(value);persist();render();return;
  }
  if(action==='choose-saved-course')return chooseCourse();
  if(action==='choose-course')return applyCourse(value);
  if(action==='browse-courses-home')return rentalCanEditRoute()&&(window.parent!==window?navigateHost('outing',{section:'recommend',mode:'rent'}):chooseCourse());
  if(action==='header-profile')return navigateHost('profile');
  if(action==='open-status'){
    const v=rentalVehicles.find(v=>v.id===state.rentalVehicleType),d=state.rentalUX.dispatch;
    return openModal({title:'차량 상태',iconName:'car',body:`<p>${d.vehicle?escapeHtml(v.name)+' · '+escapeHtml(d.vehicle.plate):'아직 배정된 차량이 없어요.'}</p><p class="rux-note">${state.tripActive?'렌트 이용 중 · '+formatElapsed(getRentalRemaining())+' 남음':d.vehicle?'출발 위치로 이동하거나 탑승을 기다리고 있어요.':'차량과 시간을 고른 뒤 출발 위치에서 요청해 주세요.'}</p>`,primary:'확인',secondary:null});
  }
  if(action==='rental-help')return openModal({title:'렌트 이용 안내',body:'<p>차량·시간·코스를 선택하고 출발 위치를 확인하세요. 차량이 도착하면 탑승 버튼이 활성화됩니다. 탑승 약 3초 후 코스 이용 화면으로 이동합니다.</p>',primary:'확인',secondary:null});
  if(action==='finish-trip')return openEndConfirmation();
}
function handleHomeSubmit(event){
  if(event.target.id==='rux-pickup-form'){event.preventDefault();searchRentalPlaces('pickup',document.querySelector('#rental-pickup-search').value);}
  if(event.target.id==='rux-route-form'){event.preventDefault();searchRentalPlaces('route',document.querySelector('#rux-route-query').value);}
  if(event.target.id==='home-search-form'){
    event.preventDefault();const q=document.querySelector('#home-search').value.trim();
    state.homeStep='booking';state.rentalFlowStep='setup';render();openRentalDestinationSearch();document.querySelector('#rux-route-query').value=q;searchRentalPlaces('route',q);
  }
}
function handleHomeKey(event){if(event.key==='Escape'&&modal.classList.contains('open'))closeModal();}
function handleBackdrop(event){if(event.target===modal)closeModal();}
function refreshRentalMapLanguage(){if(state.homeStep!=='mode'||state.tripActive)render();}
document.addEventListener('click',handleHomeClick);
document.addEventListener('submit',handleHomeSubmit);
document.addEventListener('keydown',handleHomeKey);
modal.addEventListener('click',handleBackdrop);
window.addEventListener('moov:language-change',refreshRentalMapLanguage);
 function importRoute(stops){
  if(!Array.isArray(stops)||stops.length<2||stops.length>20||stops.some(p=>!p||typeof p.name!=='string'||!p.name.trim()||(p.lat!=null&&!Number.isFinite(p.lat))||(p.lng!=null&&!Number.isFinite(p.lng))||(p.lat!=null&&Math.abs(p.lat)>90)||(p.lng!=null&&Math.abs(p.lng)>180)))throw Error('코스는 이름이 있는 2~20개 장소여야 합니다.');
  if(cleanupRunning()||state.tripActive||!['setup','pickup'].includes(state.rentalFlowStep))throw Error('배차 또는 이용 중에는 앱의 코스 변경 기능을 사용해 주세요.');
  const clean=stops.map((p,i)=>{const known=rentalKnownPlace(p.name);return {id:String(p.id||'host-'+i),name:p.name.trim().slice(0,120),lat:p.lat??known?.lat??null,lng:p.lng??known?.lng??null,category:String(p.category||known?.category||'위치 확인 필요'),dwell:Math.max(0,Number(p.dwell)||0)};});
  if(clean[0].lat==null||clean[0].lng==null)throw Error('출발지 위치를 먼저 확인해 주세요.');
  state.pickupLocation=clean[0].name;state.rentalPickupCoords={lat:clean[0].lat,lng:clean[0].lng};state.routeStops=clean.map(p=>p.name);state.rentalUX.route=calculateRentalRoute(clean);state.locationReady=true;state.homeStep='booking';state.rentalFlowStep='setup';persist();render();return publicState();
}
function handleHostMessage(event){
  if(event.source!==window.parent||event.origin!==config.parentOrigin||event.data?.source!=='moov-host'||event.data?.version!==1)return;
  if(event.data.type==='resume-booking'&&rentalCanEditRoute()){state.homeStep='booking';persist();render();return;}
  try{if(event.data.type==='set-route')emitHome('route-applied',importRoute(event.data.stops));if(event.data.type==='get-state')emitHome('state',publicState());}
  catch(error){emitHome('error',{message:error.message});}
}
window.addEventListener('message',handleHostMessage);
function updateClock(){document.querySelector('#clock').textContent=new Date().toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit',hour12:false});}
let ticker=setInterval(()=>{if(cleanupRunning())tickSecureCleanup();else{rentalTick();updateUsageTimer();}},250),clockTicker=setInterval(updateClock,30000);
function destroy(){
  window.removeEventListener('moov:language-change',refreshRentalMapLanguage);
  clearInterval(ticker);clearInterval(clockTicker);clearTimeout(toastTimer);rentalRequestToken++;rentalSearchToken++;rentalLocationToken++;renderToken++;
  if(rentalMapView){rentalMapView.stop();rentalMapView.remove();rentalMapView=null;}
  if(rentalPickerMap){rentalPickerMap.stop();rentalPickerMap.remove();rentalPickerMap=null;}
  document.removeEventListener('click',handleHomeClick);document.removeEventListener('submit',handleHomeSubmit);document.removeEventListener('keydown',handleHomeKey);document.removeEventListener('keydown',trapRentalModalFocus);modal.removeEventListener('click',handleBackdrop);window.removeEventListener('message',handleHostMessage);
}
window.MOOVHome=Object.freeze({getState:publicState,setRoute:importRoute,destroy,services:rentalServices});
window.addEventListener('pagehide',destroy,{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
render();updateClock();if(!cleanupRunning())updateUsageTimer();restoreCleanup();emitHome('ready',publicState());

function selectRentalPointOnMap(index=0,initial=null){
  if(state.tripActive||!['setup','pickup'].includes(state.rentalFlowStep))return;
  if(index!==0)return openRentalDestinationSearch(index);
  const element=document.querySelector('#home-booking-map,#rental-pickup-naver');
  if(!element||!rentalMapView)return toast(rentalMapText('지도를 불러오는 중이에요. 잠시 후 다시 선택하세요.','The map is loading. Please try again shortly.'));
  rentalLocationToken++;
  MoovLocationPicker.selectOnMap({element,map:rentalMapView.native,index,initial:initial||(index===0?state.rentalPickupCoords:null)});
}
