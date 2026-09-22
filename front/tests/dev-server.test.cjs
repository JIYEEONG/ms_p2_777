const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const test = require("node:test");

async function listen(server, host = "127.0.0.1") {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
}

function request(base, path, options) {
  return fetch(base.replace("localhost", "127.0.0.1") + path, {
    ...options, signal: AbortSignal.timeout(5000),
  });
}

test("launcher uses a fresh backend on a busy port; login and restart work", { timeout: 60000 }, async (t) => {
  const { startDev } = await import("../dev.mjs");
  const settings = {
    ENABLE_DEMO_LOGIN: "true",
    APP_BASE_URL: "https://old-tunnel.example.invalid",
    GOOGLE_REDIRECT_URI: "https://old-tunnel.example.invalid/api/auth/google/callback",
  };
  const previousSettings = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  t.after(() => {
    for (const [key, value] of Object.entries(previousSettings)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  let oldServerRequests = 0;
  const oldServer = createServer((req, res) => { oldServerRequests++; res.end("old backend"); });
  const busyPort = await listen(oldServer);
  t.after(() => close(oldServer));
  const dev = await startDev({ port: 0, backendPort: busyPort, mapsOnly: true });
  t.after(() => dev.stop());
  assert.notEqual(new URL(dev.backendUrl).port, String(busyPort));
  const config = await request(dev.appUrl, "/api/auth/config");
  assert.equal((await config.json()).demoEnabled, true);
  const login = await request(dev.appUrl, "/api/auth/demo/login", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: dev.appUrl },
    body: JSON.stringify({ username: "moov", password: "demo1234" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  try {
    const me = await request(dev.appUrl, "/api/auth/me", { headers: { Cookie: cookie } });
    const session = await me.json();
    assert.equal(session.authenticated, true);
    assert.equal(session.user.id, "demo:moov");
  } finally {
    const logout = await request(dev.appUrl, "/api/auth/logout", {
      method: "POST", headers: { Cookie: cookie, Origin: dev.appUrl },
    });
    assert.equal(logout.status, 200);
    await logout.arrayBuffer();
  }
  assert.equal(oldServerRequests, 0, "the old backend must never receive app requests");
  const previousPid = dev.backend.pid;
  process.emit("SIGINT");
  assert.equal(await dev.closed, 0);
  await assert.rejects(request(dev.backendUrl, "/api/auth/config"));
  await assert.rejects(request(dev.appUrl, "/"));
  assert.equal(await (await request(`http://127.0.0.1:${busyPort}`, "/")).text(), "old backend");
  const restarted = await startDev({ port: Number(new URL(dev.appUrl).port), backendPort: busyPort, mapsOnly: true });
  t.after(() => restarted.stop());
  assert.notEqual(restarted.backend.pid, previousPid);
  assert.equal((await request(restarted.appUrl, "/api/auth/config")).status, 200);
  // Losing Python must stop the frontend as well instead of leaving broken login.
  restarted.backend.kill();
  assert.equal(await restarted.closed, 1);
  await assert.rejects(request(restarted.appUrl, "/"));
});

test("occupied frontend is preserved and a missing Python executable fails promptly", { timeout: 10000 }, async (t) => {
  const { startDev } = await import("../dev.mjs");
  const existing = createServer((req, res) => res.end("existing frontend"));
  const port = await listen(existing, "::");
  t.after(() => close(existing));
  await assert.rejects(startDev({ port, mapsOnly: true }), /Frontend port .* already in use/);
  assert.equal(await (await request(`http://127.0.0.1:${port}`, "/")).text(), "existing frontend");
  const previousPython = process.env.MOOV_PYTHON;
  process.env.MOOV_PYTHON = "moov-nonexistent-python-for-test";
  try {
    await assert.rejects(startDev({ port: 0, mapsOnly: true }), /ENOENT/);
  } finally {
    if (previousPython === undefined) delete process.env.MOOV_PYTHON;
    else process.env.MOOV_PYTHON = previousPython;
  }
});

test("AI requests and session headers use the selected backend proxy", async (t) => {
  const { createFrontendServer } = await import("../server.mjs");
  const backend = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.writeHead(201, { "Content-Type": "application/json", "Set-Cookie": "test=value; HttpOnly" });
    res.end(JSON.stringify({ url: req.url, method: req.method, body, cookie: req.headers.cookie }));
  });
  const backendPort = await listen(backend);
  t.after(() => close(backend));
  const frontend = createFrontendServer(`http://127.0.0.1:${backendPort}`);
  const frontendPort = await listen(frontend);
  t.after(() => close(frontend));
  for (const path of ["/api/luna/chat", "/api/luna/tts", "/api/luna/stt", "/api/auth/demo/login"]) {
    const response = await request(`http://127.0.0.1:${frontendPort}`, path + "?test=1", {
      method: "POST", headers: { Cookie: "session=demo" }, body: "request body",
    });
    assert.equal(response.status, 201);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    assert.deepEqual(await response.json(), { url: path + "?test=1", method: "POST", body: "request body", cookie: "session=demo" });
  }
});
