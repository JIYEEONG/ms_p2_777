const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const dashboardDir = path.join(root, "front/public/dashboard");
const read = (name) => fs.readFileSync(path.join(dashboardDir, name), "utf8");
const digest = (name) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dashboardDir, name))).digest("hex");

const sourceHashes = {
  "styles.css": "046008db8fef74fb48d80e532fde67aa0cd6dbf080ab87808057dc9d894a5588",
  "manage.js": "281b469465ead11588c2df83fc3fbdf20ee8d14f44a020b74402984eb7249840",
  "manage.css": "fa532282a1a3ff7db1b42fdfc024e1b2b24f8c04841a21669821716e92349eff",
  "vehicle-management.css": "745544a27d31d2b4374d468498b3e5e13f87313c8cb9f07fd06a5d627bd2b3ca",
  "content-management.css": "d3564e8091c19ae84d8766a7589fc3006c7fd87518eec03884bf1c6e9bc8f9dc",
};

test("the attached administrator visual assets and management UI remain byte-identical", () => {
  for (const [name, hash] of Object.entries(sourceHashes)) assert.equal(digest(name), hash, `${name} must match the attached source`);
  assert.doesNotMatch(read("index.html"), /leaflet|OpenStreetMap/i);
  assert.match(read("index.html"), /\.\.\/naver-map\.js/);
});

test("the original views, controls and scripts remain available", () => {
  const html = read("index.html");
  for (const view of ["dashboard", "vehicles", "products", "members", "ai", "themes"])
    assert.match(html, new RegExp(`data-view-panel="${view}"`));
  for (const control of ["quick-restock", "add-product", "export-inventory", "export-members", "save-theme", "vehicle-export", "vehicle-refresh"])
    assert.ok(html.includes(control), `${control} must remain in the dashboard`);
  const order = ["integration.js", "app.js", "manage.js", "vehicle-management.js"].map((name) => html.indexOf(name));
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "integration must load before the unchanged feature scripts");
});

test("the integration layer connects the current app and API contracts", () => {
  const integration = read("integration.js");
  const app = fs.readFileSync(path.join(root, "front/public/moov.html"), "utf8");
  for (const key of ["moov-app-v3:", "moov-outing-v1:", "moov_admin_products_v3", "moov_admin_bridge_v1"])
    assert.ok(integration.includes(key) || app.includes(key), `${key} must be connected`);
  for (const endpoint of ["/api/auth/me", "/api/outing/health", "/api/outing/popularity", "/api/hot-products", "/api/admin/bootstrap"])
    assert.ok(integration.includes(endpoint), `${endpoint} must be connected`);
  for (const compatibility of ["config/", "events", "payments", "python", "assets"])
    assert.ok(integration.includes(compatibility), `${compatibility} compatibility must remain available`);
  assert.match(app, /applyAdminProductBridge\(\)/);
  assert.match(app, /adminThemeDefaults\(\)/);
});

test("the compatibility API seeds the app catalog and keeps management configuration writable", async () => {
  class TestStorage {
    constructor() { this.values = new Map(); }
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index] ?? null; }
    getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
  }
  const listeners = new Map();
  const sandbox = {
    Blob, Response, URL, JSON, Date, Map, Set, Promise, String, Number, Array, Object, RegExp,
    Storage: TestStorage,
    localStorage: new TestStorage(),
    location: { href: "http://localhost:3000/dashboard/", origin: "http://localhost:3000" },
    document: { querySelector: () => null, createElement: () => ({}) },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    FileReader: class FileReader {},
    queueMicrotask,
    setTimeout,
    clearTimeout,
    fetch: async (input) => new Response(JSON.stringify(input === "/api/auth/me" ? { authenticated: false } : {}), { status: String(input).startsWith("/api/admin/") ? 502 : 200, headers: { "Content-Type": "application/json" } }),
    addEventListener(type, handler) { listeners.set(type, handler); },
    dispatchEvent() {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  new vm.Script(read("integration.js"), { filename: "integration.js" }).runInContext(sandbox);
  const products = JSON.parse(sandbox.localStorage.getItem("moov_admin_products_v3"));
  assert.equal(products.length, 16);
  assert.equal(products[0].appProductId, "bottled-water");
  const getConfig = await sandbox.fetch("/api/config/ai");
  const initial = await getConfig.json();
  assert.equal(initial.data.personas.length, 4);
  initial.data.version = "V1.4-test";
  const saved = await sandbox.fetch("/api/config/ai", { method: "PUT", body: JSON.stringify(initial.data) });
  assert.equal(saved.status, 200);
  const after = await (await sandbox.fetch("/api/config/ai")).json();
  assert.equal(after.data.version, "V1.4-test");
});

test("all dashboard scripts parse as JavaScript", () => {
  for (const name of ["integration.js", "app.js", "manage.js", "vehicle-management.js"])
    assert.doesNotThrow(() => new vm.Script(read(name), { filename: name }));
});

test("product, member, AI, theme and vehicle feature handlers remain present", () => {
  const app = read("app.js"), manage = read("manage.js"), vehicles = read("vehicle-management.js");
  for (const action of ["add-product", "quick-restock", "export-inventory", "export-members", "save-theme"])
    assert.ok(app.includes(action), `${action} handler must remain`);
  for (const action of ["save-ai", "add-theme", "python-download", "payment-detail", "usage-export"])
    assert.ok(manage.includes(action), `${action} handler must remain`);
  for (const action of ["rebalance", "maintenance", "quarantine", "ready", "exportCSV"])
    assert.ok(vehicles.includes(action), `${action} handler must remain`);
});

test("dashboard state is routed to the authenticated admin backend and vehicles use NAVER maps", () => {
  const integration = read("integration.js"), vehicles = read("vehicle-management.js");
  for (const key of ["products", "activities", "vehicle-themes", "selected-theme", "vehicles", "vehicle-audits"])
    assert.ok(integration.includes(`\"${key}\"`), `${key} state must be server-backed`);
  assert.match(integration, /\/api\/admin\/state\//);
  assert.match(integration, /MOOV_ADMIN|adminConnection|login-required/);
  assert.match(vehicles, /MoovNaverMap\.ready\(\)/);
  assert.match(vehicles, /MoovNaverMap\.createView/);
  assert.doesNotMatch(vehicles, /\bL\.(map|marker|tileLayer|latLngBounds)\b/);
});
