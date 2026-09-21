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
      } else if (message.method === 'Runtime.executionContextsCleared') this.contextEpoch++;
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
  async clickMap(selector) {
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(150);
    const point = await this.evaluate(`(() => {
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: rect.left + rect.width * 0.7, y: rect.top + rect.height * 0.58 };
    })()`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
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
      const elements = [...document.querySelectorAll('.rental-osm-map,#taxi-naver-map,#taxi-pickup-map')];
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

async function openPage(url) {
  const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/new?about:blank`, { method: 'PUT' });
  const target = await response.json();
  const client = await CDP.connect(target.webSocketDebuggerUrl);
  sessions.push(client);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  const hostPage = ['/', '/moov.html', '/index.html'].includes(new URL(url).pathname);
  if (hostPage) await installBrowserAuthFixture(client, base);
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
  passed('fresh standalone home shows taxi and rental choices');

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
  await home.wait("state.tripActive && state.homeStep==='service' && !!document.querySelector('#rental-driving-osm')", 'active rental restored after reload');
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

async function testRental() {
  const client = await openPage(base + '/moov-home/index.html?embed=1&lang=ko');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.wait("typeof state === 'object' && typeof render === 'function'", 'rental page boot');
  await client.evaluate("clearInterval(ticker);state.homeStep='booking';state.rentalFlowStep='setup';state.tripActive=false;render()");
  await client.wait(mapReady('#home-booking-map'), 'NAVER rental booking map');
  await client.wait("state.rentalUX.route?.provider==='naver'", 'rental road route from NAVER');
  await client.wait(mapReady('#home-booking-map'), 'rental map after road route redraw');
  assert.equal(await client.evaluate('rentalLeafletMap.native instanceof naver.maps.Map'), true);
  assert.equal(await client.evaluate("!!document.querySelector('#home-booking-map .leaflet-pane')"), false);
  passed('rental booking map uses NAVER');
  passed('rental booking displays NAVER driving route');
  await client.screenshot('rental-booking');

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

  const original = await client.evaluate('({...state.rentalPickupCoords})');
  await client.click('[data-action="open-pin-picker"]');
  await client.wait(mapReady('#rental-picker-osm'), 'rental pickup map');
  await client.clickMap('#rental-picker-osm');
  await client.wait(`!!state.rentalUX.draftPickup && (Math.abs(state.rentalUX.draftPickup.lat-${original.lat})>0.00001 || Math.abs(state.rentalUX.draftPickup.lng-${original.lng})>0.00001)`, 'rental map click updates draft');
  await client.click('[data-modal-cancel]');
  assert.deepEqual(await client.evaluate('({...state.rentalPickupCoords})'), original);
  passed('rental pickup map click and cancel preserve saved pickup');

  await client.click('[data-action="open-pin-picker"]');
  await client.wait(mapReady('#rental-picker-osm'), 'rental pickup map reopened');
  await client.clickMap('#rental-picker-osm');
  await client.wait(`!!state.rentalUX.draftPickup && (Math.abs(state.rentalUX.draftPickup.lat-${original.lat})>0.00001 || Math.abs(state.rentalUX.draftPickup.lng-${original.lng})>0.00001)`, 'rental new pickup draft');
  const candidate = await client.evaluate('({lat:state.rentalUX.draftPickup.lat,lng:state.rentalUX.draftPickup.lng})');
  await client.click('[data-modal-confirm]');
  await client.wait(mapReady('#home-booking-map'), 'rental map after confirming pickup');
  assert.deepEqual(await client.evaluate('({...state.rentalPickupCoords})'), candidate);
  passed('rental pickup confirmation updates map');

  await client.evaluate("applyPickupLocation('성수역 3번 출구',{lat:37.5446,lng:127.0557});rentalSetStep('pickup')");
  await client.wait(mapReady('#rental-pickup-osm'), 'rental dispatch pickup map');
  await client.click('[data-action="request-rent-flow"]');
  await client.wait("state.rentalFlowStep==='error'||!!state.rentalUX.dispatch.response", 'rental demo vehicle request');
  assert.notEqual(await client.evaluate('state.rentalFlowStep'), 'error', await client.evaluate('state.rentalUX.dispatch.message'));
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-2500;rentalTick()');
  assert.equal(await client.evaluate('state.rentalFlowStep'), 'assigned');
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-2000;rentalTick()');
  await client.wait(mapReady('#rental-approach-osm'), 'rental approach map');
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-9000;rentalTick()');
  assert.ok(await client.evaluate('!!state.rentalUX.dispatch.position && state.rentalUX.dispatch.remainingMeters>0'));
  passed('rental vehicle approach updates position');
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-60000;rentalTick()');
  await client.wait("state.rentalFlowStep==='arrived'", 'rental arrival');
  await client.wait(mapReady('#rental-approach-osm'), 'rental arrival map');
  await client.click('[data-action="rental-boarded"]');
  await client.evaluate('state.rentalUX.dispatch.enteredAt=Date.now()-4000;rentalTick()');
  await client.wait(mapReady('#rental-driving-osm'), 'rental driving map');
  assert.equal(await client.evaluate('state.tripActive'), true);
  passed('rental arrived, boarded and driving maps');
  await client.screenshot('rental-driving');
  await client.evaluate("MoovI18n.setLanguage('en')");
  await client.wait("document.documentElement.lang==='en'", 'rental English language');
  await client.wait(mapReady('#rental-driving-osm'), 'rental driving map after English toggle');
  assert.equal(await client.evaluate('rentalLeafletMap.native instanceof naver.maps.Map'), true);
  assert.equal(await client.evaluate('state.rentalUX.route.provider'), 'naver');
  passed('rental NAVER map persists after English toggle');
  await client.screenshot('rental-driving-en');
  await client.evaluate("MoovI18n.setLanguage('ko')");

  await client.click('[data-action="rental-search-destination"]');
  await client.wait(mapReady('#rux-route-preview-map'), 'rental course preview map');
  // Wait for the asynchronous results above the map before scrolling on mobile.
  await client.wait("!!document.querySelector('#rux-route-results button')", 'rental course search results');
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

  const original = await client.evaluate('JSON.stringify({name:state.pickupLocation,coords:state.taxiPickupCoords})');
  await client.click('[data-action="open-pin-picker"]');
  await client.wait(mapReady('#taxi-pickup-map'), 'taxi pickup map');
  await client.clickMap('#taxi-pickup-map');
  await delay(250);
  const actionSelectors = await client.evaluate(`({
    cancel:document.querySelector('[data-modal-cancel]')?'[data-modal-cancel]':document.querySelector('#modal-actions .ghost-button')?'#modal-actions .ghost-button':null,
    confirm:document.querySelector('[data-modal-confirm]')?'[data-modal-confirm]':document.querySelector('#modal-actions .primary-button')?'#modal-actions .primary-button':null
  })`);
  assert.ok(actionSelectors.cancel, 'Taxi modal cancel button exists');
  await client.click(actionSelectors.cancel);
  assert.equal(await client.evaluate('JSON.stringify({name:state.pickupLocation,coords:state.taxiPickupCoords})'), original);
  passed('taxi pickup map click and cancel preserve saved pickup');

  await client.click('[data-action="open-pin-picker"]');
  await client.wait(mapReady('#taxi-pickup-map'), 'taxi pickup reopened');
  await client.clickMap('#taxi-pickup-map');
  await client.wait('!!taxiPickupSession?.ready && taxiPickupSession.request > 1', 'taxi selected pickup address');
  assert.ok(actionSelectors.confirm, 'Taxi modal confirm button exists');
  await client.click(actionSelectors.confirm);
  await client.wait(mapReady('#taxi-naver-map'), 'taxi map after pickup confirmation');
  assert.notEqual(await client.evaluate('JSON.stringify({name:state.pickupLocation,coords:state.taxiPickupCoords})'), original);
  passed('taxi pickup confirmation updates map');
  await client.evaluate('render()');
  await client.wait(mapReady('#taxi-naver-map'), 'taxi map after redraw');
  passed('taxi map survives redraw');
  return client;
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
  await testHomeNavigation();
  await testRental();
  await testTaxi();
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
