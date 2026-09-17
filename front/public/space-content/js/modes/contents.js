import { OTT_SERVICES, CONTINUE_CONTENT } from "../data/space-content.js";
import { showToast, icon } from "../core/ui.js";

const STORAGE_KEY = "moov-space-ott-v2";
let playingId = null;
let progressTimer = null;
let progress = Object.fromEntries(CONTINUE_CONTENT.map((item) => [item.id, item.progress]));

function loadAccounts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Object.fromEntries(OTT_SERVICES.map((service) => [service.id, {
      loggedIn: saved?.[service.id]?.loggedIn ?? service.loggedIn,
      connected: saved?.[service.id]?.connected ?? service.connected
    }]));
  } catch {
    return Object.fromEntries(OTT_SERVICES.map((service) => [service.id, { loggedIn: service.loggedIn, connected: service.connected }]));
  }
}

let accounts = loadAccounts();
const saveAccounts = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
const serviceById = (id) => OTT_SERVICES.find((service) => service.id === id);

export function cleanupContents() {
  clearInterval(progressTimer);
  progressTimer = null;
}

function renderLogin(container, serviceId) {
  cleanupContents();
  const service = serviceById(serviceId);
  const account = accounts[serviceId];
  container.innerHTML = `
    <section class="panel-view ott-login-view" data-panel="ott" data-ott-view="login">
      <button class="inline-back" id="ott-back" type="button">${icon("icon-chevron-left")} OTT 목록</button>
      <div class="ott-login-brand"><span class="service-logo ${service.logoClass}">${service.logo}</span><h2>${service.name}</h2></div>
      ${account.loggedIn ? `
        <div class="account-result is-signed-in"><strong>계정 로그인됨</strong><p>${service.name} 계정으로 콘텐츠를 불러올 수 있습니다.</p></div>
        <button class="light-action full-action" id="ott-logout" type="button">로그아웃</button>
      ` : `
        <form class="ott-login-form" id="ott-login-form">
          <label>이메일<input type="email" autocomplete="username" placeholder="name@example.com" required /></label>
          <label>비밀번호<input type="password" autocomplete="current-password" placeholder="비밀번호" required /></label>
          <button class="green-action" type="submit">${service.name} 로그인</button>
        </form>
        <p class="login-policy">데모 화면입니다. 입력값은 저장하거나 전송하지 않습니다.</p>
      `}
    </section>`;
  container.querySelector("#ott-back").addEventListener("click", () => renderContentsPanel(container));
  container.querySelector("#ott-login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    accounts[serviceId].loggedIn = true;
    saveAccounts();
    showToast(`${service.name} 계정에 로그인했습니다.`);
    renderLogin(container, serviceId);
  });
  container.querySelector("#ott-logout")?.addEventListener("click", () => {
    accounts[serviceId].loggedIn = false;
    saveAccounts();
    showToast(`${service.name} 계정에서 로그아웃했습니다.`);
    renderLogin(container, serviceId);
  });
}

export function renderContentsPanel(container) {
  cleanupContents();
  container.innerHTML = `
    <section class="panel-view ott-view" data-panel="ott" data-ott-view="list">
      <div class="panel-heading"><div><h2>차량 디스플레이로 이어보기</h2><p>로고는 계정 로그인, 오른쪽 버튼은 차량 연결 선택입니다.</p></div></div>
      <div class="service-list">
        ${OTT_SERVICES.map((service) => {
          const account = accounts[service.id];
          return `<article class="service-card">
            <button class="service-logo ${service.logoClass}" type="button" data-login-service="${service.id}" aria-label="${service.name} 계정 로그인 화면">${service.logo}</button>
            <div class="service-copy"><strong>${service.name}</strong><span class="account-status ${account.loggedIn ? "is-on" : ""}">${account.loggedIn ? "계정 로그인됨" : "계정 로그인 필요"}</span></div>
            <button class="connection-choice ${account.connected ? "is-on" : ""}" type="button" aria-pressed="${account.connected}" data-service="${service.id}">${account.connected ? "연결" : "연결 안 함"}</button>
          </article>`;
        }).join("")}
      </div>
      <div class="continue-heading"><h3>이어보기</h3><span>OTT 출처 표시</span></div>
      <div class="continue-list">
        ${CONTINUE_CONTENT.map((item) => `<article class="continue-card">
          <div><span class="continue-source ${item.sourceClass}">${item.source}</span><h3>${item.title} · ${item.remaining}</h3><div class="content-progress" aria-hidden="true"><span data-progress="${item.id}" style="width:${progress[item.id]}%"></span></div></div>
          <button class="play-button" type="button" data-play="${item.id}" aria-label="${playingId === item.id ? "일시정지" : "재생"}">${icon(playingId === item.id ? "icon-pause" : "icon-play")}</button>
        </article>`).join("")}
      </div>
    </section>`;

  container.querySelectorAll("[data-login-service]").forEach((button) => button.addEventListener("click", () => renderLogin(container, button.dataset.loginService)));
  container.querySelectorAll("[data-service]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.service;
    accounts[id].connected = !accounts[id].connected;
    button.classList.toggle("is-on", accounts[id].connected);
    button.setAttribute("aria-pressed", String(accounts[id].connected));
    button.textContent = accounts[id].connected ? "연결" : "연결 안 함";
    saveAccounts();
    showToast(`${serviceById(id).name} 차량 연결을 ${accounts[id].connected ? "선택했습니다." : "해제했습니다."}`);
  }));
  container.querySelectorAll("[data-play]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.play;
    cleanupContents();
    playingId = playingId === id ? null : id;
    renderContentsPanel(container);
    if (!playingId) return showToast("재생을 잠시 멈췄습니다.");
    showToast("선택한 콘텐츠를 차량 디스플레이에서 이어봅니다.");
    progressTimer = setInterval(() => {
      progress[id] = progress[id] >= 100 ? 0 : progress[id] + 1;
      const bar = container.querySelector(`[data-progress="${id}"]`);
      if (bar) bar.style.width = `${progress[id]}%`;
    }, 900);
  }));
}
