import { CONFIG } from "../config.js";
import { dataService } from "../services/data-service.js";
import { showToast, icon } from "../core/ui.js";
import { announceCabinTheme, cabinPreviewMarkup, screenMediaMarkup, updateCabinPreview } from "../core/cabin-preview.js";

const NATURE_SOUNDS = Object.freeze([
  { id: "bird-scops-owl", label: "소쩍새", src: "./assets/audio/nature/oriental-scops-owl.mp3", group: "새소리" },
  { id: "bird-goshawk", label: "참매", src: "./assets/audio/nature/goshawk.mp3", group: "새소리" },
  { id: "bird-owl", label: "부엉이", src: "./assets/audio/nature/owl.mp3", group: "새소리" },
  { id: "bird-eagle", label: "독수리", src: "./assets/audio/nature/eagle.mp3", group: "새소리" },
  { id: "bird-oriole", label: "꾀꼬리", src: "./assets/audio/nature/black-naped-oriole.mp3", group: "새소리" },
  { id: "bird-tit", label: "박새", src: "./assets/audio/nature/tit.mp3", group: "새소리" },
  { id: "bird-nightingale", label: "나이팅게일", src: "./assets/audio/nature/nightingale.mp3", group: "새소리" },
  { id: "bird-dove", label: "멧비둘기", src: "./assets/audio/nature/oriental-turtle-dove.mp3", group: "새소리" },
  { id: "bird-thrush", label: "되지빠귀", src: "./assets/audio/nature/dusky-thrush.mp3", group: "새소리" },
  { id: "bird-red-tail", label: "붉은꼬리매", src: "./assets/audio/nature/red-tailed-hawk.mp3", group: "새소리" },
  { id: "bird-wren", label: "굴뚝새", src: "./assets/audio/nature/wren.mp3", group: "새소리" },
  { id: "bird-seagull", label: "갈매기", src: "./assets/audio/nature/seagull.mp3", group: "새소리" },
  { id: "bird-skylark", label: "종달새", src: "./assets/audio/nature/skylark.mp3", group: "새소리" },
  { id: "bird-sparrow", label: "참새", src: "./assets/audio/nature/sparrow.mp3", group: "새소리" },
  { id: "bird-warbler", label: "휘파람새", src: "./assets/audio/nature/warbler.mp3", group: "새소리" },
  { id: "frog-tree", label: "청개구리", src: "./assets/audio/nature/tree-frog.mp3", group: "개구리·양서류" },
  { id: "frog-narrow-mouth", label: "맹꽁이", src: "./assets/audio/nature/narrow-mouth-frog.mp3", group: "개구리·양서류" },
  { id: "frog-chorus", label: "개구리 합창", src: "./assets/audio/nature/frog-chorus.mp3", group: "개구리·양서류" },
  { id: "frog-toad", label: "두꺼비", src: "./assets/audio/nature/toad.mp3", group: "개구리·양서류" }
]);
const BIRD_OFF_ID = "none";
const WAVE_SOUNDS = Object.freeze([
  { id: "waves-soft", label: "파도 소리 · 소", volume: .24 },
  { id: "waves-medium", label: "파도 소리 · 중", volume: .48 },
  { id: "waves-strong", label: "파도 소리 · 대", volume: .72 }
]);
const SKY_WIND_ID = "sky-wind";
const SPACE_SOUND_KEY = "space";
const MAX_MIXED_SOUNDS = 3;
const CLASSIC_SOUNDS = Object.freeze([
  { id: "classic-bach-air", label: "바흐 · G선상의 아리아", src: "./assets/audio/classic/bach-air.mp3", group: "클래식" },
  { id: "classic-beethoven-collection", label: "베토벤 · 교향곡 모음", src: "./assets/audio/classic/beethoven-symphonies.mp3", group: "클래식" },
  { id: "classic-beethoven-pastoral", label: "베토벤 · 전원 교향곡", src: "./assets/audio/classic/beethoven-pastoral.mp3", group: "클래식" },
  { id: "classic-aquarium", label: "생상스 · 수족관", src: "./assets/audio/classic/saint-saens-aquarium.mp3", group: "클래식" },
  { id: "classic-chopin-nocturne", label: "쇼팽 · 녹턴 Op.9 No.2", src: "./assets/audio/classic/chopin-nocturne-9-2.mp3", group: "클래식" },
  { id: "classic-debussy-la-mer", label: "드뷔시 · 바다", src: "./assets/audio/classic/debussy-la-mer.mp3", group: "클래식" },
  { id: "classic-dvorak-new-world", label: "드보르자크 · 신세계 4악장", src: "./assets/audio/classic/dvorak-new-world-4.mp3", group: "클래식" },
  { id: "classic-grieg-morning", label: "그리그 · 아침의 기분", src: "./assets/audio/classic/grieg-morning-mood.mp3", group: "클래식" },
  { id: "classic-holst-mars", label: "홀스트 · 화성", src: "./assets/audio/classic/holst-mars.mp3", group: "클래식" },
  { id: "classic-satie-gymnopedie", label: "사티 · 짐노페디 1번", src: "./assets/audio/classic/satie-gymnopedie-1.mp3", group: "클래식" },
  { id: "classic-holst-jupiter", label: "홀스트 · 목성", src: "./assets/audio/classic/holst-jupiter.mp3", group: "클래식" },
  { id: "classic-mozart-clarinet", label: "모차르트 · 클라리넷 협주곡 아다지오", src: "./assets/audio/classic/mozart-clarinet-adagio.mp3", group: "클래식" },
  { id: "classic-vivaldi-spring", label: "비발디 · 사계 중 봄", src: "./assets/audio/classic/vivaldi-spring.mp3", group: "클래식" },
  { id: "classic-holst-venus", label: "홀스트 · 금성", src: "./assets/audio/classic/holst-venus.mp3", group: "클래식" },
  { id: "classic-tchaikovsky-barcarolle", label: "차이콥스키 · 6월 뱃노래", src: "./assets/audio/classic/tchaikovsky-barcarolle.mp3", group: "클래식" }
]);
const EFFECT_SOUNDS = Object.freeze([
  { id: "forest-frog", label: "개구리", synth: "frog" },
  { id: "forest-crickets", label: "귀뚜라미", synth: "crickets" },
  { id: "sea-whale", label: "고래", synth: "whale" },
  { id: "sea-dolphin", label: "돌고래", synth: "dolphin" },
  { id: SKY_WIND_ID, label: "하늘 바람", synth: "wind" },
  { id: "space-ambient", label: "우주 앰비언트", synth: "space" },
  { id: "interstellar-demo", label: "인터스텔라", synth: "cosmic-organ" },
  { id: "cabin-announcement", label: "기내 방송 · 1회", action: true }
]);

