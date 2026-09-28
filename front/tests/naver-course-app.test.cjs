const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const outing = require('../public/outing-data.js');
const media = require('../public/course-media.js');

const html = fs.readFileSync(path.join(__dirname, '../public/moov.html'), 'utf8');
function section(start, end) {
  const startAt = html.indexOf(start);
  const endAt = html.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `Missing app section ${start}`);
  return html.slice(startAt, endAt);
}

function appContext(records) {
  const context = vm.createContext({
    MoovOutingData: outing, MoovCourseMedia: media,
    fetch: async () => ({ok: true, json: async () => ({courses: records})}),
    dbCourses: [], dbPlaces: [{}], baseCourses: [],
    state: {isAuthenticated: false, customCourses: []},
    hydrateMissingCourseImages: () => {},
    escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;'),
    taxiMapText: text => text,
    console,
  });
  for (const [start, end] of [
    ['async function loadCoursesFromDB()', 'loadCoursesFromDB();'],
    ['function allOutingCourses()', 'function getFilteredOutingCourses()'],
    ['function getCourseStopRole(', 'function getCourseTagImage('],
    ['function coursePhotoCredits(', 'function getCourseStopDescription('],
  ]) vm.runInContext(section(start, end), context);
  return context;
}

function fixture(index) {
  const photo = `/assets/naver-courses/app-${index}.jpg`;
  return {
    id: `catalog-${index}`, title: '같은 코스 이름', image_url: photo,
    author: '코스 작성자', description: '전시와 공원 산책', duration_seconds: 3600, distance_m: 1500,
    tags: {category: ['전시', '관광'], sub_category: ['공원'], mood: ['조용함']},
    first_place_cover: true, preserve_course_identity: true,
    image_source: {source: 'naver-image-search', original_url: `https://photos.example/${index}.jpg`,
      search_url: 'https://search.naver.com/search.naver?where=image&query=문화역서울284'},
    points: [
      {sequence_no: 1, place_name: '서울숲', place_image_url: '/later-stop.jpg'},
      {sequence_no: 0, place_name: '문화역서울284', place_image_url: photo},
    ],
  };
}

test('the active app retains all 1,000 catalog courses and their first-stop photos', async () => {
  const records = Array.from({length: 1000}, (_, index) => fixture(index));
  const app = appContext(records);
  await app.loadCoursesFromDB();
  const courses = app.allOutingCourses();
  assert.equal(courses.length, 1000);
  assert.equal(new Set(courses.map(course => app.getCourseCoverImage(course))).size, 1000);
  for (const course of courses) {
    assert.equal(course.firstPlaceCover, true);
    assert.equal(course.preserveCourseIdentity, true);
    assert.equal(course.author, '코스 작성자');
    assert.equal(course.desc, '전시와 공원 산책');
    assert.deepEqual(course._dbTags, records[0].tags);
    assert.equal(course.distance_m, 1500);
    assert.equal(course.duration_seconds, 3600);
    assert.deepEqual(course.stops, ['문화역서울284', '서울숲']);
    assert.equal(app.getCourseCoverImage(course), course.image);
    assert.equal(app.getCourseStopImage(course, course.stops[0], 0), course.image);
    assert.equal(course.stopDetails[0].name, '문화역서울284');
    assert.equal(course.stopDetails[0].type, '출발지');
    assert.equal(app.getCourseStopImage(course, course.stops[1], 1), '/later-stop.jpg');
    const credit = app.coursePhotoCredits(course);
    assert.ok(credit.includes(course.imageSource.original_url));
    assert.match(credit, /네이버 이미지 검색/);
  }
});

test('the active app never replaces a failed catalog cover with a category photo', async () => {
  const record = fixture('failed');
  const app = appContext([record]);
  await app.loadCoursesFromDB();
  const course = app.dbCourses[0];
  media.markFailed(course.image);
  assert.equal(app.getCourseCoverImage(course), null);
  assert.equal(app.getCourseStopImage(course, course.stops[0], 0), null);
  assert.equal(app.getCourseStopImage(course, course.stops[1], 1), '/later-stop.jpg');
});

test('automatic hydration leaves fixed first-place catalog photos alone', async () => {
  const app = appContext([]);
  let unrelatedSearches = 0;
  Object.assign(app, {
    normalizeSearch: value => value || '',
    findPixabayImageForCourse: async () => { unrelatedSearches++; return {url: '/unrelated.jpg'}; },
    findCommonsImageForCourse: async () => { unrelatedSearches++; return null; },
  });
  vm.runInContext(section('async function hydrateMissingCourseImages(', 'async function findPixabayImageForCourse('), app);
  const course = {id: 'missing-catalog-file', firstPlaceCover: true, image: null, name: '문화역서울284'};
  await app.hydrateMissingCourseImages([course]);
  assert.equal(unrelatedSearches, 0);
  assert.equal(course.image, null);
});
