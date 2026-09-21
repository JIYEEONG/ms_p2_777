const {test}=require('node:test');
const assert=require('node:assert/strict');
const {missing,restore}=require('../public/account-snapshot.js');
const makeStorage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const snapshot={schemaVersion:1,language:'en',appSettings:{theme:'웰니스',chatFontScale:1.2,paymentCards:[{number:'must-not-import'}],tripActive:true},outing:{customCourses:[{id:'mine-one',name:'Saved course'}],savedCourseIds:['mine-one'],outingActionIds:{saves:{old:'no'}}},rentalSettings:{rentalHours:6,rentalVehicleType:'family',tripActive:true}};
test('new account restores settings, custom and saved courses without auth, payment or active-trip state',()=>{
  const storage=makeStorage(),id='google:one';
  const result=restore(snapshot,storage,id,missing(storage,id));
  assert.equal(result.changed,true);
  assert.deepEqual(JSON.parse(storage.getItem('moov-app-v3:google%3Aone')),{userId:id,theme:'웰니스',chatFontScale:1.2});
  assert.deepEqual(JSON.parse(storage.getItem('moov-outing-v1:google%3Aone')).savedCourseIds,['mine-one']);
  assert.deepEqual(JSON.parse(storage.getItem('moov-home-policy-design-v2:google%3Aone')),{rentalHours:6,rentalVehicleType:'family'});
  assert.equal(storage.getItem('moov-language'),'en');
});
test('existing stores including deliberately empty lists and another account stay unchanged',()=>{
  const storage=makeStorage(),id='google:one';
  storage.setItem('moov-outing-v1:google%3Aone','{"customCourses":[],"savedCourseIds":[]}');
  storage.setItem('moov-app-v3:google%3Atwo','{"theme":"other-account"}');
  storage.setItem('moov-language','ko');
  restore(snapshot,storage,id,missing(storage,id));
  assert.equal(storage.getItem('moov-outing-v1:google%3Aone'),'{"customCourses":[],"savedCourseIds":[]}');
  assert.equal(storage.getItem('moov-app-v3:google%3Atwo'),'{"theme":"other-account"}');
  assert.equal(storage.getItem('moov-language'),'ko');
  assert.equal(restore(snapshot,storage,id,missing(storage,id)).changed,false);
});
test('failed storage write rolls back the other snapshot stores',()=>{
  const storage=makeStorage(),set=storage.setItem;
  storage.setItem=(key,value)=>{if(key.startsWith('moov-outing'))throw Error('quota');set(key,value);};
  assert.throws(()=>restore(snapshot,storage,'google:one',missing(storage,'google:one')),/quota/);
  assert.equal(storage.getItem('moov-app-v3:google%3Aone'),null);
});