const rainAudio = new Audio(CONFIG.media.rainSound);
rainAudio.loop = true;
let customAudio = null;
const activeAudioTracks = new Map();
const activeSynths = new Map();
let audioContext = null;
let announcementTimer = null;

function initialThemeId() {
  try {
    const saved = localStorage.getItem("moov-active-theme");
    if (CONFIG.media.windowThemes.some((theme) => theme.id === saved)) return saved;
  } catch {}
  return CONFIG.defaults.windowTheme;
}

function initialDisplayPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem("moov-display-preferences") || "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

const savedDisplay = initialDisplayPreferences();

let state = {
  view: "themes",
  theme: initialThemeId(),
  weather: Number.isFinite(savedDisplay.weather) ? savedDisplay.weather : CONFIG.defaults.windowWeather,
  brightness: Number.isFinite(savedDisplay.brightness) ? savedDisplay.brightness : CONFIG.defaults.windowBrightness,
  temperature: Number.isFinite(savedDisplay.temperature) ? savedDisplay.temperature : 50,
  motion: true,
  preferenceTheme: initialThemeId(),
  privateSlots: Array.from({ length: 4 }, (_, index) => ({ screens: null, mediaName: `내 테마 ${index + 1}`, mediaUrl: null, mediaType: "image" })),
  privateSlotIndex: 0,
  privateCustomApplied: false,
  customAudioUrl: null,
  customAudioName: "업로드한 소리 없음",
  customAudioMuted: false,
  soundByTheme: { forest: ["bird-tit"], sea: ["waves-medium"], sky: ["bird-skylark"], space: ["space-ambient"], private: [], ...(savedDisplay.soundByTheme || {}) },
  volumeByTheme: { forest: 58, sea: 58, sky: 55, space: 48, private: 55, ...(savedDisplay.volumeByTheme || {}) }
};

Object.keys(state.soundByTheme).forEach((key) => {
  const value = state.soundByTheme[key];
  state.soundByTheme[key] = Array.isArray(value) ? value.filter((id) => id && id !== BIRD_OFF_ID).slice(0, MAX_MIXED_SOUNDS) : value && value !== BIRD_OFF_ID ? [value] : [];
});

const selectedTheme = () => CONFIG.media.windowThemes.find((theme) => theme.id === state.theme) || CONFIG.media.windowThemes[0];
const themeById = (id) => CONFIG.media.windowThemes.find((theme) => theme.id === id) || CONFIG.media.windowThemes[0];
const activePrivateSlot = () => state.privateSlots[state.privateSlotIndex];
const privateScreens = (index = state.privateSlotIndex) => state.privateSlots[index]?.screens || themeById("private").screens;
const screensForTheme = (theme) => theme.id === "private" && state.privateCustomApplied ? privateScreens() : theme.screens;

