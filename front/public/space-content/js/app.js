import { renderPurchasePanel } from "./modes/purchase.js";
import { renderContentsPanel, cleanupContents } from "./modes/contents.js";
import { renderWellnessPanel, cleanupWellness } from "./modes/wellness.js";
import { renderThemePanel, cleanupTheme } from "./modes/window.js";
import { showToast } from "./core/ui.js";
import { CONFIG } from "./config.js";
import { CABIN_THEME_EVENT, cabinPreviewMarkup, updateCabinPreview } from "./core/cabin-preview.js";

const panel = document.querySelector("#space-panel");
const scroller = document.querySelector("#space-scroll");
const contentTabs = document.querySelector("#content-tabs");
let state = { primary: "contents", content: "ott" };

function activeThemeId() {
  try {
    const saved = localStorage.getItem("moov-active-theme");
    if (CONFIG.media.windowThemes.some((theme) => theme.id === saved)) return saved;
  } catch {
    // 브라우저 저장소를 사용할 수 없으면 기본 테마를 사용합니다.
  }
  return CONFIG.defaults.windowTheme;
}

function initializeCabinPreview() {
  const mount = document.querySelector("#desktop-cabin-preview");
  const theme = CONFIG.media.windowThemes.find((item) => item.id === activeThemeId()) || CONFIG.media.windowThemes[0];
  mount.innerHTML = cabinPreviewMarkup({ screens: theme.screens, label: theme.label });
  updateCabinPreview(document.querySelector(".cabin-preview"), {
    themeId: theme.id,
    screens: theme.screens,
    label: theme.label,
    brightness: CONFIG.defaults.windowBrightness,
    motion: true,
    applied: true
  });
}

function stateFromHash() {
  const route = location.hash.slice(1);
  if (route === "purchase") return { primary: "purchase", content: state.content };
  if (route === "wellness") return { primary: "contents", content: "wellness" };
  if (["thema", "window", "sleep"].includes(route)) return { primary: "contents", content: "thema" };
  return { primary: "contents", content: "ott" };
}

function canonicalHash() {
  return state.primary === "purchase" ? "purchase" : state.content;
}

function cleanupPanel() {
  cleanupContents();
  cleanupWellness();
  cleanupTheme();
}

function syncTabs() {
  document.querySelectorAll("[data-primary-tab]").forEach((button) => {
    const active = button.dataset.primaryTab === state.primary;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  contentTabs.hidden = state.primary !== "contents";
  document.querySelectorAll("[data-content-tab]").forEach((button) => {
    const active = button.dataset.contentTab === state.content;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function renderPanel({ updateHistory = false } = {}) {
  cleanupPanel();
  syncTabs();
  if (state.primary === "purchase") renderPurchasePanel(panel);
  else if (state.content === "wellness") renderWellnessPanel(panel);
  else if (state.content === "thema") renderThemePanel(panel);
  else renderContentsPanel(panel);
  scroller.scrollTop = 0;
  if (updateHistory) history.pushState(state, "", `#${canonicalHash()}`);
}

document.querySelectorAll("[data-primary-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.primary = button.dataset.primaryTab;
    renderPanel({ updateHistory: true });
  });
});

document.querySelectorAll("[data-content-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.primary = "contents";
    state.content = button.dataset.contentTab;
    renderPanel({ updateHistory: true });
  });
});

document.querySelectorAll("[data-unavailable-nav]").forEach((button) => {
  button.addEventListener("click", () => showToast(`${button.dataset.unavailableNav} 메뉴는 전체 MOOV 앱에서 이용할 수 있습니다.`));
});

document.querySelector("#vehicle-button").addEventListener("click", () => showToast("MOOV Cabin이 연결되어 있습니다."));
document.querySelector("#profile-button").addEventListener("click", () => showToast("내 정보는 전체 앱에서 연결됩니다."));

function updateClock() {
  const now = new Date();
  document.querySelector("#clock").textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

window.addEventListener("popstate", () => {
  state = stateFromHash();
  renderPanel();
});
window.addEventListener("pagehide", cleanupPanel);
window.addEventListener(CABIN_THEME_EVENT, (event) => {
  updateCabinPreview(document.querySelector(".cabin-preview"), event.detail);
});

state = stateFromHash();
history.replaceState(state, "", `#${canonicalHash()}`);
initializeCabinPreview();
updateClock();
setInterval(updateClock, 30000);
renderPanel();

if (!document.documentElement.classList.contains("embedded") && "serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").then((registration) => registration.update()).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem("moov-sw-refreshed")) return;
    sessionStorage.setItem("moov-sw-refreshed", "1");
    location.reload();
  });
}
