const APP_FACTS = {
  version: "2.6.2",
  mainMenus: ["AI 말동무", "공간", "홈", "나들이", "내 정보"],
  vehicles: 4,
  rentalOptions: 3,
  products: 16,
  baseCourses: 15,
  historyRoutes: 6,
  tasteGroups: 4,
  personas: ["무브", "토닥이", "척척박사", "링고"],
  themes: ["기본", "윈도우", "콘텐츠", "웰니스", "수면", "프라이빗"],
};

const ENDPOINTS = [
  ["POST", "/api/luna/chat", "AI 답변·페르소나 전환·위기 감지"],
  ["POST", "/api/luna/stt", "한국어·영어 음성 인식"],
  ["POST", "/api/luna/tts", "페르소나별 음성 합성"],
  ["POST", "/api/outing/recommendations", "추천 요청과 결과 기록"],
  ["POST", "/api/outing/events", "코스 검색·선택·저장·좋아요 이벤트"],
  ["GET", "/api/outing/health", "나들이 저장소 상태"],
  ["GET", "/api/outing/popularity", "최근 7일 유효 좋아요 집계"],
];

const FEATURES = {
  mobility: [
    ["목적지·경유지 설정", "장소 검색과 관심 코스 전체 경로 적용", "브라우저 상태"],
    ["택시 예약", "차종 선택, 배정, 이용시간, 자동 결제 안내", "브라우저 상태"],
    ["렌트 예약", "차종·시간·옵션 선택과 예상 요금 계산", "브라우저 상태"],
    ["이용 종료", "차량 기록 삭제 3단계와 검증 확인번호", "브라우저 상태"],
  ],
  ai: [
    ["텍스트 대화", "4개 페르소나와 최근 대화 맥락 전송", "백엔드 API"],
    ["음성 대화", "STT 언어 감지 후 TTS 음성 응답", "백엔드 API"],
    ["대화 기록", "명시적 저장 동의가 있을 때만 기록", "브라우저+DB"],
    ["위기 감지", "위기 키워드 안내와 안전 이벤트 기록", "백엔드 DB"],
  ],
  space: [
    ["차량 상품 구매", "검색·관심·장바구니·결제·전자 영수증", "브라우저 상태"],
    ["OTT", "차량 디스플레이 연결과 이어보기 UI", "프로토타입 UI"],
    ["Wellness", "차량 내 웰니스 프로그램 UI", "프로토타입 UI"],
    ["Thema", "테마·창문·수면 환경 설정", "브라우저 상태"],
  ],
  outing: [
    ["커뮤니티", "검색·지도·취향순·인기순·최신순·거리순", "앱+이벤트 API"],
    ["취향 추천", "카테고리·분위기·동행·시간·예산 기반 규칙 추천", "앱+이벤트 API"],
    ["코스 등록", "직접 입력 또는 최근 이용 기록에서 경로 불러오기", "브라우저 상태"],
    ["관심코스", "저장·등록 코스와 새 항목 레드닷", "브라우저 상태"],
  ],
};

const ROUTES = [
  ["overview", "앱 현황", "배포 앱의 실제 구현 범위"],
  ["mobility", "택시·렌트", "현재 이동 세션과 차량 기능"],
  ["ai", "AI 말동무", "대화·음성·저장·안전 기능"],
  ["space", "공간·상품", "상품 구매와 차량 콘텐츠"],
  ["outing", "나들이", "코스·추천·관심 이벤트"],
  ["data", "데이터 범위", "저장 위치와 백엔드 API"],
];

