const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('front/public/moov.html', 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

test('community keeps manual map opening and exposes preference sorting without the taste filter', () => {
  const browse = between('function renderCourseBrowse()', 'function clampMatchPercent');
  const clickHandlers = between('if (action === "toggle-outing-map")', 'if (action === "taste-course-steps")');
  assert.doesNotMatch(browse, /renderOutingFilterBar/);
  assert.match(browse, /\["preference", "취향순"\]/);
  assert.match(clickHandlers, /state\.outingFilterDraft\[button\.dataset\.filter\] = value/);
  assert.doesNotMatch(clickHandlers, /outing-filter[^\n]+outingMapOpen/);
});

test('course taste filters apply explicitly and place results use match then Korean name order', () => {
  const filterBar = between('function renderOutingFilterBar', 'function getCourseMapPoints');
  const placeList = between('function filteredTastePlaces', 'function placeDistanceFromUser');
  assert.match(filterBar, /data-action="apply-outing-filters">적용하기/);
  assert.doesNotMatch(filterBar, /필터 펼치기/);
  assert.match(source, /state\.outingFilters = \{ \.\.\.state\.outingFilterDraft \}/);
  assert.match(placeList, /b\.matchPercent/);
  assert.match(placeList, /localeCompare\(String\(b\.name\), "ko-KR"\)/);
});

test('course likes are stable below 999 and update from local liked state immediately', () => {
  const likes = between('function seededCourseLikes', 'function courseCard');
  assert.match(likes, /120 \+ \(\(hash >>> 0\) % 878\)/);
  assert.match(likes, /likedCourseIds\.has\(course\.id\) \? 1 : 0/);
  assert.match(source, /\.course-actions button\.liked svg \{ fill: currentColor; \}/);
  assert.match(source, /좋아요 \$\{courseLikeCount\(course\)\}/);
});
