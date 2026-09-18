const test = require('node:test');
const assert = require('node:assert/strict');
const outing = require('../public/outing-data.js');

const courses = [
  { id: 'cafe', name: '카페 산책', desc: '', stops: ['어니언 성수'], createdAt: '2026-09-01', distance: 2 },
  { id: 'museum', name: '전시 산책', desc: '', stops: ['디뮤지엄'], createdAt: '2026-09-02', distance: 3 },
  { id: 'unknown', name: '새 장소', desc: '', stops: ['미확인 장소'], createdAt: '2026-09-03', distance: null },
];
const tags = {
  cafe: { category: ['카페'], mood: ['감성'], companion: ['혼자'], time: ['오후'], price: 32000 },
  museum: { category: ['전시'], mood: ['조용함'], companion: ['친구'], time: ['오후'], price: 70000 },
  unknown: { category: [], mood: [], companion: [], time: [], price: null },
};
const tagsFor = (course) => tags[course.id];

test('category and budget change the candidate set without relaxing conditions', () => {
  const filters = { category: '전시', mood: '전체', companion: '전체', purpose: '전체', time: '전체', budget: 30000 };
  assert.deepEqual(courses.filter((course) => outing.matches(course, '', filters, tagsFor(course))), []);
  filters.budget = 100000;
  assert.deepEqual(courses.filter((course) => outing.matches(course, '', filters, tagsFor(course))).map((course) => course.id), ['museum']);
});

test('rule ranking is deterministic and does not use example likes', () => {
  const preference = { category: '카페', mood: '감성', companion: '혼자', budget: 100000 };
  assert.deepEqual(outing.rank(courses, preference, tagsFor).map((item) => item.course.id), ['cafe', 'unknown', 'museum']);
  assert.equal(outing.score(courses[0], preference, tags.cafe), 130);
  assert.deepEqual(outing.sort(courses, 'popular', preference, tagsFor, () => 0).map((course) => course.id), ['unknown', 'museum', 'cafe']);
});

test('unknown places never receive fabricated coordinates', () => {
  assert.equal(outing.pointForStop(courses[0], 0).id, 'demo-onion');
  assert.equal(outing.pointForStop(courses[2], 0).lat, null);
  assert.equal(outing.pointForStop(courses[2], 0).source, 'unverified');
});

test('taste match uses selected preferences and saved course tags instead of fixed percentages', () => {
  const preference = { category: '카페', mood: '전체', companion: '전체', time: '전체' };
  const before = outing.tasteSignals(preference);
  assert.equal(outing.tasteMatch(tags.cafe, before).percent, 100);
  assert.equal(outing.tasteMatch(tags.museum, before).percent, 0);
  const after = outing.tasteSignals(preference, [{ tags: tags.museum, weight: 2 }]);
  assert.ok(outing.tasteMatch(tags.museum, after).percent > 0);
  assert.ok(outing.tasteMatch(tags.cafe, after).percent < 100);
  assert.equal(outing.tasteMatch(tags.cafe, []).percent, null);
});