const state = { route: "overview", outingHealth: null, popularity: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const formatNumber = (value) => new Intl.NumberFormat("ko-KR").format(Number(value) || 0);

function readJson(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}

function appState() {
  const saved = readJson("moov-app-v2", {});
  const userId = saved.userId || saved.username || "지영";
  const outing = readJson(`moov-outing-v1:${encodeURIComponent(userId)}`, {});
  const queue = readJson(`moov-outing-pending-v1:${encodeURIComponent(userId)}`, []);
  return { saved, outing, queue, userId };
}

function pill(text, type = "") { return `<span class="pill ${type}">${escapeHtml(text)}</span>`; }
function kpi(label, value, note) { return `<article class="card kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`; }
function card(title, description, body) { return `<article class="card"><div class="card-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div></div><div class="card-body">${body}</div></article>`; }
function rows(items, className = "feature-list") {
  return `<div class="${className}">${items.map(([title, description, source]) => `<div class="feature-row"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p>${pill(source, source.includes("백엔드") || source.includes("DB") ? "backend" : source.includes("프로토타입") ? "warning" : "local")}</div>`).join("")}</div>`;
}
function sourceNotice() {
  return `<section class="notice"><div><strong>실제 앱 범위만 표시 중</strong><p>앱 코드, 동일 출처의 브라우저 저장 상태, 현재 FastAPI 라우터에서 확인되는 항목만 정리했습니다.</p></div>${pill("코드 기준", "backend")}</section>`;
}

function overviewView() {
  const { saved, outing, queue } = appState();
  const orderCount = saved.orders?.length || 0;
  const chatCount = saved.chatThreads?.length || 0;
  const customCount = outing.customCourses?.length || 0;
  const savedCourseCount = outing.savedCourseIds?.length || 0;
  const sections = [
    ["택시·렌트", 4], ["AI 말동무", 4], ["공간·상품", 4], ["나들이", 4], ["내 정보", 6],
  ];
  const max = Math.max(...sections.map((item) => item[1]));
  return `${sourceNotice()}<div class="grid kpis">${kpi("주요 메뉴", `${APP_FACTS.mainMenus.length}개`, "앱 하단 내비게이션")}${kpi("백엔드 API", `${ENDPOINTS.length}개`, "FastAPI 라우트")}${kpi("정적 카탈로그", `${APP_FACTS.products + APP_FACTS.baseCourses + APP_FACTS.vehicles}개`, "상품·코스·차량")}${kpi("전송 대기", `${queue.length}건`, "나들이 오프라인 큐")}</div>
  <div class="grid two-cols">${card("구현 기능", "메뉴별 사용자 기능 수", `<div>${sections.map(([name, count]) => `<div class="chart-row"><span>${name}</span><div class="metric-bar"><i style="width:${count / max * 100}%"></i></div><strong>${count}</strong></div>`).join("")}</div>`)}${card("현재 브라우저 상태", "같은 출처에서 실행할 때 앱 localStorage를 읽습니다.", `<div class="status-list"><div class="status-row"><strong>이동 세션</strong><p>${saved.tripActive ? `${saved.homeMode === "rent" ? "렌트" : "택시"} 이용 중` : "이용 없음"}</p>${pill(saved.tripActive ? "LIVE" : "대기", saved.tripActive ? "backend" : "local")}</div><div class="status-row"><strong>저장 대화</strong><p>${chatCount}개 대화</p>${pill("동의 기반", "local")}</div><div class="status-row"><strong>구매 내역</strong><p>${orderCount}건</p>${pill("브라우저", "local")}</div><div class="status-row"><strong>관심·등록 코스</strong><p>${savedCourseCount}개 · 직접 등록 ${customCount}개</p>${pill("사용자별", "local")}</div></div>`)}</div>`;
}

function mobilityView() {
  const { saved } = appState();
  const destination = saved.routeStops?.at?.(-1) || "설정 없음";
  const elapsed = saved.tripActive && saved.usageStartedAt ? Math.max(0, Date.now() - saved.usageStartedAt) : 0;
  const minutes = Math.floor(elapsed / 60000);
  return `${sourceNotice()}<div class="grid kpis">${kpi("차량 유형", `${APP_FACTS.vehicles}종`, "컴팩트·이지핏·중형·라운지")}${kpi("렌트 옵션", `${APP_FACTS.rentalOptions}개`, "프라이버시·웰니스·OTT")}${kpi("현재 상태", saved.tripActive ? "이용 중" : "대기", saved.homeMode === "rent" ? "렌트 모드" : "택시 모드")}${kpi("이용 시간", `${minutes}분`, "브라우저 타이머 기준")}</div><div class="grid two-cols">${card("지원 기능", "앱에서 직접 실행 가능한 이동 기능", rows(FEATURES.mobility))}${card("현재 이동 상태", "운영 서버가 아닌 현재 브라우저 저장값", `<div class="status-list"><div class="status-row"><strong>출발 위치</strong><p>${escapeHtml(saved.pickupLocation || "현재 위치 · 서울 성수동")}</p>${pill("브라우저", "local")}</div><div class="status-row"><strong>목적지</strong><p>${escapeHtml(destination)}</p>${pill("브라우저", "local")}</div><div class="status-row"><strong>선택 차종</strong><p>${escapeHtml(saved.homeMode === "rent" ? saved.rentalVehicleType || "standard" : saved.taxiVehicleType || "standard")}</p>${pill("브라우저", "local")}</div><div class="status-row"><strong>삭제 증명</strong><p>${escapeHtml(saved.securityProof?.reference || "아직 발급되지 않음")}</p>${pill(saved.securityProof ? "검증 완료" : "없음", saved.securityProof ? "backend" : "local")}</div></div>`)}</div>`;
}

function aiView() {
  const { saved } = appState();
  const messages = (saved.chatThreads || []).reduce((sum, thread) => sum + (thread.messages?.length || 0), 0);
  return `${sourceNotice()}<div class="grid kpis">${kpi("페르소나", `${APP_FACTS.personas.length}종`, APP_FACTS.personas.join(" · "))}${kpi("저장 대화", `${saved.chatThreads?.length || 0}개`, "저장 동의 시")}${kpi("저장 메시지", `${messages}개`, "현재 브라우저")}${kpi("음성 대화", saved.aiVoiceEnabled === false ? "꺼짐" : "켜짐", "STT + TTS")}</div><div class="grid two-cols">${card("AI 기능", "현재 앱과 FastAPI에 구현된 기능", rows(FEATURES.ai))}${card("사용자 설정", "앱 브라우저에 저장된 개인 설정", `<div class="status-list"><div class="status-row"><strong>현재 페르소나</strong><p>${escapeHtml(saved.aiPersona || "무브")}</p>${pill("브라우저", "local")}</div><div class="status-row"><strong>승차 후 자동 시작</strong><p>${saved.aiAutoStart === false ? "사용 안 함" : "사용"}</p>${pill("설정", "local")}</div><div class="status-row"><strong>대화 기록 저장</strong><p>${saved.aiSaveEnabled ? "동의함" : "동의 안 함"}</p>${pill("동의", saved.aiSaveEnabled ? "backend" : "warning")}</div><div class="status-row"><strong>지원 언어</strong><p>한국어·영어 음성 인식</p>${pill("STT", "backend")}</div></div>`)}</div>`;
}

function spaceView() {
  const { saved } = appState();
  const cartQty = (saved.cart || []).reduce((sum, item) => sum + (item.qty || 0), 0);
  return `${sourceNotice()}<div class="grid kpis">${kpi("상품", `${APP_FACTS.products}개`, "앱 정적 카탈로그")}${kpi("장바구니", `${cartQty}개`, "현재 브라우저")}${kpi("구매 내역", `${saved.orders?.length || 0}건`, "전자 영수증")}${kpi("공간 테마", `${APP_FACTS.themes.length}종`, saved.theme || "기본")}</div><div class="grid two-cols">${card("공간·상품 기능", "앱에서 확인 가능한 구매와 콘텐츠 기능", rows(FEATURES.space))}${card("현재 개인 상태", "상품과 공간 설정은 브라우저에 저장됩니다.", `<div class="status-list"><div class="status-row"><strong>관심 상품</strong><p>${saved.productLikes?.length || 0}개</p>${pill("브라우저", "local")}</div><div class="status-row"><strong>적용 테마</strong><p>${escapeHtml(saved.theme || "기본")}</p>${pill("차량 UI", "local")}</div><div class="status-row"><strong>온도</strong><p>${escapeHtml(saved.themeConfig?.temperature ?? 22)}℃</p>${pill("설정", "local")}</div><div class="status-row"><strong>프라이버시</strong><p>${saved.themeConfig?.privacy === false ? "꺼짐" : "켜짐"}</p>${pill("설정", "local")}</div></div>`)}</div>`;
}

function outingView() {
  const { outing, queue } = appState();
  const likes = outing.likedCourseIds?.length || 0;
  const saves = outing.savedCourseIds?.length || 0;
  const custom = outing.customCourses?.length || 0;
  const popularityCount = state.popularity?.counts ? Object.keys(state.popularity.counts).length : 0;
  return `${sourceNotice()}<div class="grid kpis">${kpi("기본 코스", `${APP_FACTS.baseCourses}개`, "앱 정적 카탈로그")}${kpi("직접 등록", `${custom}개`, "사용자별 브라우저 저장")}${kpi("관심 저장", `${saves}개`, "현재 사용자")}${kpi("좋아요 코스", `${likes}개`, state.popularity ? `서버 집계 ${popularityCount}개 코스` : "서버 확인 전")}</div><div class="grid two-cols">${card("나들이 기능", "커뮤니티·코스등록·관심코스 기준", rows(FEATURES.outing))}${card("추천·이벤트 상태", "앱 상태와 나들이 백엔드 연결", `<div class="status-list"><div class="status-row"><strong>정렬 기준</strong><p>${escapeHtml(outing.outingSort || "최신순")}</p>${pill("사용자별", "local")}</div><div class="status-row"><strong>취향 유형</strong><p>${escapeHtml(outing.tasteGroup || "감성 탐험형")}</p>${pill(`${APP_FACTS.tasteGroups}개 유형`, "local")}</div><div class="status-row"><strong>전송 대기</strong><p>${queue.length}건</p>${pill(queue.length ? "재시도 예정" : "없음", queue.length ? "warning" : "backend")}</div><div class="status-row"><strong>저장소 상태</strong><p>${escapeHtml(state.outingHealth?.storage || "확인되지 않음")}</p>${pill(state.outingHealth?.ok ? "연결됨" : "오프라인", state.outingHealth?.ok ? "backend" : "offline")}</div></div>`)}</div>`;
}

function dataView() {
  const sources = [
    ["moov-app-v2", "이동·AI·상품·공간·프로필 상태", "localStorage"],
    ["moov-outing-v1:{user}", "사용자별 코스·추천·좋아요·저장", "localStorage"],
    ["moov-outing-pending-v1:{user}", "오프라인 나들이 이벤트 재전송 큐", "localStorage"],
    ["ai_sessions", "저장 동의한 AI 세션", "PostgreSQL"],
    ["app_events", "AI 메시지·위기 감지 이벤트", "PostgreSQL"],
    ["outing_recommendations", "규칙 추천 요청과 결과", "PostgreSQL/SQLite"],
    ["outing_events", "코스 상호작용 이벤트", "PostgreSQL/SQLite"],
  ];
  const sourceRows = `<div class="source-list">${sources.map(([name, description, source]) => `<div class="source-row"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(description)}</p>${pill(source, source.includes("local") ? "local" : "backend")}</div>`).join("")}</div>`;
  const endpointRows = `<div>${ENDPOINTS.map(([method, path, role]) => `<div class="endpoint"><strong>${escapeHtml(method)}</strong><code>${escapeHtml(path)}</code>${pill(role, method === "GET" ? "local" : "backend")}</div>`).join("")}</div>`;
  return `${sourceNotice()}<div class="grid two-cols">${card("실제 저장 범위", "코드에서 생성·조회하는 저장소만 표시", sourceRows)}${card("백엔드 API", "현재 FastAPI 라우터에 등록된 엔드포인트", endpointRows)}</div><div class="grid two-cols">${card("앱 카탈로그", "배포 앱 코드에 포함된 정적 데이터", `<div class="tag-cloud"><span>차량 ${APP_FACTS.vehicles}종</span><span>렌트 옵션 ${APP_FACTS.rentalOptions}개</span><span>상품 ${APP_FACTS.products}개</span><span>기본 코스 ${APP_FACTS.baseCourses}개</span><span>이용 기록 ${APP_FACTS.historyRoutes}건</span><span>AI 페르소나 ${APP_FACTS.personas.length}종</span><span>공간 테마 ${APP_FACTS.themes.length}종</span></div>`)}${card("데이터 해석", "현재 대시보드에서 지켜야 할 기준", `<div class="status-list"><div class="status-row"><strong>카탈로그 수</strong><p>앱 코드에 포함된 정적 항목 수</p>${pill("실제 코드", "backend")}</div><div class="status-row"><strong>개인 상태</strong><p>동일 출처 브라우저의 localStorage 값</p>${pill("기기 한정", "local")}</div><div class="status-row"><strong>서버 상태</strong><p>나들이 health/popularity API 응답</p>${pill("연결 시", "backend")}</div><div class="status-row"><strong>성과 KPI</strong><p>실제 운영 원천이 없어 표시하지 않음</p>${pill("제외", "warning")}</div></div>`)}</div>`;
}

