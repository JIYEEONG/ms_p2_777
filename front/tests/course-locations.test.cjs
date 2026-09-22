const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolveCourses} = require('../public/course-locations.js');
const matchPlace = (name, places) => {
  const exact = places.filter(p => p.name === name);
  return exact.length === 1 ? exact[0] : null;
};
test('Name-only courses resolve in itinerary order, preserving registered coordinates and inputs', async () => {
  const courses = [{id:'palace',name:'궁궐 코스',points:[{name:'등록장소',lat:37.5,lng:127},{name:'시험장소 A'},{name:'시험장소 B'}]}];
  const before = structuredClone(courses);
  const maps = {matchPlace,searchPlaces:async query => query === '시험장소 A' ? [{name:query,lat:37.51,lng:127.01}] : query === '시험장소 B' ? [{name:query,lat:37.52,lng:127.02}] : []};
  const [resolved] = await resolveCourses(courses,maps);
  assert.deepEqual(resolved.points.map(p=>p.lat),[37.5,37.51,37.52]);
  assert.deepEqual(courses,before);
});
test('A palace course searches the palace-qualified name before a same-name business', async () => {
  const calls=[];
  const maps={matchPlace,searchPlaces:async query=>{
    calls.push(query);
    return [{name:'경복궁 경회루',lat:37.5797,lng:126.976},{name:'경회루',lat:37.6198,lng:127.0746}];
  }};
  const [course]=await resolveCourses([{name:'경복궁 투어',points:[{name:'경회루'}]}],maps);
  assert.deepEqual(calls,['경복궁 경회루']);
  assert.equal(course.points[0].lat,37.5797);
});
test('Ambiguous or failed searches remain unknown and can be retried', async () => {
  let attempt=0;
  const maps={matchPlace,searchPlaces:async name=>{
    attempt++;
    if(attempt===1)throw Error('temporary failure');
    return attempt===2?[{name,lat:37,lng:127},{name,lat:38,lng:127}]:[{name,lat:37,lng:127}];
  }};
  const input=[{name:'',points:[{name:'중복 시험장소'}]}];
  assert.equal((await resolveCourses(input,maps))[0].points[0].lat,undefined);
  assert.equal((await resolveCourses(input,maps))[0].points[0].lat,undefined);
  assert.equal((await resolveCourses(input,maps))[0].points[0].lat,37);
});
test('Disposed maps do not launch subsequent place searches',async()=>{
  const result=await resolveCourses([{name:'닫힘',points:[{name:'미조회 장소'}]}],{searchPlaces:()=>assert.fail('must not search')},()=>false);
  assert.equal(result[0].points[0].lat,undefined);
});