function mediaScreenMarkup(value, position, label) {
  return `<figure class="theme-screen theme-screen-${position}">${screenMediaMarkup(value, position, label, "data-theme-screen")}<span class="weather-overlay" aria-hidden="true"></span><figcaption>${position === "left" ? "좌측" : position === "front" ? "정면" : "우측"}</figcaption></figure>`;
}

function threeScreenMarkup(theme, screens = theme.screens, compact = false) {
  const rain = Math.max(0, (50 - state.weather) / 50);
  const displayScreens = compact
    ? Object.fromEntries(Object.entries(screens).map(([key, value]) => [key, typeof value === "object" && value.type === "video" ? (value.poster || value.src) : value]))
    : screens;
  return `<div class="three-screen-preview theme-${theme.id} ${compact ? "is-compact" : ""} ${state.motion ? "has-motion" : "is-paused"}" style="--theme-brightness:${.45 + state.brightness / 100 * .75};--theme-rain:${rain};--theme-warmth:${(state.temperature - 50) / 50}">
    ${["left", "front", "right"].map((position) => mediaScreenMarkup(displayScreens[position], position, theme.label)).join("")}
  </div>`;
}

function themeThumbnailMarkup(theme) {
  const front = theme.screens.front;
  const src = typeof front === "object" ? (front.poster || front.src) : front;
  return `<span class="theme-row-thumb"><img src="${src}" alt="${theme.alt}" /></span>`;
}

function bindMedia(container) {
  container.querySelectorAll("video[data-theme-screen]").forEach((video) => {
    video.muted = true;
    if (state.motion) video.play().catch(() => {});
    else video.pause();
  });
}

function themeDisplayLabel(theme) {
  return theme.id === "private" && state.privateCustomApplied ? `Private · 내 테마 ${state.privateSlotIndex + 1}` : theme.label;
}

function rememberAppliedTheme(id, label = themeById(id).label) {
  try {
    localStorage.setItem("moov-active-theme", id);
    localStorage.setItem("moov-active-theme-label", label);
  } catch {}
}

function previewTheme(container, theme, { applied = false, screens = screensForTheme(theme) } = {}) {
  const detail = {
    themeId: theme.id, label: themeDisplayLabel(theme), screens, brightness: state.brightness,
    weather: state.weather, temperature: state.temperature, motion: state.motion, applied
  };
  updateCabinPreview(container, detail);
  announceCabinTheme(detail);
}

function activeSoundKey(themeId = state.theme) {
  return themeId === "private" && !state.privateCustomApplied ? SPACE_SOUND_KEY : themeId;
}

function ambientOptions(soundKey) {
  const nature = NATURE_SOUNDS.map((sound) => ({ ...sound, kind: "file" }));
  const classics = CLASSIC_SOUNDS.map((sound) => ({ ...sound, kind: "file" }));
  const waves = WAVE_SOUNDS.map((sound) => ({ ...sound, kind: "wave", src: themeById("sea").ambient || CONFIG.media.rainSound }));
  const effect = (id) => EFFECT_SOUNDS.find((sound) => sound.id === id);
  const birds = nature.filter((sound) => sound.group === "새소리");
  const amphibians = nature.filter((sound) => sound.group === "개구리·양서류");
  const grouped = (sounds) => sounds.map((sound) => ({ ...sound, group: "환경음·효과" }));

  if (soundKey === "forest") return [...birds, ...amphibians, ...classics, ...grouped([effect("forest-crickets")])];
  if (soundKey === "sea") return [
    ...birds.filter((sound) => sound.id === "bird-seagull"),
    ...classics,
    ...grouped([...waves, effect("sea-whale"), effect("sea-dolphin")])
  ];
  if (soundKey === "sky") return [
    ...birds,
    ...classics,
    ...grouped([effect(SKY_WIND_ID)]),
    effect("cabin-announcement")
  ];
  if (soundKey === SPACE_SOUND_KEY) return [...classics, effect("cabin-announcement")];
  return [
    ...nature,
    ...classics,
    ...grouped([...waves, effect("forest-crickets"), effect("sea-whale"), effect("sea-dolphin"), effect(SKY_WIND_ID), effect("space-ambient"), effect("interstellar-demo")])
  ];
}

function featuredSoundIds(soundKey) {
  if (soundKey === "forest") return ["frog-tree", "frog-narrow-mouth", "frog-chorus", "frog-toad", "forest-crickets"];
  if (soundKey === "sea") return ["waves-soft", "waves-medium", "waves-strong"];
  if (soundKey === "sky") return ["bird-goshawk", "bird-red-tail", "bird-eagle"];
  if (soundKey === SPACE_SOUND_KEY) return ["classic-holst-mars", "classic-holst-jupiter", "classic-holst-venus"];
  return [];
}

