const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const outing = require('../public/outing-data.js');
const media = require('../public/course-media.js');
const catalog = require('../public/vehicle-catalog.js');
const taxi = require('../public/taxi-fare.js');

test('taxi and rental share four cars, capacity and the consolidated fares', () => {
  assert.deepEqual(catalog.vehicles.map(v => v.id), ['standard', 'easyfit', 'family', 'premium']);
  assert.deepEqual(taxi.vehicles, catalog.vehicles);
  for (const id of ['easyfit', 'family']) {
    assert.equal(catalog.vehicles.find(v => v.id === id).seats, '최대 4인');
    assert.equal(catalog.rentalFare(id, 3), 12900);
    assert.equal(catalog.rentalFare(id, 4), 15600);
    assert.equal(catalog.rentalFare(id, 24), 69600);
    assert.equal(taxi.calculate({ vehicleId: id, distanceMeters: 5500 }).total, 7395);
  }
  assert.equal(catalog.vehicles.find(v => v.id === 'family').name, 'MOOV 중형');
  assert.match(catalog.vehicles.find(v => v.id === 'easyfit').desc, /휠체어/);
  assert.equal(catalog.normalizeId('barrierfree'), 'easyfit');
  assert.equal(catalog.rentalFare('barrierfree', 3), 12900);
  const context = vm.createContext({MoovVehicleCatalog: catalog});
  vm.runInContext(fs.readFileSync('front/public/moov-home/js/data.js', 'utf8'), context);
  assert.equal(vm.runInContext('rentalVehicles.length', context), 4);
  assert.equal(vm.runInContext('rentalVehicles.find(v=>v.id==="family").name', context), 'MOOV 중형');
});

test('database distances use kilometres and missing values stay unknown', () => {
  const course = outing.fromDatabase({id: 'palace', title: '경복궁', distance_m: '1800', duration_seconds: 3900,
    points: [{sequence_no: 2, place_name: '경복궁'}, {sequence_no: 1, place_name: '광화문'}]});
  assert.equal(course.distance, 1.8);
  assert.equal(course.time, '약 65분');
  assert.deepEqual(course.stops, ['광화문', '경복궁']);
  for (const value of [null, undefined, '', ' ', 'unknown', -1, Infinity]) assert.equal(outing.distanceKm({distance_m: value}), null);
  assert.equal(outing.distanceKm({distance_m: 0}), 0);
  assert.equal(outing.distanceKm({distance: 2.5}), 2.5);
});

test('duplicate IDs and itineraries are removed while different and reversed routes survive', () => {
  const courses = [
    {id:'a', name:'궁궐 산책', stops:['광화문', '경복궁']},
    {id:'b', name:'다시 등록한 코스', stops:[' 광화문 ', '경 복 궁']},
    {id:'a', name:'duplicate id', stops:['서울숲', '어니언 성수']},
    {id:'c', name:'궁궐 산책', stops:['경복궁', '광화문']},
    {id:'d', name:'궁궐 산책', stops:['광화문', '숭례문']},
    {id:'e', name:'카페 코스', stops:['지점 1', '지점 2']},
    {id:'f', name:'카페 코스', stops:['지점 1', '지점 2']},
  ];
  assert.deepEqual(outing.uniqueCourses(courses).map(c => c.id), ['a','c','d','e','f']);
  const route = id => ({id, stops:['지점 1','지점 2'], _dbPoints:[{latitude:37.57,longitude:126.97},{latitude:37.58,longitude:126.98}]});
  assert.deepEqual(outing.uniqueCourses([route('a'),route('b')]).map(c => c.id), ['a']);
  assert.deepEqual(outing.uniqueCourses([
    {id:'local',name:'궁궐 나들이',stops:['경복궁']},
    {id:'server',name:'궁궐 나들이',stops:['경복궁']},
    {id:'different',name:'야간 관람',stops:['경복궁']},
  ]).map(c=>c.id), ['local','different']);
});

test('a failed uploaded palace photo falls back to a bundled photo and unrelated cafes do not reuse it', () => {
  const course = {name:'경복궁 산책', image:'https://example.invalid/expired-photo.jpg', stops:['광화문','경복궁']};
  assert.equal(media.candidates(course)[0], course.image);
  media.markFailed(course.image);
  assert.equal(media.candidates(course)[0], './assets/place-gyeongbokgung.jpg');
  const missing = {name:'처음 가는 카페',stops:['우리 동네 카페']};
  assert.ok(media.candidates(missing).length > 0);
  assert.equal(media.isRepresentative(missing, media.candidates(missing)[0]), true);
  assert.equal(media.placeImage('서울숲'), './assets/course-seoulforest.jpg');
  const shared = media.distinguishCovers([{name:'새 카페 A',image:'/same.jpg',stops:['가게 A']},{name:'새 카페 B',image:'/same.jpg',stops:['가게 B']}]);
  shared.forEach(course => assert.ok(media.candidates(course).length > 0));
  assert.notEqual(media.candidates(shared[0])[0], media.candidates(shared[1])[0]);
  for (const name of ['경복궁','광화문','숭례문','서울숲']) assert.ok(fs.existsSync('front/public/' + media.placeImage(name).replace('./','')));
});