const VIEWS = { overview: overviewView, mobility: mobilityView, ai: aiView, space: spaceView, outing: outingView, data: dataView };

function routeMeta() { return ROUTES.find(([id]) => id === state.route) || ROUTES[0]; }
function renderNav() { $("#nav").innerHTML = ROUTES.map(([id, label]) => `<button class="${id === state.route ? "active" : ""}" data-route="${id}" ${id === state.route ? 'aria-current="page"' : ""}>${escapeHtml(label)}</button>`).join(""); }
function render() {
  const [, label, description] = routeMeta();
  $("#pageTitle").textContent = label;
  $("#heading").textContent = label;
  $("#description").textContent = description;
  $("#breadcrumb").textContent = `MOOV / ${label}`;
  $("#view").innerHTML = VIEWS[state.route]();
  renderNav();
  document.title = `${label} · MOOV 앱 운영 대시보드`;
  $("#updatedAt").textContent = `확인 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
}

async function refreshServerState(showToast = true) {
  const fetchJson = async (path) => {
    try { const response = await fetch(path, { headers: { Accept: "application/json" } }); return response.ok ? response.json() : null; }
    catch { return null; }
  };
  [state.outingHealth, state.popularity] = await Promise.all([fetchJson("/api/outing/health"), fetchJson("/api/outing/popularity")]);
  render();
  if (showToast) toast(state.outingHealth?.ok ? "앱 상태와 나들이 API를 새로 확인했습니다." : "브라우저 상태를 갱신했습니다. 나들이 API는 오프라인입니다.");
}

let toastTimer;
function toast(message) { const element = $("#toast"); element.textContent = message; element.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove("show"), 2400); }
function closeMenu() { $(".sidebar").classList.remove("open"); $("#overlay").hidden = true; }
function setRoute(route, push = true) { state.route = VIEWS[route] ? route : "overview"; if (push) history.pushState(null, "", `#/${state.route}`); render(); closeMenu(); $("#main").focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }

document.addEventListener("click", (event) => { const route = event.target.closest("[data-route]"); if (route) setRoute(route.dataset.route); });
$("#refreshButton").addEventListener("click", () => refreshServerState());
$("#themeButton").addEventListener("click", () => { document.body.classList.toggle("dark"); localStorage.setItem("moov-dashboard-theme", document.body.classList.contains("dark") ? "dark" : "light"); toast("대시보드 색상 모드를 변경했습니다."); });
$("#menuButton").addEventListener("click", () => { $(".sidebar").classList.add("open"); $("#overlay").hidden = false; });
$("#overlay").addEventListener("click", closeMenu);
window.addEventListener("hashchange", () => setRoute(location.hash.replace(/^#\/?/, ""), false));

if (localStorage.getItem("moov-dashboard-theme") === "dark") document.body.classList.add("dark");
state.route = VIEWS[location.hash.replace(/^#\/?/, "")] ? location.hash.replace(/^#\/?/, "") : "overview";
history.replaceState(null, "", `#/${state.route}`);
render();
refreshServerState(false);