function ensureSoundChoice(soundKey) {
  const valid = new Set(ambientOptions(soundKey).filter((option) => !option.action).map((option) => option.id));
  state.soundByTheme[soundKey] = (state.soundByTheme[soundKey] || []).filter((id) => valid.has(id)).slice(0, MAX_MIXED_SOUNDS);
  return state.soundByTheme[soundKey];
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  audioContext.resume?.().catch(() => {});
  return audioContext;
}

function playTone(frequency, duration, volume, type = "sine", delay = 0) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(.001, volume), start + .04);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .05);
}

function synthPattern(kind, volume) {
  const patterns = {
    vivaldi: [659, 659, 659, 587, 523, 587, 659, 784],
    nautical: [196, 262, 294, 330, 294, 262, 220, 196],
    airy: [523, 659, 784, 988, 784, 659, 587, 698],
    "cosmic-organ": [110, 165, 220, 330, 247, 196, 147, 110],
    frog: [145, 118, 145],
    crickets: [3200, 3500, 3300, 3700],
    whale: [110, 98, 82, 123],
    dolphin: [1700, 2100, 2500, 1900],
    space: [110, 165, 220, 277]
  };
  const notes = patterns[kind] || patterns.space;
  const short = ["frog", "crickets", "dolphin"].includes(kind);
  notes.forEach((frequency, index) => playTone(frequency, short ? .16 : .72, volume * (short ? .34 : .18), short ? "sine" : "triangle", index * (short ? .12 : .48)));
}

function startSynthLoop(sound, volume) {
  if (activeSynths.has(sound.id)) return;
  if (sound.synth === "wind") {
    const context = getAudioContext();
    if (!context) return;
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * .25;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 720;
    gain.gain.value = volume * .16;
    source.buffer = buffer;
    source.loop = true;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    activeSynths.set(sound.id, { stop: () => { try { source.stop(); } catch {} } });
    return;
  }
  synthPattern(sound.synth, volume);
  const timer = window.setInterval(() => synthPattern(sound.synth, volume), ["frog", "crickets", "dolphin"].includes(sound.synth) ? 4200 : 5200);
  activeSynths.set(sound.id, { stop: () => window.clearInterval(timer) });
}

function stopOneShotAudio() {
  if (announcementTimer) window.clearTimeout(announcementTimer);
  announcementTimer = null;
  window.speechSynthesis?.cancel();
}

function playCabinAnnouncementOnce(volume = .5) {
  stopOneShotAudio();
  playTone(659, .28, volume * .18, "sine");
  playTone(880, .4, volume * .16, "sine", .32);
  announcementTimer = window.setTimeout(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    const message = new SpeechSynthesisUtterance("Ladies and gentlemen, welcome aboard MOOV. Please remain seated and keep your seat belt fastened. We hope you enjoy your journey.");
    message.lang = "en-US";
    message.rate = .84;
    message.pitch = .92;
    message.volume = Math.min(1, volume);
    window.speechSynthesis.speak(message);
    announcementTimer = null;
  }, 820);
  showToast("기내 안내방송을 한 번 재생합니다.");
}

function stopSynths() {
  activeSynths.forEach((entry) => entry.stop());
  activeSynths.clear();
}

function syncAmbientAudio(themeId) {
  rainAudio.pause();
  const soundKey = activeSoundKey(themeId);
  const selected = ensureSoundChoice(soundKey);
  const options = new Map(ambientOptions(soundKey).map((sound) => [sound.id, sound]));
  const volume = (state.volumeByTheme[soundKey] ?? 55) / 100;
  const desiredFiles = new Set(selected.filter((id) => ["file", "wave"].includes(options.get(id)?.kind)));
  activeAudioTracks.forEach((audio, id) => {
    if (!desiredFiles.has(id)) { audio.pause(); audio.currentTime = 0; activeAudioTracks.delete(id); }
  });
  desiredFiles.forEach((id) => {
    const sound = options.get(id);
    let audio = activeAudioTracks.get(id);
    if (!audio) { audio = new Audio(sound.src); audio.loop = true; activeAudioTracks.set(id, audio); }
    audio.volume = Math.min(.8, volume * (sound.volume || .62));
    audio.play().catch(() => {});
  });
  stopSynths();
  selected.forEach((id) => {
    const sound = options.get(id);
    if (sound?.synth) startSynthLoop(sound, volume);
  });
  if (customAudio && !state.customAudioMuted && soundKey === "private" && state.privateCustomApplied) {
    customAudio.volume = Math.min(.8, volume);
    customAudio.play().catch(() => {});
  } else customAudio?.pause();
}

