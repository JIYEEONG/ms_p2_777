import { CONFIG } from "../config.js";
import { dataService } from "../services/data-service.js";
import { showToast, icon } from "../core/ui.js";
import { WELLNESS_PROGRAMS, WELLNESS_SAFETY_NOTICES, WELLNESS_STEPS } from "../data/wellness-routines.js";

let state = {
  view: "list",
  previewState: null,
  actualVehicleState: null,
  activity: "stretch",
  guideMode: "voice",
  programId: null,
  segments: [],
  segmentIndex: 0,
  phase: null,
  remaining: 0,
  paused: false
};
let activeContainer = null;
let timer = null;
let unsubscribe = null;

const THEME_LABELS = Object.fromEntries(CONFIG.media.windowThemes.map((theme) => [theme.id, theme.label]));
const clearTimer = () => { clearInterval(timer); timer = null; };
const stopSpeech = () => window.speechSynthesis?.cancel();

function activeThemeLabel() {
  try { return localStorage.getItem("moov-active-theme-label") || THEME_LABELS[localStorage.getItem("moov-active-theme")] || THEME_LABELS[CONFIG.defaults.windowTheme]; }
  catch { return THEME_LABELS[CONFIG.defaults.windowTheme]; }
}

function speechRateFor(text, availableSeconds) {
  const spokenCharacters = text.replace(/\s+/g, "").length;
  const estimatedSecondsAtNormalRate = spokenCharacters / 4.1;
  const targetSeconds = Math.max(1.4, availableSeconds - .8);
  return Math.min(1.8, Math.max(1.2, estimatedSecondsAtNormalRate / targetSeconds));
}

