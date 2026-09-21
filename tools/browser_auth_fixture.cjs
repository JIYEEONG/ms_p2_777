/* Browser-test-only auth transport. No production script, cookie or credential is changed. */
const assert = require('node:assert/strict');

const smokeUser = Object.freeze({
  id: 'google:smoke-user', name: 'MOOV Smoke Test', email: 'smoke@example.test', picture: '',
});

async function installBrowserAuthFixture(client, base) {
  const origin = new URL(base).origin;
  const fixture = { errors: [], requests: [] };
  client.authFixture = fixture;
  client.socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    const pathname = new URL(request.url).pathname;
    fixture.requests.push({ path: pathname, method: request.method });
    let status = 200;
    let body;
    if (pathname === '/api/auth/config') body = { configured: true, loginUrl: '/api/auth/google/start' };
    else if (pathname === '/api/auth/me') body = { authenticated: true, user: smokeUser };
    else { status = 400; body = { error: 'This fixture only supplies session verification.' }; }
    void client.send('Fetch.fulfillRequest', {
      requestId, responseCode: status,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json; charset=utf-8' },
        { name: 'Cache-Control', value: 'no-store' },
      ],
      body: Buffer.from(JSON.stringify(body)).toString('base64'),
    }).catch(error => fixture.errors.push(error.message));
  });
  await client.send('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/auth/*', requestStage: 'Request' }] });
}

async function waitForVerifiedSmokeUser(client) {
  await client.wait(`typeof state==='object' && state.isAuthenticated && state.userId===${JSON.stringify(smokeUser.id)} && window.MoovGoogleAuth?.getStatus().phase==='authenticated'`, 'verified smoke-test Google session');
  assert.deepEqual(client.authFixture?.errors, [], 'Auth fixture serves all intercepted requests');
  assert.ok(client.authFixture.requests.some(request => request.path === '/api/auth/me'), 'The application verifies its server session');
}

module.exports = { installBrowserAuthFixture, waitForVerifiedSmokeUser, smokeUser };
