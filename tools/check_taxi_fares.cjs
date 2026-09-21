/* Isolated browser checks for the workbook taxi fare policy.
 * Run: node tools/check_taxi_fares.cjs [http://localhost:3000]
 * Uses a fresh Edge profile and demo bookings; never reads project credentials.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { installBrowserAuthFixture, waitForVerifiedSmokeUser } = require('./browser_auth_fixture.cjs');

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moov-taxi-fares-'));
const executable = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
let browser, client;

// Independent oracle: hundredths of KRW per km, rounded once at the final won.
const rates = {
  small: { base: 3223, included: 1600, rate100: 67150 },
  medium: { base: 4080, included: 1600, rate100: 85000 },
  large: { base: 5950, included: 3000, rate100: 112625 },
};
const vehicleClasses = { standard: 'small', easyfit: 'medium', family: 'large', premium: 'large', barrierfree: 'large' };
function expectedFare(vehicleId, distanceMeters) {
  const rate = rates[vehicleClasses[vehicleId]];
  return Math.floor((rate.base * 100000 + Math.max(0, distanceMeters - rate.included) * rate.rate100 + 50000) / 100000);
}
function passed(name, details) {
  checks.push({ name, ok: true, ...(details ? { details } : {}) });
  console.log('PASS ' + name);
}

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
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result || {});
      } else if (message.method === 'Runtime.executionContextsCleared') this.contextEpoch++;
      else if (message.method === 'Runtime.exceptionThrown') {
        const detail = message.params.exceptionDetails;
        this.exceptions.push({ message: detail.exception?.description || detail.text, source: detail.url ? new URL(detail.url, base).pathname : '', line: detail.lineNumber });
      }
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Browser connection closed'));
      }
      this.pending.clear();
    });
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('Browser connection failed')), { once: true });
    });
    return new CDP(socket);
  }
  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 35000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
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
      const element=document.querySelector(${JSON.stringify(selector)});
      if(!element || element.disabled) throw new Error('Missing or disabled action: '+${JSON.stringify(selector)});
      element.click();
    })()`);
  }
  async input(selector, value) {
    await this.evaluate(`(() => {
      const element=document.querySelector(${JSON.stringify(selector)});
      if(!element) throw new Error('Missing input');
      element.value=${JSON.stringify(value)};
      element.dispatchEvent(new Event('input',{bubbles:true}));
      element.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
  }
  async screenshot(name, focusSelector) {
    if (focusSelector) await this.evaluate(`document.querySelector(${JSON.stringify(focusSelector)})?.scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(220); // Let the 180 ms modal open/close transition finish.
    await this.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, name + '.png'), Buffer.from(result.data, 'base64'));
  }
  async reload() {
    const epoch = this.contextEpoch;
    await this.send('Page.reload', { ignoreCache: true });
    const until = Date.now() + 10000;
    while (this.contextEpoch === epoch && Date.now() < until) await delay(50);
    assert.notEqual(this.contextEpoch, epoch, 'Reload creates a fresh page context');
    await this.wait("document.readyState==='complete' && typeof state==='object' && typeof currentTaxiQuote==='function'", 'fare page after reload');
    await waitForVerifiedSmokeUser(this);
  }
  async diagnostics() {
    return this.evaluate(`(() => ({
      path:location.pathname, readyState:document.readyState, language:document.documentElement.lang,
      fareEngine:typeof window.MoovTaxiFare, mapConstructor:typeof window.naver?.maps?.Map,
      fareStatus:typeof taxiFareState==='object'?{status:taxiFareState.status,error:taxiFareState.error,hasQuote:!!taxiFareState.quote}:null,
      mapStatus:document.querySelector('#taxi-map-status')?.textContent,
      fareCard:document.querySelector('#taxi-fare-card')?.textContent.slice(0,600),
      modalTitle:document.querySelector('#modal-title')?.textContent,
      calculatorError:document.querySelector('#taxi-calculator-error')?.textContent,
      tripActive:typeof state==='object'?state.tripActive:null,
      receiptCount:typeof state==='object'?state.taxiReceipts?.length:null,
    }))()`);
  }
}

async function quote() {
  await client.wait("taxiFareState.status==='ready' && !!currentTaxiQuote()", 'valid route fare quote');
  const result = await client.evaluate('currentTaxiQuote()');
  assert.equal(result.total, expectedFare(result.vehicleId, result.distanceMeters));
  assert.ok(result.distanceMeters > 0);
  return result;
}
async function closeModal() {
  await client.evaluate("if(modal.classList.contains('open'))closeModal()");
}
async function checkVehicleSelector(vehicleId, language = 'ko') {
  await client.wait("!!document.querySelector('.taxi-vehicle-picker .taxi-vehicle-hero img') && !!document.querySelector('.taxi-vehicle-details h3')", 'rental-style taxi selector');
  await client.wait("(()=>{const image=document.querySelector('.taxi-vehicle-hero img');return image?.complete && image.naturalWidth>0})()", 'selected taxi hero image');
  const result = await client.evaluate(`(() => {
    const vehicle=MoovTaxiFare.vehicles.find(item=>item.id===${JSON.stringify(vehicleId)});
    const picker=document.querySelector('.taxi-vehicle-picker');
    const image=picker.querySelector('.taxi-vehicle-hero img');
    const details=picker.querySelector('.taxi-vehicle-details');
    const list=picker.querySelector('.taxi-vehicle-list');
    const content=document.querySelector('#app-content');
    return {
      expectedTitle:${JSON.stringify(language)}==='en'?vehicle.nameEn:vehicle.name,
      title:details.querySelector('h3').textContent.trim(),
      imagePath:new URL(image.currentSrc||image.src,location.href).pathname,
      expectedImagePath:new URL(vehicle.image,location.href).pathname,
      selected:[...picker.querySelectorAll('.taxi-vehicle-choice[aria-pressed="true"]')].map(button=>button.dataset.value),
      text:picker.textContent,
      width:window.innerWidth,
      overflow:{document:document.documentElement.scrollWidth-window.innerWidth,
        content:content.scrollWidth-content.clientWidth,
        picker:picker.scrollWidth-picker.clientWidth,
        details:details.scrollWidth-details.clientWidth},
      horizontalList:!!list && getComputedStyle(list).overflowX==='auto',
    };
  })()`);
  assert.ok(result.title.includes(result.expectedTitle), 'Selected taxi title matches its vehicle');
  assert.equal(result.imagePath, result.expectedImagePath, 'Selected taxi hero matches its vehicle');
  assert.deepEqual(result.selected, [vehicleId]);
  assert.equal(result.width, 390);
  for (const [area, overflow] of Object.entries(result.overflow)) assert.ok(overflow <= 1, `${area} overflows the mobile width by ${overflow}px`);
  assert.equal(result.horizontalList, true, 'Taxi thumbnails use a horizontal scroller');
  if (language === 'en') assert.equal(/[가-힣]/.test(result.text), false, 'Taxi selector is translated into English');
}

async function checkPolicyAndCalculator() {
  const cases = [];
  for (const vehicleId of Object.keys(vehicleClasses)) {
    for (const distanceMeters of [0, 1, 1599, 1600, 1601, 2000, 2999, 3000, 3001, 5500, 12345]) cases.push({ vehicleId, distanceMeters });
  }
  const results = await client.evaluate(`(${JSON.stringify(cases)}).map(value=>MoovTaxiFare.calculate(value))`);
  results.forEach((result, index) => {
    const sample = cases[index];
    assert.equal(result.total, expectedFare(sample.vehicleId, sample.distanceMeters), `${sample.vehicleId} at ${sample.distanceMeters} m`);
    assert.equal(result.fareClass, vehicleClasses[sample.vehicleId]);
    assert.ok(Number.isInteger(result.total));
  });
  passed('workbook rates and included-distance boundaries for all five vehicles', { cases: cases.length });
  const invalid = await client.evaluate(`[-1,0.5,NaN,Infinity,10000001].map(distanceMeters=>{
    try{MoovTaxiFare.calculate({vehicleId:'standard',distanceMeters});return false;}catch{return true;}
  })`);
  assert.ok(invalid.every(Boolean));
  passed('fare engine rejects invalid, noninteger and excessive distances');

  await client.click('[data-action="taxi-fare-calculator"]');
  await client.wait("!!document.querySelector('#taxi-fare-distance')", 'manual calculator');
  for (const distanceMeters of [1600, 1601, 3000, 3001, 12345]) {
    await client.input('#taxi-fare-distance', String(distanceMeters / 1000));
    await client.wait("document.querySelectorAll('#taxi-calculator-results [data-taxi-calculator-vehicle][data-taxi-total]').length===5", 'calculator results for all vehicles');
    const rows = await client.evaluate("[...document.querySelectorAll('#taxi-calculator-results [data-taxi-calculator-vehicle]')].map(row=>({vehicleId:row.dataset.taxiCalculatorVehicle,total:Number(row.dataset.taxiTotal)}))");
    for (const row of rows) assert.equal(row.total, expectedFare(row.vehicleId, distanceMeters));
  }
  passed('manual calculator matches policy on both sides of included-distance boundaries');
  for (const input of ['', '-1', '0', 'abc', '1.6009']) {
    await client.input('#taxi-fare-distance', input);
    await client.wait("!!document.querySelector('#taxi-calculator-error')?.textContent.trim()", 'manual calculator validation');
    assert.equal(await client.evaluate("document.querySelectorAll('#taxi-calculator-results [data-taxi-total]').length"), 0);
  }
  passed('manual calculator rejects empty, negative, zero, nonnumeric and fractional-meter input');
  await client.input('#taxi-fare-distance', '12.345');
  await client.wait("document.querySelectorAll('#taxi-calculator-results [data-taxi-total]').length===5", 'calculator restored after invalid input');
  await client.screenshot('taxi-calculator-ko', '#taxi-fare-distance');
  await closeModal();
}

async function checkQuotesAndLanguage() {
  for (const vehicleId of Object.keys(vehicleClasses)) {
    await client.click(`[data-action="taxi-vehicle"][data-value="${vehicleId}"]`);
    const current = await quote();
    assert.equal(current.vehicleId, vehicleId);
    await checkVehicleSelector(vehicleId);
    const amount = await client.evaluate("document.querySelector('#taxi-fare-card [data-taxi-fare-total]')?.textContent");
    assert.ok(amount && Number(amount.replace(/[^0-9]/g, '')) === current.total, 'Displayed quote matches selected vehicle');
  }
  passed('actual NAVER route produces correct fare for all vehicle classes');
  passed('all five taxi selections update hero, title and pressed thumbnail without mobile overflow');
  await client.click('[data-action="taxi-vehicle"][data-value="standard"]');
  const korean = await quote();
  await checkVehicleSelector('standard');
  await client.screenshot('taxi-selector-ko', '.taxi-vehicle-picker');
  await client.screenshot('taxi-booking-ko', '#taxi-fare-card');
  await client.evaluate("MoovI18n.setLanguage('en')");
  await client.wait("document.documentElement.lang==='en'", 'English UI');
  const english = await quote();
  assert.equal(english.total, korean.total);
  const englishText = await client.evaluate("document.querySelector('#taxi-fare-card').textContent");
  assert.ok(/[A-Za-z]/.test(englishText));
  assert.equal(/[가-힣]/.test(englishText), false, 'Fare card contains no leftover Korean labels');
  await checkVehicleSelector('standard', 'en');
  passed('taxi selector is translated and fits the English mobile layout');
  passed('English fare card preserves identical amount');
  await client.screenshot('taxi-selector-en', '.taxi-vehicle-picker');
  await client.screenshot('taxi-booking-en', '#taxi-fare-card');
  await client.click('[data-action="taxi-fare-calculator"]');
  await client.input('#taxi-fare-distance', '3.001');
  await client.wait("document.querySelectorAll('#taxi-calculator-results [data-taxi-total]').length===5", 'English calculator results');
  assert.equal(await client.evaluate("/[가-힣]/.test(document.querySelector('#modal-body').textContent)"), false);
  await client.screenshot('taxi-calculator-en', '#taxi-fare-distance');
  await closeModal();
  passed('manual calculator is translated into English');
  await client.evaluate("MoovI18n.setLanguage('ko')");
  await quote();
}

async function checkAsyncAndFailure() {
  await client.evaluate(`(() => {
    window.__fareSmokeDirections = MoovNaverMap.directions;
    MoovNaverMap.directions = () => new Promise(resolve => {
      window.__fareSmokeResolveOld = () => resolve({distanceMeters:99999,durationSeconds:9999,points:[[37.5446,127.0557],[37.5104,126.996]]});
    });
    state.taxiPickupCoords={lat:37.5451,lng:127.0555};
    state.pickupLocation='테스트 픽업 A';state.routeStops[0]=state.pickupLocation;
    render();
  })()`);
  await client.wait("typeof window.__fareSmokeResolveOld==='function' && taxiFareState.status==='loading'", 'deferred route lookup');
  assert.equal(await client.evaluate('currentTaxiQuote()'), null);
  assert.equal(await client.evaluate("document.querySelector('#taxi-book-button').disabled"), true);
  await client.evaluate("document.querySelector('#taxi-book-button').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
  assert.equal(await client.evaluate('state.tripActive'), false);
  assert.equal(await client.evaluate("modal.classList.contains('open')"), false, 'Booking is guarded while quote is pending');
  passed('booking is blocked until a current route quote exists');

  await client.evaluate('MoovNaverMap.directions=window.__fareSmokeDirections');
  await client.click('[data-action="taxi-vehicle"][data-value="family"]');
  const latest = await quote();
  assert.equal(latest.vehicleId, 'family');
  await client.evaluate('window.__fareSmokeResolveOld();delete window.__fareSmokeResolveOld');
  await delay(150);
  assert.deepEqual(await client.evaluate('currentTaxiQuote()'), latest);
  passed('late route response cannot replace a newer vehicle quote');

  await client.evaluate("MoovNaverMap.directions=async()=>{throw new Error('Simulated route failure')};state.taxiPickupCoords={lat:37.5452,lng:127.0554};state.pickupLocation='테스트 픽업 B';state.routeStops[0]=state.pickupLocation;render()");
  await client.wait("taxiFareState.status==='error' && !!document.querySelector('[data-action=\"retry-taxi-fare\"]')", 'route failure with retry');
  assert.equal(await client.evaluate('currentTaxiQuote()'), null);
  assert.equal(await client.evaluate("document.querySelector('#taxi-book-button').disabled"), true);
  await client.evaluate('MoovNaverMap.directions=window.__fareSmokeDirections;delete window.__fareSmokeDirections');
  await client.click('[data-action="retry-taxi-fare"]');
  await quote();
  assert.equal(await client.evaluate("document.querySelector('#taxi-book-button').disabled"), false);
  passed('route failure disables booking and retry restores the quote');

  await client.evaluate(`(() => {
    window.__fareSmokeDirections = MoovNaverMap.directions;
    MoovNaverMap.directions = async () => ({distanceMeters:1600.5,durationSeconds:600,points:[[37.5446,127.0557],[37.5104,126.996]]});
    render();
  })()`);
  await client.wait("taxiFareState.status==='error'", 'fractional-meter upstream route is rejected');
  assert.equal(await client.evaluate('currentTaxiQuote()'), null);
  assert.equal(await client.evaluate("document.querySelector('#taxi-book-button').disabled"), true);
  await client.evaluate('MoovNaverMap.directions=window.__fareSmokeDirections;delete window.__fareSmokeDirections');
  await client.click('[data-action="retry-taxi-fare"]');
  await quote();
  passed('invalid upstream distance cannot be silently rounded into a fare');

  await client.evaluate("window.__fareSmokeReady=MoovNaverMap.ready;MoovNaverMap.ready=async()=>{throw new Error('Simulated map unavailable')};render()");
  await client.wait("taxiFareState.status==='error'", 'map service unavailable');
  await client.click('[data-action="taxi-fare-calculator"]');
  await client.input('#taxi-fare-distance', '5.5');
  await client.wait("document.querySelectorAll('#taxi-calculator-results [data-taxi-total]').length===5", 'calculator works without map');
  const noMapRows = await client.evaluate("[...document.querySelectorAll('#taxi-calculator-results [data-taxi-calculator-vehicle]')].map(row=>({vehicleId:row.dataset.taxiCalculatorVehicle,total:Number(row.dataset.taxiTotal)}))");
  for (const row of noMapRows) assert.equal(row.total, expectedFare(row.vehicleId, 5500));
  await closeModal();
  assert.equal(await client.evaluate("document.querySelector('#taxi-book-button').disabled"), true);
  await client.evaluate('MoovNaverMap.ready=window.__fareSmokeReady;delete window.__fareSmokeReady');
  await client.click('[data-action="retry-taxi-fare"]');
  await quote();
  passed('manual calculator remains usable while the map is unavailable');
}

async function checkBookingAndReceipt() {
  await client.click('[data-action="taxi-vehicle"][data-value="easyfit"]');
  const booked = await quote();
  await client.click('#taxi-book-button');
  await client.wait("modal.classList.contains('open') && !!document.querySelector('[data-modal-confirm]')", 'booking review');
  const reviewText = await client.evaluate("document.querySelector('#modal-body').textContent");
  assert.ok(reviewText.includes(booked.total.toLocaleString('en-US')), 'Booking review shows the calculated quote');
  await client.screenshot('taxi-booking-detail', '#modal-title');
  await client.click('[data-modal-confirm]');
  await client.wait('state.tripActive && !!state.taxiTrip', 'demo booking snapshot');
  const snapshot = await client.evaluate('state.taxiTrip');
  assert.equal(snapshot.quote.total, booked.total);
  assert.equal(snapshot.quote.vehicleId, 'easyfit');
  assert.equal(snapshot.simulated, true);
  assert.equal(await client.evaluate('currentUsageFee()'), booked.total);
  await client.wait("!!document.querySelector('#taxi-active-fare')", 'active trip fare');
  await client.screenshot('taxi-active-ko', '#taxi-active-fare');
  passed('booking stores the reviewed fare as a trip snapshot');

  await client.evaluate("state.usageStartedAt=Date.now()-12*3600000;state.taxiVehicleType='premium';state.routeStops=['서울 성수동','서울숲'];persist();render();updateUsageTimer()");
  assert.equal(await client.evaluate('currentUsageFee()'), booked.total);
  assert.deepEqual(await client.evaluate('state.taxiTrip'), snapshot);
  passed('elapsed time and later selection changes cannot alter the booked fare');
  await client.reload();
  await client.evaluate("enterAuthenticatedScreen();state.activeTab='home';state.homeMode='taxi';render()");
  assert.equal(await client.evaluate('state.tripActive'), true);
  assert.deepEqual(await client.evaluate('state.taxiTrip'), snapshot);
  assert.equal(await client.evaluate('currentUsageFee()'), booked.total);
  passed('booked fare snapshot survives reload');

  const beforeCount = await client.evaluate('state.taxiReceipts.length');
  await client.click('[data-action="finish-trip"]');
  await client.click('[data-modal-confirm]');
  await client.wait(`!state.tripActive && state.taxiReceipts.length===${beforeCount + 1}`, 'completed demo trip receipt', 12000);
  const receipt = await client.evaluate('state.taxiReceipts[0]');
  assert.equal(receipt.id, snapshot.id, 'Receipt is tied to the booked trip');
  assert.equal(receipt.quote.total, booked.total, 'Receipt retains the booked fare');
  assert.equal(receipt.quote.vehicleId, snapshot.quote.vehicleId);
  assert.deepEqual(receipt.stops, snapshot.stops);
  assert.equal(receipt.simulated, true);
  assert.equal(receipt.charged, false, 'Demo receipt never claims a real charge');
  await client.evaluate("completeSecureCleanup('taxi');completeSecureCleanup('taxi')");
  assert.equal(await client.evaluate('state.taxiReceipts.length'), beforeCount + 1);
  assert.deepEqual(await client.evaluate('state.taxiReceipts[0]'), receipt);
  passed('trip completion creates exactly one receipt for the booked amount');
  await closeModal();
  await client.evaluate("state.profileView='usage';setTab('profile')");
  await client.wait("!!document.querySelector('[data-action=\"taxi-receipt\"]')", 'receipt in usage history');
  await client.click('[data-action="taxi-receipt"]');
  await client.screenshot('taxi-receipt-ko', '#modal-title');
  assert.ok((await client.evaluate("document.querySelector('#modal-body').textContent")).includes(booked.total.toLocaleString('en-US')));
  await closeModal();
  await client.evaluate("MoovI18n.setLanguage('en');render()");
  await client.click('[data-action="taxi-receipt"]');
  await client.screenshot('taxi-receipt-en', '#modal-title');
  assert.match(await client.evaluate("document.querySelector('#modal-title').textContent"), /receipt/i);
  assert.match(await client.evaluate("document.querySelector('#modal-body').textContent"), /fare|distance|total/i);
  passed('receipt is accessible in Korean and English usage history');
  await closeModal();
  await client.reload();
  assert.equal(await client.evaluate('state.taxiReceipts.length'), beforeCount + 1);
  assert.deepEqual(await client.evaluate('state.taxiReceipts[0]'), receipt);
  passed('completed receipt survives reload without duplication');
}

async function main() {
  assert.ok(fs.existsSync(executable), 'Microsoft Edge is required (or set EDGE_PATH)');
  const profile = path.join(artifactDir, 'profile');
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let launchError;
  browser.on('error', error => { launchError = error; });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 200 && !fs.existsSync(portFile); attempt++) {
    if (launchError) throw launchError;
    await delay(100);
  }
  assert.ok(fs.existsSync(portFile), 'Edge debugging port did not start');
  const debuggingPort = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
  const target = await (await fetch(`http://127.0.0.1:${debuggingPort}/json/new?about:blank`, { method: 'PUT' })).json();
  client = await CDP.connect(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await installBrowserAuthFixture(client, base);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url: base + '/moov.html?lang=ko' });
  await client.wait("typeof state==='object' && typeof currentTaxiQuote==='function' && !!window.MoovTaxiFare", 'taxi fare UI boot');
  await waitForVerifiedSmokeUser(client);
  await client.evaluate("enterAuthenticatedScreen();state.paymentCards=[{id:'card-smoke',name:'Smoke Test Card',number:'•••• 4242',primary:true}];state.activeTab='home';state.homeMode='taxi';state.homeStep='setup';state.tripActive=false;persist();render()");
  await quote();
  await checkPolicyAndCalculator();
  await checkQuotesAndLanguage();
  await checkAsyncAndFailure();
  await checkBookingAndReceipt();
  assert.deepEqual(client.exceptions, [], 'No uncaught JavaScript errors');
  passed('no uncaught JavaScript errors');
  fs.writeFileSync(path.join(artifactDir, 'results.json'), JSON.stringify({ checks, exceptions: client.exceptions }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: checks.length, artifacts: artifactDir }));
}

main().catch(async error => {
  let diagnostics;
  if (client) {
    try { await client.screenshot('failure'); } catch {}
    try { diagnostics = await client.diagnostics(); } catch {}
  }
  const result = { ok: false, checks, error: error.message, exceptions: client?.exceptions || [], diagnostics, artifacts: artifactDir };
  fs.writeFileSync(path.join(artifactDir, 'results.json'), JSON.stringify(result, null, 2));
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}).finally(async () => {
  try { if (client) await client.send('Browser.close'); } catch {}
  client?.socket.close();
  if (browser && browser.exitCode == null) browser.kill();
});
