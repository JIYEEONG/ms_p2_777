import { CONFIG } from "../config.js";

export const CABIN_THEME_EVENT = "moov:cabin-theme-change";
const POSITIONS = ["left", "front", "right"];
const LABELS = { left: "좌측", front: "정면", right: "우측" };

export function normalizeMedia(value) {
  return typeof value === "string" ? { type: "image", src: value } : { type: "image", ...value };
}

export function screenMediaMarkup(value, position, label, dataName = "data-cabin-screen") {
  const media = normalizeMedia(value);
  if (media.type === "video") {
    return `<video src="${media.src}" ${media.poster ? `poster="${media.poster}"` : ""} autoplay muted loop playsinline preload="metadata" ${dataName}="${position}" aria-label="${label} 테마 ${LABELS[position]} 화면"></video>`;
  }
  return `<img src="${media.src}" alt="${label} 테마 ${LABELS[position]} 화면" ${dataName}="${position}" />`;
}

export function cabinPreviewMarkup({ screens, label, compact = false, weather = CONFIG.defaults.windowWeather } = {}) {
  const activeScreens = screens || CONFIG.media.windowThemes[0].screens;
  const activeLabel = label || CONFIG.media.windowThemes[0].label;
  const rain = Math.max(0, (50 - weather) / 50);
  return `<div class="cabin-theme-stage ${compact ? "is-compact" : ""}" data-cabin-stage data-theme-id="${activeLabel}" style="--cabin-rain:${rain}" aria-label="${activeLabel} 테마가 적용된 차량 3면 창문">
    <img class="cabin-theme-base" src="${CONFIG.media.cabinPreview.src}" alt="${CONFIG.media.cabinPreview.alt}" width="677" height="232" />
    ${POSITIONS.map((position) => `<span class="cabin-theme-window is-${position}" aria-label="${LABELS[position]} 창문">
      ${screenMediaMarkup(activeScreens[position], position, activeLabel)}
      <span class="weather-overlay" aria-hidden="true"></span>
      <span class="cabin-screen-fallback">화면을 불러오지 못했습니다.</span>
    </span>`).join("")}
  </div>`;
}

function replaceScreen(frame, value, position, label) {
  const current = frame.querySelector("[data-cabin-screen]");
  const media = normalizeMedia(value);
  if (current?.tagName.toLowerCase() === media.type && current.getAttribute("src") === media.src) return current;
  current?.remove();
  frame.insertAdjacentHTML("afterbegin", screenMediaMarkup(media, position, label));
  return frame.querySelector("[data-cabin-screen]");
}

export function updateCabinPreview(root, detail = {}) {
  if (!root) return;
  const theme = CONFIG.media.windowThemes.find((item) => item.id === detail.themeId);
  const screens = detail.screens || theme?.screens;
  const label = detail.label || theme?.label || "선택한";
  if (!screens) return;
  const weather = detail.weather ?? CONFIG.defaults.windowWeather;
  const brightness = detail.brightness ?? CONFIG.defaults.windowBrightness;
  const temperature = detail.temperature ?? 50;
  root.querySelectorAll("[data-cabin-stage]").forEach((stage) => {
    stage.style.setProperty("--cabin-brightness", String(.45 + (brightness / 100) * .75));
    stage.style.setProperty("--cabin-rain", String(Math.max(0, (50 - weather) / 50)));
    stage.style.setProperty("--cabin-warmth", String((temperature - 50) / 50));
    stage.classList.toggle("has-motion", detail.motion !== false);
    stage.dataset.themeId = detail.themeId || theme?.id || "";
    stage.setAttribute("aria-label", `${label} 테마가 적용된 차량 3면 창문`);
    POSITIONS.forEach((position) => {
      const frame = stage.querySelector(`.cabin-theme-window.is-${position}`);
      if (!frame) return;
      frame.classList.remove("has-image-error");
      const media = replaceScreen(frame, screens[position], position, label);
      media.addEventListener("error", () => frame.classList.add("has-image-error"), { once: true });
      if (media.tagName === "VIDEO") {
        if (detail.motion === false) media.pause();
        else media.play().catch(() => {});
      }
    });
  });
  root.querySelectorAll("[data-cabin-theme-name]").forEach((node) => {
    node.textContent = `${label} · ${detail.applied ? "3면 적용 중" : "3면 미리보기"}`;
  });
}

export function announceCabinTheme(detail) {
  window.dispatchEvent(new CustomEvent(CABIN_THEME_EVENT, { detail }));
}
