function icon(id) { return `<svg aria-hidden="true"><use href="#i-${id}"></use></svg>`; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}
function rentalFareForHours(vehicleId, hours) {
  const policy = rentalFarePolicy[vehicleId] || rentalFarePolicy.standard;
  const h = Math.max(3, Math.min(24, Number(hours) || 3));
  const breakpoints = [3,6,9,12,18];
  const tier = breakpoints.filter((v) => v <= h).at(-1) || 3;
  const hourly = policy.packages[tier] / tier;
  return Math.round(hourly * h / 10) * 10;
}
function rentalFareDelta(vehicleId, hours) {
  const h = Math.max(3, Math.min(24, Number(hours) || 3));
  if (h >= 24) return 0;
  return rentalFareForHours(vehicleId, h + 1) - rentalFareForHours(vehicleId, h);
}
function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remain = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${remain}`;
}
function getRentalRemaining() {
  const endAt = state.rentalEndsAt || ((state.usageStartedAt || Date.now()) + state.rentalHours * 3600000);
  return Math.max(0, endAt - Date.now());
}
function renderHomeModeChoice() {
  return `<div class="home-mode-entry">${renderSearchField({ inputId: "home-search", stateKey: "homeQuery", className: "home-search", placeholder: "원하는 곳, 코스를 검색하세요", label: "홈 검색" })}<div class="home-mode-grid"><button class="home-mode-card taxi" data-action="select-home-mode" data-value="taxi"><img src="assets/afbdf8b0ad3f4986.png" alt="택시 아이콘" /><span><strong>택시</strong><small>목적지까지 빠르게 이동하고<br />거리만큼 자동 결제해요.</small></span><em>가까운 차량 약 3분 ${icon("chevron")}</em></button><button class="home-mode-card rent" data-action="select-home-mode" data-value="rent"><img src="assets/315ebb9cbe762ef8.png" alt="렌트 아이콘" /><span><strong>렌트</strong><small>차량과 공간 옵션을 골라<br />3~24시간 자유롭게 이용해요.</small></span><em>3시간 10,180원부터 ${icon("chevron")}</em></button></div>${renderHomePromotionSlider()}${renderHomeNoticePreview()}</div>`;
}
function renderHomePromotionSlider() {
  const slides = [...homePromotions, ...homePromotions];
  return `<section class="home-promo-section" aria-label="광고와 추천 코스"><div class="section-row"><strong>광고·프로모션</strong><span class="small muted">추천 코스</span></div><div class="home-promo-slider" data-drag-scroll>${slides.map((promo, index) => `<button class="home-promo-slide promo-${promo.id}" data-action="${promo.action}" aria-label="${escapeHtml(promo.title)}"><img src="${document.documentElement.lang === "en" ? promo.imageEn : promo.image}" alt="${escapeHtml(promo.title)}" /><span class="home-promo-shade"></span><span class="home-promo-copy"><small>${escapeHtml(promo.tag)}</small><strong>${escapeHtml(promo.title)}</strong><em>${escapeHtml(promo.desc)}</em></span></button>`).join("")}</div></section>`;
}
function renderHomeNoticePreview() {
  return `<section class="card home-notice-preview"><div class="section-row"><strong>공지·이벤트</strong><button class="mini-action" data-action="home-notices">전체보기</button></div>${appNotices.slice(0, 2).map((notice) => `<button class="home-notice-row" data-action="notice-detail" data-value="${notice.id}" data-title="${escapeHtml(notice.title)}" data-text="${escapeHtml(notice.text)}"><span class="badge ${notice.tag === "이벤트" ? "orange" : ""}">${notice.tag}</span><span><strong>${escapeHtml(notice.title)}</strong><small>${escapeHtml(notice.date)}</small></span>${icon("chevron")}</button>`).join("")}</section>`;
}
function renderUsageStatus() {
  const modeLabel = state.homeMode === "rent" ? "렌트" : "택시";
  const rent = state.homeMode === "rent";
  const detail = state.tripActive ? (rent ? "렌트 남은 시간" : "이동 이용시간") : "이용 대기 중";
  const timerAttr = rent ? "data-live-remaining" : "data-live-usage";
  const timerValue = state.tripActive ? (rent ? formatElapsed(getRentalRemaining()) : formatElapsed(Date.now() - (state.usageStartedAt || Date.now()))) : "00:00:00";
  return `<section class="usage-status ${state.tripActive ? "active" : ""}"><span class="usage-mode">${icon(rent ? "key" : "car")} ${modeLabel}</span><div><small>${detail}</small><strong ${timerAttr}>${timerValue}</strong></div><span class="live-indicator"><i></i>${state.tripActive ? "LIVE" : "READY"}</span></section>`;
}

window.addEventListener("moov:language-change", () => {
  const english = document.documentElement.lang === "en";
  document.querySelectorAll(".home-promo-slide").forEach((slide) => {
    const promo = homePromotions.find((entry) => slide.classList.contains(`promo-${entry.id}`));
    const image = slide.querySelector("img");
    if (promo && image) image.src = english ? promo.imageEn : promo.image;
  });
});
