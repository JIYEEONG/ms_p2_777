/* Browser smoke checks for the rental and taxi NAVER maps.
 * Run: node tools/check_naver_maps.cjs [http://localhost:3000]
 * Uses a fresh Edge profile; no real account or booking is required.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { installBrowserAuthFixture, waitForVerifiedSmokeUser } = require('./browser_auth_fixture.cjs');

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moov-naver-smoke-'));
const profile = path.join(artifactDir, 'profile');
const executable = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sessions = [];
const checks = [];
let browser, debuggingPort;

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.exceptions = [];
    this.requests = [];
    this.contextEpoch = 0;
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
      } else if (message.method === 'Network.requestWillBeSent') this.requests.push(message.params.request.url);
      else if (message.method === 'Runtime.executionContextsCleared') this.contextEpoch++;
      else if (message.method === 'Runtime.exceptionThrown') {
        const detail = message.params.exceptionDetails;
        this.exceptions.push({
          message: detail.exception?.description || detail.text,
          source: detail.url ? new URL(detail.url, base).pathname : '',
          line: detail.lineNumber,
        });
      }
    });
    socket.addEventListener('close', () => {
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timeout);
        entry.reject(new Error('Browser connection closed'));
      }
      this.pending.clear();
    });
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('CDP connection failed')), { once: true });
    });
    return new CDP(socket);
  }
  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP timeout: ' + method));
      }, 35000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result?.value;
  }
  async wait(expression, description, timeout = 30000) {
    const until = Date.now() + timeout;
    let lastError;
    while (Date.now() < until) {
      try { if (await this.evaluate(expression)) return; }
      catch (error) { lastError = error; }
      await delay(100);
    }
    throw new Error('Timed out: ' + description + (lastError ? ' (' + lastError.message + ')' : ''));
  }
  async click(selector) {
    await this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element || element.disabled) throw new Error('Missing or disabled action: ' + ${JSON.stringify(selector)});
      element.click();
    })()`);
  }
  async clickMap(selector, xFraction = 0.7, yFraction = 0.58) {
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(150);
    const point = await this.evaluate(`(() => {
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: rect.left + rect.width * ${xFraction}, y: rect.top + rect.height * ${yFraction} };
    })()`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  }
  async dragMarker(selector) {
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(200);
    const point = await this.evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...point });
    for(let step=1;step<=8;step++) {
      await this.send('Input.dispatchMouseEvent', {type:'mouseMoved',button:'left',buttons:1,x:point.x+step*2,y:point.y+step*1.5});
      await delay(30);
    }
    await this.send('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:point.x+16,y:point.y+12});
  }
  async panMap(selector) {
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(150);
    const point = await this.evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width*.38,y:r.top+r.height*.3};})()`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...point });
    for (let step = 1; step <= 10; step++) {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: point.x + step * 5, y: point.y + step * 2 });
      await delay(30);
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x: point.x + 50, y: point.y + 20 });
  }
  async pinchMap(selector, expand) {
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(150);
    const center = await this.evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height*.4};})()`);
    const touches = spread => [-1, 1].map((side, index) => ({ id: index + 1, x: center.x + side * spread, y: center.y, radiusX: 3, radiusY: 3, force: 1 }));
    await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(expand ? 28 : 84) });
    for (let step = 1; step <= 14; step++) {
      await this.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(expand ? 28 + step * 4 : 84 - step * 4) });
      await delay(40);
    }
    await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(650);
  }
  async reload() {
    const epoch = this.contextEpoch;
    await this.send('Page.reload', { ignoreCache: true });
    const until = Date.now() + 10000;
    while (this.contextEpoch === epoch && Date.now() < until) await delay(50);
    if (this.contextEpoch === epoch) throw new Error('Page did not reload');
    await this.wait("document.readyState==='complete' && typeof render==='function'", 'page after reload');
    if (this.authFixture) await waitForVerifiedSmokeUser(this);
  }
  async screenshot(name, waitForTiles = true) {
    if (waitForTiles && !name.startsWith('failure-')) {
      await this.wait(`(() => {
        const elements = [...document.querySelectorAll('[data-map-provider="naver"]')];
        return elements.some(element => {
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height) return false;
          const tiles = [...element.querySelectorAll('img[src*="pstatic"],img[src*="naver"]')];
          return tiles.some(tile => {
            const size = tile.getBoundingClientRect();
            return tile.complete && tile.naturalWidth > 0 && size.width >= 128 && size.height >= 128;
          });
        });
      })()`, 'loaded NAVER tiles before ' + name, 25000);
      // Let the tile image reach the compositor before capturing the screen.
      await this.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    }
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, name + '.png'), Buffer.from(result.data, 'base64'));
  }
  async diagnostics() {
    return this.evaluate(`(() => {
      const elements = [...document.querySelectorAll('.rental-naver-map,#taxi-naver-map,.map-location-canvas,#outing-naver-map,#course-detail-naver-map')];
      return {
        path: location.pathname,
        title: document.title,
        readyState: document.readyState,
        language: document.documentElement.lang,
        naverMapType: typeof window.naver?.maps?.Map,
        adapterReadyType: typeof window.MoovNaverMap?.ready,
        scriptCount: document.scripts.length,
        scriptHosts: [...new Set([...document.scripts].filter(script => script.src).map(script => new URL(script.src, location.href).hostname))],
        maps: elements.map(element => {
          const rect = element.getBoundingClientRect();
          return { id: element.id, provider: element.dataset.mapProvider || null,
            error: element.dataset.mapError || null, children: element.childElementCount,
            width: Math.round(rect.width), height: Math.round(rect.height),
            tileImages: element.querySelectorAll('img[src*="pstatic"],img[src*="naver"]').length,
            loadedTileImages: [...element.querySelectorAll('img[src*="pstatic"],img[src*="naver"]')].filter(tile => tile.complete && tile.naturalWidth >= 128).length };
        }),
        status: [...document.querySelectorAll('.rux-map-status,#taxi-map-status,#taxi-pickup-address')].map(element => ({ id: element.id, text: element.textContent.slice(0, 220) })),
      };
    })()`);
  }
}

function passed(name, details) {
  checks.push({ name, ok: true, ...(details ? { details } : {}) });
  console.log('PASS ' + name);
}

function mapReady(selector) {
  return `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    return !!(window.naver?.maps?.Map && element &&
      ((element.dataset.mapProvider === 'naver' && element.childElementCount > 0) ||
       element.querySelector('img[src*="pstatic"],img[src*="naver"],canvas,[style*="naver"],.moov-naver-map-canvas')));
  })()`;
}

async function openPage(url, authOptions) {
  const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/new?about:blank`, { method: 'PUT' });
  const target = await response.json();
  const client = await CDP.connect(target.webSocketDebuggerUrl);
  sessions.push(client);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');
  const hostPage = ['/', '/moov.html', '/index.html'].includes(new URL(url).pathname);
  if (hostPage) await installBrowserAuthFixture(client, base, authOptions);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 950, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url });
  if (hostPage) await waitForVerifiedSmokeUser(client);
  return client;
}

async function testHomeNavigation() {
  const home = await openPage(base + '/moov-home/index.html?embed=1&lang=ko');
  await home.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await home.wait("typeof window.MOOVHome?.getState==='function'", 'standalone home boot');
  const originalStorage = await home.evaluate('Object.fromEntries(Object.entries(localStorage))');
  const landing = "state.homeStep==='mode' && !state.tripActive && !!document.querySelector('.home-mode-entry [data-action=\"select-home-mode\"][data-value=\"rent\"]')";
  await home.wait(landing, 'fresh home landing');
  assert.equal(await home.evaluate("!!document.querySelector('[data-action=\"select-home-mode\"][data-value=\"taxi\"]')"), true);
  await home.wait("[...document.querySelectorAll('.home-mode-card img')].every(image=>image.complete&&image.naturalWidth>0)", 'home service card images');
  await home.screenshot('home-landing-ko', false);
  assert.equal(await home.evaluate("!!document.querySelector('.home-promo-section .section-row .muted')"),false);
  passed('fresh standalone home shows taxi and rental choices without the recommended trips heading');

  await home.click('[data-action="select-home-mode"][data-value="rent"]');
  await home.wait("state.homeStep==='booking' && !!document.querySelector('#home-booking-map')", 'enter rental booking');
  await home.click('[data-tab="home"]');
  await home.wait(landing, 'rental booking back to home');
  assert.equal(await home.evaluate('state.rentalFlowStep'), 'setup');
  await home.click('[data-action="select-home-mode"][data-value="rent"]');
  await home.click('.home-logo');
  await home.wait(landing, 'logo back to home');
  passed('home navigation and logo leave inactive rental booking');

  await home.click('[data-action="select-home-mode"][data-value="rent"]');
  assert.equal(await home.evaluate('JSON.parse(localStorage.getItem(STORAGE_KEY)).homeStep'), 'booking');
  await home.reload();
  await home.wait(landing, 'saved booking reload opens landing');
  passed('reloading an inactive saved booking opens home landing');

  await home.click('[data-action="select-home-mode"][data-value="rent"]');
  await home.evaluate(`(() => {
    window.__homeSmokeApproach=naverRentalApproach;
    window.__homeSmokeVehicleRequest=rentalServices.requestVehicle;
    naverRentalApproach=async()=>({points:[[37.54,127.05],[37.5446,127.0557]],cumulative:[0,1000],totalMeters:1000,pickupSnap:{lat:37.5446,lng:127.0557,distanceMeters:0},durationMs:18000});
    rentalServices.requestVehicle=id=>new Promise(resolve=>window.__homeSmokeResolveVehicle=()=>resolve({id,plate:'DEMO',color:'화이트',battery:78}));
    void requestRentalVehicle();
  })()`);
  await home.wait("state.rentalFlowStep==='matching' && typeof window.__homeSmokeResolveVehicle==='function'", 'pending demo dispatch');
  const requestToken = await home.evaluate('rentalRequestToken');
  await home.click('[data-tab="home"]');
  await home.wait(landing, 'home cancels pending rental screen');
  assert.ok(await home.evaluate(`rentalRequestToken>${requestToken}`));
  await home.evaluate('window.__homeSmokeResolveVehicle();naverRentalApproach=window.__homeSmokeApproach;rentalServices.requestVehicle=window.__homeSmokeVehicleRequest;delete window.__homeSmokeResolveVehicle;delete window.__homeSmokeApproach;delete window.__homeSmokeVehicleRequest');
  await home.evaluate('Promise.resolve().then(()=>rentalTick())');
  assert.equal(await home.evaluate(landing), true);
  assert.equal(await home.evaluate('state.rentalFlowStep'), 'setup');
  assert.equal(await home.evaluate('state.rentalUX.dispatch.status'), 'idle');
  passed('late cancelled dispatch completion cannot reopen rental booking');

  await home.evaluate("state.tripActive=true;state.usageStartedAt=Date.now();state.rentalEndsAt=Date.now()+3*3600000;state.homeStep='service';state.rentalFlowStep='driving';state.rentalUX.dispatch={status:'driving'};persist();render()");
  const active = await home.evaluate('({startedAt:state.usageStartedAt,endsAt:state.rentalEndsAt,stops:state.routeStops})');
  await home.click('[data-tab="home"]');
  await home.click('.home-logo');
  assert.equal(await home.evaluate('state.tripActive'), true);
  assert.equal(await home.evaluate('state.rentalFlowStep'), 'driving');
  await home.reload();
  await home.wait("state.tripActive && state.homeStep==='service' && !!document.querySelector('#rental-driving-naver')", 'active rental restored after reload');
  assert.deepEqual(await home.evaluate('({startedAt:state.usageStartedAt,endsAt:state.rentalEndsAt,stops:state.routeStops})'), active);
  passed('active rental survives home, logo and reload without resetting the trip');

  // Retire the synthetic active session before testing the integrated host.
  await home.evaluate('state.tripActive=false;state.rentalEndsAt=null;state.usageStartedAt=null;destroy();localStorage.removeItem(STORAGE_KEY)');
  await home.send('Page.navigate', { url: 'about:blank' });
  const host = await openPage(base + '/moov.html?lang=ko');
  await host.wait("typeof state==='object' && typeof showScreen==='function'", 'integrated host boot');
  await host.evaluate("enterAuthenticatedScreen();state.tripActive=false;state.homeMode='rent';state.homeStep='mode';state.activeTab='home';render()");
  const frameLanding = "(()=>{const frame=document.querySelector('.moov-home-frame');const s=frame?.contentWindow?.MOOVHome?.getState();return s?.homeStep==='mode'&&!s.tripActive&&!!frame.contentDocument.querySelector('.home-mode-entry')})()";
  await host.wait(frameLanding, 'integrated iframe home landing');
  await host.evaluate("document.querySelector('.moov-home-frame').contentDocument.querySelector('[data-action=\"select-home-mode\"][data-value=\"rent\"]').click()");
  await host.wait("document.querySelector('.moov-home-frame')?.contentWindow?.MOOVHome?.getState().homeStep==='booking'", 'integrated rental booking');
  await host.click('[data-tab="home"]');
  await host.wait(frameLanding, 'host home button returns rental iframe to landing');
  passed('integrated host home button returns rental booking to the iframe landing');

  await host.evaluate("document.querySelector('.moov-home-frame').contentDocument.querySelector('[data-action=\"select-home-mode\"][data-value=\"taxi\"]').click()");
  await host.wait("state.homeMode==='taxi' && state.homeStep==='setup' && !!document.querySelector('#taxi-naver-map')", 'integrated taxi booking');
  await host.click('[data-tab="home"]');
  await host.wait(frameLanding, 'taxi back to iframe home landing');
  passed('integrated taxi booking returns to the iframe home landing');

  // These keys belong only to the fresh smoke-test profile.
  await host.evaluate(`(() => {for(const key of Object.keys(localStorage))localStorage.removeItem(key);for(const [key,value] of Object.entries(${JSON.stringify(originalStorage)}))localStorage.setItem(key,value)})()`);
  await host.send('Page.navigate', { url: 'about:blank' });
}


async function selectSearchedDestination(client, rental = false) {
  const named = process.argv.includes('--place-search');
  const query = named ? '스타벅스 성수역점' : '서울특별시 중구 세종대로 110';
  const expected = named ? '스타벅스 성수역점' : '세종대로';
  assert.equal(await client.evaluate("!!document.querySelector('.mobility-map .map-place-search')"),false);
  await client.evaluate(`(() => {
    const form=[...document.querySelectorAll('.route-location-form')].at(-1);
    const input=form.querySelector('input');input.value='';input.focus();
  })()`);
  await client.send('Input.insertText', { text: query });
  await client.wait("!![...document.querySelectorAll('.route-location-form')].at(-1)?.querySelector('.route-location-results button')", 'inline NAVER address search results');
  await client.screenshot(rental?'rental-location-search':'taxi-location-search');
  await client.evaluate("[...document.querySelectorAll('.route-location-form')].at(-1).querySelector('.route-location-results button').click()");
  if(rental){
    await client.wait(`state.rentalUX.route?.provider==='naver' && state.routeStops.at(-1).includes(${JSON.stringify(expected)})`, 'searched rental destination applied');
    const goal=await client.evaluate('JSON.stringify(state.rentalUX.route.stops.at(-1))');
    await client.wait(mapReady('#home-booking-map'), 'rental map after destination change');
    const previousPickup=await client.evaluate('JSON.stringify(state.rentalPickupCoords)');
    await client.dragMarker('#home-booking-map .home-pin.start');
    await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')", 'searched route pickup drag candidate');
    await client.click('.pickup-selection .primary-button');
    await client.wait(`JSON.stringify(state.rentalPickupCoords)!==${JSON.stringify(previousPickup)}`, 'rental native marker drag updates pickup');
    await client.wait("state.rentalUX.route?.provider==='naver'", 'rental route recalculated after drag');
    assert.equal(await client.evaluate('JSON.stringify(state.rentalUX.route.stops.at(-1))'),goal);
    await client.evaluate('render()');
    await client.wait("state.rentalUX.route?.provider==='naver'", 'rental route after redraw');
    assert.equal(await client.evaluate('JSON.stringify(state.rentalUX.route.stops.at(-1))'),goal);
  }else{
    await client.wait(`!!currentTaxiQuote() && state.routeStops.at(-1).includes(${JSON.stringify(expected)})`, 'searched taxi destination fare');
    const goal=await client.evaluate('JSON.stringify(state.taxiSearchPlaces[state.routeStops.at(-1)])');
    const pickup=await client.evaluate('JSON.stringify(state.taxiPickupCoords)');
    await client.dragMarker('#taxi-naver-map .taxi-map-marker.start');
    await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')", 'searched taxi pickup drag candidate');
    await client.click('.pickup-selection .primary-button');
    await client.wait(`JSON.stringify(state.taxiPickupCoords)!==${JSON.stringify(pickup)}`, 'taxi native marker drag updates pickup');
    await client.wait('!!currentTaxiQuote()', 'taxi fare recalculated after drag');
    assert.notEqual(await client.evaluate('JSON.stringify(state.taxiPickupCoords)'),pickup);
    assert.equal(await client.evaluate('JSON.stringify(state.taxiSearchPlaces[state.routeStops.at(-1)])'),goal);
  }
  passed((rental?'rental':'taxi')+' searches '+query+' and retains its destination when dragging pickup');
}

async function testPlaceNameSearch() {
  const rental=await openPage(base+'/moov-home/index.html?embed=1&lang=ko');
  await rental.wait("typeof state==='object' && typeof render==='function'",'rental boot');
  await rental.evaluate("clearInterval(ticker);state.homeStep='booking';state.rentalFlowStep='setup';state.tripActive=false;render()");
  await rental.wait("state.rentalUX.route?.provider==='naver'",'rental route ready');
  await selectSearchedDestination(rental,true);
  const taxi=await openPage(base+'/moov.html?lang=en');
  await taxi.evaluate("enterAuthenticatedScreen();state.activeTab='home';state.homeMode='taxi';state.homeStep='setup';state.tripActive=false;render()");
  await taxi.wait('!!currentTaxiQuote()','taxi route ready');
  await selectSearchedDestination(taxi,false);
}

async function testExistingMapSelection(client,rental) {
  const map=rental?'#home-booking-map':'#taxi-naver-map';
  const pickupMarker=map+(rental?' .home-pin.start':' .taxi-map-marker.start');
  const goalMarker=map+(rental?' .home-pin.goal':' .taxi-map-marker.goal');
  const coords=rental?'state.rentalPickupCoords':'state.taxiPickupCoords';
  const original=await client.evaluate(`JSON.stringify(${coords})`);
  await client.evaluate(`void(window.__selectionMap=${rental?'rentalMapView.native':'taxiMapSession.map'})`);
  await client.clickMap(pickupMarker,0.5,0.5);
  await client.wait("!!document.querySelector('.inplace-map-selection')", 'selection controls below existing map');
  assert.equal(await client.evaluate("document.querySelector('#modal').classList.contains('open')"),false);
  assert.equal(await client.evaluate(`window.__selectionMap===${rental?'rentalMapView.native':'taxiMapSession.map'}`),true);
  await client.clickMap(map,0.45,0.3);
  await client.wait("!document.querySelector('.inplace-map-selection .primary-button').disabled", 'selected point address');
  await client.screenshot(rental?'rental-existing-map-pickup':'taxi-existing-map-pickup');
  await client.click('.inplace-map-selection .pickup-cancel');
  assert.equal(await client.evaluate(`JSON.stringify(${coords})`),original);
  assert.equal(await client.evaluate("!!document.querySelector('.inplace-map-selection')"),false);
  await client.clickMap(pickupMarker,0.5,0.5);
  await client.clickMap(map,0.45,0.3);
  await client.wait("!document.querySelector('.inplace-map-selection .primary-button').disabled", 'new pickup ready');
  await client.click('.inplace-map-selection .primary-button');
  await client.wait(`JSON.stringify(${coords})!==${JSON.stringify(original)}`, 'existing map pickup applied');
  await client.wait(rental?"state.rentalUX.route?.provider==='naver'":"!!currentTaxiQuote()", 'updated road route');
  await client.wait(mapReady(map), 'existing map after pickup change');
  const goal=await client.evaluate('state.routeStops.at(-1)');
  await client.clickMap(goalMarker,0.5,0.5);
  await client.wait("!!document.querySelector('.inplace-map-selection')", 'destination selection on existing map');
  assert.equal(await client.evaluate("document.querySelector('#modal').classList.contains('open')"),false);
  await client.clickMap(map,0.45,0.3);
  await client.wait("!document.querySelector('.inplace-map-selection .primary-button').disabled", 'new destination ready');
  await client.click('.inplace-map-selection .primary-button');
  await client.wait(`state.routeStops.at(-1)!==${JSON.stringify(goal)}`, 'existing map destination applied');
  await client.wait(rental?"state.rentalUX.route?.provider==='naver'":"!!currentTaxiQuote()", 'destination road route and fare updated');
  assert.equal(await client.evaluate("!!document.querySelector('.inplace-map-selection')"),false);
  passed((rental?'rental':'taxi')+' selects pickup and destination on the existing map; cancel preserves route and no modal opens');
}

async function testRental() {
  const client = await openPage(base + '/moov-home/index.html?embed=1&lang=ko');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.wait("typeof state === 'object' && typeof render === 'function'", 'rental page boot');
  await client.evaluate("clearInterval(ticker);state.homeStep='booking';state.rentalFlowStep='setup';state.tripActive=false;render()");
  await client.wait(mapReady('#home-booking-map'), 'NAVER rental booking map');
  await client.wait("state.rentalUX.route?.provider==='naver'", 'rental road route from NAVER');
  await client.wait(mapReady('#home-booking-map'), 'rental map after road route redraw');
  assert.equal(await client.evaluate('rentalMapView.native instanceof naver.maps.Map'), true);
  assert.equal(await client.evaluate("!!document.querySelector('#home-booking-map .leaflet-pane')"), false);
  passed('rental booking map uses NAVER');
  passed('rental booking displays NAVER driving route');
  await client.screenshot('rental-booking');
  await selectSearchedDestination(client,true);

  await client.evaluate(`(() => {
    window.__smokeOriginalCalculateRoute = rentalServices.calculateRoute;
    window.__smokeRouteFailureCount = 0;
    rentalServices.calculateRoute = async (...args) => {
      if (window.__smokeRouteFailureCount++ === 0) throw new Error('Simulated route lookup failure');
      return window.__smokeOriginalCalculateRoute(...args);
    };
    state.rentalUX.route = calculateRentalRoute(ensureRentalRoute().stops);
    render();
  })()`);
  await client.wait("state.rentalUX.route?.routeError && !!document.querySelector('[data-action=\"retry-rental-route\"]')", 'rental failed route offers retry');
  assert.equal(await client.evaluate('window.__smokeRouteFailureCount'), 1);
  assert.notEqual(await client.evaluate('state.rentalUX.route.provider'), 'naver');
  assert.equal(await client.evaluate('state.rentalUX.route.distance'), null);
  assert.equal(await client.evaluate('state.rentalUX.route.minutes'), null);
  assert.equal(await client.evaluate('state.rentalUX.route.points.length'), 0);
  await client.evaluate('rentalServices.calculateRoute=window.__smokeOriginalCalculateRoute;delete window.__smokeOriginalCalculateRoute;delete window.__smokeRouteFailureCount');
  await client.click('[data-action="retry-rental-route"]');
  await client.wait("state.rentalUX.route?.provider==='naver' && !state.rentalUX.route.routeError", 'rental retry restores actual road route');
  await client.wait(mapReady('#home-booking-map'), 'rental map after route recovery');
  assert.equal(await client.evaluate("!!document.querySelector('[data-action=\"retry-rental-route\"]')"), false);
  passed('rental route lookup failure recovers through retry');

  const beforeHours = await client.evaluate('state.rentalHours');
  await client.click('[data-action="rent-plus"]');
  await client.wait(mapReady('#home-booking-map'), 'rental redraw after duration change');
  assert.equal(await client.evaluate('state.rentalHours'), beforeHours + 1);
  passed('rental map survives duration redraw');

  await testExistingMapSelection(client,true);

  await client.evaluate("applyPickupLocation('성수역 3번 출구',{lat:37.5446,lng:127.0557});rentalSetStep('pickup')");
  await client.wait(mapReady('#rental-pickup-naver'), 'rental dispatch pickup map');
  await client.click('[data-action="request-rent-flow"]');
  await client.wait("state.rentalFlowStep==='error'||!!state.rentalUX.dispatch.response", 'rental demo vehicle request');
  assert.notEqual(await client.evaluate('state.rentalFlowStep'), 'error', await client.evaluate('state.rentalUX.dispatch.message'));
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-2500;rentalTick()');
  assert.equal(await client.evaluate('state.rentalFlowStep'), 'assigned');
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-2000;rentalTick()');
  await client.wait(mapReady('#rental-approach-naver'), 'rental approach map');
  assert.equal(await client.evaluate('state.rentalUX.dispatch.approachRoute.strategy'), 'shortest-returned');
  assert.equal(await client.evaluate("document.querySelector('#rental-approach-naver .pickup-origin')?.textContent"), '출발');
  passed('rental approach selects the shortest NAVER candidate independently of the passenger course');
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-9000;rentalTick()');
  assert.ok(await client.evaluate('!!state.rentalUX.dispatch.position && state.rentalUX.dispatch.remainingMeters>0'));
  passed('rental vehicle approach updates position');
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-60000;rentalTick()');
  await client.wait("state.rentalFlowStep==='arrived'", 'rental arrival');
  await client.wait(mapReady('#rental-approach-naver'), 'rental arrival map');
  await client.click('[data-action="rental-boarded"]');
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-4000;rentalTick()');
  await client.wait(mapReady('#rental-driving-naver'), 'rental driving map');
  assert.equal(await client.evaluate('state.tripActive'), true);
  passed('rental arrived, boarded and driving maps');
  await client.screenshot('rental-driving');
  await client.evaluate("MoovI18n.setLanguage('en')");
  await client.wait("document.documentElement.lang==='en'", 'rental English language');
  await client.wait(mapReady('#rental-driving-naver'), 'rental driving map after English toggle');
  await client.wait("state.rentalUX.route?.provider==='naver'", 'rental driving road route after pickup and language changes');
  assert.equal(await client.evaluate('rentalMapView.native instanceof naver.maps.Map'), true);
  assert.equal(await client.evaluate('state.rentalUX.route.provider'), 'naver');
  passed('rental NAVER map persists after English toggle');
  await client.screenshot('rental-driving-en');
  await client.evaluate("MoovI18n.setLanguage('ko')");

  await client.click('[data-action="rental-search-destination"]');
  await client.wait(mapReady('#rux-route-preview-map'), 'rental course preview map');
  // Empty queries do not fabricate local search results.
  await client.wait("document.querySelector('#rux-route-results')?.textContent.length>0", 'rental course search guidance');
  await client.clickMap('#rux-route-preview-map');
  await client.wait("state.rentalUX.routeEdit?.status==='ready'||state.rentalUX.routeEdit?.status==='error'", 'course preview calculation');
  assert.equal(await client.evaluate('state.rentalUX.routeEdit.status'), 'ready');
  await client.click('[data-modal-cancel]');
  passed('rental course preview map click');
  return client;
}

async function testTaxi() {
  const client = await openPage(base + '/moov.html?lang=ko');
  await client.wait("typeof state === 'object' && typeof render === 'function' && typeof showScreen === 'function'", 'taxi page boot');
  await client.evaluate("enterAuthenticatedScreen();state.activeTab='home';state.homeMode='taxi';state.homeStep='setup';state.tripActive=false;render()");
  await client.wait(mapReady('#taxi-naver-map'), 'NAVER taxi map');
  await client.wait('!!taxiMapSession?.line', 'taxi road route from NAVER');
  assert.equal(await client.evaluate('taxiMapSession.map instanceof naver.maps.Map'), true);
  assert.equal(await client.evaluate("!!document.querySelector('#taxi-naver-map .leaflet-pane')"), false);
  passed('taxi booking map uses NAVER');
  passed('taxi booking displays NAVER driving route');
  await client.screenshot('taxi-booking');
  await client.evaluate("MoovI18n.setLanguage('en')");
  await client.wait("document.documentElement.lang==='en'", 'taxi English language');
  await client.wait(mapReady('#taxi-naver-map'), 'taxi map after English toggle');
  await client.wait("!!taxiMapSession?.line && document.querySelector('#taxi-map-status')?.textContent.includes('Driving')", 'taxi English route status');
  assert.equal(await client.evaluate('taxiMapSession.map instanceof naver.maps.Map'), true);
  passed('taxi NAVER map redraws with English route status');
  await client.screenshot('taxi-booking-en');

  await testExistingMapSelection(client,false);
  await client.evaluate('render()');
  await client.wait(mapReady('#taxi-naver-map'), 'taxi map after redraw');
  passed('taxi map survives redraw');
  await selectSearchedDestination(client);
  return client;
}

const controlStops = [
  { name: 'Control pickup', lat: 37.5446, lng: 127.0557 },
  { name: 'Control waypoint', lat: 37.5459, lng: 127.0579 },
  { name: 'Control destination', lat: 37.5485, lng: 127.0592 },
];

function routeControlPage(rental) {
  return {
    kind: rental ? 'rental' : 'taxi',
    map: rental ? '#home-booking-map' : '#taxi-naver-map',
    native: rental ? 'rentalMapView.native' : 'taxiMapSession.map',
    points: rental ? 'state.rentalUX.route.stops.map(({lat,lng})=>({lat,lng}))' : 'taxiMapSession.points.map(({lat,lng})=>({lat,lng}))',
    ready: rental ? "state.rentalUX.route?.provider==='naver' && !!rentalMapView?.native" : '!!currentTaxiQuote() && !!taxiMapSession?.line',
    locate: rental ? '.route-tools [data-action="locate-rental"]' : '.route-tools [data-action="locate-home"]',
  };
}

async function setControlRoute(client, rental, stops) {
  if (rental) await client.evaluate(`MOOVHome.setRoute(${JSON.stringify(stops)})`);
  else await client.evaluate(`(() => {
    const stops=${JSON.stringify(stops)};
    state.selectedCourse=null;state.routeStops=stops.map(p=>p.name);state.pickupLocation=stops[0].name;
    state.taxiPickupCoords={lat:stops[0].lat,lng:stops[0].lng};
    state.taxiSearchPlaces=Object.fromEntries(stops.slice(1).map(p=>[p.name,{lat:p.lat,lng:p.lng}]));
    state.locationReady=true;state.tripActive=false;state.activeTab='home';state.homeMode='taxi';state.homeStep='setup';render();
  })()`);
  const config = routeControlPage(rental);
  await client.wait(config.ready, config.kind + ' control route calculation');
  await client.wait(mapReady(config.map), config.kind + ' control map redraw');
  await delay(500);
}

async function assertRouteMarkersFit(client, rental) {
  const config = routeControlPage(rental);
  const layout = await client.evaluate(`(() => {
    const map=${config.native},rect=document.querySelector(${JSON.stringify(config.map)}).getBoundingClientRect();
    const selector=${JSON.stringify(config.map + (rental ? ' .home-pin' : ' .taxi-map-marker'))};
    return {zoom:map.getZoom(),width:rect.width,height:rect.height,markers:[...document.querySelectorAll(selector)].map(el=>{
      const r=el.getBoundingClientRect();return {left:r.left-rect.left,top:r.top-rect.top,right:r.right-rect.left,bottom:r.bottom-rect.top};
    })};
  })()`);
  assert.ok(layout.markers.length >= 2, config.kind + ' renders route markers');
  for (const marker of layout.markers) {
    assert.ok(marker.left >= -1 && marker.top >= -1 && marker.right <= layout.width + 1 && marker.bottom <= layout.height + 1,
      config.kind + ' route marker stays inside map: ' + JSON.stringify({ marker, layout }));
  }
  return layout.zoom;
}

async function testRouteControls(rental) {
  const config = routeControlPage(rental);
  const client = await openPage(base + (rental ? '/moov-home/index.html?embed=1&lang=ko' : '/moov.html?lang=ko'));
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.wait("typeof state==='object' && typeof render==='function'", config.kind + ' controls boot');
  if (rental) await client.evaluate('clearInterval(ticker);state.tripActive=false');
  else await client.evaluate('enterAuthenticatedScreen()');
  await setControlRoute(client, rental, controlStops);

  const fields = await client.evaluate(`(() => {
    const tools=document.querySelector('.route-tools'),planner=document.querySelector('.route-planner');
    return {sizes:[...planner.querySelectorAll('input')].map(input=>parseFloat(getComputedStyle(input).fontSize)),
      actions:tools.querySelectorAll('button').length,before:!!(tools.compareDocumentPosition(planner)&Node.DOCUMENT_POSITION_FOLLOWING),
      perFieldButtons:planner.querySelectorAll('.route-search-submit,.route-map-select').length};
  })()`);
  assert.equal(fields.sizes.length, 3);
  assert.ok(fields.sizes.every(size => size >= 16), 'route inputs retain readable mobile text');
  assert.equal(fields.perFieldButtons, 0);
  assert.equal(fields.actions, 3);
  assert.equal(fields.before, true, 'location and course buttons precede the route fields');
  passed(config.kind + ' has readable direct-search inputs and three visible tools above the route');

  const beforeLocation = await client.evaluate(config.points);
  const current = { latitude: 37.5435, longitude: 127.0550, accuracy: 12 };
  await client.evaluate(`MoovNaverMap.getCurrentPosition=success=>success({coords:${JSON.stringify(current)},timestamp:Date.now()})`);
  await client.click(config.locate);
  await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')", 'GPS pickup candidate ready');
  await client.click('.pickup-selection .primary-button');
  await client.wait(`Math.abs(${rental ? 'state.rentalPickupCoords' : 'state.taxiPickupCoords'}?.lat-${current.latitude})<1e-8`, config.kind + ' current location becomes pickup');
  await client.wait(config.ready, config.kind + ' current-location route refresh');
  const afterLocation = await client.evaluate(config.points);
  assert.deepEqual(afterLocation.slice(1), beforeLocation.slice(1));
  assert.equal(await client.evaluate("document.querySelector('#modal')?.classList.contains('open')||false"), false);
  passed(config.kind + ' current-location pickup confirmation preserves all other stops');

  await setControlRoute(client, rental, controlStops);
  for (const [index, kind] of ['start', 'waypoint', 'goal'].entries()) {
    const before = await client.evaluate(config.points);
    const selector = config.map + (rental ? ' .home-pin.' : ' .taxi-map-marker.') + kind;
    await client.dragMarker(selector);
    if(index===0){
      await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')", 'dragged pickup candidate ready');
      await client.click('.pickup-selection .primary-button');
    }
    await client.wait(`JSON.stringify((${config.points})[${index}])!==${JSON.stringify(JSON.stringify(before[index]))}`, config.kind + ' native ' + kind + ' drag changes its coordinate');
    await client.wait(config.ready, config.kind + ' route refresh after ' + kind + ' drag');
    const after = await client.evaluate(config.points);
    assert.equal(after.length, before.length);
    for (let other = 0; other < before.length; other++) if (other !== index) assert.deepEqual(after[other], before[other], kind + ' drag preserves stop ' + other);
    assert.equal(await client.evaluate("!!document.querySelector('.inplace-map-selection')"), false, 'drag finishes without a separate map selection step');
    passed(config.kind + ' native ' + kind + ' marker drag refreshes the route and preserves the other stops');
  }

  const closeStops = [controlStops[0], { name: 'Nearby destination', lat: 37.5457, lng: 127.0575 }];
  await setControlRoute(client, rental, closeStops);
  const closeZoom = await assertRouteMarkersFit(client, rental);
  await client.screenshot(config.kind + '-route-controls-close');
  await setControlRoute(client, rental, [controlStops[0], { name: 'Seoul City Hall', lat: 37.5664, lng: 126.9784 }]);
  const farZoom = await assertRouteMarkersFit(client, rental);
  assert.ok(closeZoom > farZoom, 'nearby route zooms in farther than a long route');
  passed(config.kind + ' fits both route markers and zooms with route distance', { closeZoom, farZoom });

  const beforePan = await client.evaluate(`JSON.stringify(${config.native}.getCenter())`);
  await client.panMap(config.map);
  await client.wait(`JSON.stringify(${config.native}.getCenter())!==${JSON.stringify(beforePan)}`, config.kind + ' desktop map pan');
  passed(config.kind + ' map pans with mouse drag');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await delay(300);
  const beforeExpand = await client.evaluate(config.native + '.getZoom()');
  await client.pinchMap(config.map, true);
  await client.wait(`${config.native}.getZoom()>${beforeExpand}`, config.kind + ' two-finger pinch expands map');
  const beforeContract = await client.evaluate(config.native + '.getZoom()');
  await client.pinchMap(config.map, false);
  await client.wait(`${config.native}.getZoom()<${beforeContract}`, config.kind + ' two-finger pinch contracts map');
  passed(config.kind + ' mobile two-finger pinch zooms in and out');

  await client.evaluate("MoovI18n.setLanguage('en')");
  await client.wait("document.documentElement.lang==='en'", config.kind + ' route controls English');
  await client.wait(config.ready, config.kind + ' English route refreshed');
  const english = await client.evaluate("({tools:document.querySelector('.route-tools').textContent,labels:[...document.querySelectorAll('.route-location-form')].map(f=>f.textContent)})");
  assert.equal(/[가-힣]/.test(english.tools), false, 'route tools have English labels');
  assert.equal(english.labels.some(label => /[가-힣]/.test(label)), false, 'route field labels have English text');
  await client.screenshot(config.kind + '-route-controls-en');
  passed(config.kind + ' route tools and field labels translate into English');
  if (process.argv.includes('--place-search')) await selectSearchedDestination(client, rental);
  if (!rental && !process.argv.includes('--pickup-only')) await testTaxiLocationRace(client);
  return client;
}

async function testPickupSelection(rental) {
  const client = await testRouteControls(rental), config = routeControlPage(rental);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await client.evaluate("MoovI18n.setLanguage('ko')");
  await setControlRoute(client, rental, controlStops);
  const before = await client.evaluate(config.points);
  const open = rental ? 'selectRentalPointOnMap(0)' : 'openMapPinPicker()';
  await client.evaluate(open);
  await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')", 'initial pickup description');
  await client.panMap(config.map);
  await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')", 'map center pickup description');
  assert.deepEqual(await client.evaluate(config.points), before, 'draft pan never commits the journey');
  const alignment = await client.evaluate(`(()=>{const m=document.querySelector(${JSON.stringify(config.map)}).getBoundingClientRect(),p=document.querySelector('.pickup-center-pin').getBoundingClientRect();return {x:p.left+p.width/2-m.left-m.width/2,y:p.bottom-m.top-m.height/2}})()`);
  assert.ok(Math.abs(alignment.x)<2 && Math.abs(alignment.y)<3, 'pickup pin stays fixed at screen center');
  await client.screenshot(config.kind+'-pickup-confirmation');
  await client.click('.pickup-cancel');
  assert.deepEqual(await client.evaluate(config.points), before, 'cancel preserves all journey stops');
  await client.evaluate(open);
  await client.panMap(config.map);
  await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')", 'new pickup description');
  const center = await client.evaluate(`(()=>{const p=${config.native}.getCenter();return {lat:p.lat(),lng:p.lng()}})()`);
  await client.click('.pickup-selection .primary-button');
  await client.wait(config.ready,'confirmed pickup road route');
  await client.wait(mapReady(config.map),'confirmed pickup map');
  const point = await client.evaluate(rental?'state.rentalPickupCoords':'state.taxiPickupCoords');
  assert.ok(Math.abs(point.lat-center.lat)<1e-7&&Math.abs(point.lng-center.lng)<1e-7,'confirmed pickup equals the pin coordinate');
  assert.deepEqual((await client.evaluate(config.points)).slice(1),before.slice(1));
  await assertRouteMarkersFit(client,rental);
  const confirmedPickup = JSON.stringify(point);
  await client.evaluate(`(()=>{const input=document.querySelector('.route-location-form[data-route-index="0"] input');input.value='어니언 성수';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await client.wait("!!document.querySelector('.route-location-form[data-route-index=\"0\"] .route-location-results button')",'pickup search result');
  await client.click('.route-location-form[data-route-index="0"] .route-location-results button');
  await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')",'searched pickup preview');
  assert.equal(await client.evaluate(`JSON.stringify(${rental?'state.rentalPickupCoords':'state.taxiPickupCoords'})`),confirmedPickup,'search result opens a draft without immediately changing pickup');
  assert.ok(await client.evaluate("document.querySelector('.pickup-place').textContent.length>0"));
  await client.click('.pickup-selection .primary-button');
  await client.wait(config.ready,'searched pickup route update');
  await client.wait(mapReady(config.map),'searched pickup map redraw');
  await assertRouteMarkersFit(client,rental);
  passed(config.kind+' pickup search result uses the same explicit confirmation flow');
  if(rental){
    await client.evaluate("rentalSetStep('pickup')");
    await client.wait(mapReady('#rental-pickup-naver'),'rental pickup confirmation route');
    assert.equal(await client.evaluate("document.querySelectorAll('#rental-pickup-naver .rux-map-marker').length"),3);
  }
  passed(config.kind+' center-pin draft, cancel, exact-coordinate confirmation and whole-route fit');
}

async function testPickupDragCancel(rental) {
  const client=await openPage(base+(rental?'/moov-home/index.html?embed=1&lang=ko':'/moov.html?lang=ko'));
  const config=routeControlPage(rental);
  await client.wait("typeof state==='object'&&typeof render==='function'",'pickup drag cancel boot');
  if(rental)await client.evaluate('clearInterval(ticker);state.tripActive=false');
  else await client.evaluate('enterAuthenticatedScreen()');
  await setControlRoute(client,rental,controlStops);
  const before=await client.evaluate(config.points);
  await client.dragMarker(config.map+(rental?' .home-pin.start':' .taxi-map-marker.start'));
  await client.wait("!!document.querySelector('.pickup-selection')",'drag opens pickup draft');
  await client.click('.pickup-cancel');
  assert.deepEqual(await client.evaluate(config.points),before);
  const position=await client.evaluate(rental?"[...rentalMapView._layers].find(x=>x.getElement?.().classList.contains('start')).getLatLng()":"(()=>{const p=taxiMapSession.markers[0].getPosition();return {lat:p.lat(),lng:p.lng()}})()");
  assert.equal(position.lat,controlStops[0].lat);assert.equal(position.lng,controlStops[0].lng);
  await client.dragMarker(config.map+(rental?' .home-pin.start':' .taxi-map-marker.start'));
  await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')",'dragged pickup ready');
  await client.click('.pickup-selection .primary-button');
  await client.wait(config.ready,'dragged pickup confirmed road route');
  assert.notDeepEqual((await client.evaluate(config.points))[0],before[0]);
  passed(config.kind+' dragged pickup cancel restores marker and confirmation commits the new point');
}

async function testNameOnlyRentalCourse(){
  const client=await openPage(base+'/moov-home/index.html?embed=1&lang=ko');
  await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await client.wait("typeof MOOVHome==='object'",'name-only rental course boot');
  await client.evaluate(`clearInterval(ticker);state.tripActive=false;MOOVHome.setRoute([
    {name:'서울특별시 성동구 성수동2가 289-36',lat:37.5446,lng:127.0557},
    {name:'숭례문',dwell:20},{name:'광화문',dwell:25},{name:'경복궁',dwell:40}
  ])`);
  await client.wait("state.rentalUX.route?.provider==='naver'||state.rentalUX.route?.routeError||state.rentalUX.route?.unresolved&&state.rentalUX.route?.locationLookupDone",'name-only stops resolved and driving route calculated',45000);
  assert.equal(await client.evaluate('state.rentalUX.route.provider'),'naver',JSON.stringify(await client.evaluate('state.rentalUX.route')));
  await client.wait(mapReady('#home-booking-map'),'name-only full route map');
  assert.equal(await client.evaluate("document.querySelectorAll('#home-booking-map .home-pin').length"),4);
  await assertRouteMarkersFit(client,true);
  assert.ok(await client.evaluate('state.rentalUX.route.points.length>2'));
  passed('name-only Sungnyemun, Gwanghwamun and Gyeongbokgung course resolves through NAVER and shows all four markers');
  await client.evaluate('selectRentalPointOnMap(0)');
  await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')",'same pickup confirmation ready');
  await client.click('.pickup-selection .primary-button');
  await client.wait("state.rentalUX.route?.provider==='naver'",'same pickup confirmation restores road route');
  await client.wait(mapReady('#home-booking-map'),'full route after pickup confirmation');
  await assertRouteMarkersFit(client,true);
  await client.screenshot('rental-confirmed-full-palace-route');
  passed('confirming the same pickup exits the close-up and fits the entire road route');
  const before=await client.evaluate('state.rentalUX.route.stops.map(({lat,lng})=>({lat,lng}))');
  await client.dragMarker('#home-booking-map .home-pin.waypoint');
  await client.wait('state.rentalUX.route?.provider===\'naver\' && state.rentalUX.route.stops[1].lat!=='+before[1].lat,'waypoint drag updates restored route');
  const after=await client.evaluate('state.rentalUX.route.stops.map(({lat,lng})=>({lat,lng}))');
  for(const i of [0,2,3])assert.deepEqual(after[i],before[i]);
  await client.panMap('#home-booking-map');
  await client.click('.route-overview');
  await assertRouteMarkersFit(client,true);
  await client.evaluate('selectRentalPointOnMap(0)');
  await client.click('.route-overview');
  assert.equal(await client.evaluate("!!document.querySelector('.pickup-selection')"),false);
  await assertRouteMarkersFit(client,true);
  passed('restored course waypoints remain draggable and full-route button restores all markers');
}

async function testTaxiLocationRace(existingClient) {
  const client = existingClient || await openPage(base + '/moov.html?lang=ko');
  await client.wait("typeof state==='object' && typeof render==='function'", 'taxi location-race boot');
  if (!existingClient) await client.evaluate('enterAuthenticatedScreen()');
  await setControlRoute(client, false, controlStops);
  const fixturePosition = { coords: { latitude: 37.5435, longitude: 127.0550, accuracy: 12 }, timestamp: Date.now() };
  await client.evaluate(`(() => {
    window.__locationRace={callbacks:[],reverseCalls:0,originalReverse:MoovNaverMap.describePoint,originalPosition:MoovNaverMap.getCurrentPosition};
    MoovNaverMap.getCurrentPosition=(success,error)=>window.__locationRace.callbacks.push({success,error});
    MoovNaverMap.describePoint=async point=>{window.__locationRace.reverseCalls++;return {...point,name:'Test pickup'}};
  })()`);
  try {
    await client.click('.route-tools [data-action="locate-home"]');
    const manual = { lat: 37.5449, lng: 127.0555 };
    await client.evaluate(`applyPickupLocation('Manual pickup after location request',${JSON.stringify(manual)})`);
    await client.evaluate(`(() => {const callback=window.__locationRace.callbacks[0];callback.success(${JSON.stringify(fixturePosition)});callback.error({code:1})})()`);
    await client.wait('!!currentTaxiQuote()', 'manual pickup route after stale geolocation');
    assert.deepEqual(await client.evaluate('state.taxiPickupCoords'), manual);
    assert.equal(await client.evaluate('window.__locationRace.reverseCalls'), 0, 'stale position does not start reverse-geocoding');
    assert.equal(await client.evaluate("document.querySelector('#modal')?.classList.contains('open')||false"), false, 'stale location error does not open permission modal');
    passed('taxi ignores delayed geolocation success and failure after a manual pickup change');

    await client.evaluate('MoovNaverMap.describePoint=()=>new Promise(resolve=>window.__locationRace.resolveReverse=resolve)');
    await client.click('.route-tools [data-action="locate-home"]');
    await client.evaluate(`window.__locationRace.callbacks[1].success(${JSON.stringify(fixturePosition)})`);
    await client.wait("typeof window.__locationRace.resolveReverse==='function'", 'deferred reverse-geocoding request started');
    const newerManual = { lat: 37.5452, lng: 127.0560 };
    await client.evaluate(`applyPickupLocation('Manual pickup during address lookup',${JSON.stringify(newerManual)})`);
    await client.evaluate("window.__locationRace.resolveReverse({lat:37.5435,lng:127.055,name:'Old candidate'});new Promise(resolve=>setTimeout(resolve,0))");
    await client.wait('!!currentTaxiQuote()', 'manual pickup route after stale address response');
    assert.deepEqual(await client.evaluate('state.taxiPickupCoords'), newerManual);
    assert.equal(await client.evaluate('state.pickupLocation'), 'Manual pickup during address lookup');
    assert.deepEqual(await client.evaluate('taxiMapSession.points.slice(1).map(({lat,lng})=>({lat,lng}))'), controlStops.slice(1).map(({lat,lng})=>({lat,lng})));
    passed('taxi ignores a delayed current-location address response after a newer manual pickup');
  } finally {
    await client.evaluate(`(() => {
      const fixture=window.__locationRace;MoovNaverMap.describePoint=fixture.originalReverse;
      MoovNaverMap.getCurrentPosition=fixture.originalPosition;
      delete window.__locationRace;
    })()`);
  }
}

async function testCourseRouteControls() {
  const host = await openPage(base + '/moov.html?lang=ko');
  await host.wait("typeof state==='object' && typeof render==='function'", 'course bridge host');
  const course = await host.evaluate(`(() => {
    enterAuthenticatedScreen();state.tripActive=false;state.homeMode='rent';state.homeStep='mode';state.activeTab='home';
    const course=baseCourses.find(c=>c.stops.every((_,index)=>Number.isFinite(MoovOutingData.pointForStop(c,index).lat)));
    state.savedCourseIds.add(course.id);state.outingQuery='';persist();render();return {id:course.id,stops:course.stops};
  })()`);
  const frame = "document.querySelector('.moov-home-frame')?.contentWindow";
  await host.wait(`!!${frame}?.MOOVHome`, 'course bridge rental iframe');
  await host.evaluate(`${frame}.MOOVHome.setRoute(${JSON.stringify(controlStops)})`);
  const pickup = await host.evaluate(`${frame}.MOOVHome.getState().rentalPickupCoords`);
  const assertRentalCourse = async description => {
    await host.wait(`state.activeTab==='home' && state.homeMode==='rent' && ${frame}?.MOOVHome?.getState().routeStops.length===${course.stops.length + 1}`, description);
    const stateAfter = await host.evaluate(`${frame}.MOOVHome.getState()`);
    assert.deepEqual(stateAfter.routeStops.slice(1), course.stops);
    assert.deepEqual(stateAfter.rentalPickupCoords, pickup);
  };
  for (const action of ['choose-saved-course', 'browse-courses-home']) {
    await host.evaluate(`${frame}.document.querySelector('.route-tools [data-action="${action}"]').click()`);
    await host.wait("state.activeTab==='outing'", 'rental course button enters host outing');
    if (action === 'choose-saved-course') assert.equal(await host.evaluate('state.outingSub'), 'interest');
    await host.wait(`!!document.querySelector('[data-action="follow-course"][data-value="${course.id}"]')`, 'host displays the saved test course');
    await host.click(`[data-action="follow-course"][data-value="${course.id}"]`);
    await assertRentalCourse('selected course returns to rental with all stops');
    passed('rental ' + action + ' connects to host courses, restores all stops and preserves pickup');
  }

  await setControlRoute(host, false, controlStops);
  await host.click('.route-tools [data-action="choose-saved-course"]');
  await host.wait(`state.activeTab==='outing'&&state.outingSub==='interest'&&!!document.querySelector('[data-action="follow-course"][data-value="${course.id}"]')`, 'taxi saved-course selection page');
  await host.click(`[data-action="follow-course"][data-value="${course.id}"]`);
  await host.wait('!!currentTaxiQuote()', 'taxi saved-course fare recalculated');
  assert.equal(await host.evaluate('state.homeMode'), 'taxi');
  assert.deepEqual(await host.evaluate('state.routeStops.slice(1)'), course.stops);
  passed('taxi saved-course selection keeps taxi mode and recalculates its route and fare');

  const taxiPickup = await host.evaluate('state.taxiPickupCoords');
  await host.click('.route-tools [data-action="browse-courses-home"]');
  await host.wait("state.activeTab==='outing'", 'taxi outing courses');
  await host.wait(`!!document.querySelector('[data-action="follow-course"][data-value="${course.id}"]')`, 'taxi outing course is available');
  await host.click(`[data-action="follow-course"][data-value="${course.id}"]`);
  await host.wait("state.activeTab==='home' && state.homeMode==='taxi' && !!currentTaxiQuote()", 'outing course returns to taxi with a current fare');
  assert.deepEqual(await host.evaluate('state.routeStops.slice(1)'), course.stops);
  assert.deepEqual(await host.evaluate('state.taxiPickupCoords'), taxiPickup);
  passed('taxi outing course returns to taxi mode with all stops and the same pickup');
}

async function testCourseReturnHistory(){
  await testCourseRouteControls();
  const host=await openPage(base+'/moov.html?lang=ko');
  await host.wait("typeof state==='object' && typeof render==='function'",'history course return boot');
  await host.evaluate("enterAuthenticatedScreen();state.tripActive=false;state.homeMode='rent';state.homeStep='mode';state.activeTab='home';state.outingSub='register';state.courseSource='history';render()");
  const frame="document.querySelector('.moov-home-frame')?.contentWindow";
  await host.wait(`!!${frame}?.MOOVHome`,'history rental iframe');
  await host.evaluate(`${frame}.MOOVHome.setRoute(${JSON.stringify(controlStops)});${frame}.eval('state.rentalHours=7;persist();render()')`);
  const before=await host.evaluate(`${frame}.MOOVHome.getState()`);
  await host.evaluate(`${frame}.document.querySelector('[data-action="browse-courses-home"]').click()`);
  await host.wait("state.activeTab==='outing' && !!document.querySelector('.course-selection-notice')",'rental selection context');
  assert.equal(await host.evaluate('state.outingSub'),'community','old registration subtab is not retained');
  await host.click('[data-action="outing-sub"][data-value="register"]');
  assert.equal(await host.evaluate("!!document.querySelector('#course-title')"),false,'booking selection does not open the course registration form');
  const history=await host.evaluate('historyRoutes[0]');
  await host.click(`[data-action="use-history-route"][data-value="${history.id}"]`);
  await host.wait(`state.activeTab==='home'&&${frame}?.MOOVHome?.getState().homeStep==='booking'&&JSON.stringify(${frame}.MOOVHome.getState().routeStops.slice(1))===${JSON.stringify(JSON.stringify(history.stops))}`,'history route applied directly to rental');
  const after=await host.evaluate(`${frame}.MOOVHome.getState()`);
  await host.wait(`${frame}?.MOOVHome?.getState().rentalUX.route?.provider==='naver'`,'selected history course draws the actual NAVER driving route',45000);
  assert.deepEqual(after.rentalPickupCoords,before.rentalPickupCoords);
  assert.equal(after.rentalHours,7);assert.equal(after.rentalVehicleType,before.rentalVehicleType);
  assert.deepEqual(after.rentalOptions,before.rentalOptions);
  assert.equal(await host.evaluate('pendingHomeCourse'),null,'course acknowledged before pending transfer is cleared');
  passed('history course returns directly to rental, draws NAVER route and preserves pickup, vehicle, hours and options');

  await host.evaluate(`${frame}.document.querySelector('[data-action="choose-saved-course"]').click()`);
  await host.wait("state.activeTab==='outing'&&state.outingSub==='interest'",'saved course selector');
  await host.click('[data-action="return-course-booking"]');
  await host.wait(`${frame}?.MOOVHome?.getState().homeStep==='booking'`,'cancel returns directly to booking');
  assert.deepEqual(await host.evaluate(`${frame}.MOOVHome.getState().routeStops`),after.routeStops);
  passed('return without changes restores rental booking and its previous course');

  await host.evaluate(`${frame}.document.querySelector('[data-action="browse-courses-home"]').click()`);
  await host.wait("state.activeTab==='outing'",'rental detail course selection');
  const detail=await host.evaluate(`(()=>{const course=baseCourses.find(c=>c.stops.every((_,i)=>Number.isFinite(MoovOutingData.pointForStop(c,i).lat)));openCourseDetail(course);return {id:course.id,stops:course.stops};})()`);
  await host.click('#modal-actions .primary-button');
  await host.wait(`${frame}?.MOOVHome?.getState().homeStep==='booking'&&JSON.stringify(${frame}.MOOVHome.getState().routeStops.slice(1))===${JSON.stringify(JSON.stringify(detail.stops))}`,'detail course applied');
  assert.equal(await host.evaluate("document.querySelector('#modal').classList.contains('open')"),false);
  await host.screenshot('rental-returned-from-selected-course',false);
  passed('course detail confirmation closes the modal and opens rental with the selected course');

  await host.evaluate("state.returnToHomeAfterCourse=false;state.outingSub='register';state.courseSource='history';setTab('outing')");
  await host.click(`[data-action="use-history-route"][data-value="${history.id}"]`);
  assert.equal(await host.evaluate('state.activeTab'),'outing');
  assert.equal(await host.evaluate('state.courseDraft.title'),history.name);
  assert.ok(await host.evaluate("!!document.querySelector('#course-title')"));
  passed('ordinary history import still edits a registration draft outside booking selection');
}

async function testTaxiSharedRoute(){
  const client=await openPage(base+'/moov.html?lang=ko');
  await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await client.wait("typeof state==='object'&&typeof render==='function'",'taxi shared route boot');
  await client.evaluate(`enterAuthenticatedScreen();state.tripActive=false;state.homeMode='taxi';state.homeStep='setup';state.activeTab='home';state.selectedCourse=null;state.taxiSearchPlaces={};state.taxiPickupCoords={lat:37.5446,lng:127.0557};state.pickupLocation='현재 위치 · 서울 성수동';state.routeStops=[state.pickupLocation,'한가람미술관','예술의전당 오페라하우스','서래마을'];render()`);
  await client.wait('!!currentTaxiQuote()','venue-name taxi route, duration and fare',45000);
  await client.wait(mapReady('#taxi-naver-map'),'venue-name taxi map');
  const estimate=await client.evaluate(`(async()=>{const route=await MoovNaverMap.directionsForStops(taxiMapSession.points);return {route,quote:currentTaxiQuote(),displayed:Number(document.querySelector('#taxi-fare-card [data-taxi-duration-seconds]').dataset.taxiDurationSeconds),text:document.querySelector('#taxi-fare-card').textContent}})()`);
  assert.ok(estimate.quote.total>0&&estimate.quote.durationSeconds>0);
  assert.equal(estimate.quote.distanceMeters,estimate.route.distanceMeters);assert.equal(estimate.quote.durationSeconds,estimate.route.durationSeconds);
  assert.equal(estimate.displayed,estimate.quote.durationSeconds);assert.match(estimate.text,/예상 소요시간/);
  assert.equal(await client.evaluate("document.querySelectorAll('#taxi-naver-map .taxi-map-marker').length"),4);
  await assertRouteMarkersFit(client,false);
  await client.screenshot('taxi-venue-route-time');
  await client.evaluate("document.querySelector('#taxi-fare-card').scrollIntoView({block:'center'})");
  await client.screenshot('taxi-venue-time-fare');
  passed('taxi resolves Opera House and all course venues, showing actual NAVER duration, distance and fare');

  await client.panMap('#taxi-naver-map');await client.click('[data-action="taxi-center-route"]');await assertRouteMarkersFit(client,false);
  await client.evaluate('openMapPinPicker()');await client.click('[data-action="taxi-center-route"]');
  assert.equal(await client.evaluate("!!document.querySelector('.pickup-selection')"),false);await assertRouteMarkersFit(client,false);
  passed('taxi full-route action restores all markers and exits pickup adjustment like rental');

  await client.evaluate("state.selectedCourse=null;state.routeStops=[state.pickupLocation,'한옥','서래마을'];render()");
  await client.wait("taxiFareState.status==='error'&&!!document.querySelector('.route-location-form[data-route-index=\"1\"] .route-location-results button')",'ambiguous place needs selection');
  assert.equal(await client.evaluate('currentTaxiQuote()'),null);
  assert.equal(await client.evaluate("document.querySelectorAll('#taxi-naver-map .taxi-map-marker').length"),2);
  await client.click('.route-location-form[data-route-index="1"] .route-location-results button');
  await client.wait("!!document.querySelector('.route-location-form[data-route-index=\"1\"] .route-location-results button')",'candidate place results');
  await client.click('.route-location-form[data-route-index="1"] .route-location-results button');
  await client.wait('!!currentTaxiQuote()','selected place restores taxi route and duration',45000);
  passed('ambiguous place never creates an invented fare and inline place selection restores calculation');
  await client.evaluate("MoovI18n.setLanguage('en')");
  await client.wait("!!currentTaxiQuote()&&document.querySelector('#taxi-fare-card').textContent.includes('Estimated travel time')",'English taxi duration');
  passed('taxi route duration and full-route button have English labels');
}

async function testNaverOnlyOuting() {
  const client = await openPage(base + '/moov.html?lang=ko');
  await client.wait("typeof state==='object' && typeof MoovCourseMap==='object'", 'outing NAVER module');
  await client.evaluate(`(() => {
    enterAuthenticatedScreen();state.tripActive=false;
    window.__testCourse={id:'naver-migration-course',name:'NAVER course',stops:['First stored place','Second stored place','Final stored place'],
      _dbPoints:[{latitude:37.5446,longitude:127.0557},{latitude:37.5459,longitude:127.0579},{latitude:37.5485,longitude:127.0592}],_dbTags:{category:[],mood:[]}};
    dbCourses=[window.__testCourse];state.outingQuery='';state.outingFilters={budget:100000};state.outingSort='latest';state.outingMapOpen=true;state.outingSub='community';setTab('outing');
  })()`);
  await client.wait("document.querySelector('#outing-naver-map')?.dataset.mapState==='ready'", 'NAVER outing overview');
  assert.equal(await client.evaluate("document.querySelectorAll('#outing-naver-map .naver-course-marker').length"), 3);
  assert.equal(await client.evaluate('typeof window.L'), 'undefined');
  assert.equal(await client.evaluate("document.querySelector('#outing-naver-map').dataset.mapProvider"), 'naver');
  await client.screenshot('outing-naver-overview');
  passed('outing overview uses NAVER with database place coordinates and no legacy SDK');

  await client.clickMap('.naver-course-marker', .5, .5);
  await client.wait("document.querySelector('#course-detail-naver-map')?.dataset.routeProvider==='naver'", 'NAVER course detail road route');
  await client.screenshot('outing-naver-detail');
  passed('course marker opens detail with the actual NAVER road route');

  await client.evaluate(`closeModal();window.__realDirections=MoovNaverMap.directions;MoovNaverMap.directions=async()=>{throw new Error('Test route unavailable')};openCourseDetail(window.__testCourse)`);
  await client.wait("document.querySelector('#course-detail-naver-map')?.dataset.mapState==='route-error'", 'course route failure');
  assert.equal(await client.evaluate("document.querySelector('#course-detail-naver-map').dataset.routeProvider||null"), null);
  await client.evaluate('MoovNaverMap.directions=window.__realDirections');
  await client.click('#modal .course-map-status button');
  await client.wait("document.querySelector('#course-detail-naver-map')?.dataset.routeProvider==='naver'", 'course route retry');
  passed('course route failure offers retry and never substitutes a local path');

  await client.evaluate(`closeModal();state.courseDraft={title:'NAVER preview',desc:'',stops:[{type:'경유지',name:baseCourses[0].stops[0],photo:null},{type:'목적지',name:baseCourses[0].stops[1],photo:null}]};previewCourse()`);
  await client.wait("document.querySelector('#course-detail-naver-map')?.dataset.routeProvider==='naver'", 'registered course preview');
  assert.equal(await client.evaluate("!!document.querySelector('#modal img[src*=\"map-seoul\"]')"), false);
  passed('registration preview uses NAVER instead of a fixed map image or invented path');

  await client.evaluate("closeModal();MoovI18n.setLanguage('en');openCourseDetail(window.__testCourse)");
  await client.wait("document.querySelector('#course-detail-naver-map')?.dataset.routeProvider==='naver'", 'English course map');
  assert.match(await client.evaluate("document.querySelector('#modal .course-map-status').textContent"), /Driving/);
  await client.evaluate("closeModal();setTab('home');setTab('profile');setTab('ai');setTab('space')");
  assert.equal(await client.evaluate("document.querySelectorAll('.course-map-status').length"), 0);
  passed('English course map and unrelated tab navigation work with map cleanup');
}

async function main() {
  assert.ok(fs.existsSync(executable), 'Microsoft Edge executable must exist (or set EDGE_PATH)');
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let launchError;
  browser.on('error', error => { launchError = error; });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 200 && !fs.existsSync(portFile); attempt++) {
    if (launchError) throw launchError;
    await delay(100);
  }
  assert.ok(fs.existsSync(portFile), 'Edge debugging port did not start');
  debuggingPort = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
  if(process.argv.includes('--map-location'))await require('./map_location_browser_checks.cjs')({openPage,base,mapReady,passed});
  else if(process.argv.includes('--login-survey'))await require('./login_survey_browser_checks.cjs')({openPage,base,passed});
  else if(process.argv.includes('--taxi-shared')){await testTaxiSharedRoute();await testCourseRouteControls();}
  else if(process.argv.includes('--course-return'))await testCourseReturnHistory();
  else if(process.argv.includes('--name-only-route'))await testNameOnlyRentalCourse();
  else if(process.argv.includes('--pickup-drag-cancel')){await testPickupDragCancel(true);await testPickupDragCancel(false);}
  else if(process.argv.includes('--pickup-only')){await testPickupSelection(true);await testPickupSelection(false);}
  else if(process.argv.includes('--outing-only'))await testNaverOnlyOuting();
  else if(process.argv.includes('--location-race'))await testTaxiLocationRace();
  else if(process.argv.includes('--route-controls')){
    if(!process.argv.includes('--taxi-only'))await testRouteControls(true);
    await testRouteControls(false);
    if(!process.argv.includes('--taxi-only'))await testCourseRouteControls();
  }
  else if(process.argv.includes('--place-search'))await testPlaceNameSearch();
  else {
    if(!process.argv.includes('--taxi-only')){
      await testHomeNavigation();
      await testRental();
    }
    await testTaxi();
    await testNaverOnlyOuting();
  }
  const legacyRequests = sessions.flatMap(client => client.requests).filter(url => /openstreetmap|unpkg\.com\/leaflet|\/moov-home\/(?:vendor\/leaflet|js\/(?:road-data|road-routing|local-map))|map-seoul\.jpg|ride-map\.jpg/i.test(url));
  assert.deepEqual(legacyRequests, [], 'No legacy map providers or assets requested');
  passed('all map traffic uses NAVER without legacy map assets');
  const exceptions = sessions.flatMap(client => client.exceptions);
  assert.deepEqual(exceptions, [], 'No uncaught JavaScript errors');
  passed('no uncaught JavaScript errors');
  fs.writeFileSync(path.join(artifactDir, 'results.json'), JSON.stringify({ checks, exceptions }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: checks.length, artifacts: artifactDir }));
}

main().catch(async error => {
  const diagnostics = [];
  for (let index = 0; index < sessions.length; index++) {
    try { await sessions[index].screenshot('failure-' + index); } catch {}
    try { diagnostics.push(await sessions[index].diagnostics()); }
    catch { diagnostics.push({ session: index, unavailable: true }); }
  }
  const exceptions = sessions.flatMap(client => client.exceptions);
  fs.writeFileSync(path.join(artifactDir, 'results.json'), JSON.stringify({ checks, error: error.message, exceptions, diagnostics }, null, 2));
  console.error(JSON.stringify({ ok: false, error: error.message, exceptions, diagnostics, artifacts: artifactDir }));
  process.exitCode = 1;
}).finally(async () => {
  try { if (sessions.length) await sessions.at(-1).send('Browser.close'); } catch {}
  for (const client of sessions) client.socket.close();
  if (browser && browser.exitCode == null) browser.kill();
});
