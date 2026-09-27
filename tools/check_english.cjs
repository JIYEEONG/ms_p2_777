/* Isolated browser checks; --live-courses reads public course fixtures only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { installBrowserAuthFixture } = require('./browser_auth_fixture.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'moov-english-'));
let browser, server, client;
class CDP {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map(); this.errors = [];
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.id) {
        const p = this.pending.get(data.id);
        if (!p) return;
        this.pending.delete(data.id); clearTimeout(p.timer);
        data.error ? p.reject(Error(data.error.message)) : p.resolve(data.result);
      }
      if (data.method === 'Runtime.exceptionThrown') this.errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error('Timeout: ' + method)); }, 20000);
      this.pending.set(id, {resolve, reject, timer});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
  }
  async wait(expression, label) {
    for (let i = 0; i < 150; i++) {
      try { if (await this.evaluate(expression)) return; } catch {}
      await delay(100);
    }
    throw Error('Timed out: ' + label);
  }
}
const scan = `(() => {
  const out = new Set();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while(walk.nextNode()) {
    const node=walk.currentNode, el=node.parentElement;
    if (!el || el.closest('script,style,textarea,[data-i18n-skip],[contenteditable],.detail-message-row.user')) continue;
    if (!el.getClientRects().length || getComputedStyle(el).visibility==='hidden') continue;
    if (/[가-힣]/.test(node.nodeValue)) out.add(node.nodeValue.trim());
  }
  for(const el of document.querySelectorAll('[placeholder],[aria-label],[alt],[title],optgroup[label]')) {
    if(!el.getClientRects().length || el.closest('[data-i18n-skip]'))continue;
    for(const name of ['placeholder','aria-label','alt','title','label']) {
      const value=el.getAttribute(name); if(value && /[가-힣]/.test(value))out.add(name+': '+value);
    }
  }
  return [...out];
})()`;
const reports = [];
async function snapshot(name) {
  await client.evaluate('MoovI18n.refresh()');
  await delay(120);
  const missing = await client.evaluate(scan);
  reports.push({name, missing});
  console.log(name + ': ' + missing.length + ' Korean strings');
}
async function navigate(base, url) {
  await client.send('Page.navigate', {url:base+url});
  await client.wait("document.readyState==='complete' && !!window.MoovI18n", url);
  await delay(300);
}
async function main() {
  const { createFrontendServer } = await import('../front/server.mjs');
  server = createFrontendServer('http://127.0.0.1:1');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const profile=path.join(artifacts,'profile');
  browser=spawn(process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'], {windowsHide:true,stdio:'ignore'});
  let launchError; browser.on('error',error=>launchError=error);
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<150&&!fs.existsSync(portFile);i++){if(launchError)throw launchError;await delay(100);}
  assert.ok(fs.existsSync(portFile),'Edge debugging port started');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  const socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  client=new CDP(socket);
  await client.send('Page.enable'); await client.send('Runtime.enable');
  await client.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await client.send('Emulation.setDeviceMetricsOverride',{width:430,height:932,deviceScaleFactor:1,mobile:false});
  await installBrowserAuthFixture(client,base);
  await navigate(base,'/moov.html');
  await client.wait("typeof state==='object' && state.isAuthenticated",'authenticated fixture');
  await client.wait("document.querySelector('#app').classList.contains('screen-active')",'visible app after survey');
  assert.equal(await client.evaluate('MoovI18n.getLanguage()'),'en','English is the branch default');
  assert.equal(await client.evaluate("MoovI18n.translate('미등록공원')"),'미등록공원','Unknown place names are not treated as currency');
  assert.equal(await client.evaluate("MoovI18n.place('예술의전당오페라하우스')"),'Seoul Arts Center Opera House','NAVER venue spacing aliases use reviewed English');
  assert.equal(await client.evaluate("MoovI18n.place('예술의전당오페라하우스주차장')"),'Seoul Arts Center Opera House Parking');
  // Nested explicit labels, editable content, option values and live mutations.
  await client.evaluate(`(()=>{
    const host=document.createElement('section');host.id='translation-fixture';
    host.innerHTML='<button data-i18n-en="Saved trips"><svg></svg><span>관심코스</span></button><textarea placeholder="코스를 소개해 주세요">내가 작성한 문장</textarea><select><option>배리어프리</option></select><p id="dynamic-label">입고 필요 8종</p>';
    document.body.append(host);MoovI18n.refresh();
  })()`);
  assert.deepEqual(await client.evaluate(`(()=>{const h=document.querySelector('#translation-fixture');return [h.querySelector('span').textContent,h.querySelector('textarea').placeholder,h.querySelector('textarea').value,h.querySelector('option').value,h.querySelector('option').textContent,h.querySelector('p').textContent]})()`),['Saved trips','Describe your trip','내가 작성한 문장','배리어프리','Accessible','8 products need restocking']);
  await client.evaluate("document.querySelector('#dynamic-label').textContent='입고 필요 9종'");
  await client.evaluate(`document.querySelector('#translation-fixture').insertAdjacentHTML('beforeend','<strong id="custom-location" data-i18n-place>새로운장소</strong>');MoovI18n.refresh()`);
  assert.doesNotMatch(await client.evaluate("document.querySelector('#custom-location').textContent"),/[가-힣]/,'Unlisted route location has a readable display label');
  await client.wait("document.querySelector('#dynamic-label').textContent==='9 products need restocking'",'live text translation');
  await client.evaluate("MoovI18n.setLanguage('ko')");
  assert.equal(await client.evaluate("document.querySelector('#dynamic-label').textContent"),'입고 필요 9종');
  assert.equal(await client.evaluate("document.querySelector('#custom-location').textContent"),'새로운장소');
  await client.evaluate("document.querySelector('#translation-fixture').remove();MoovI18n.setLanguage('en')");
  const courseFixtures = process.argv.includes('--live-courses')
    ? (await (await fetch('http://127.0.0.1:8000/api/outing/courses')).json()).courses
    : [{id:'english-regression',title:'엘씨오 → 성동 AI미래기술체험센터 → 동대문디자인플라자 디자인전시관 코스',points:['엘씨오','성동 AI미래기술체험센터','동대문디자인플라자 디자인전시관'].map((place_name,index)=>({place_name,sequence_no:index})),tags:{}}];
  await client.evaluate(`window.englishCourses=${JSON.stringify(courseFixtures)};dbCourses=englishCourses.map(MoovOutingData.fromDatabase)`);
  assert.deepEqual(await client.evaluate(`englishCourses.flatMap(c=>[c.title,...c.points.map(p=>p.place_name)]).filter(s=>/[가-힣]/.test(MoovI18n.translate(s)))`),[], 'All public course titles and stops translated');
  await client.evaluate(`state.activeTab='outing';state.outingSub='community';render()`);
  await snapshot('public-community-courses');
  await client.evaluate(`openCourseDetail(dbCourses.find(c=>c.name.includes('엘씨오'))||dbCourses[0])`);
  await snapshot('public-course-detail');
  await client.evaluate(`openCourseStopDetail(state.activeDetailCourse,0)`);
  await snapshot('public-course-stop-detail');
  await client.evaluate('closeModal()');
  // Editable location labels use English presentation and canonical search terms.
  await client.evaluate(`(()=>{
    const host=document.createElement('section');host.id='picker-fixture';
    host.innerHTML=[0,1,2].map(index=>MoovLocationPicker.field({index,value:'안국역',label:'Stop',kind:'waypoint'})).join('');
    document.querySelector('#app-content').replaceChildren(host);window.pickerQueries=[];window.selectedPlace=null;
    MoovLocationPicker.configureRouteSearch({search:async query=>{pickerQueries.push(query);return [{name:'안국역 3호선',address:'서울특별시 종로구 율곡로 62',lat:37.5765389,lng:126.9855095}]},onSelect:place=>{window.selectedPlace=place}});
    host.querySelector('input').focus();
    host.querySelector('input').dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));
  })()`);
  assert.deepEqual(await client.evaluate('pickerQueries'),[],'Focus and hover alone do not open address suggestions');
  await client.evaluate("document.querySelector('#picker-fixture input').click()");
  await client.wait("!!document.querySelector('#picker-fixture .route-location-results button')",'existing pickup lookup on focus').catch(async error=>{console.log(await client.evaluate("({queries:pickerQueries,active:document.activeElement.outerHTML,html:document.querySelector('#picker-fixture').innerHTML})"));throw error;});
  assert.equal(await client.evaluate("document.querySelector('#picker-fixture input').value"),'Anguk Station');
  assert.deepEqual(await client.evaluate('pickerQueries'),['안국역']);
  assert.doesNotMatch(await client.evaluate("document.querySelector('#picker-fixture .route-location-results').textContent"),/[가-힣]/);
  await client.evaluate(`document.querySelectorAll('#picker-fixture input')[1].click();document.querySelectorAll('#picker-fixture input')[2].click()`);
  await client.wait('pickerQueries.length===3','stop and destination clicks');
  assert.equal(await client.evaluate("document.querySelectorAll('#picker-fixture .route-location-results:not([hidden])').length"),1,'Only one address list remains open');
  await client.wait("!!document.querySelector('#picker-fixture form[data-route-index=\"2\"] .route-location-results button')",'destination results');
  await client.evaluate("document.querySelector('#picker-fixture form[data-route-index=\"2\"] .route-location-results button').click()");
  assert.equal(await client.evaluate('selectedPlace.name'),'안국역 3호선','Selection preserves canonical name');
  assert.equal(await client.evaluate("document.querySelectorAll('#picker-fixture .route-location-results:not([hidden])').length"),0,'Selection dismisses suggestions');
  await client.evaluate("document.querySelector('#picker-fixture input').click();document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}))");
  await delay(100);
  assert.equal(await client.evaluate("document.querySelectorAll('#picker-fixture .route-location-results:not([hidden])').length"),0,'Outside touch dismisses suggestions even while search is pending');
  await client.evaluate("document.querySelector('#picker-fixture input').click();document.querySelector('#picker-fixture input').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  assert.equal(await client.evaluate("document.querySelectorAll('#picker-fixture .route-location-results:not([hidden])').length"),0,'Escape dismisses suggestions');
  await client.evaluate(`const edited=document.querySelector('#picker-fixture input');edited.value='My custom place';MoovI18n.setLanguage('ko')`);
  assert.equal(await client.evaluate("document.querySelector('#picker-fixture input').value"),'My custom place');
  assert.equal(await client.evaluate("document.querySelectorAll('#picker-fixture input')[1].value"),'안국역');
  await client.evaluate("document.querySelector('#picker-fixture').remove();MoovI18n.setLanguage('en')");
  for(const tab of ['home','ai','space','outing','profile']) {
    await client.evaluate(`state.activeTab=${JSON.stringify(tab)};render()`);
    await snapshot(tab);
  }
  for(const sub of ['talk','history','settings']) {
    await client.evaluate(`state.activeTab='ai';state.aiSub=${JSON.stringify(sub)};render()`);
    await snapshot('ai-'+sub);
  }
  for(const sub of ['community','recommend','register','interest']) {
    await client.evaluate(`state.activeTab='outing';state.outingSub=${JSON.stringify(sub)};render()`);
    await snapshot('outing-'+sub);
  }
  for(const sub of ['notices','usage','courses','payments','policies','version']) {
    await client.evaluate(`state.activeTab='profile';state.profileView=${JSON.stringify(sub)};render()`);
    await snapshot('profile-'+sub);
  }
  // Exercise rendered modules directly without performing purchases/dispatches.
  for(const fn of ['renderVehicleTypeSelector("standard","noop")','renderRegisterCourse()','renderTastePlaceFinder()','renderRecommendation()']) {
    await client.evaluate(`document.querySelector('#app-content').innerHTML=${fn}`);
    await snapshot(fn);
  }
  await navigate(base,'/moov-home/index.html?lang=en');
  await snapshot('home-iframe');
  for(const vehicle of ['standard','family','premium','barrierfree']) {
    await client.evaluate(`state.homeStep='booking';state.rentalVehicleType=${JSON.stringify(vehicle)};render()`);
    await snapshot('rental-'+vehicle);
  }
  await navigate(base,'/space-content/index.html?lang=en');
  for(const hash of ['ott','wellness','window','purchase']) {
    await client.evaluate(`location.hash=${JSON.stringify(hash)}`);await delay(200);await snapshot('space-'+hash);
    if(hash==='window')assert.deepEqual(await client.evaluate("[...document.querySelectorAll('optgroup')].map(el=>el.label).filter(label=>/[가-힣]/.test(label))"),[],'Native sound menu groups translated');
  }
  await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate(base,'/dashboard/index.html?lang=en');
  await client.wait("!!document.querySelector('#product-filter-result')",'dashboard');
  for(const view of ['dashboard','vehicles','products','members','ai','themes']) {
    await client.evaluate(`document.querySelector('[data-view="${view}"]').click()`);await delay(250);await snapshot('dashboard-'+view);
  }
  const result={reports,errors:client.errors};
  fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify(result,null,2));
  const shot=await client.send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(artifacts,'dashboard.png'),Buffer.from(shot.data,'base64'));
  console.log('ARTIFACTS '+artifacts);
  assert.deepEqual(client.errors,[],'No uncaught browser errors');
  assert.equal(reports.reduce((sum,r)=>sum+r.missing.length,0),0,'No untranslated visible UI strings');
}
main().catch(error=>{console.error(error);console.log('ARTIFACTS '+artifacts);fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({reports,errors:client?.errors,error:error.message},null,2));process.exitCode=1;}).finally(async()=>{
  try{await client?.send('Browser.close');}catch{}client?.socket.close();browser?.kill();server?.close();
});
