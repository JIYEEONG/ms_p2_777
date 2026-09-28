const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../public/outing-data.js');
const media = require('../public/course-media.js');

test('1,000 catalog IDs survive identical route/title deduplication', () => {
  const courses = Array.from({length: 1000}, (_, i) => data.fromDatabase({
    id: `course-${i}`, title: '같은 코스', preserve_course_identity: true,
    points: [{sequence_no: 0, place_name: '문화역서울284'}, {sequence_no: 1, place_name: '서울숲'}],
  }));
  assert.equal(data.uniqueCourses([...courses, courses[0]]).length, 1000);
});

test('catalog cover and first stop use the same fixed photo across sort orders', () => {
  const courses = [1, 2].map(i => data.fromDatabase({id: `naver-${i}`, title: '문화역서울284',
    image_url: `/assets/naver-courses/test-${i}.jpg`, first_place_cover: true,
    points: [{sequence_no: 0, place_name: '문화역서울284', place_image_url: `/assets/naver-courses/test-${i}.jpg`}],
  }));
  for (const order of [courses, [...courses].reverse()]) {
    for (const course of media.sequenceCovers(media.distinguishCovers(order))) {
      assert.equal(course._displayCover, course.image);
      assert.deepEqual(media.candidates(course, 0), [course.image]);
    }
  }
  media.markFailed(courses[0].image);
  assert.deepEqual(media.candidates(courses[0]), []);
  assert.deepEqual(media.candidates(courses[0], 0), []);
});

test('a fixed destination photo never becomes a first-stop or generic waypoint photo', () => {
  const course = data.fromDatabase({id: 'destination-cover', title: '서울숲 산책',
    image_url: '/assets/naver-courses/destination-cover.jpg', first_place_cover: true,
    cover_stop_index: 2, image_place: '경복궁', cover_role: 'destination',
    points: [{sequence_no: 0, place_name: '서울숲'}, {sequence_no: 1, place_name: '인사동길'},
      {sequence_no: 2, place_name: '경복궁', place_image_url: '/assets/naver-courses/destination-cover.jpg'}],
  });
  assert.equal(course.coverStopIndex, 2);
  assert.equal(course.imagePlace, '경복궁');
  assert.equal(course.coverRole, 'destination');
  assert.deepEqual(media.candidates(course), [course.image]);
  assert.deepEqual(media.candidates(course, 0), []);
  assert.deepEqual(media.candidates(course, 1), []);
  assert.deepEqual(media.candidates(course, 2), [course.image]);
  media.markFailed(course.image);
  assert.deepEqual(media.candidates(course), []);
  assert.deepEqual(media.candidates(course, 2), []);
});

test('a catalog course without a photo stays blank even at recognizable landmarks', () => {
  const course = data.fromDatabase({id: 'unresolved', title: '서울숲 산책',
    first_place_cover: true, image_url: null,
    points: [{sequence_no: 0, place_name: '서울숲'}, {sequence_no: 1, place_name: '경복궁'}],
  });
  assert.deepEqual(media.candidates(course), []);
  assert.deepEqual(media.candidates(course, 0), []);
  assert.deepEqual(media.candidates(course, 1), []);
});