function stopAmbientAudio() {
  rainAudio.pause();
  activeAudioTracks.forEach((audio) => { audio.pause(); audio.currentTime = 0; });
  activeAudioTracks.clear();
  stopSynths();
  stopOneShotAudio();
  customAudio?.pause();
}

function saveDisplayPreferences() {
  try {
    localStorage.setItem("moov-display-preferences", JSON.stringify({
      temperature: state.temperature,
      brightness: state.brightness,
      weather: state.weather,
      soundByTheme: state.soundByTheme,
      volumeByTheme: state.volumeByTheme
    }));
  } catch {}
}

async function applySelectedTheme(container, theme, { spaceMode = false } = {}) {
  const leavingSpace = state.theme === "private" && !state.privateCustomApplied;
  state.theme = theme.id;
  state.preferenceTheme = theme.id;
  state.privateCustomApplied = theme.id === "private" && !spaceMode;
  if (!spaceMode && leavingSpace) state.motion = true;
  if (spaceMode) {
    state.motion = false;
  }
  rememberAppliedTheme(theme.id, spaceMode ? "Space" : themeDisplayLabel(theme));
  previewTheme(container, theme, { applied: true, screens: spaceMode ? theme.screens : screensForTheme(theme) });
  syncAmbientAudio(theme.id);
  await dataService.sendVehicleCommand("window.apply", {
    theme: theme.id,
    weather: state.weather,
    screens: spaceMode ? theme.screens : screensForTheme(theme),
    sound: ensureSoundChoice(spaceMode ? SPACE_SOUND_KEY : activeSoundKey(theme.id)),
    motion: state.motion
  });
  showToast(`${theme.label} 테마가 저장되었습니다.`);
}

function soundSettingsMarkup(soundKey, { privateMode = false } = {}) {
  const selected = ensureSoundChoice(soundKey);
  const options = ambientOptions(soundKey);
  const selectable = options.filter((sound) => !sound.action);
  const featuredIds = featuredSoundIds(soundKey);
  const featuredOptions = featuredIds.map((id) => selectable.find((sound) => sound.id === id)).filter(Boolean);
  const dropdownOptions = selectable.filter((sound) => !featuredIds.includes(sound.id));
  const selectedOptions = selectable.filter((sound) => selected.includes(sound.id));
  const groups = ["새소리", "개구리·양서류", "클래식", "환경음·효과"];
  const hasCabinAnnouncement = options.some((sound) => sound.id === "cabin-announcement");
  const label = soundKey === SPACE_SOUND_KEY ? "Space" : soundKey === "private" ? "Private" : themeById(soundKey).label;
  return `<section class="inline-theme-settings" data-sound-settings="${soundKey}">
    <div class="inline-settings-title"><div><strong>${icon("icon-music")} ${label} 배경음</strong><small>테마에 어울리는 소리만 표시 · 최대 ${MAX_MIXED_SOUNDS}개</small></div><button type="button" data-sound-off class="sound-off ${selected.length ? "" : "is-active"}">전체 소리 끄기</button></div>
    ${featuredOptions.length ? `<div class="featured-sound-block"><span>핵심 소리</span><div class="featured-sound-row">${featuredOptions.map((sound) => `<button type="button" data-sound-id="${sound.id}" class="${selected.includes(sound.id) ? "is-active" : ""}" aria-pressed="${selected.includes(sound.id)}">${sound.label}</button>`).join("")}</div></div>` : ""}
    <div class="sound-dropdown-row">
      <label for="sound-picker-${soundKey}">소리 선택</label>
      <select id="sound-picker-${soundKey}" data-sound-picker>
        <option value="">목록에서 소리를 선택하세요</option>
        ${groups.map((group) => {
          const groupOptions = dropdownOptions.filter((sound) => sound.group === group);
          return groupOptions.length ? `<optgroup label="${group}">${groupOptions.map((sound) => `<option value="${sound.id}" ${selected.includes(sound.id) ? "disabled" : ""}>${sound.label}${selected.includes(sound.id) ? " · 선택됨" : ""}</option>`).join("")}</optgroup>` : "";
        }).join("")}
      </select>
    </div>
    <div class="selected-sound-list" aria-label="현재 선택한 배경음">
      ${selectedOptions.length ? selectedOptions.map((sound) => `<button type="button" data-sound-id="${sound.id}" class="is-active" aria-pressed="true">${sound.label}<span aria-hidden="true">×</span></button>`).join("") : `<span class="sound-empty">선택한 소리가 없습니다.</span>`}
    </div>
    <div class="sound-action-row">
      ${hasCabinAnnouncement ? `<button type="button" data-sound-id="cabin-announcement" class="is-action">기내 방송 · 1회</button>` : ""}
    </div>
    ${privateMode ? `<p class="private-selection">업로드한 개인 음악과 공통 배경음을 함께 사용할 수 있습니다.</p>` : ""}
    <div class="inline-slider-grid">
      <label><span>소리 크기 <output data-volume-value>${state.volumeByTheme[soundKey]}%</output></span><input data-sound-volume type="range" min="0" max="100" value="${state.volumeByTheme[soundKey]}" /></label>
      <label><span>밝기 <output data-brightness-value>${state.brightness}%</output></span><input data-theme-brightness type="range" min="10" max="100" value="${state.brightness}" /></label>
    </div>
  </section>`;
}

