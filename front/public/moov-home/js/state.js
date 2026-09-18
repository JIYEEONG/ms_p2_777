/* Isolated storage. The host application's authentication / other tabs are untouched. */
const STORAGE_KEY='moov-home-policy-design-v1';
const config=Object.assign({embedded:new URLSearchParams(location.search).get('embed')==='1',parentOrigin:location.origin},window.MOOV_HOME_CONFIG||{});
document.body.classList.toggle('embedded',config.embedded);
function readSaved(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return s&&typeof s==='object'&&!Array.isArray(s)?s:{};}catch{return {};}}
const saved=readSaved();
const state={
  activeTab:'home',homeMode:'rent',homeStep:saved.homeStep==='mode'?'mode':'booking',
  tripActive:saved.tripActive===true,usageStartedAt:Number(saved.usageStartedAt)||null,rentalEndsAt:Number(saved.rentalEndsAt)||null,
  rentalHours:Math.max(3,Math.min(24,Number(saved.rentalHours)||3)),
  rentalVehicleType:rentalVehicles.some(v=>v.id===saved.rentalVehicleType)?saved.rentalVehicleType:'standard',
  rentalOptions:new Set(Array.isArray(saved.rentalOptions)?saved.rentalOptions.filter(id=>rentalOptionCatalog.some(x=>x.id===id)):[]),
  pickupLocation:typeof saved.pickupLocation==='string'?saved.pickupLocation:'현재 위치 · 서울 성수동',
  rentalPickupCoords:Number.isFinite(saved.rentalPickupCoords?.lat)&&Number.isFinite(saved.rentalPickupCoords?.lng)?saved.rentalPickupCoords:{lat:37.5446,lng:127.0557},
  rentalRecentPickups:Array.isArray(saved.rentalRecentPickups)?saved.rentalRecentPickups:[],
  locationReady:!!saved.locationReady,selectedCourse:null,rentalStopPopup:null,
  securityCleanup:saved.securityCleanup&&typeof saved.securityCleanup==='object'?saved.securityCleanup:null,
  securityProof:saved.securityProof&&typeof saved.securityProof==='object'?saved.securityProof:null,
  rentalFlowStep:['setup','pickup','matching','assigned','approaching','arrived','boarded','driving','error'].includes(saved.rentalFlowStep)?saved.rentalFlowStep:'setup',
  routeStops:Array.isArray(saved.routeStops)&&saved.routeStops.every(x=>typeof x==='string')?saved.routeStops:['현재 위치 · 서울 성수동','서울숲 카페거리']
};
if(state.tripActive&&!state.rentalEndsAt){state.tripActive=false;state.rentalFlowStep='setup';}
if(state.tripActive){state.homeStep='service';if(!['driving','boarded'].includes(state.rentalFlowStep))state.rentalFlowStep='driving';}
const content=document.querySelector('#app-content'),modal=document.querySelector('#modal');
let rentalFlowTimer=null,rentalLeafletMap=null,toastTimer=null;
function publicState(){return JSON.parse(JSON.stringify({...state,rentalOptions:[...state.rentalOptions],rentalUX:{...state.rentalUX,draftPickup:null,routeEdit:null}}));}
function emitHome(type,detail){
  const message={source:'moov-home',version:1,type,detail};
  window.dispatchEvent(new CustomEvent('moov-home:'+type,{detail}));
  if(window.parent!==window&&config.parentOrigin&&config.parentOrigin!=='null')window.parent.postMessage(message,config.parentOrigin);
}
function persist(){const snapshot=publicState();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot));}catch{}emitHome('state',snapshot);}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000);}
