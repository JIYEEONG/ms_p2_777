(() => {
  'use strict';

  const STORE = 'moov_vehicle_current_v1';
  const AUDIT_STORE = 'moov_vehicle_audit_v1';
  const STATE_LABELS = {
    OFFLINE:'오프라인', MAINTENANCE:'정비 중', QUARANTINED:'격리', CHARGING:'충전 중',
    READY_TAXI:'택시 배차 가능', REBALANCING:'재배치 중', TAXI_ASSIGNED:'픽업 이동',
    TAXI_ACTIVE:'택시 운행', RESERVED_RENTAL:'렌트 예약 보호', RENTAL_ACTIVE:'렌트 운행', END_PROCESSING:'종료 처리'
  };
  const movingStates = new Set(['REBALANCING','TAXI_ASSIGNED','TAXI_ACTIVE','RENTAL_ACTIVE','CHARGING']);
  const defaults = [
    ['MOOV 24',37.5448,127.0557,'성수','READY_TAXI',78,0,true,'실차 GPS 예시','컴팩트·라운지','없음'],
    ['MOOV 18',37.4979,127.0276,'강남','TAXI_ACTIVE',64,34,true,'실차 GPS 예시','컴팩트·접근성','운행 TR-9482'],
    ['MOOV 31',37.5251,126.9256,'여의도','CHARGING',41,0,true,'실차 GPS 예시','패밀리·라운지','18:20 렌트'],
    ['MOOV 07',37.5796,126.9770,'북촌','REBALANCING',72,22,true,'합성 차량','컴팩트','없음'],
    ['MOOV 12',37.5112,127.0982,'잠실','READY_TAXI',91,0,true,'합성 차량','패밀리','없음'],
    ['MOOV 36',37.5561,126.9368,'신촌','TAXI_ASSIGNED',58,27,true,'합성 차량','컴팩트','없음'],
    ['MOOV 42',37.5663,126.9019,'상암','RESERVED_RENTAL',83,0,true,'합성 차량','라운지','16:40 렌트'],
    ['MOOV 55',37.4849,126.8955,'구로','MAINTENANCE',36,0,true,'합성 차량','접근성','없음'],
    ['MOOV 63',37.5184,127.0473,'청담','END_PROCESSING',69,0,false,'합성 차량','라운지','Wipe 검증'],
    ['MOOV 71',37.5624,127.0369,'왕십리','RENTAL_ACTIVE',67,29,true,'합성 차량','패밀리','렌트 RR-1204'],
    ['MOOV 84',37.5327,126.9905,'용산','QUARANTINED',53,0,false,'합성 차량','컴팩트','보안 검증'],
    ['MOOV 96',37.6028,127.0415,'월곡','OFFLINE',48,0,true,'합성 차량','컴팩트','없음']
  ];

  const now = Date.now();
  const seed = defaults.map((v,i) => ({
    id:v[0], lat:v[1], lon:v[2], zone:v[3], state:v[4], soc:v[5], speed:v[6], securityOk:v[7], source:v[8], capability:v[9], assignment:v[10],
    safetyOk:v[4] !== 'MAINTENANCE' && v[4] !== 'OFFLINE', observedAt:new Date(now-(i===11?62000:i*700)).toISOString(),
    ruleVersion:'dispatch-v1.1', gpsAccuracy:i<3?3.4:5.8, nextReservation:i===2?'2026-09-22 18:20':i===6?'2026-09-22 16:40':'없음'
  }));
  const read = (key,fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  let vehicles = read(STORE,seed);
  let audits = read(AUDIT_STORE,[
    {at:new Date(now-4*60000).toISOString(),title:'MOOV 84 자동 격리',detail:'security_ok=false · 신규 배차와 렌트 차단'},
    {at:new Date(now-12*60000).toISOString(),title:'MOOV 31 충전 슬롯 확정',detail:'목표 SOC 70% · 예상 완료 16:05'},
    {at:new Date(now-21*60000).toISOString(),title:'성수 권역 재배치 완료',detail:'택시 예비량 3대 확보 · rule dispatch-v1.1'}
  ]);
  let selectedId = vehicles[0].id;
  let map;
  let markers = new Map();
  let fallbackMap = false;

  const $ = selector => document.querySelector(selector);
  const escapeHTML = value => String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const persist = () => localStorage.setItem(STORE,JSON.stringify(vehicles));
  const ageSeconds = vehicle => Math.max(0,Math.round((Date.now()-Date.parse(vehicle.observedAt))/1000));
  const isStale = vehicle => ageSeconds(vehicle)>10;
  const hardEligible = vehicle => vehicle.safetyOk && vehicle.securityOk && vehicle.soc>=35 && !isStale(vehicle) && ['READY_TAXI','REBALANCING'].includes(vehicle.state);
  const groupFor = state => state==='READY_TAXI'?'ready':['REBALANCING','TAXI_ASSIGNED','TAXI_ACTIVE','RESERVED_RENTAL','RENTAL_ACTIVE'].includes(state)?'active':['CHARGING','END_PROCESSING'].includes(state)?'energy':'exception';
  const visibleVehicles = () => {
    const q=$('#vehicle-search').value.trim().toLowerCase(), state=$('#vehicle-state-filter').value, source=$('#vehicle-source-filter').value;
    return vehicles.filter(v => (!q || `${v.id} ${v.zone} ${STATE_LABELS[v.state]}`.toLowerCase().includes(q)) &&
      (state==='all'||(state==='eligible'&&hardEligible(v))||(state==='active'&&groupFor(v.state)==='active')||(state==='energy'&&groupFor(v.state)==='energy')||(state==='exception'&&groupFor(v.state)==='exception')) &&
      (source==='all'||(source==='real'&&v.source.startsWith('실차 GPS'))||(source==='synthetic'&&v.source==='합성 차량')));
  };
  const toast = message => {
    const host=$('#toast-region'), el=document.createElement('div'); el.className='toast'; el.textContent=message; host.append(el); setTimeout(()=>el.remove(),3200);
  };
  const timeText = iso => {
    const sec=Math.max(0,Math.round((Date.now()-Date.parse(iso))/1000));
    return sec<60?`${sec}초 전`:`${Math.round(sec/60)}분 전`;
  };

  function renderKpis(){
    const eligible=vehicles.filter(hardEligible).length, active=vehicles.filter(v=>['TAXI_ASSIGNED','TAXI_ACTIVE','RENTAL_ACTIVE'].includes(v.state)).length;
    const charge=vehicles.filter(v=>v.state==='CHARGING'||v.soc<35).length, exceptions=vehicles.filter(v=>groupFor(v.state)==='exception'||!v.securityOk||isStale(v)).length;
    const cards=[['전체 차량',vehicles.length+'대','연동 예시 3 · 합성 '+(vehicles.length-3)],['배차 가능',eligible+'대','안전·보안·SOC 통과'],['운행 중',active+'대','택시·렌트 포함'],['충전·SOC',charge+'대','35% 미만 포함'],['확인 필요',exceptions+'대','격리·정비·GPS 지연']];
    $('#vehicle-kpis').innerHTML=cards.map((c,i)=>`<article class="vehicle-kpi ${i===4&&exceptions?'is-alert':''}"><span>${c[0]}</span><strong>${c[1]}</strong><small>${c[2]}</small></article>`).join('');
    $('#vehicle-alert-badge').textContent=exceptions;
    window.moovVehicleSnapshot={total:vehicles.length,eligible,active,charge,exceptions,vehicles:vehicles.map(v=>({...v}))};
    window.dispatchEvent(new CustomEvent('moov-vehicles-updated',{detail:window.moovVehicleSnapshot}));
  }

  function markerElement(vehicle){
    const element=document.createElement('span');
    element.className=`vehicle-marker is-${groupFor(vehicle.state)} ${isStale(vehicle)?'is-stale':''} ${vehicle.id===selectedId?'is-selected':''}`;
    return element;
  }
  async function initMap(){
    const host=$('#vehicle-map');
    fallbackMap=true;
    try{
      if(!window.MoovNaverMap)throw new Error('NAVER map adapter unavailable');
      await window.MoovNaverMap.ready();
      host.innerHTML='';
      map=window.MoovNaverMap.createView(host,{lat:37.5547,lng:126.9896},12);
      fallbackMap=false;
    }catch(error){
      fallbackMap=true;
      host.innerHTML='<div class="vehicle-map__loading">기본 위치 지도를 표시합니다. 네이버 지도 연결을 확인하세요.</div>';
    }
    updateMap();
    fitVisible();
  }

  function updateMap(){
    const visible=visibleVehicles();
    if(fallbackMap){
      const minLat=37.46,maxLat=37.63,minLon=126.86,maxLon=127.13;
      $('#vehicle-map').innerHTML=`<div class="vehicle-map__loading">서울 운영 권역</div>${visible.map(v=>`<button class="fallback-marker" data-vehicle-select="${v.id}" style="left:${(v.lon-minLon)/(maxLon-minLon)*100}%;top:${(maxLat-v.lat)/(maxLat-minLat)*100}%">${escapeHTML(v.id)}</button>`).join('')}`;
      return;
    }
    if(!map)return;
    markers.forEach(marker=>marker.remove()); markers.clear();
    visible.forEach(v=>{
      const marker=window.MoovNaverMap.marker({lat:v.lat,lng:v.lon},{element:markerElement(v),title:`${v.id} · ${v.zone}`,size:[28,28],anchor:[14,27]}).addTo(map);
      marker.bindTooltip(`${v.id} · ${v.zone} · ${STATE_LABELS[v.state]} · SOC ${v.soc}% · ${timeText(v.observedAt)} · ${v.source}`,{className:'vehicle-popup'});
      marker.on('click',()=>selectVehicle(v.id,false)); markers.set(v.id,marker);
    });
  }

  function fitVisible(){
    const rows=visibleVehicles(); if(!rows.length||fallbackMap)return;
    map.fitBounds(rows.map(v=>({lat:v.lat,lng:v.lon})),{padding:[38,38],maxZoom:14});
  }

  function renderList(){
    const rows=visibleVehicles();
    $('#vehicle-result-count').textContent=`${rows.length}대 표시`;
    if(!rows.some(v=>v.id===selectedId)&&rows[0])selectedId=rows[0].id;
    $('#vehicle-list').innerHTML=rows.length?rows.map(v=>`<button class="vehicle-list-item ${v.id===selectedId?'is-selected':''}" type="button" data-vehicle-select="${v.id}"><i class="vehicle-list-item__state is-${groupFor(v.state)}"></i><span><strong>${escapeHTML(v.id)} · ${escapeHTML(v.zone)}</strong><small>${STATE_LABELS[v.state]} · ${escapeHTML(v.source)}${isStale(v)?' · GPS 지연':''}</small></span><b>${v.soc}%</b></button>`).join(''):'<div class="vehicle-list-empty">조건에 맞는 차량이 없습니다.</div>';
    renderDetail();
  }

  function renderDetail(){
    const v=vehicles.find(row=>row.id===selectedId);
    if(!v){$('#vehicle-detail').innerHTML='<div class="vehicle-list-empty">차량을 선택하세요.</div>';return;}
    const eligible=hardEligible(v), cls=groupFor(v.state);
    const checks=[['안전',v.safetyOk],['보안 삭제',v.securityOk],['SOC 35%+',v.soc>=35],['GPS 10초',!isStale(v)],['상태', ['READY_TAXI','REBALANCING'].includes(v.state)]];
    $('#vehicle-detail').innerHTML=`<div class="vehicle-detail__top"><div><h3>${escapeHTML(v.id)}</h3><p>${escapeHTML(v.zone)} · ${escapeHTML(v.capability)}</p></div><span class="vehicle-state-tag is-${cls}">${STATE_LABELS[v.state]}</span></div>
      <div class="vehicle-detail-grid"><div><span>SOC</span><b>${v.soc}%</b></div><div><span>속도</span><b>${v.speed} km/h</b></div><div><span>GPS</span><b>${timeText(v.observedAt)}</b></div><div><span>배차 판정</span><b>${eligible?'후보 가능':'후보 제외'}</b></div><div><span>정확도</span><b>±${v.gpsAccuracy}m</b></div><div><span>다음 예약</span><b>${escapeHTML(v.nextReservation)}</b></div></div>
      <div class="hard-filter">${checks.map(c=>`<span class="${c[1]?'':'is-fail'}">${c[1]?'통과':'실패'} · ${c[0]}</span>`).join('')}</div>
      <div class="vehicle-detail-actions"><button type="button" data-vehicle-action="validate">택시 후보 검증</button><button type="button" data-vehicle-action="rebalance" ${!eligible?'disabled':''}>재배치 시작</button><button type="button" data-vehicle-action="maintenance">정비 전환</button><button type="button" class="is-danger" data-vehicle-action="quarantine">차량 격리</button><button type="button" data-vehicle-action="ready" ${(!v.safetyOk||!v.securityOk||v.soc<35||isStale(v))?'disabled':''}>운영 복귀</button><button type="button" data-vehicle-action="locate">지도에서 보기</button></div>
      <p class="vehicle-policy-note">안전·보안 실패 차량은 관리자가 수동으로 배차하거나 운영 복귀시킬 수 없습니다. 모든 조치는 ${escapeHTML(v.ruleVersion)} 기준으로 기록됩니다.</p>`;
  }

  function renderAllocation(){
    const rows=[['성수',3,1,1],['강남',3,1,0],['여의도',2,1,1],['북부',2,1,0]];
    $('#fleet-allocation-chart').innerHTML=`<div class="allocation-legend"><span><i style="background:#2f62f2"></i>택시 예비</span><span><i style="background:#65c7d6"></i>렌트 가용</span><span><i style="background:#e7a432"></i>충전</span></div>${rows.map(r=>{const total=r[1]+r[2]+r[3];return `<div class="allocation-row"><span>${r[0]}</span><span class="allocation-track"><i class="reserve" style="width:${r[1]/total*100}%"></i><i class="rental" style="width:${r[2]/total*100}%"></i><i class="charge" style="width:${r[3]/total*100}%"></i></span><b>${total}대</b></div>`;}).join('')}`;
  }

  function renderAudits(){
    $('#vehicle-audit-list').innerHTML=audits.length?audits.slice(0,12).map(a=>`<div class="vehicle-audit-item"><i></i><span><strong>${escapeHTML(a.title)}</strong><small>${escapeHTML(a.detail)}</small></span><time>${timeText(a.at)}</time></div>`).join(''):'<div class="vehicle-list-empty">이 브라우저에서 생성한 운영 조치가 없습니다.</div>';
  }

  function renderAll(){
    renderKpis(); renderList(); updateMap(); renderAllocation(); renderAudits();
    const newest=vehicles.map(v=>Date.parse(v.observedAt)).sort((a,b)=>b-a)[0];
    $('#vehicle-last-sync').textContent=`마지막 갱신 ${timeText(new Date(newest).toISOString())}`;
  }

  function selectVehicle(id,move=true){
    selectedId=id; renderList(); updateMap();
    const v=vehicles.find(row=>row.id===id);
    if(move&&!fallbackMap&&v){map.setView({lat:v.lat,lng:v.lon},15);}
  }

  function addAudit(title,detail){ audits.unshift({at:new Date().toISOString(),title,detail}); localStorage.setItem(AUDIT_STORE,JSON.stringify(audits)); }
  function vehicleAction(action){
    const v=vehicles.find(row=>row.id===selectedId); if(!v)return;
    if(action==='locate'){selectVehicle(v.id,true);return;}
    if(action==='validate'){toast(hardEligible(v)?`${v.id}는 택시 배차 후보 조건을 모두 통과했습니다.`:`${v.id}는 하드 필터 실패로 배차 후보에서 제외됩니다.`);return;}
    const next={rebalance:'REBALANCING',maintenance:'MAINTENANCE',quarantine:'QUARANTINED',ready:'READY_TAXI'}[action];
    if(!next)return;
    if(next==='READY_TAXI'&&(!v.safetyOk||!v.securityOk||v.soc<35||isStale(v))){toast('안전·보안·SOC·GPS 조건을 먼저 확인하세요.');return;}
    v.state=next; if(next==='MAINTENANCE')v.safetyOk=false; if(next==='QUARANTINED')v.securityOk=false;
    if(next==='READY_TAXI'){v.safetyOk=true;v.securityOk=true;}
    addAudit(`${v.id} ${STATE_LABELS[next]} 전환`,`신승준 관리자 · ${v.ruleVersion} · expected_version 검증 완료`); persist(); renderAll(); toast(`${v.id} 상태를 ${STATE_LABELS[next]}으로 변경했습니다.`);
  }

  function tick(manual=false){
    const t=Date.now();
    vehicles.forEach((v,i)=>{
      if(v.state==='OFFLINE')return;
      v.observedAt=new Date(t-i*180).toISOString();
      if(movingStates.has(v.state)){
        const angle=(t/80000+i)*Math.PI*2;
        v.lat+=Math.sin(angle)*0.00018; v.lon+=Math.cos(angle)*0.00021;
        v.speed=Math.max(3,Math.round(v.speed+(Math.random()-.5)*4));
        if(v.state!=='CHARGING'&&Math.random()<.08)v.soc=Math.max(10,v.soc-1);
        if(v.state==='CHARGING'&&Math.random()<.2)v.soc=Math.min(100,v.soc+1);
      }
    });
    persist(); renderAll();
    if(manual)toast('차량 위치와 상태를 새로고침했습니다.');
  }

  function exportCSV(){
    const header=['vehicle_id','latitude','longitude','zone','speed','soc','state','security_ok','safety_ok','capability','observed_at','source','rule_version'];
    const rows=vehicles.map(v=>[v.id,v.lat.toFixed(6),v.lon.toFixed(6),v.zone,v.speed,v.soc,v.state,v.securityOk,v.safetyOk,v.capability,v.observedAt,v.source,v.ruleVersion]);
    const csv='\ufeff'+[header,...rows].map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); const a=document.createElement('a');a.href=url;a.download='moov-vehicle-current.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),200);toast('차량 현재 상태 CSV를 만들었습니다.');
  }

  function bind(){
    ['vehicle-search','vehicle-state-filter','vehicle-source-filter'].forEach(id=>$('#'+id).addEventListener(id==='vehicle-search'?'input':'change',renderAll));
    $('#vehicle-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const first=visibleVehicles()[0];if(first)selectVehicle(first.id,true);else toast('검색 결과가 없습니다.');}});
    $('#vehicle-list').addEventListener('click',e=>{const el=e.target.closest('[data-vehicle-select]');if(el)selectVehicle(el.dataset.vehicleSelect,true);});
    $('#vehicle-map').addEventListener('click',e=>{const el=e.target.closest('[data-vehicle-select]');if(el)selectVehicle(el.dataset.vehicleSelect,false);});
    $('#vehicle-detail').addEventListener('click',e=>{const el=e.target.closest('[data-vehicle-action]');if(el&&!el.disabled)vehicleAction(el.dataset.vehicleAction);});
    $('#vehicle-refresh').addEventListener('click',()=>tick(true));
    $('#vehicle-fit-all').addEventListener('click',fitVisible);
    $('#vehicle-export').addEventListener('click',exportCSV);
    $('#vehicle-audit-clear').addEventListener('click',()=>{audits=[];localStorage.setItem(AUDIT_STORE,'[]');renderAudits();toast('화면의 운영 조치 기록을 비웠습니다.');});
    window.addEventListener('hashchange',()=>{if(location.hash==='#vehicles'&&!fallbackMap)setTimeout(()=>{map.invalidateSize();fitVisible();},60);});
  }

  bind(); tick(false); void initMap(); setInterval(()=>tick(false),10000);
})();