test('null-photo courses rotate relevant local photographs evenly and keep uploaded photos first', () => {
  const courses = Array.from({length:20},(_,i)=>outing.fromDatabase({id:'cover-'+i,title:'감성 전시 코스',image_url:null,tags:{category:['전시','카페']},points:[{sequence_no:0,place_name:'전시장 '+i}]}));
  const covers = media.distinguishCovers(courses).map(course => media.candidates(course)[0]);
  const galleryCount = media.photos.filter(photo => photo.topic === 'gallery').length;
  assert.equal(new Set(covers).size,Math.min(20,galleryCount));
  for (const src of covers) {
    assert.ok(fs.existsSync('front/public/'+src.replace('./','')));
    assert.equal(media.photos.find(photo=>photo.src===src).topic,'gallery');
    assert.ok(covers.filter(photo=>photo===src).length<=Math.ceil(20/galleryCount));
  }
  assert.deepEqual(covers,media.distinguishCovers(courses).map(course=>media.candidates(course)[0]));
  const known = {name:'경복궁 투어',stops:['경복궁']};
  assert.equal(media.candidates(known)[0],'./assets/place-gyeongbokgung.jpg');
  assert.equal(media.isRepresentative(known,media.candidates(known)[0]),false);
  const upload = {...known,image:'https://example.test/my-photo.jpg'};
  assert.equal(media.candidates(upload)[0],upload.image);
});

test('generic stale titles become stop names; duplicate custom titles gain their routes', () => {
  const course = outing.fromDatabase({id:'food-route',title:'감성 전시 코스',tags:{category:['음식점']},points:[{sequence_no:0,place_name:'구씨네부엌'},{sequence_no:1,place_name:'신도림이도식당'}]});
  assert.equal(course.name,'구씨네부엌 → 신도림이도식당');
  assert.deepEqual(media.topicsFor(course),['korean-food']);
  assert.equal(outing.matches(course,'음식점',{},course._dbTags),true);
  assert.equal(outing.matches(course,'전시',{},course._dbTags),false);
  const named=outing.distinguishNames([{id:'a',name:'주말 코스',stops:['서울숲','콘피']},{id:'b',name:'주말 코스',stops:['광화문','경복궁']}]);
  assert.notEqual(named[0].name,named[1].name);
  assert.match(named[0].name,/서울숲 → 콘피/);
  const uploaded=outing.fromDatabase({id:'mine',title:'내가 만든 특별한 코스',points:[{sequence_no:0,place_name:'서울숲'}]});
  assert.equal(uploaded.name,'내가 만든 특별한 코스');
});

test('cover ownership stays stable after sorting and excludes reused fallback photos', () => {
  const courses=[
    {id:'first',name:'한강 산책',image:'https://test.blob.core.windows.net/course-images/course-hangang-sunset.jpg',stops:['반포 한강공원','콘피']},
    {id:'second',name:'한강과 식사',stops:['반포 한강공원','구씨네부엌']},
    {id:'third',name:'한강과 전시',stops:['반포 한강공원','문화역서울284']},
  ];
  const original=media.distinguishCovers(courses), reversed=media.distinguishCovers([...courses].reverse());
  for(const course of original) assert.equal(media.candidates(course)[0],media.candidates(reversed.find(c=>c.id===course.id))[0]);
  assert.equal(new Set(original.map(c=>media.photoKey(media.candidates(c)[0]))).size,3);
  media.markFailed(courses[0].image);
  assert.equal(new Set(original.map(c=>media.photoKey(media.candidates(c)[0]))).size,3);
  assert.ok(!media.candidates(original[1])[0].startsWith('data:image/svg'));
});

test('a shared generic upload cannot attach a palace photo to a forest or cafe', () => {
  const courses=media.distinguishCovers([
    {id:'forest',name:'서울숲 산책',image:'/assets/place-gyeongbokgung.jpg',stops:['서울숲','가족마당']},
    {id:'cafe',name:'우리 동네 카페',image:'/assets/place-gyeongbokgung.jpg',stops:['콘피','베르시']},
  ]);
  const forest=media.candidates(courses[0])[0];
  assert.ok(forest==='./assets/course-seoulforest.jpg'||media.photos.find(photo=>photo.src===forest)?.places.includes('서울숲'));
  assert.ok(media.isRepresentative(courses[1],media.candidates(courses[1])[0]));
  for(const course of courses) assert.ok(!media.candidates(course).some(src=>src.endsWith('place-gyeongbokgung.jpg')));
});

