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
  assert.equal(outing.score(courses[0], preference, tags.cafe), 1);
  assert.deepEqual(outing.sort(courses, 'popular', preference, tagsFor, () => 0).map((course) => course.id), ['unknown', 'museum', 'cafe']);
});

test('unknown places never receive fabricated coordinates', () => {
  assert.equal(outing.pointForStop(courses[0], 0).id, 'demo-onion');
  assert.equal(outing.pointForStop(courses[2], 0).lat, null);
  assert.equal(outing.pointForStop(courses[2], 0).source, 'unverified');
});

test('database coordinates survive course map and rental handoff without demo replacements', () => {
  const course = { id: 'database', stops: ['어니언 성수', 'Stored place'], _dbPoints: [
    { latitude: '37.5501', longitude: '127.0611' }, { latitude: null, longitude: '' },
  ] };
  assert.equal(outing.pointForStop(course, 0).lat, 37.5501);
  assert.equal(outing.pointForStop(course, 0).lng, 127.0611);
  assert.equal(outing.pointForStop(course, 0).source, 'provided');
  assert.equal(outing.pointForStop(course, 1).lat, null);
  assert.equal(typeof outing.newId(), 'string');
});

test('nearby sorting recalculates distance from current user coordinates', () => {
  const nearByCoordinates = {
    id: 'near-db',
    createdAt: '2026-09-01',
    distance_m: 999999,
    stops: ['Near'],
    _dbPoints: [{ latitude: '37.5446', longitude: '127.0580' }],
  };
  const farByCoordinates = {
    id: 'far-db',
    createdAt: '2026-09-02',
    distance_m: 1,
    stops: ['Far'],
    _dbPoints: [{ latitude: '37.6100', longitude: '127.1000' }],
  };
  const sorted = outing.sort(
    [farByCoordinates, nearByCoordinates],
    'nearby',
    {},
    () => ({}),
    () => 0,
    { userLat: 37.5445, userLon: 127.0557 },
  );
  assert.deepEqual(sorted.map((course) => course.id), ['near-db', 'far-db']);
  assert.ok(outing.courseDistanceFromUser(nearByCoordinates, { userLat: 37.5445, userLon: 127.0557 }) < 1);
});

test('course exposure prioritizes unique image and name completeness', () => {
  const ready = { id: 'ready', name: '완성 코스', image: 'https://example.com/ready.jpg', createdAt: '2026-09-01', stops: ['Far'], _dbPoints: [{ latitude: '37.7000', longitude: '127.2000' }] };
  const imageOnly = { id: 'image-only', name: '', image: 'https://example.com/only-image.jpg', createdAt: '2026-09-02', stops: ['Mid'], _dbPoints: [{ latitude: '37.5500', longitude: '127.0600' }] };
  const namedNoImageHighScore = { id: 'named-no-image', name: '가까운 코스', image: null, createdAt: '2026-09-03', stops: ['Near'], _dbPoints: [{ latitude: '37.5446', longitude: '127.0580' }] };
  const empty = { id: 'empty', name: '', image: null, createdAt: '2026-09-04', stops: ['Empty'], _dbPoints: [{ latitude: '37.5450', longitude: '127.0585' }] };
  const duplicateNameA = { id: 'duplicate-name-a', name: '중복 이름', image: 'https://example.com/name-duplicate-a.jpg', createdAt: '2026-09-05', stops: ['Name duplicate A'], _dbPoints: [{ latitude: '37.5450', longitude: '127.0585' }] };
  const duplicateNameB = { id: 'duplicate-name-b', name: '중복 이름', image: 'https://example.com/name-duplicate-b.jpg', createdAt: '2026-09-06', stops: ['Name duplicate B'], _dbPoints: [{ latitude: '37.5450', longitude: '127.0585' }] };
  const duplicateImageA = { id: 'duplicate-image-a', name: '중복 이미지 A', image: 'https://example.com/duplicate.jpg', createdAt: '2026-09-07', stops: ['Image duplicate A'], _dbPoints: [{ latitude: '37.5450', longitude: '127.0585' }] };
  const duplicateImageB = { id: 'duplicate-image-b', name: '중복 이미지 B', image: 'https://example.com/duplicate.jpg', createdAt: '2026-09-08', stops: ['Image duplicate B'], _dbPoints: [{ latitude: '37.5450', longitude: '127.0585' }] };
  const preference = { category: '카페', mood: '전체', companion: '전체', budget: 100000 };
  const testTags = {
    ready: { category: [], mood: [], companion: [], time: [], price: null },
    'image-only': { category: [], mood: [], companion: [], time: [], price: null },
    'named-no-image': { category: ['카페'], mood: [], companion: [], time: [], price: null },
    empty: { category: [], mood: [], companion: [], time: [], price: null },
    'duplicate-name-a': { category: [], mood: [], companion: [], time: [], price: null },
    'duplicate-name-b': { category: [], mood: [], companion: [], time: [], price: null },
    'duplicate-image-a': { category: [], mood: [], companion: [], time: [], price: null },
    'duplicate-image-b': { category: [], mood: [], companion: [], time: [], price: null },
  };
  const input = [duplicateImageB, namedNoImageHighScore, duplicateNameA, imageOnly, empty, duplicateImageA, duplicateNameB, ready];
  const sorted = outing.sort(
    input,
    'nearby',
    preference,
    (course) => testTags[course.id],
    () => 0,
    { userLat: 37.5445, userLon: 127.0557 },
  );
  assert.deepEqual(sorted.map((course) => course.id), ['ready', 'image-only', 'named-no-image', 'empty', 'duplicate-name-b', 'duplicate-name-a', 'duplicate-image-b', 'duplicate-image-a']);
  assert.deepEqual(outing.rank(input, preference, (course) => testTags[course.id]).map((item) => item.course.id), ['ready', 'image-only', 'named-no-image', 'empty', 'duplicate-name-b', 'duplicate-name-a', 'duplicate-image-b', 'duplicate-image-a']);
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
