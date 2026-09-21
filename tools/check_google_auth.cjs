/* Isolated browser regression for the Google session gate.
 * Run: node tools/check_google_auth.cjs [http://localhost:3000]
 * Auth endpoints are intercepted in a fresh Edge profile. No real Google account,
 * OAuth redirect, project credentials, payment, or production session is used.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moov-google-auth-'));
const executable = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const users = {
  a: { id: 'google:test-a', name: 'Auth Test Alpha', email: 'alpha@example.test', picture: '' },
  b: { id: 'google:test-b', name: 'Auth Test Beta', email: 'beta@example.test', picture: '' },
};
const accountKey = user => 'moov-app-v3:' + encodeURIComponent(user.id);
const checks = [];
let browser, client;
function passed(name) { checks.push({ name, ok: true }); console.log('PASS ' + name); }

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.exceptions = [];
    this.contextEpoch = 0;
    this.onRequest = null;
    this.interceptionErrors = [];
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
      } else if (message.method === 'Fetch.requestPaused') {
        Promise.resolve(this.onRequest?.(message.params)).catch(error => this.interceptionErrors.push(error.message));
      }
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(new Error('Browser connection closed')); }
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
  async wait(expression, description, timeout = 15000) {
    const until = Date.now() + timeout;
    let lastError;
    while (Date.now() < until) {
      try { if (await this.evaluate(expression)) return; } catch (error) { lastError = error; }
      await delay(80);
    }
    throw new Error('Timed out: ' + description + (lastError ? ' (' + lastError.message + ')' : ''));
  }
  async click(selector) {
    await this.evaluate(`(() => {const element=document.querySelector(${JSON.stringify(selector)});if(!element||element.disabled)throw new Error('Missing or disabled action');element.click()})()`);
  }
  async screenshot(name) {
    await delay(250);
    await this.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, name + '.png'), Buffer.from(result.data, 'base64'));
  }
  async navigate(query = '?lang=ko') {
    const epoch = this.contextEpoch;
    await this.send('Page.navigate', { url: base + '/moov.html' + query });
    const until = Date.now() + 10000;
    while (this.contextEpoch === epoch && Date.now() < until) await delay(40);
    await this.wait("document.readyState==='complete' && !!window.MoovGoogleAuth && typeof state==='object'", 'auth page bootstrap');
  }
  async settled() { await this.wait("MoovGoogleAuth.getStatus().phase!=='checking'", 'server session decision'); }
  async signedOut() {
    await this.settled();
    await this.wait("document.querySelector('#login')?.classList.contains('screen-active')", 'login screen');
    assert.equal(await this.evaluate('state.isAuthenticated'), false, 'Local app state cannot authenticate an anonymous server session');
    assert.equal(await this.evaluate("document.querySelector('#app')?.classList.contains('screen-active')"), false);
  }
  async signedIn(user) {
    await this.settled();
    await this.wait(`state.isAuthenticated && state.userId===${JSON.stringify(user.id)} && document.querySelector('#app')?.classList.contains('screen-active')`, 'authenticated app');
    assert.equal(await this.evaluate('MoovGoogleAuth.getStatus().user.id'), user.id);
  }
  async diagnostics() {
    return this.evaluate(`(() => ({path:location.pathname,readyState:document.readyState,language:document.documentElement.lang,
      activeScreens:[...document.querySelectorAll('.screen-active')].map(el=>el.id),
      status:document.querySelector('#google-auth-status')?.textContent,
      state:document.querySelector('#google-auth-status')?.dataset.state,
      buttonDisabled:document.querySelector('#google-login-button')?.disabled,
      authenticated:typeof state==='object'?state.isAuthenticated:null,
      authPhase:window.MoovGoogleAuth?.getStatus().phase}))()`);
  }
}

// All mutable mocks and request inspection remain in this Node test process.
const mock = { configured: true, user: null, configStatus: 200, meStatus: 200, logoutStatus: 200, requests: [], held: [], holdNextMe: false };
async function respond(requestId, status, data, html = false) {
  await client.send('Fetch.fulfillRequest', {
    requestId, responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: html ? 'text/html; charset=utf-8' : 'application/json' }, { name: 'Cache-Control', value: 'no-store' }],
    body: Buffer.from(html ? data : JSON.stringify(data)).toString('base64'),
  });
}
async function intercept({ requestId, request }) {
  const pathname = new URL(request.url).pathname;
  mock.requests.push({ path: pathname, method: request.method });
  if (pathname === '/api/auth/config') return respond(requestId, mock.configStatus, { configured: mock.configured, loginUrl: '/api/auth/google/start' });
  if (pathname === '/api/auth/me') {
    const body = { authenticated: !!mock.user, user: mock.user ? { ...mock.user } : null };
    if (mock.holdNextMe) { mock.holdNextMe = false; mock.held.push(() => respond(requestId, mock.meStatus, body)); return; }
    return respond(requestId, mock.meStatus, body);
  }
  if (pathname === '/api/auth/logout') {
    assert.equal(request.method, 'POST', 'Logout must use POST');
    if (mock.logoutStatus === 200) mock.user = null;
    return respond(requestId, mock.logoutStatus, { ok: mock.logoutStatus === 200 });
  }
  if (pathname === '/api/auth/google/start') {
    return respond(requestId, 200, '<!doctype html><title>Intercepted OAuth start</title><p id="intercepted-start">No external sign-in was performed.</p>', true);
  }
  throw new Error('Unexpected auth endpoint: ' + pathname);
}
async function retry() { await client.evaluate('MoovGoogleAuth.retry()'); await client.settled(); }
async function waitHeld() {
  for (let attempt = 0; attempt < 100 && !mock.held.length; attempt++) await delay(50);
  assert.equal(mock.held.length, 1, 'Expected one held server session response');
}

async function checkLogin() {
  mock.holdNextMe = true;
  await client.navigate();
  await waitHeld();
  assert.equal(await client.evaluate('state.isAuthenticated'), false);
  await client.click('[data-action="skip-splash"]');
  assert.equal(await client.evaluate("document.querySelector('#app').classList.contains('screen-active')"), false);
  assert.equal(await client.evaluate("document.querySelector('#google-login-button').disabled"), true);
  await mock.held.shift()();
  await client.signedOut();
  passed('stale local authentication and splash skip cannot bypass the pending server session');
  assert.equal(await client.evaluate("!!document.querySelector('#login-form, #user-password, #user-name, #username, input[type=password]')"), false, 'Username/password demo sign-in is removed');
  assert.equal(await client.evaluate("document.querySelector('#google-login-button').disabled"), false);
  assert.match(await client.evaluate("document.querySelector('#google-login-label').textContent"), /Google.*로그인/);
  assert.equal(await client.evaluate('document.documentElement.scrollWidth>window.innerWidth+1'), false);
  await client.screenshot('google-login-ko');
  await client.evaluate("MoovI18n.setLanguage('en')");
  await client.wait("document.querySelector('#google-login-label').textContent==='Sign in with Google'", 'English Google sign-in');
  const englishText = await client.evaluate("(()=>{const copy=document.querySelector('#login').cloneNode(true);copy.querySelector('.language-switch')?.remove();return copy.textContent})()");
  assert.equal(/[가-힣]/.test(englishText), false, 'English login contains no untranslated Korean');
  await client.screenshot('google-login-en');
  passed('Google-only login renders in Korean and English at mobile width');

  mock.configured = false;
  await retry();
  await client.signedOut();
  assert.equal(await client.evaluate("document.querySelector('#google-login-button').disabled"), true);
  assert.equal(await client.evaluate("document.querySelector('#google-auth-status').dataset.state"), 'unconfigured');
  assert.equal(await client.evaluate("document.querySelector('#google-auth-retry').hidden"), false);
  const before = mock.requests.filter(request => request.path === '/api/auth/google/start').length;
  await client.evaluate('MoovGoogleAuth.start()');
  assert.equal(mock.requests.filter(request => request.path === '/api/auth/google/start').length, before);
  mock.configured = true;
  await client.click('#google-auth-retry');
  await client.settled();
  assert.equal(await client.evaluate("document.querySelector('#google-login-button').disabled"), false);
  passed('missing server configuration disables sign-in and retry recovers');

  for (const field of ['meStatus', 'configStatus']) {
    mock[field] = 503;
    await retry();
    await client.signedOut();
    assert.equal(await client.evaluate("document.querySelector('#google-auth-status').dataset.state"), 'unavailable');
    assert.equal(await client.evaluate("document.querySelector('#google-auth-retry').hidden"), false);
    mock[field] = 200;
    await client.click('#google-auth-retry');
    await client.signedOut();
  }
  passed('session and configuration outages show recoverable errors without granting access');

  for (const [code, expected] of [['cancelled', 'cancelled'], ['invalid_state', 'failed']]) {
    await client.navigate('?lang=en&auth_error=' + code);
    await client.signedOut();
    assert.equal(await client.evaluate("document.querySelector('#google-auth-status').dataset.state"), expected);
    assert.equal(await client.evaluate("new URLSearchParams(location.search).has('auth_error')"), false, 'Callback error is removed from the address bar');
    await client.click('#google-auth-retry');
    await client.settled();
    assert.equal(await client.evaluate("document.querySelector('#google-auth-status').dataset.state"), 'signedout');
  }
  passed('cancelled and failed callback messages are displayed and retry clears them');
}

async function checkAccounts() {
  mock.user = users.a;
  await retry();
  await client.signedIn(users.a);
  assert.equal(await client.evaluate("state.paymentCards.some(card=>card.id==='legacy-shared-card')"), false, 'Legacy shared cards are not imported into the verified account');
  assert.notEqual(await client.evaluate('state.theme'), 'Legacy Shared Theme');
  await client.evaluate("state.profileView='menu';setTab('profile')");
  await client.wait(`document.querySelector('.profile-card h3')?.textContent.includes(${JSON.stringify(users.a.name)})`, 'Google account name in profile');
  await client.screenshot('google-signed-in');
  passed('a verified server user opens the app and supplies the profile identity');
  await client.evaluate("void(window.__authContentBeforeRetry=document.querySelector('#app-content').firstElementChild)");
  await retry();
  await client.signedIn(users.a);
  assert.equal(await client.evaluate("window.__authContentBeforeRetry===document.querySelector('#app-content').firstElementChild"), true, 'Rechecking the same account preserves the current app DOM');
  await client.evaluate('delete window.__authContentBeforeRetry');
  passed('rechecking the same verified account preserves the existing app content');

  await client.evaluate(`state.theme='Auth Test Alpha Theme';state.paymentCards=[{id:'auth-test-alpha-card',name:'Alpha Test Card',number:'•••• 1111',primary:true}];persist()`);
  const stored = await client.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(accountKey(users.a))}))`);
  assert.ok(stored, 'Account A state is persisted under its Google id');
  assert.equal(stored.paymentCards[0].id, 'auth-test-alpha-card');
  await client.navigate('?lang=en');
  await client.signedIn(users.a);
  assert.equal(await client.evaluate('state.paymentCards[0].id'), 'auth-test-alpha-card');
  passed('account preferences survive reload only after server identity verification');

  mock.user = users.b;
  await retry();
  await client.signedIn(users.b);
  assert.equal(await client.evaluate("state.paymentCards.some(card=>card.id==='auth-test-alpha-card')"), false);
  assert.notEqual(await client.evaluate('state.theme'), 'Auth Test Alpha Theme');
  await client.evaluate("state.theme='Auth Test Beta Theme';state.paymentCards=[{id:'auth-test-beta-card',name:'Beta Test Card',number:'•••• 2222',primary:true}];persist()");
  assert.equal(await client.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(accountKey(users.a))})).paymentCards[0].id`), 'auth-test-alpha-card');
  assert.equal(await client.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(accountKey(users.b))})).paymentCards[0].id`), 'auth-test-beta-card');
  mock.user = users.a;
  await retry();
  await client.signedIn(users.a);
  assert.equal(await client.evaluate('state.theme'), 'Auth Test Alpha Theme');
  assert.equal(await client.evaluate('state.paymentCards[0].id'), 'auth-test-alpha-card');
  passed('account A and B keep separate preferences and payment-card snapshots');

  mock.holdNextMe = true;
  await client.evaluate('void MoovGoogleAuth.retry()');
  await waitHeld();
  mock.user = users.b;
  await retry();
  await client.signedIn(users.b);
  await mock.held.shift()();
  await delay(150);
  await client.signedIn(users.b);
  assert.equal(await client.evaluate('state.paymentCards[0].id'), 'auth-test-beta-card');
  passed('a stale session response cannot restore the previous account');

  mock.meStatus = 503;
  await retry();
  await client.signedOut();
  assert.equal(await client.evaluate("document.querySelector('#google-auth-status').dataset.state"), 'unavailable');
  mock.meStatus = 200;
  await retry();
  await client.signedIn(users.b);
  passed('an unavailable session recheck removes access despite a previously valid local account');

  await client.evaluate("state.profileView='menu';setTab('profile')");
  mock.holdNextMe = true;
  await client.evaluate('void MoovGoogleAuth.retry()');
  await waitHeld();
  mock.logoutStatus = 503;
  await client.click('[data-action="logout"]');
  await client.wait('!MoovGoogleAuth.getStatus().busy', 'failed logout completion');
  assert.equal(await client.evaluate('MoovGoogleAuth.getStatus().phase'), 'authenticated', 'Failed logout restores the authenticated phase while an older check is pending');
  await client.signedIn(users.b);
  assert.equal(await client.evaluate("document.querySelector('[data-action=logout]').disabled"), false);
  await mock.held.shift()();
  await delay(150);
  await client.signedIn(users.b);
  passed('failed logout during a pending session recheck restores the authenticated phase');
  mock.logoutStatus = 200;
  await client.click('[data-action="logout"]');
  await client.signedOut();
  assert.ok(mock.requests.some(request => request.path === '/api/auth/logout' && request.method === 'POST'));
  await client.navigate('?lang=en');
  await client.signedOut();
  passed('logout uses POST, survives reload, and a failed logout remains retryable');

  await client.click('#google-login-button');
  await client.wait("!!document.querySelector('#intercepted-start')", 'intercepted OAuth start');
  assert.equal(await client.evaluate('location.pathname'), '/api/auth/google/start');
  passed('Google sign-in starts at the same-origin server endpoint without visiting Google');
}

async function main() {
  assert.ok(fs.existsSync(executable), 'Microsoft Edge is required (or set EDGE_PATH)');
  const profile = path.join(artifactDir, 'profile');
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let launchError;
  browser.on('error', error => { launchError = error; });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 200 && !fs.existsSync(portFile); attempt++) { if (launchError) throw launchError; await delay(100); }
  assert.ok(fs.existsSync(portFile), 'Edge debugging port did not start');
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  client = await CDP.connect(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  client.onRequest = intercept;
  await client.send('Fetch.enable', { patterns: [{ urlPattern: new URL(base).origin + '/api/auth/*', requestStage: 'Request' }] });
  const stale = { isAuthenticated: true, username: 'Stale Local Login', userId: users.a.id, theme: 'Legacy Shared Theme', paymentCards: [{ id: 'legacy-shared-card', name: 'Legacy Test Card', number: '•••• 9999', primary: true }] };
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `if(location.origin===${JSON.stringify(new URL(base).origin)}&&!sessionStorage.getItem('auth-check-seeded')){sessionStorage.setItem('auth-check-seeded','1');localStorage.setItem('moov-app-v2',${JSON.stringify(JSON.stringify(stale))});localStorage.setItem(${JSON.stringify(accountKey(users.a))},${JSON.stringify(JSON.stringify({ isAuthenticated: true, userId: users.a.id }))})}` });
  await checkLogin();
  await checkAccounts();
  assert.deepEqual(client.interceptionErrors, [], 'All fake auth endpoints were fulfilled successfully');
  assert.deepEqual(client.exceptions, [], 'No uncaught JavaScript errors');
  passed('no uncaught JavaScript errors or interception failures');
  fs.writeFileSync(path.join(artifactDir, 'results.json'), JSON.stringify({ checks, exceptions: client.exceptions, authRequests: mock.requests }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: checks.length, artifacts: artifactDir }));
}

main().catch(async error => {
  let diagnostics;
  if (client) { try { await client.screenshot('failure'); } catch {} try { diagnostics = await client.diagnostics(); } catch {} }
  const result = { ok: false, checks, error: error.message, exceptions: client?.exceptions || [], interceptionErrors: client?.interceptionErrors || [], diagnostics, artifacts: artifactDir };
  fs.writeFileSync(path.join(artifactDir, 'results.json'), JSON.stringify(result, null, 2));
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}).finally(async () => {
  try { if (client) await client.send('Browser.close'); } catch {}
  client?.socket.close();
  if (browser && browser.exitCode == null) browser.kill();
});