test('at least 50 distinct local raster photos have source metadata and match places or activities', () => {
  const crypto=require('node:crypto');
  assert.ok(media.photos.length>=50);
  assert.equal(new Set(media.photos.map(photo=>photo.sha256)).size,media.photos.length);
  for(const photo of media.photos){
    const bytes=fs.readFileSync('front/public/'+photo.src.replace('./',''));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),photo.sha256);
    assert.ok(bytes[0]===255&&bytes[1]===216 || bytes[0]===137&&bytes[1]===80);
    assert.match(photo.source,/^https:\/\/commons\.wikimedia\.org\/wiki\//);
    assert.ok(photo.author&&photo.license&&photo.licenseUrl);
  }
  const museum={name:'문화역서울284 산책',stops:['문화역서울284']};
  assert.ok(media.candidates(museum).some(src=>media.photos.find(photo=>photo.src===src)?.topic==='seoul284'));
  const restaurant={name:'노란돼지',stops:['노란돼지']};
  assert.ok(media.representatives(restaurant).every(src=>media.photos.find(photo=>photo.src===src).topic==='grill'));
  assert.ok(media.candidates({name:'<script>alert(1)</script>',stops:['알 수 없는 장소']}).every(src=>src.startsWith('./assets/')));
  assert.equal(media.placeImage('N서울타워'),null,'A tower must not use a pork cutlet photo');
});

function assertPhotoWindow(courses, api = media) {
  const covers = courses.map(course => api.photoKey(api.candidates(course)[0]));
  for (let start = 0; start < covers.length; start++) {
    const window = covers.slice(start, start + 50);
    assert.equal(new Set(window).size, window.length, `Repeated cover in window starting at ${start}`);
  }
}

test('50-photo windows stay unique across boundaries without moving or losing courses', () => {
  const fixturePhotos = Array.from({length:50}, (_, i) => ({src:`./test-gallery-${i}.jpg`,topic:'gallery',places:[],sha256:String(i)}));
  const context = vm.createContext({module:{exports:{}},require:()=>fixturePhotos});
  vm.runInContext(fs.readFileSync('front/public/course-media.js','utf8'), context);
  const api = context.module.exports;
  const courses = Array.from({length:125}, (_, i) => ({id:'window-'+i,name:'전시장 '+i,stops:['전시장 '+i]}));
  for (const ordered of [courses, [...courses].reverse()]) {
    const result = api.sequenceCovers(ordered);
    assert.deepEqual(Array.from(result, course => course.id), ordered.map(course=>course.id));
    assertPhotoWindow(result, api);
    assert.deepEqual(Array.from(api.sequenceCovers(ordered),course=>api.candidates(course)[0]),Array.from(result,course=>api.candidates(course)[0]));
    for (const course of ordered) assert.equal(api.candidates(course)[0],api.candidates(result.find(item=>item.id===course.id))[0],'Details reuse the currently displayed cover');
  }
});

test('failed photos are replaced without reintroducing nearby duplicates', () => {
  const stops=['전시관','카페','쇼핑몰','식당','스테이크','삼겹살','제과점','마카롱','수산','타코','AI 기술','도자공방','서울타워'];
  const courses=Array.from({length:115},(_,i)=>({id:'repaired-'+i,name:'여러 장소 '+i,stops}));
  const before=media.sequenceCovers(courses);
  assertPhotoWindow(before);
  const failed=media.candidates(before[0])[0];
  media.markFailed(failed);
  const repaired=media.repairSequence();
  assertPhotoWindow(repaired);
  assert.ok(repaired.every(course=>media.candidates(course)[0]!==failed));
  assert.equal(media.photoKey(media.photos[0].src+'?cache=2'),media.photoKey(media.photos[0].src));
});

test('a known destination keeps a real place photo ahead of a general city reference', () => {
  const forest={id:'actual-forest',name:'서울숲 피크닉 산책',stops:['서울숲','가족마당'],_displayCover:media.photos.find(photo=>photo.topic==='city-view').src};
  const [course]=media.sequenceCovers([forest]);
  const src=media.candidates(course)[0];
  assert.equal(media.isRepresentative(course,src),false);
  assert.ok(src==='./assets/course-seoulforest.jpg'||media.photos.find(photo=>photo.src===src)?.places.includes('서울숲'));
});

test('equally relevant recommendations spread stops without hiding courses or changing score order', () => {
  const items=[
    {course:{id:'a',stops:['공원','카페 A']},score:1},
    {course:{id:'b',stops:['공원','카페 B']},score:1},
    {course:{id:'c',stops:['전시관','식당']},score:1},
    {course:{id:'d',stops:['공방','서점']},score:.5},
  ];
  const result=outing.diversifyTies(items,item=>item.score,item=>item.course);
  assert.deepEqual(result.map(item=>item.course.id),['a','c','b','d']);
  assert.equal(result.length,items.length);
});