function bindSoundSettings(container, soundKey, rerender) {
  const root = container.querySelector(`[data-sound-settings="${soundKey}"]`);
  if (!root) return;
  root.querySelector("[data-sound-off]").addEventListener("click", () => {
    state.soundByTheme[soundKey] = [];
    if (soundKey === "private") state.customAudioMuted = true;
    stopAmbientAudio();
    saveDisplayPreferences();
    dataService.sendVehicleCommand("window.sound", { theme: soundKey, selected: [] });
    rerender();
  });
  root.querySelector("[data-sound-picker]").addEventListener("change", (event) => {
    const id = event.target.value;
    if (!id) return;
    const current = [...ensureSoundChoice(soundKey)];
    if (current.length >= MAX_MIXED_SOUNDS) { showToast("배경음은 최대 3개까지 함께 선택할 수 있습니다."); event.target.value = ""; return; }
    state.soundByTheme[soundKey] = [...current, id];
    if (soundKey === "private") state.customAudioMuted = false;
    saveDisplayPreferences();
    syncAmbientAudio(state.theme);
    dataService.sendVehicleCommand("window.sound", { theme: soundKey, selected: state.soundByTheme[soundKey] });
    rerender();
  });
  root.querySelectorAll("[data-sound-id]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.soundId;
    const option = ambientOptions(soundKey).find((sound) => sound.id === id);
    if (id === "cabin-announcement") { playCabinAnnouncementOnce((state.volumeByTheme[soundKey] || 55) / 100); return; }
    const current = [...ensureSoundChoice(soundKey)];
    const exists = current.includes(id);
    let next = exists ? current.filter((value) => value !== id) : [...current, id];
    if (id.startsWith("waves-")) next = next.filter((value) => !value.startsWith("waves-") || value === id);
    if (next.length > MAX_MIXED_SOUNDS) { showToast("배경음은 최대 3개까지 함께 선택할 수 있습니다."); return; }
    state.soundByTheme[soundKey] = next;
    if (soundKey === "private") state.customAudioMuted = false;
    saveDisplayPreferences();
    syncAmbientAudio(state.theme);
    dataService.sendVehicleCommand("window.sound", { theme: soundKey, selected: next });
    rerender();
  }));
  root.querySelector("[data-sound-volume]").addEventListener("input", (event) => {
    state.volumeByTheme[soundKey] = Number(event.target.value);
    root.querySelector("[data-volume-value]").textContent = `${event.target.value}%`;
    saveDisplayPreferences();
    syncAmbientAudio(state.theme);
    dataService.sendVehicleCommand("window.sound.volume", { theme: soundKey, volume: state.volumeByTheme[soundKey] });
  });
  root.querySelector("[data-theme-brightness]").addEventListener("input", (event) => {
    state.brightness = Number(event.target.value);
    root.querySelector("[data-brightness-value]").textContent = `${event.target.value}%`;
    saveDisplayPreferences();
    previewTheme(container, selectedTheme(), { applied: true, screens: screensForTheme(selectedTheme()) });
    dataService.sendVehicleCommand("window.brightness", { theme: soundKey, brightness: state.brightness });
  });
}

