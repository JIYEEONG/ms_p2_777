/* Home-scoped cleanup lifecycle. UI is a demo; no vehicle/OTT/server credentials are accessed. */
const CLEANUP_DURATION_MS=4400;
function cleanupRunning(){return state.securityCleanup?.status==='running';}
function cleanupStage(){
  const elapsed=Math.max(0,Date.now()-(state.securityCleanup?.startedAt||Date.now()));
  if(elapsed<1100)return {percent:18,index:0,message:'신규 인증과 외부 연결을 차단하고 있습니다.'};
  if(elapsed<2800)return {percent:56,index:1,message:'개인 데이터와 연결 정보를 삭제하고 있습니다.'};
  return {percent:84,index:2,message:'잔존 데이터와 차량 상태를 검증합니다.'};
}
function renderCleanupBanner(){
  if(cleanupRunning())return `<button class="cleanup-banner" data-action="open-cleanup"><span>${icon('shield')} 차량 기록 정리 중</span><strong>진행 상태 보기 ${icon('chevron')}</strong></button>`;
  if(state.securityProof&&!state.tripActive)return `<button class="cleanup-banner complete" data-action="open-cleanup"><span>${icon('shield')} 최근 개인 기록 정리 완료</span><strong>결과 보기 ${icon('chevron')}</strong></button>`;
  return '';
}
function openEndConfirmation(expired=false){
  if(cleanupRunning())return openCleanupStatus();
  if(!state.tripActive)return;
  openModal({title:expired?'렌트 시간이 종료됐어요':'렌트 이용을 종료할까요?',iconName:'shield',
    body:`<p>안전한 장소에 정차한 뒤 개인 기록 정리를 시작합니다. 정리가 끝나기 전에는 다음 이용자에게 차량이 배정되지 않습니다.</p><div class="security-scope"><div><strong>차량에서 삭제</strong><span>로그인 토큰, 블루투스·USB·미러링 연결, OTT 세션, 음성 버퍼, 검색·경로 캐시, 임시 공간 설정</span></div><div><strong>계정·서버에 보존</strong><span>결제 영수증, 법정 사고 증적, 동의한 관심 목록과 이용 기록</span></div></div><details class="security-exceptions"><summary>예외 상황과 처리 기준</summary><ul><li>주행 중이면 안전 정차 후 정리를 시작합니다.</li><li>통신이 끊겨도 차량 로컬 정리를 계속하고 복구 후 결과를 확정합니다.</li><li>전원이 중단되면 재부팅 후 미완료 단계부터 재개합니다.</li><li>잔존 데이터나 삭제 증명 불일치가 있으면 안전 모드로 격리하여 재배차를 보류합니다.</li></ul></details><p class="cleanup-demo-label">정리 과정 체험 · 실제 차량과 연결되지 않았어요.</p>`,
    primary:'종료 및 정리 시작',secondary:expired?null:'계속 이용',onConfirm:()=>{runSecureCleanup(expired?'time-expired':'user');return false;}});
}
function runSecureCleanup(reason='user'){
  if(cleanupRunning())return openCleanupStatus();
  if(!state.tripActive)return;
  const now=Date.now();
  state.securityCleanup={status:'running',startedAt:now,stage:0,reason,summary:{vehicleId:state.rentalVehicleType,hours:state.rentalHours,estimatedFare:rentalTotalFare(),endedAt:now,reason,simulated:true}};
  state.securityProof=null;
  rentalRequestToken++;rentalSearchToken++;state.rentalUX.draftPickup=null;state.rentalUX.routeEdit=null;
  persist();render();emitHome('cleanup-start',{startedAt:now,simulated:true});openCleanupStatus();
}
function cleanupProgressBody(stage){
  return `<div class="security-progress"><div class="security-progress-head"><strong data-cleanup-percent>${stage.percent}%</strong><span>${escapeHtml(stage.message)}</span></div><div class="security-progress-bar" role="progressbar" aria-label="개인 기록 정리 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${stage.percent}"><i style="width:${stage.percent}%"></i></div><div class="security-steps">${['접근 차단','기록 삭제','잔존 검증'].map((label,i)=>`<span class="${i<stage.index?'done':i===stage.index?'active':''}">${icon(i<stage.index?'shield':'clock')}<strong>${label}</strong></span>`).join('')}</div><p>앱을 닫아도 차량 내부 정리는 계속되는 정책입니다. 서버 연결이 지연되면 차량은 배차되지 않고 안전 모드로 유지됩니다.</p><p class="cleanup-demo-label">현재는 체험 진행입니다. 창을 닫거나 다시 열어도 정리 상태를 복구합니다.</p></div>`;
}
function openCleanupStatus(){
  if(state.securityCleanup?.status==='complete'||!cleanupRunning()&&state.securityProof)return openCleanupComplete();
  if(!cleanupRunning())return;
  const stage=cleanupStage();
  openModal({title:'차량 기록을 정리하고 있어요',iconName:'shield',body:cleanupProgressBody(stage),primary:'개인정보 정리 중',secondary:null});
  modal.dataset.kind='cleanup-progress';
  const confirm=modal.querySelector('[data-modal-confirm]');if(confirm)confirm.disabled=true;
}
function onSecurityModalClose(){
  if(modal.dataset.kind==='cleanup-complete'&&state.securityCleanup){state.securityCleanup.acknowledged=true;persist();}
  modal.dataset.kind='';
}
function tickSecureCleanup(){
  const task=state.securityCleanup;
  if(!task||task.status!=='running')return;
  if(Date.now()-task.startedAt>=CLEANUP_DURATION_MS)return completeSecureCleanup();
  const stage=cleanupStage();
  if(task.stage!==stage.index){
    task.stage=stage.index;persist();
    if(modal.classList.contains('open')&&modal.dataset.kind==='cleanup-progress')document.querySelector('#modal-body').innerHTML=cleanupProgressBody(stage);
  }
}
function completeSecureCleanup(){
  const task=state.securityCleanup;if(task?.status!=='running')return;
  const completedAt=new Date(),reference='ZT-'+String(task.startedAt).slice(-8);
  const proof={reference,completedAt:completedAt.toISOString(),wipedTargets:7,retainedTargets:3,residual:0,simulated:true};
  // Clear only this standalone module's ephemeral pickup / route / option data.
  state.tripActive=false;state.usageStartedAt=null;state.rentalEndsAt=null;state.homeStep='mode';state.rentalFlowStep='setup';state.locationReady=false;
  state.pickupLocation='현재 위치 · 서울 성수동';state.rentalPickupCoords={lat:37.5446,lng:127.0557};state.rentalRecentPickups=[];
  state.routeStops=[state.pickupLocation,'서울숲 카페거리'];state.selectedCourse=null;state.rentalStopPopup=null;state.rentalCourseModified=false;
  state.rentalOptions.clear();state.rentalVehicleType='standard';state.rentalHours=3;
  state.rentalUX={dispatch:{status:'idle'},route:null,recent:[],draftPickup:null,routeEdit:null};
  state.securityProof=proof;state.securityCleanup={status:'complete',startedAt:task.startedAt,acknowledged:false};
  persist();render();content.scrollTop=0;
  emitHome('cleanup-complete',proof);emitHome('trip-ended',{...task.summary,cleanupProof:proof});
  openCleanupComplete();
}
function openCleanupComplete(){
  const proof=state.securityProof;if(!proof)return;
  const when=new Date(proof.completedAt).toLocaleString('ko-KR');
  openModal({title:'개인 기록 정리가 완료됐어요',iconName:'shield',
    body:`<div class="security-complete"><span class="security-check">${icon('shield')}</span><strong>삭제 검증 PASS · 잔존 0건</strong><p>차량의 인증·연결·콘텐츠 흔적을 삭제하고 다음 이용자의 접근을 차단하는 정리 과정을 완료했습니다.</p><div class="receipt-info"><span>완료 시각</span><strong>${escapeHtml(when)}</strong><span>확인 번호</span><strong>${escapeHtml(proof.reference)}</strong><span>삭제 대상</span><strong>7개 범주</strong><span>서버 보존</span><strong>결제·법정 증적·동의 기록</strong></div><div class="policy-note">감사 기록에는 결과와 가명 세션만 남으며 원문 대화, 검색어, 토큰 값은 저장하지 않는 정책입니다.</div><p class="cleanup-demo-label">체험 결과 · 실제 차량·계정의 삭제 검증 증명이 아닙니다.</p></div>`,primary:'완료 확인',secondary:null});
  modal.dataset.kind='cleanup-complete';
}
function restoreCleanup(){
  if(cleanupRunning()){
    if(!Number.isFinite(state.securityCleanup.startedAt)){state.securityCleanup=null;persist();return;}
    tickSecureCleanup();if(cleanupRunning())openCleanupStatus();
  }else if(state.securityCleanup?.status==='complete'&&!state.securityCleanup.acknowledged)openCleanupComplete();
}