function speak(text, availableSeconds = 8) {
  if (state.guideMode !== "voice" || !("speechSynthesis" in window)) return;
  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = speechRateFor(text, availableSeconds);
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function programsFor(mode) {
  return WELLNESS_PROGRAMS.filter((program) => program.states.includes(mode) && program.activity === state.activity);
}

function totalSeconds(program) {
  return program.stepIds.reduce((sum, id) => sum + WELLNESS_STEPS[id].durationSec * (WELLNESS_STEPS[id].bilateral ? 2 : 1), 0);
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}분 ${remainder}초` : `${minutes}분`;
}

function stepDurationLabel(program) {
  const durations = [...new Set(program.stepIds.map((id) => WELLNESS_STEPS[id].durationSec))];
  return durations.length === 1 ? `${durations[0]}초씩` : "동작별 진행";
}

function flattenProgram(program) {
  return program.stepIds.flatMap((id) => {
    const step = WELLNESS_STEPS[id];
    return step.bilateral
      ? [{ step, side: "left" }, { step, side: "right" }]
      : [{ step, side: null }];
  });
}

function segmentImage(segment) {
  const image = segment.step.image;
  if (typeof image === "string") return image;
  return image?.[segment.side] || image?.left || image?.right || "";
}

function nextProgramFor(mode, currentId) {
  const programs = programsFor(mode).filter((program) => !program.id.endsWith("-all"));
  const currentIndex = programs.findIndex((program) => program.id === currentId);
  return currentIndex >= 0 ? programs[currentIndex + 1] || null : null;
}

function canStart(mode) {
  return !state.actualVehicleState || state.actualVehicleState === mode;
}

function renderStateChooser() {
  return `<div class="wellness-state-switch" role="group" aria-label="차량 상태별 프로그램 보기">
    <button type="button" data-preview-state="stopped" class="${state.previewState === "stopped" ? "is-active" : ""}" aria-pressed="${state.previewState === "stopped"}"><span>◉</span>정차중</button>
    <button type="button" data-preview-state="parked" class="${state.previewState === "parked" ? "is-active" : ""}" aria-pressed="${state.previewState === "parked"}"><span>P</span>주차중</button>
  </div>`;
}

function renderActivityChooser() {
  return `<div class="wellness-activity-tabs" role="tablist" aria-label="웰니스 프로그램 종류">
    <button type="button" role="tab" data-activity="stretch" class="${state.activity === "stretch" ? "is-active" : ""}" aria-selected="${state.activity === "stretch"}">스트레칭</button>
    <button type="button" role="tab" data-activity="yoga" class="${state.activity === "yoga" ? "is-active" : ""}" aria-selected="${state.activity === "yoga"}">요가</button>
  </div>`;
}

function safetyMarkup() {
  return `<aside class="wellness-safety"><strong>안전 안내</strong><ul>${WELLNESS_SAFETY_NOTICES.map((item) => `<li>${item}</li>`).join("")}</ul></aside>`;
}

function programCardMarkup(program, index, disabled) {
  const first = WELLNESS_STEPS[program.stepIds[0]];
  const firstImage = typeof first.image === "string" ? first.image : first.image.left;
  return `<article class="wellness-program-card compact ${disabled ? "is-readonly" : ""}" data-program="${program.id}" role="button" tabindex="${disabled ? "-1" : "0"}" aria-disabled="${disabled}" aria-label="${program.name} 시작">
    <img src="${firstImage}" alt="${program.name} 대표 자세" width="384" height="512" />
    <span class="program-number">${index + 1}</span>
    <div class="wellness-program-copy"><h3>${program.name}</h3><small>${icon("icon-clock")} ${formatDuration(totalSeconds(program))} · ${stepDurationLabel(program)}</small><em>${disabled ? "보기 전용" : program.subtitle}</em></div>
    <span class="routine-start" aria-hidden="true"><span>${icon("icon-play")}</span></span>
  </article>`;
}

function programListMarkup(programs, disabled) {
  return `<div class="wellness-program-list">${programs.map((program, index) => programCardMarkup(program, index, disabled)).join("")}</div>`;
}

function groupedYogaMarkup(programs, disabled) {
  const groups = [["low", "초급"], ["mid", "중급"], ["high", "고급"]];
  return groups.map(([id, label]) => `<section class="wellness-difficulty-section" aria-labelledby="yoga-${id}-title">
    <h4 id="yoga-${id}-title"><span>${label}</span></h4>
    ${programListMarkup(programs.filter((program) => program.difficulty === id), disabled)}
  </section>`).join("");
}

function renderList(container) {
  clearTimer();
  stopSpeech();
  state.view = "list";
  state.programId = null;
  if (state.actualVehicleState === "driving") return renderBlocked(container);
  const mode = state.previewState;
  container.innerHTML = `
    <section class="panel-view wellness-view" data-panel="wellness" data-wellness-view="list">
      <div class="active-theme-strip"><strong>적용 테마 <span>${activeThemeLabel()}</span></strong></div>
      <div class="panel-heading split-heading wellness-title-row"><div><h2>프로그램</h2></div></div>
      ${renderActivityChooser()}
      ${renderStateChooser()}
      ${!mode ? `<div class="wellness-empty"><strong>운행을 시작하세요</strong><p>차량 상태가 확인되면 이용 가능한 ${state.activity === "yoga" ? "요가" : "스트레칭"}가 자동으로 표시됩니다.</p></div>` : `
        <h3 class="wellness-list-label">${mode === "parked" ? "주차중" : "정차중"} ${state.activity === "yoga" ? "요가" : "스트레칭"}</h3>
        ${(() => {
          const programs = programsFor(mode);
          const allProgram = programs.find((program) => program.id.endsWith("-all"));
          const individualPrograms = programs.filter((program) => !program.id.endsWith("-all"));
          const disabled = !canStart(mode);
          return `${allProgram ? `<button class="wellness-all-program ${disabled ? "is-readonly" : ""}" type="button" data-program="${allProgram.id}" ${disabled ? "disabled" : ""}>
            <strong>전체</strong><i>${icon("icon-play")}</i>
          </button>` : ""}
          ${mode === "parked" && state.activity === "yoga" ? groupedYogaMarkup(individualPrograms, disabled) : programListMarkup(individualPrograms, disabled)}`;
        })()}`}
      ${safetyMarkup()}
    </section>`;
  container.querySelectorAll("[data-activity]").forEach((button) => button.addEventListener("click", () => {
    state.activity = button.dataset.activity;
    renderList(container);
  }));
  container.querySelectorAll("[data-preview-state]").forEach((button) => button.addEventListener("click", () => {
    state.previewState = button.dataset.previewState;
    renderList(container);
  }));
  container.querySelectorAll("[data-program]").forEach((button) => button.addEventListener("click", () => startProgram(container, button.dataset.program)));
  container.querySelectorAll(".wellness-program-card[data-program]").forEach((card) => card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startProgram(container, card.dataset.program);
    }
  }));
}

function startProgram(container, programId) {
  const program = WELLNESS_PROGRAMS.find((item) => item.id === programId);
  if (!program || !program.states.includes(state.previewState) || !canStart(state.previewState)) return;
  state.programId = programId;
  state.segments = flattenProgram(program);
  state.segmentIndex = 0;
  state.phase = "prepare";
  state.remaining = CONFIG.wellness.preparationSeconds;
  state.paused = false;
  renderSession(container);
}

function currentSegment() {
  return state.segments[state.segmentIndex];
}

function sessionTotalSeconds() {
  return CONFIG.wellness.preparationSeconds + state.segments.reduce((sum, item) => sum + item.step.durationSec, 0);
}

function sessionElapsedSeconds() {
  if (state.phase === "prepare") return CONFIG.wellness.preparationSeconds - state.remaining;
  const completed = state.segments.slice(0, state.segmentIndex).reduce((sum, item) => sum + item.step.durationSec, 0);
  return CONFIG.wellness.preparationSeconds + completed + (currentSegment().step.durationSec - state.remaining);
}

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.max(0, Math.floor(seconds % 60))).padStart(2, "0")}`;

function togglePlayback(container) {
  state.paused = !state.paused;
  if (state.paused) { clearTimer(); stopSpeech(); }
  renderSession(container);
}

function seekSession(container, requestedSeconds) {
  const target = Math.max(0, Math.min(sessionTotalSeconds(), Number(requestedSeconds)));
  clearTimer();
  stopSpeech();
  if (target < CONFIG.wellness.preparationSeconds) {
    state.phase = "prepare";
    state.segmentIndex = 0;
    state.remaining = Math.max(1, Math.ceil(CONFIG.wellness.preparationSeconds - target));
  } else {
    state.phase = "exercise";
    let offset = target - CONFIG.wellness.preparationSeconds;
    let index = 0;
    while (index < state.segments.length - 1 && offset >= state.segments[index].step.durationSec) {
      offset -= state.segments[index].step.durationSec;
      index += 1;
    }
    state.segmentIndex = index;
    state.remaining = Math.max(1, Math.ceil(state.segments[index].step.durationSec - offset));
  }
  state.paused = false;
  renderSession(container);
}

function startCountdown(container) {
  clearTimer();
  if (state.paused) return;
  timer = setInterval(() => {
    state.remaining = Math.max(0, state.remaining - 1);
    updateTimer(container);
    if (state.remaining === 0) {
      clearTimer();
      advance(container);
    }
  }, 1000);
}

function updateTimer(container) {
  const timerNode = container.querySelector("#wellness-timer-label");
  const progressNode = container.querySelector("#wellness-session-progress");
  const title = container.querySelector("#wellness-phase-title");
  if (timerNode) timerNode.textContent = `${state.remaining}초 남음`;
  const sessionTotal = sessionTotalSeconds();
  const elapsed = sessionElapsedSeconds();
  if (progressNode) {
    progressNode.value = elapsed;
    progressNode.style.setProperty("--seek", `${Math.min(100, (elapsed / sessionTotal) * 100)}%`);
  }
  const timeNode = container.querySelector("#wellness-media-time");
  if (timeNode) timeNode.textContent = `${formatTime(elapsed)} / ${formatTime(sessionTotal)}`;
  if (title && state.phase === "prepare") title.textContent = `${state.remaining}초 후 시작합니다`;
}

function previous(container) {
  if (state.phase === "prepare") {
    state.remaining = CONFIG.wellness.preparationSeconds;
    return renderSession(container);
  }
  state.segmentIndex = Math.max(0, state.segmentIndex - 1);
  state.remaining = currentSegment().step.durationSec;
  state.paused = false;
  renderSession(container);
}

function advance(container) {
  if (state.phase === "prepare") {
    state.phase = "exercise";
    state.remaining = currentSegment().step.durationSec;
    return renderSession(container);
  }
  if (state.segmentIndex >= state.segments.length - 1) return renderComplete(container);
  state.segmentIndex += 1;
  state.remaining = currentSegment().step.durationSec;
  renderSession(container);
}

function renderSession(container) {
  const segment = currentSegment();
  if (!segment) return renderList(container);
  state.view = "session";
  const program = WELLNESS_PROGRAMS.find((item) => item.id === state.programId);
  const sideText = segment.side ? (segment.side === "left" ? "왼쪽" : "오른쪽") : "동작";
  const title = state.phase === "prepare" ? `${state.remaining}초 후 시작합니다` : `${sideText} · ${segment.step.title}`;
  const imageSrc = segmentImage(segment);
  const mirrorImage = state.phase === "exercise" && segment.side === "right" && segment.step.mirrorRight;
  const sessionTotal = sessionTotalSeconds();
  const elapsed = sessionElapsedSeconds();
  container.innerHTML = `
    <section class="panel-view wellness-detail" data-panel="wellness" data-wellness-view="session">
      <div class="wellness-session-top"><button class="inline-back" id="wellness-back" type="button">${icon("icon-chevron-left")} 프로그램 목록</button><span class="vehicle-badge">${state.previewState === "parked" ? "P 주차중" : "◉ 정차중"}</span></div>
      <div class="wellness-step-head"><div><span class="program-badge">${program.name}</span><h2>${segment.step.title}</h2></div><strong>${state.segmentIndex + 1} / ${state.segments.length}</strong></div>
      <article class="wellness-step-card">
        <div class="wellness-image-frame">
          <img id="wellness-step-image" class="${mirrorImage ? "is-mirrored" : ""}" src="${imageSrc}" alt="${sideText} ${segment.step.title} 자세" width="384" height="512" role="button" tabindex="0" aria-label="사진을 눌러 ${state.paused ? "계속 재생" : "일시정지"}" />
          <div class="wellness-media-controls" role="toolbar" aria-label="자세 재생 도구">
            <input id="wellness-session-progress" class="wellness-media-seek" type="range" min="0" max="${sessionTotal}" step="1" value="${elapsed}" style="--seek:${Math.min(100, (elapsed / sessionTotal) * 100)}%" aria-label="프로그램 재생 위치" />
            <button id="wellness-pause" type="button" aria-label="${state.paused ? "계속 재생" : "일시정지"}">${icon(state.paused ? "icon-play" : "icon-pause")}</button>
            <button id="wellness-previous" type="button" ${state.segmentIndex === 0 ? "disabled" : ""} aria-label="이전 자세">${icon("icon-skip-back")}</button>
            <button id="wellness-skip" type="button" aria-label="다음 자세">${icon("icon-skip-forward")}</button>
            <button id="wellness-voice" type="button" class="${state.guideMode === "voice" ? "is-on" : ""}" aria-pressed="${state.guideMode === "voice"}" aria-label="음성 안내 ${state.guideMode === "voice" ? "끄기" : "켜기"}">${icon(state.guideMode === "voice" ? "icon-volume" : "icon-volume-off")}</button>
            <strong id="wellness-media-time">${formatTime(elapsed)} / ${formatTime(sessionTotal)}</strong>
          </div>
        </div>
        <div class="wellness-caption" aria-live="polite">
          <div><span>${state.phase === "prepare" ? "준비" : sideText}</span><strong id="wellness-phase-title">${title}</strong></div>
          <b id="wellness-timer-label">${state.remaining}초 남음</b>
          <p>${segment.step.guide}</p>
          <small><strong>주의</strong> ${segment.step.caution}</small>
        </div>
      </article>
      <div class="wellness-session-actions">
        ${state.phase === "prepare" ? '<button class="green-action" id="wellness-start-now" type="button">바로 시작</button>' : ""}
      </div>
      ${safetyMarkup()}
    </section>`;
  container.querySelector("#wellness-back").addEventListener("click", () => renderList(container));
  container.querySelector("#wellness-start-now")?.addEventListener("click", () => { state.phase = "exercise"; state.remaining = currentSegment().step.durationSec; renderSession(container); });
  const stepImage = container.querySelector("#wellness-step-image");
  stepImage.addEventListener("click", () => togglePlayback(container));
  stepImage.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); togglePlayback(container); }
  });
  container.querySelector("#wellness-pause").addEventListener("click", () => togglePlayback(container));
  container.querySelector("#wellness-previous").addEventListener("click", () => previous(container));
  container.querySelector("#wellness-skip").addEventListener("click", () => advance(container));
  container.querySelector("#wellness-voice").addEventListener("click", () => {
    state.guideMode = state.guideMode === "voice" ? "text" : "voice";
    if (state.guideMode !== "voice") stopSpeech();
    renderSession(container);
    showToast(state.guideMode === "voice" ? "음성 안내를 켰습니다." : "음성 안내를 껐습니다.");
  });
  const seek = container.querySelector("#wellness-session-progress");
  seek.addEventListener("input", () => {
    const value = Number(seek.value);
    seek.style.setProperty("--seek", `${Math.min(100, (value / sessionTotal) * 100)}%`);
    container.querySelector("#wellness-media-time").textContent = `${formatTime(value)} / ${formatTime(sessionTotal)}`;
  });
  seek.addEventListener("change", () => seekSession(container, seek.value));
  if (!state.paused) {
    const speechText = state.phase === "prepare" ? `${program.name}, 3초 후 시작합니다.` : `${sideText} ${segment.step.guide}`;
    speak(speechText, state.remaining);
    startCountdown(container);
  }
}

