const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

module.exports=async function({openPage,base,passed}){
  const directory=path.resolve(__dirname,'../backend/account_snapshots');
  const file=fs.readdirSync(directory).find(name=>name.endsWith('.json'));
  assert.ok(file,'Committed account snapshot exists');
  const snapshot=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
  const client=await openPage(base+'/moov.html?lang=ko',{backup:snapshot});
  await client.wait("!!document.querySelector('#app.screen-active')&&state.backupPending===false",'snapshot restored before app entry');
  const courses=await client.evaluate('state.customCourses.map(c=>({id:c.id,name:c.name,stops:c.stops}))');
  assert.deepEqual(courses,snapshot.outing.customCourses.map(c=>({id:c.id,name:c.name,stops:c.stops})));
  assert.deepEqual(await client.evaluate('[...state.savedCourseIds]'),snapshot.outing.savedCourseIds);
  assert.equal(await client.evaluate('state.chatFontScale'),snapshot.appSettings.chatFontScale);
  assert.equal(await client.evaluate('state.tripActive'),false);
  const rental=await client.evaluate("JSON.parse(localStorage.getItem('moov-home-policy-design-v2:'+encodeURIComponent(state.userId)))");
  assert.deepEqual(rental,snapshot.rentalSettings);
  await client.evaluate("state.outingSub='interest';setTab('outing')");
  assert.match(await client.evaluate("document.querySelector('#app-content').textContent"),/경복궁 투어/);
  await client.screenshot('restored-account-course',false);
  await client.evaluate("state.chatFontScale=1.2;state.customCourses=[];state.savedCourseIds.clear();persist()");
  await client.reload();
  await client.wait("!!document.querySelector('#app.screen-active')&&state.backupPending===false",'existing account reload');
  assert.equal(await client.evaluate('state.chatFontScale'),1.2);
  assert.equal(await client.evaluate('state.customCourses.length'),0);
  assert.equal(await client.evaluate('state.savedCourseIds.size'),0);
  passed('Actual account course and settings restore on first use; reload preserves newer edits and intentional deletions');
};
