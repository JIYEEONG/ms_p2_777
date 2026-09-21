/* Browser-test-only auth transport. No production script, cookie or credential is changed. */
const assert = require('node:assert/strict');

const smokeUser = Object.freeze({
  id: 'google:smoke-user', name: 'MOOV Smoke Test', email: 'smoke@example.test', picture: '',
});

async function installBrowserAuthFixture(client, base, options = {}) {
  const origin = new URL(base).origin;
  const emptyAnswers = { categories: [], subcategories: {}, preferredRegions: [], avoidedRegions: [], avoidances: { foodRestrictions: [], foods: [], other: [] } };
  const fixture = { errors: [], requests: [], failSave: false, failLoad: false, survey: Object.hasOwn(options, 'survey') ? options.survey : {
    version: '1.8', status: 'skipped', answers: emptyAnswers, profile: { categories: {}, subcategories: {}, preferredRegions: [], excludedRegions: [], excludedTags: [] },
  } };
  client.authFixture = fixture;
  fixture.locationConsent = Object.hasOwn(options,'consent') ? options.consent : {version:'1',agreedAt:'2026-09-21T00:00:00Z'};
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
    else if (pathname === '/api/outing/survey/location-consent') {
      if(fixture.failSave){status=503;body={detail:'Test save failure'};}
      else{fixture.locationConsent={version:'1',agreedAt:new Date().toISOString()};body={locationConsent:fixture.locationConsent};}
    }
    else if (pathname === '/api/outing/survey') {
      if ((request.method === 'PUT' && fixture.failSave) || (request.method === 'GET' && fixture.failLoad)) {
        status = 503; body = {detail:'Test service unavailable'};
      } else {
        if (request.method === 'PUT') {
          const saved = JSON.parse(request.postData);
          const a = saved.answers;
          fixture.survey = {...saved,profile:{categories:Object.fromEntries(a.categories.map(c=>[c,1])),subcategories:a.subcategories,preferredRegions:a.preferredRegions,excludedRegions:a.avoidedRegions,excludedTags:Object.values(a.avoidances).flat()}};
        }
        body = {survey: fixture.survey,locationConsent:fixture.locationConsent};
      }
    }
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
  await client.send('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/auth/*', requestStage: 'Request' }, { urlPattern: origin + '/api/outing/survey*', requestStage: 'Request' }] });
}

async function waitForVerifiedSmokeUser(client) {
  await client.wait(`typeof state==='object' && state.isAuthenticated && state.userId===${JSON.stringify(smokeUser.id)} && window.MoovGoogleAuth?.getStatus().phase==='authenticated'`, 'verified smoke-test Google session');
  assert.deepEqual(client.authFixture?.errors, [], 'Auth fixture serves all intercepted requests');
  assert.ok(client.authFixture.requests.some(request => request.path === '/api/auth/me'), 'The application verifies its server session');
}

module.exports = { installBrowserAuthFixture, waitForVerifiedSmokeUser, smokeUser };
