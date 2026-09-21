/* Restore a server-verified account snapshot only into previously missing stores. */
(function(root){
  'use strict';
  const appFields=['homeMode','theme','themeConfig','rentalHours','taxiVehicleType','rentalVehicleType','rentalOptions','aiPersona','aiVoiceEnabled','aiSaveEnabled','aiAutoStart','chatFontScale','productLikes'];
  const outingFields=['customCourses','savedCourseIds','likedCourseIds','outingSort','outingFilters','recommendationPrefs','tasteGroup','outingMapOpen'];
  const rentalFields=['rentalHours','rentalVehicleType','rentalOptions'];
  const pick=(value,fields)=>Object.fromEntries(fields.filter(key=>Object.hasOwn(value||{},key)).map(key=>[key,value[key]]));
  const keys=id=>({app:'moov-app-v3:'+encodeURIComponent(id),outing:'moov-outing-v1:'+encodeURIComponent(id),rental:'moov-home-policy-design-v2:'+encodeURIComponent(id),language:'moov-language'});
  function missing(storage,id){
    try{return Object.fromEntries(Object.entries(keys(id)).map(([name,key])=>[name,storage.getItem(key)===null]));}
    catch{return {};}
  }
  function restore(snapshot,storage,id,absent){
    if(!id||snapshot?.schemaVersion!==1)return {changed:false};
    const target=keys(id),writes=[];
    if(absent?.app&&snapshot.appSettings)writes.push([target.app,JSON.stringify({...pick(snapshot.appSettings,appFields),userId:id})]);
    if(absent?.outing&&snapshot.outing)writes.push([target.outing,JSON.stringify(pick(snapshot.outing,outingFields))]);
    if(absent?.rental&&snapshot.rentalSettings)writes.push([target.rental,JSON.stringify(pick(snapshot.rentalSettings,rentalFields))]);
    if(absent?.language&&['ko','en'].includes(snapshot.language))writes.push([target.language,snapshot.language]);
    const previous=writes.map(([key])=>[key,storage.getItem(key)]);
    try{for(const [key,value] of writes)storage.setItem(key,value);}
    catch(error){for(const [key,value] of previous){try{value===null?storage.removeItem(key):storage.setItem(key,value);}catch{}}throw error;}
    return {changed:writes.length>0,language:absent?.language?snapshot.language:null};
  }
  const api={missing,restore};root.MoovAccountSnapshot=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