function renderComplete(container) {
  clearTimer();
  stopSpeech();
  state.view = "complete";
  const program = WELLNESS_PROGRAMS.find((item) => item.id === state.programId);
  const nextProgram = nextProgramFor(state.previewState, program.id);
  container.innerHTML = `<section class="panel-view wellness-complete" data-wellness-view="complete"><div class="complete-mark">${icon("icon-check")}</div><span class="program-badge">PROGRAM COMPLETE</span><h2>${program.name} 완료</h2><p>모든 동작을 마쳤습니다. 천천히 편안한 자세로 돌아오세요.</p><div class="wellness-complete-actions"><button class="green-action" id="wellness-complete-next" type="button">${nextProgram ? "다음" : "프로그램 목록"}</button></div></section>`;
  container.querySelector("#wellness-complete-next").addEventListener("click", () => nextProgram ? startProgram(container, nextProgram.id) : renderList(container));
}

function renderBlocked(container) {
  clearTimer();
  stopSpeech();
  container.innerHTML = `<section class="panel-view wellness-blocked" data-wellness-view="blocked"><div class="wellness-blocked-icon">${icon("icon-car")}</div><h2>차량 이동 중에는 이용할 수 없어요</h2><p>안전을 위해 프로그램과 음성 안내를 정지했습니다.</p></section>`;
}

function handleVehicleState(nextState) {
  if (!nextState) return;
  state.actualVehicleState = nextState;
  state.previewState = nextState === "driving" ? null : nextState;
  if (!activeContainer) return;
  if (nextState === "driving") renderBlocked(activeContainer);
  else renderList(activeContainer);
}

export function renderWellnessPanel(container) {
  activeContainer = container;
  renderList(container);
  unsubscribe?.();
  unsubscribe = dataService.subscribeVehicleState(handleVehicleState);
  dataService.getVehicleState().then(handleVehicleState).catch(() => {});
}

export function cleanupWellness() {
  clearTimer();
  stopSpeech();
  unsubscribe?.();
  unsubscribe = null;
  activeContainer = null;
  state.view = "list";
}
