const {test}=require('node:test');
const assert=require('node:assert/strict');
const survey=require('../public/survey-profile.js');
const course=(id,tags,name=id)=>({id,name,stops:[],tags});
const tags=c=>c.tags;
const profile={categories:{'카페':1},subcategories:{'카페':['커피']},preferredRegions:['성수'],excludedRegions:['강남'],excludedTags:['고수']};
test('excluded regions and foods beat matching categories and popularity',()=>{
  const list=[course('bad-region',{category:['카페'],region:'강남'}),course('bad-food',{category:['카페']},'고수 요리'),course('good',{category:['전시']})];
  assert.deepEqual(survey.rank(list,profile,tags,()=>999).map(x=>x.course.id),['good']);
});
test('rank uses activity then details then preferred area; other activities stay eligible',()=>{
  const list=[course('other',{category:['쇼핑']}),course('area',{category:['카페'],region:['성수']}),course('detail',{category:['카페'],subcategory:['커피']}),course('both',{category:['카페'],subcategory:['커피'],region:['성수']})];
  assert.deepEqual(survey.rank(list,profile,tags).map(x=>x.course.id),['both','detail','area','other']);
});
test('empty answers remain neutral with stable popularity fallback',()=>{
  const list=[course('a',{category:['전시']}),course('b',{category:['카페']})];
  const result=survey.rank(list,{},tags,c=>c.id==='b'?5:0);
  assert.equal(result[0].course.id,'b');assert.equal(result[0].match.percent,null);
});
test('subcategory matching requires the parent category and single-character exclusions are not substring matches',()=>{
  assert.equal(survey.match(course('x',{}),profile,{category:['음식점'],subcategory:['커피']}).subcategory,0);
  assert.equal(survey.allowed(course('x',{},'밀레니엄 공원'),{excludedTags:['밀']},{}),true);
  assert.equal(survey.allowed(course('x',{}),{excludedTags:['밀']},{ingredients:['밀']}),false);
});
test('structured detail tags are bound to their activity, not shared across categories',()=>{
  const taste={categories:{'음식점':1,'체험':1},subcategories:{'음식점':['기타']}};
  assert.equal(survey.match({},taste,{category:['음식점','체험'],subcategories:{'체험':['기타']}}).subcategory,0);
  assert.equal(survey.match({},taste,{category:['음식점'],subcategories:{'음식점':['기타']}}).subcategory,1);
});
