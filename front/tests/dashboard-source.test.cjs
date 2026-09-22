const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const appHtml = fs.readFileSync(path.join(root, "front/public/moov.html"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "front/public/dashboard/app.js"), "utf8");
const backend = [
  "backend/outing_api.py",
  "backend/routers/chat.py",
  "backend/routers/stt.py",
  "backend/routers/tts.py",
].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");

function arraySource(name) {
  const marker = `const ${name} = [`;
  const start = appHtml.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist in app source`);
  let depth = 0;
  for (let index = start + marker.length - 1; index < appHtml.length; index += 1) {
    if (appHtml[index] === "[") depth += 1;
    if (appHtml[index] === "]") depth -= 1;
    if (depth === 0) return appHtml.slice(start, index + 1);
  }
  throw new Error(`${name} array is not closed`);
}

function dashboardFact(name) {
  const match = dashboard.match(new RegExp(`${name}:\\s*(\\d+)`));
  assert.ok(match, `${name} dashboard fact must exist`);
  return Number(match[1]);
}

test("dashboard catalog counts match the deployed app source", () => {
  assert.equal(dashboardFact("vehicles"), (arraySource("rentalVehicles").match(/\bid\s*:/g) || []).length);
  assert.equal(dashboardFact("rentalOptions"), (arraySource("rentalOptionCatalog").match(/\bid\s*:/g) || []).length);
  assert.equal(dashboardFact("products"), (arraySource("products").match(/\bid\s*:/g) || []).length);
  assert.equal(dashboardFact("baseCourses"), (arraySource("baseCourses").match(/\bid\s*:/g) || []).length);
  assert.equal(dashboardFact("historyRoutes"), (arraySource("historyRoutes").match(/\bid\s*:/g) || []).length);
});

test("every dashboard endpoint exists in the FastAPI source", () => {
  const endpoints = [...dashboard.matchAll(/\["(?:GET|POST)",\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(endpoints.length, 7);
  for (const endpoint of endpoints) {
    const routes = [endpoint, endpoint.replace("/api/outing", "")];
    assert.ok(routes.some((route) => backend.includes(`"${route}"`)), `${endpoint} must exist in backend routers`);
  }
});

test("dashboard excludes unsupported synthetic operating metrics", () => {
  for (const unsupported of ["610000", "11173", "50000", "TourAPI", "Kakao Local", "Power BI"])
    assert.equal(dashboard.includes(unsupported), false, `${unsupported} should not be presented as dashboard data`);
});
