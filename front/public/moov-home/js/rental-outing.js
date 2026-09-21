/* A rental keeps its vehicle, clock and itinerary while the passenger is walking.
   Only recall moves the waiting vehicle. Positions and arrivals are demo data. */
function ensureRentalOuting(){
  const route=ensureRentalRoute();
  if(!state.rentalUX.outing){
    state.rentalUX.outing={phase:'driving',completedStops:0,
      carPosition:rentalClone(state.rentalUX.dispatch.position||route.stops[0]),
      userPosition:rentalClone(route.stops[0]),pickup:null,recall:null};
  }
  return state.rentalUX.outing;
}
function rentalOutingAvailable(){
  return state.tripActive&&state.rentalFlowStep==='driving'&&!cleanupRunning()&&getRentalRemaining()>0;
}
function rentalOutingNext(){return ensureRentalRoute().stops[ensureRentalOuting().completedStops+1]||null;}
function commitRentalOuting(){state.rentalUX.dispatch.position=rentalClone(ensureRentalOuting().carPosition);persist();render();}
function disembarkRentalOuting(){
  if(!rentalOutingAvailable())return;
  const outing=ensureRentalOuting(),next=rentalOutingNext();
  if(outing.phase!=='driving'||!next)return;
  try{
    outing.carPosition=roadNetwork.snapPickup(next);
  }catch(error){toast(error.message);return;}
  outing.completedStops++;
  outing.userPosition=rentalClone(next);outing.pickup=null;outing.recall=null;outing.phase='walking';
  state.rentalStopPopup=null;commitRentalOuting();
  toast('하차했어요. 산책을 마친 곳에서 내 차량을 불러 주세요.');
}
function openRentalRecallPicker(){
  if(!rentalOutingAvailable())return;
  const outing=ensureRentalOuting();if(outing.phase!=='walking')return;
  state.rentalUX.draftPickup=rentalClone(outing.userPosition);
  const places=[...RENTAL_PLACES].sort((a,b)=>rentalDistance(a,outing.userPosition)-rentalDistance(b,outing.userPosition)).slice(0,6);
  openModal({title:'어디로 차량을 부를까요?',iconName:'pin',
    body:`<p class="rux-note">산책을 마친 위치를 지도에서 선택하세요. 파란 핀이 내 위치이며, 가까운 도로에서 차량을 만나요.</p><button class="ghost-button full" data-action="recall-locate">${icon('pin')} 현재 위치 확인</button><div id="rental-picker-osm" class="rental-osm-map picker" aria-label="산책 후 승차 위치 선택 지도"></div><p id="rux-draft-label" class="rux-draft-label" aria-live="polite">내 위치 · 체험 선택: ${escapeHtml(outing.userPosition.name)}</p><p id="recall-picker-error" class="rux-error-text" role="alert"></p><p class="rux-note">체험 장소로 위치 선택</p><div class="rental-search-results">${places.map(p=>`<button data-action="recall-place" data-value="${p.id}"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)}</small></button>`).join('')}</div>`,
    primary:'이 위치로 내 차량 호출',secondary:'취소',onConfirm:startRentalRecall});
  rentalModalKind='recall';
  requestAnimationFrame(()=>{
    if(rentalModalKind!=='recall')return;
    initRentalPickerMap();
    rentalPickerMarker?.getElement()?.classList.add('outing-user-pin');
    if(rentalPickerMap){const marker=rentalMarker(rentalPickerMap,outing.carPosition,'내 차');marker.getElement()?.classList.add('home-car');}
  });
}
function chooseRentalRecallPlace(point){
  if(rentalModalKind!=='recall')return;
  rentalSearchToken++;setRentalDraftPickup(point);
  document.querySelector('#rux-draft-label').textContent='내 위치 · 체험 선택: '+point.name;
  document.querySelector('#recall-picker-error').textContent='';
}
function locateRentalRecallUser(){
  if(rentalModalKind!=='recall')return;
  const token=++rentalSearchToken,label=document.querySelector('#rux-draft-label');
  label.textContent='현재 위치를 확인하고 있어요…';
  const fail=()=>{if(token===rentalSearchToken&&rentalModalKind==='recall')label.textContent='현재 위치를 확인하지 못했어요. 지도나 체험 장소에서 선택해 주세요.';};
  if(!navigator.geolocation)return fail();
  navigator.geolocation.getCurrentPosition(position=>{
    if(token!==rentalSearchToken||rentalModalKind!=='recall')return;
    setRentalDraftPickup({...rentalPoint(position.coords.latitude,position.coords.longitude),name:'현재 위치',locationSource:'gps'});
    label.textContent='현재 위치를 확인했어요. 지도에서 승차 위치를 확인해 주세요.';
  },fail,{timeout:7000,maximumAge:0});
}
function startRentalRecall(){
  if(!rentalOutingAvailable()||rentalModalKind!=='recall')return false;
  const outing=ensureRentalOuting(),point=state.rentalUX.draftPickup;
  if(outing.phase!=='walking'||!point)return false;
  try{
    const route=roadNetwork.buildRecall(outing.carPosition,point);
    outing.userPosition=rentalClone(point);outing.pickup=route.pickupSnap;
    outing.recall={route,startedAt:Date.now()};
    outing.phase=route.totalMeters<5?'arrived':'approaching';
    if(outing.phase==='arrived')outing.carPosition=rentalClone(route.pickupSnap);
    commitRentalOuting();return true;
  }catch(error){document.querySelector('#recall-picker-error').textContent=error.message;return false;}
}
function rentalRecallPosition(outing=ensureRentalOuting(),now=Date.now()){
  const recall=outing.recall;
  if(!recall)return {...outing.carPosition,remainingMeters:0,remainingPoints:[]};
  return approachAt(recall.route,outing.phase==='arrived'?1:Math.max(0,(now-recall.startedAt)/recall.route.durationMs));
}
function tickRentalOuting(){
  if(!rentalOutingAvailable())return;
  const outing=ensureRentalOuting();if(outing.phase!=='approaching')return;
  const position=rentalRecallPosition(outing);outing.carPosition={lat:position.lat,lng:position.lng};
  state.rentalUX.dispatch.position=rentalClone(outing.carPosition);
  rentalCarMarker?.setLatLng([position.lat,position.lng]);
  rentalApproachLine?.setLatLngs(position.remainingPoints);
  const remaining=Math.max(0,Math.ceil((outing.recall.startedAt+outing.recall.route.durationMs-Date.now())/1000));
  const eta=document.querySelector('[data-recall-eta]');if(eta)eta.textContent=remaining+'초';
  const distance=document.querySelector('[data-recall-distance]');if(distance)distance.textContent=Math.round(position.remainingMeters)+'m 남음';
  if(remaining===0){outing.phase='arrived';commitRentalOuting();}
}
function cancelRentalRecall(){
  if(!rentalOutingAvailable())return;
  const outing=ensureRentalOuting();if(!['approaching','arrived'].includes(outing.phase))return;
  const position=rentalRecallPosition(outing);
  outing.carPosition={lat:position.lat,lng:position.lng};outing.phase='walking';outing.recall=null;outing.pickup=null;
  commitRentalOuting();toast('호출을 취소했어요. 차량은 현재 지점에서 기다립니다.');
}
function boardRentalRecall(){
  if(!rentalOutingAvailable())return;
  const outing=ensureRentalOuting();if(outing.phase!=='arrived')return;
  outing.userPosition={...outing.userPosition,...outing.carPosition};
  outing.recall=null;outing.pickup=null;outing.phase=rentalOutingNext()?'driving':'complete';
  commitRentalOuting();content.scrollTop=0;
  toast(rentalOutingNext()?'탑승했어요. 다음 장소로 이동합니다.':'탑승했어요. 모든 코스를 둘러봤습니다.');
}
function renderRentalOuting(){
  const outing=ensureRentalOuting(),route=ensureRentalRoute(),next=rentalOutingNext(),phase=outing.phase;
  const vehicle=rentalVehicles.find(v=>v.id===state.rentalVehicleType),identity=state.rentalUX.dispatch.vehicle;
  const title={driving:'다음 장소로 이동해요',walking:'산책을 즐기고 오세요',approaching:'내 차량이 오고 있어요',arrived:'차량이 도착했어요',complete:'코스를 모두 둘러봤어요'}[phase];
  const desc={driving:next?.name,walking:'내 차량은 대기 중이에요. 돌아갈 필요 없이 산책을 마친 곳으로 부르세요.',approaching:'승차 지점에서 기다려 주세요. 도착하면 탑승 버튼이 켜집니다.',arrived:'지도에 표시된 승차 지점에서 차량을 확인해 주세요.',complete:'새 목적지를 추가하거나 렌트 이용을 종료할 수 있어요.'}[phase];
  let action='';
  if(phase==='driving')action='<button class="primary-button full" data-action="outing-disembark">도착·하차 체험</button>';
  if(phase==='walking')action='<button class="primary-button full" data-action="recall-open">내 차량 호출</button>';
  if(['approaching','arrived'].includes(phase))action=`<button class="primary-button full" data-action="recall-board" ${phase==='arrived'?'':'disabled'}>${next?'탑승하고 다음 장소로':'차량에 탑승했어요'}</button><button class="ghost-button full" data-action="recall-cancel">호출 취소 · 위치 다시 선택</button>`;
  const routeEditable=!['approaching','arrived'].includes(phase);
  return `<div class="mobility-screen rent rux rux-driving outing-screen" data-rental-step="driving" data-outing-phase="${phase}"><div class="mobility-mode-bar"><span class="mode-current">${icon('key')} 렌트 이용 중</span><span class="rux-demo">체험</span></div><section class="mobility-map" aria-label="내 위치와 렌트 차량 지도"><div id="rental-outing-map" class="home-live-map rental-osm-map"></div><div class="outing-map-legend"><span class="user">내 위치</span><span>내 차량</span>${outing.pickup?'<span>승차 지점</span>':''}</div><button class="map-locate" data-action="outing-center" aria-label="내 위치와 차량 함께 보기">${icon('pin')}</button></section>${renderUsageStatus()}<section class="mobility-sheet"><div class="sheet-handle"></div><div class="outing-step" aria-live="polite"><span class="outing-eyebrow">${outing.completedStops} / ${route.stops.length-1}개 장소 방문</span><h3 class="rux-heading" tabindex="-1">${title}</h3><p>${escapeHtml(desc||'')}</p></div>${phase==='approaching'?`<div class="outing-eta"><strong>체험 도착까지 <b data-recall-eta>${Math.max(0,Math.ceil((outing.recall.startedAt+outing.recall.route.durationMs-Date.now())/1000))}초</b></strong><span data-recall-distance>${Math.round(rentalRecallPosition(outing).remainingMeters)}m 남음</span></div>`:''}${outing.pickup?.distanceMeters>20?`<p class="rux-note">내 위치에서 약 ${outing.pickup.distanceMeters}m 떨어진 도로의 승차 지점에서 만나요.</p>`:''}<div class="outing-vehicle"><span class="outing-car-icon">${icon('car')}</span><div><strong>${escapeHtml(vehicle.name)} · ${escapeHtml(identity?.plate||'MOOV 24')}</strong><small>이용 중인 내 차량 · 충전 ${identity?.battery??78}%</small></div></div><div class="outing-actions">${action}</div>${next&&phase!=='driving'?`<div class="outing-next"><small>재탑승 후 다음 장소</small><strong>${escapeHtml(next.name)}</strong><span>탑승하면 남은 코스로 이어집니다.</span></div>`:''}<p class="source-demo-note">차량 이동·도착 체험 · 산책 중에도 렌트 시간은 계속됩니다.</p><details class="outing-itinerary"><summary>나들이 코스 · ${Math.max(0,route.stops.length-1-outing.completedStops)}곳 남음</summary><ol>${route.stops.slice(1).map((p,i)=>`<li class="${i<outing.completedStops?'visited':''}" ${i===outing.completedStops?'aria-current="step"':''}><span>${i<outing.completedStops?'✓':i+1}</span><div><strong>${escapeHtml(p.name)}</strong><small>${i<outing.completedStops?'방문 완료':i===outing.completedStops?'다음 장소':'방문 예정'}</small></div></li>`).join('')}</ol></details>${routeEditable?`<div class="drive-edit-row">${next?'<button class="ghost-button" data-action="outing-change-next">다음 장소 변경</button>':''}<button class="ghost-button" data-action="rental-add-stop">${icon('plus')} 장소 추가</button></div>`:''}<button class="danger-text-button" data-action="finish-trip">렌트 이용 종료</button></section></div>`;
}
function initRentalOutingMap(){
  const el=document.querySelector('#rental-outing-map');if(!el)return;
  const outing=ensureRentalOuting(),next=rentalOutingNext();
  const position=outing.phase==='approaching'?rentalRecallPosition(outing):outing.carPosition;
  const map=rentalMapBase(el,[position.lat,position.lng],15);if(!map)return;
  map.zoomControl.setPosition('topleft');
  const onboard=['driving','complete'].includes(outing.phase),user=onboard?position:outing.userPosition;
  const bounds=[[position.lat,position.lng],[user.lat,user.lng]];
  if(onboard&&next&&Number.isFinite(next.lat)&&Number.isFinite(next.lng)){
    bounds.push([next.lat,next.lng]);
    L.polyline([[position.lat,position.lng],[next.lat,next.lng]],{color:'#28754e',weight:4,dashArray:'7 6'}).addTo(map);
    rentalMarker(map,next,'다음').bindTooltip(escapeHtml(next.name));
  }
  if(outing.recall){
    const p=rentalRecallPosition(outing);
    rentalApproachLine=L.polyline(p.remainingPoints,{color:'#28754e',weight:5}).addTo(map);
    bounds.push(...outing.recall.route.points);
    rentalMarker(map,outing.pickup,'승차').getElement()?.classList.add('outing-pickup-pin');
  }
  rentalMarker(map,{...user,name:onboard?'내 위치 · 차량 탑승 중':'내 위치 · '+(user.locationSource==='gps'?'현재 위치':'체험 선택')},'나').getElement()?.classList.add('outing-user-pin');
  rentalCarMarker=rentalMarker(map,{...position,name:'이용 중인 내 차량'},'내 차');
  rentalCarMarker.getElement()?.classList.add('home-car');
  map.fitBounds(bounds,{paddingTopLeft:[50,65],paddingBottomRight:[50,55],maxZoom:16});
}
function handleRentalOutingAction(button){
  const actions={'outing-disembark':disembarkRentalOuting,'recall-open':openRentalRecallPicker,'recall-locate':locateRentalRecallUser,
    'recall-place':()=>{const p=RENTAL_PLACES.find(p=>p.id===button.dataset.value);if(p)chooseRentalRecallPlace(p);},
    'recall-board':boardRentalRecall,'recall-cancel':cancelRentalRecall,'outing-center':initRentalOutingMap,
    'outing-change-next':()=>openRentalDestinationSearch(ensureRentalOuting().completedStops+1)};
  if(!actions[button.dataset.action])return false;actions[button.dataset.action]();return true;
}