export function renderThemePanel(container) {
  state.view = "themes";
  const theme = selectedTheme();
  const activeScreens = screensForTheme(theme);
  const spaceLocked = theme.id === "private" && !state.privateCustomApplied;
  const basicSoundKey = theme.id === "private" ? (state.privateCustomApplied ? null : SPACE_SOUND_KEY) : theme.id;
  container.innerHTML = `
    <section class="panel-view theme-view" data-panel="thema" data-theme-view="themes">
      <div class="panel-heading split-heading theme-heading"><div><h2>테마 설정</h2><p>분할된 전면·좌우 3면이 같은 장소처럼 이어집니다.</p></div>
        <div class="theme-control-stack">
          <button class="motion-chip ${state.motion ? "is-on" : ""}" id="theme-motion" type="button" aria-pressed="${state.motion}" ${spaceLocked ? "disabled" : ""}>${icon(state.motion ? "icon-pause" : "icon-play")} ${state.motion ? "움직임 켜짐" : "움직임 꺼짐"}</button>
          <button class="theme-settings-button" id="personal-settings" type="button">${icon("icon-settings")} 설정</button>
        </div>
      </div>
      <figure class="theme-cabin-preview"><figcaption><span>차량 3면 미리보기</span><strong data-cabin-theme-name>${themeDisplayLabel(theme)} · 3면 미리보기</strong></figcaption>
        ${cabinPreviewMarkup({ screens: activeScreens, label: themeDisplayLabel(theme), compact: true, weather: state.weather })}
      </figure>
      <section class="theme-library-section private-library"><div class="theme-section-title"><h3>Private</h3><span>내가 설정한 테마</span></div>
        <div class="private-slot-grid">${state.privateSlots.map((slot, index) => `<button type="button" data-private-slot="${index}" class="${state.privateCustomApplied && state.theme === "private" && state.privateSlotIndex === index ? "is-active" : ""}"><strong>내 테마 ${index + 1}</strong><small>${slot.screens ? slot.mediaName : "사진·동영상 설정"}</small></button>`).join("")}</div>
      </section>
      <section class="theme-library-section"><div class="theme-section-title"><h3>기본 테마</h3></div>
        <div class="theme-compact-row" role="list" aria-label="기본 테마 선택">
          ${CONFIG.media.windowThemes.map((item) => `<button class="theme-compact-card ${item.id === state.theme && !(item.id === "private" && state.privateCustomApplied) ? "is-active" : ""}" type="button" data-theme="${item.id}" aria-pressed="${item.id === state.theme && !(item.id === "private" && state.privateCustomApplied)}">${themeThumbnailMarkup(item)}<strong>${item.label}</strong></button>`).join("")}
        </div>
        ${basicSoundKey ? soundSettingsMarkup(basicSoundKey) : ""}
      </section>
    </section>`;
  bindMedia(container);
  container.querySelectorAll("[data-theme]").forEach((button) => button.addEventListener("click", async () => {
    const nextTheme = themeById(button.dataset.theme);
    await applySelectedTheme(container, nextTheme, { spaceMode: nextTheme.id === "private" });
    renderThemePanel(container);
  }));
  container.querySelectorAll("[data-private-slot]").forEach((button) => button.addEventListener("click", () => {
    state.privateSlotIndex = Number(button.dataset.privateSlot);
    renderPrivateSettings(container);
  }));
  container.querySelector("#theme-motion").addEventListener("click", () => {
    if (spaceLocked) return;
    state.motion = !state.motion;
    renderThemePanel(container);
    syncAmbientAudio(state.theme);
  });
  container.querySelector("#personal-settings").addEventListener("click", () => renderPersonalSettings(container));
  if (basicSoundKey) bindSoundSettings(container, basicSoundKey, () => renderThemePanel(container));
  previewTheme(container, theme, { applied: true, screens: activeScreens });
}

function renderPersonalSettings(container) {
  state.view = "personal";
  const soundTheme = themeById(state.preferenceTheme);
  const soundKey = soundTheme.id === "private" && !state.privateCustomApplied ? SPACE_SOUND_KEY : soundTheme.id;
  container.innerHTML = `
    <section class="panel-view private-theme-view" data-panel="thema" data-theme-view="personal">
      <button class="inline-back" id="personal-back" type="button">${icon("icon-chevron-left")} 테마 설정</button>
      <div class="panel-heading"><h2>테마 설정</h2><p>기본 테마별 배경음과 창 디스플레이를 조절하세요.</p></div>
      <section class="private-setting-card dropdown-setting"><h3>${icon("icon-image")} 테마</h3>
        <label for="theme-sound-select">기본 테마</label>
        <select id="theme-sound-select">${CONFIG.media.windowThemes.map((item) => `<option value="${item.id}" ${soundTheme.id === item.id ? "selected" : ""}>${item.label}</option>`).join("")}</select>
      </section>
      ${soundSettingsMarkup(soundKey)}
      <section class="private-setting-card display-tuning"><h3>창 디스플레이</h3><label><span>색온도</span><output id="temperature-value">${state.temperature}%</output><input id="personal-temperature" type="range" min="0" max="100" value="${state.temperature}" /></label></section>
    </section>`;
  container.querySelector("#personal-back").addEventListener("click", () => renderThemePanel(container));
  container.querySelector("#theme-sound-select").addEventListener("change", (event) => {
    state.preferenceTheme = event.target.value;
    renderPersonalSettings(container);
  });
  bindSoundSettings(container, soundKey, () => renderPersonalSettings(container));
  container.querySelector("#personal-temperature").addEventListener("input", (event) => {
    state.temperature = Number(event.target.value);
    container.querySelector("#temperature-value").textContent = `${state.temperature}%`;
    saveDisplayPreferences();
    previewTheme(document, selectedTheme(), { applied: true });
  });
}

