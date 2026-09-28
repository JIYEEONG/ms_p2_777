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
