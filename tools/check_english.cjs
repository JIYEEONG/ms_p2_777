/* Isolated browser checks. API requests are mocked; no real accounts are used. */
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
  for(const el of document.querySelectorAll('[placeholder],[aria-label],[alt],[title]')) {
    if(!el.getClientRects().length || el.closest('[data-i18n-skip]'))continue;
    for(const name of ['placeholder','aria-label','alt','title']) {
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
  await client.send('Emulation.setDeviceMetricsOverride',{width:430,height:932,deviceScaleFactor:1,mobile:false});
  await installBrowserAuthFixture(client,base);
  await navigate(base,'/moov.html');
  await client.wait("typeof state==='object' && state.isAuthenticated",'authenticated fixture');
  await client.wait("document.querySelector('#app').classList.contains('screen-active')",'visible app after survey');
  assert.equal(await client.evaluate('MoovI18n.getLanguage()'),'en','English is the branch default');
  assert.equal(await client.evaluate("MoovI18n.translate('미등록공원')"),'미등록공원','Unknown place names are not treated as currency');
  // Nested explicit labels, editable content, option values and live mutations.
  await client.evaluate(`(()=>{
    const host=document.createElement('section');host.id='translation-fixture';
    host.innerHTML='<button data-i18n-en="Saved trips"><svg></svg><span>관심코스</span></button><textarea placeholder="코스를 소개해 주세요">내가 작성한 문장</textarea><select><option>배리어프리</option></select><p id="dynamic-label">입고 필요 8종</p>';
    document.body.append(host);MoovI18n.refresh();
  })()`);
  assert.deepEqual(await client.evaluate(`(()=>{const h=document.querySelector('#translation-fixture');return [h.querySelector('span').textContent,h.querySelector('textarea').placeholder,h.querySelector('textarea').value,h.querySelector('option').value,h.querySelector('option').textContent,h.querySelector('p').textContent]})()`),['Saved trips','Describe your trip','내가 작성한 문장','배리어프리','Accessible','8 products need restocking']);
  await client.evaluate("document.querySelector('#dynamic-label').textContent='입고 필요 9종'");
  await client.wait("document.querySelector('#dynamic-label').textContent==='9 products need restocking'",'live text translation');
  await client.evaluate("MoovI18n.setLanguage('ko')");
  assert.equal(await client.evaluate("document.querySelector('#dynamic-label').textContent"),'입고 필요 9종');
  await client.evaluate("document.querySelector('#translation-fixture').remove();MoovI18n.setLanguage('en')");
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