function renderPrivateSettings(container) {
  state.view = "private";
  const base = themeById("private");
  const slot = activePrivateSlot();
  container.innerHTML = `
    <section class="panel-view private-theme-view" data-panel="thema" data-theme-view="private">
      <button class="inline-back" id="private-back" type="button">${icon("icon-chevron-left")} 테마 설정</button>
      <div class="panel-heading"><h2>Private · 내 테마 ${state.privateSlotIndex + 1}</h2><p>좌측·정면·우측 3면의 사진·동영상과 개인 배경소리를 설정하세요.</p></div>
      <div class="private-preview">${threeScreenMarkup(base, privateScreens())}<p>${slot.mediaName}</p></div>
      <section class="private-setting-card"><h3>${icon("icon-image")} 사진 또는 동영상</h3>
        <div class="private-setting-actions"><button type="button" id="private-media-upload">${icon("icon-upload")} 휴대폰에서 업로드</button><button type="button" id="private-default-space">${icon("icon-image")} 우주 기본 배경</button></div>
        <input id="private-media-input" type="file" accept="image/*,video/*" hidden /><p class="private-selection">${slot.mediaName}</p>
      </section>
      <section class="private-setting-card"><h3>${icon("icon-music")} 개인 배경소리</h3>
        <div class="private-setting-actions"><button type="button" id="private-audio-upload">${icon("icon-upload")} 노래·배경소리 업로드</button><button type="button" id="private-audio-clear">소리 제거</button></div>
        <input id="private-audio-input" type="file" accept="audio/*" hidden /><p class="private-selection">${state.customAudioName}</p>
      </section>
      ${soundSettingsMarkup("private", { privateMode: true })}
      <button class="green-action" id="apply-private-theme" type="button">적용</button>
    </section>`;
  bindMedia(container);
  container.querySelector("#private-back").addEventListener("click", () => renderThemePanel(container));
  container.querySelector("#private-media-upload").addEventListener("click", () => container.querySelector("#private-media-input").click());
  container.querySelector("#private-media-input").addEventListener("change", (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (slot.mediaUrl) URL.revokeObjectURL(slot.mediaUrl);
    slot.mediaUrl = URL.createObjectURL(file);
    slot.mediaType = file.type.startsWith("video/") ? "video" : "image";
    const media = { type: slot.mediaType, src: slot.mediaUrl };
    slot.screens = { left: media, front: media, right: media };
    slot.mediaName = file.name;
    renderPrivateSettings(container);
  });
  container.querySelector("#private-default-space").addEventListener("click", () => {
    if (slot.mediaUrl) URL.revokeObjectURL(slot.mediaUrl);
    slot.mediaUrl = null;
    slot.screens = null;
    slot.mediaName = `내 테마 ${state.privateSlotIndex + 1}`;
    renderPrivateSettings(container);
  });
  container.querySelector("#private-audio-upload").addEventListener("click", () => container.querySelector("#private-audio-input").click());
  container.querySelector("#private-audio-input").addEventListener("change", (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (state.customAudioUrl) URL.revokeObjectURL(state.customAudioUrl);
    state.customAudioUrl = URL.createObjectURL(file);
    state.customAudioName = file.name;
    state.customAudioMuted = false;
    customAudio?.pause();
    customAudio = new Audio(state.customAudioUrl);
    customAudio.loop = true;
    syncAmbientAudio("private");
    renderPrivateSettings(container);
  });
  container.querySelector("#private-audio-clear").addEventListener("click", () => {
    customAudio?.pause(); customAudio = null; state.customAudioMuted = false; state.customAudioName = "업로드한 소리 없음"; renderPrivateSettings(container);
  });
  bindSoundSettings(container, "private", () => renderPrivateSettings(container));
  container.querySelector("#apply-private-theme").addEventListener("click", async () => {
    state.theme = "private";
    state.preferenceTheme = "private";
    state.privateCustomApplied = true;
    state.motion = true;
    rememberAppliedTheme("private", `Private · 내 테마 ${state.privateSlotIndex + 1}`);
    previewTheme(container, themeById("private"), { applied: true, screens: privateScreens() });
    syncAmbientAudio("private");
    const applyCommand = dataService.sendVehicleCommand("window.private.apply", { slot: state.privateSlotIndex + 1, screens: privateScreens(), sound: { selected: ensureSoundChoice("private"), custom: Boolean(customAudio && !state.customAudioMuted) }, volume: state.volumeByTheme.private, temperature: state.temperature, brightness: state.brightness, motion: state.motion });
    showToast("Private 설정을 전면·좌우 3면에 적용했습니다.");
    renderThemePanel(container);
    await applyCommand;
  });
}

export function cleanupTheme() {
  stopAmbientAudio();
}
