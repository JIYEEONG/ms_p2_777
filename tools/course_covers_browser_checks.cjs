const assert = require('node:assert/strict');

module.exports = async function ({openPage,base,passed}) {
  const client=await openPage(base+'/moov.html?lang=ko');
  await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await client.wait(`document.querySelector('#app.screen-active') && window.MoovCoursePhotos`,'app and course photo catalog');
  const loaded=await client.evaluate(`Promise.all(MoovCoursePhotos.map(async photo=>{const image=new Image();image.src=photo.src;await image.decode();return image.naturalWidth>0})).then(items=>items.filter(Boolean).length)`);
  assert.ok(loaded>=50,'All local photographs decode, with at least 50 available');
  await client.evaluate(`loadCoursesFromDB()`);
  await client.evaluate(`state.outingQuery='';state.outingFilters={category:'전체',mood:'전체',companion:'전체',purpose:'전체',budget:100000};state.outingSub='community';state.outingSort='latest';state.outingMapOpen=false;state.communityRecommendationOpen=false;setTab('outing')`);
  await client.wait(`document.querySelectorAll('.course-visual img').length>0 && [...document.querySelectorAll('.course-visual img')].every(img=>{img.loading='eager';return img.complete&&img.naturalWidth>0})`,'all actual course covers decode',45000);
  async function checkWindows(label) {
    await client.wait(`[...document.querySelectorAll('.course-visual img')].every(img=>{img.loading='eager';return img.complete&&img.naturalWidth>0})`,label+' covers decode',45000);
    const result=await client.evaluate(`(()=>{const images=[...document.querySelectorAll('.course-visual img')],keys=images.map(img=>MoovCourseMedia.photoKey(img.getAttribute('src')));return {cards:document.querySelectorAll('.course-card').length,images:images.length,repeatedWindows:keys.filter((_,i)=>new Set(keys.slice(i,i+50)).size!==keys.slice(i,i+50).length).length}})()`);
    assert.equal(result.images,result.cards,label+': every card has a photograph');
    assert.equal(result.repeatedWindows,0,label+': every sliding window of 50 covers is unique');
    return result.cards;
  }
  await checkWindows('Latest feed');
  const stats=await client.evaluate(`(()=>{const courses=getVisibleOutingCourses(),images=[...document.querySelectorAll('.course-visual img')],srcs=images.map(img=>MoovCourseMedia.photoKey(img.getAttribute('src')));return {courses:courses.length,images:images.length,names:new Set(courses.map(c=>c.name)).size,covers:new Set(srcs).size,illustrations:srcs.filter(src=>src.startsWith('data:image/svg')).length,staleNames:courses.filter(c=>/^(감성|활기참|트렌디) (전시|관광|카페|음식점|체험|쇼핑) 코스$/.test(c.name)).length}})()`);
  assert.ok(stats.courses>20,'Exercise the database feed, not only bundled demo courses');
  assert.equal(stats.images,stats.courses);
  assert.equal(stats.names,stats.courses);
  assert.ok(stats.covers>=50,'The feed uses at least 50 different real photographs');
  assert.equal(stats.staleNames,0);
  assert.equal(stats.illustrations,0);
  passed(`Database feed: ${stats.courses} courses, ${stats.covers} real photo covers, no repeated photo in any 50-card window`);
  await client.evaluate(`document.querySelector('.course-visual img[data-representative="true"]').closest('.course-card').scrollIntoView({block:'start'})`);
  await new Promise(resolve=>setTimeout(resolve,400));
  await client.screenshot('community-distinct-route-covers',false);
  const selected=await client.evaluate(`(()=>{const image=document.querySelector('.course-visual img[data-representative="true"]');window.__coverId=image.closest('button').dataset.value;return {src:image.getAttribute('src'),id:window.__coverId}})()`);
  await client.evaluate(`openCourseDetail(getCourse(window.__coverId))`);
  await client.wait(`document.querySelector('.detail-cover img')?.naturalWidth>0`,'detail photograph loads');
  assert.equal(await client.evaluate(`document.querySelector('.detail-cover img').getAttribute('src')`),selected.src);
  await new Promise(resolve=>setTimeout(resolve,400));
  await client.screenshot('course-photograph-detail',false);
  await client.evaluate(`closeModal()`);
  for (const [sort,category] of [['popular','전체'],['nearby','전체'],['preference','전체'],['latest','음식점'],['latest','전시'],['nearby','전시']]) {
    await client.evaluate(`state.outingSort=${JSON.stringify(sort)};state.outingFilters.category=${JSON.stringify(category)};render()`);
    await checkWindows(sort+' / '+category);
  }
  await client.evaluate(`state.outingSort='latest';state.outingFilters.category='전체';render()`);
  await checkWindows('Restored latest feed');
  // An image error must repair the whole visible assignment, not pick another
  // card's photo from an independent fallback list.
  await client.evaluate(`document.querySelector('.course-visual img[data-representative="true"]').dispatchEvent(new Event('error'))`);
  await checkWindows('Photo failure recovery');
  const repaired=await client.evaluate(`(()=>{const image=document.querySelector('.course-visual img[data-representative="true"]');window.__coverId=image.dataset.courseCover;return image.getAttribute('src')})()`);
  await client.evaluate(`openCourseDetail(getCourse(window.__coverId))`);
  await client.wait(`document.querySelector('.detail-cover img')?.naturalWidth>0`,'repaired detail photograph');
  assert.equal(await client.evaluate(`document.querySelector('.detail-cover img').getAttribute('src')`),repaired);
  passed('50-card uniqueness survives sorting, category filters and a failed image; list and detail agree');
};
