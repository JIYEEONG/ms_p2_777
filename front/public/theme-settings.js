import { CONFIG } from './space-content/js/config.js';
import { OTT_SERVICES } from './space-content/js/data/space-content.js';

const modes = ['윈도우', 'OTT', '웰니스', '테마', '프라이빗'];
const lights = {
  '민트 앰비언트': { color: '#67e6c0', brightness: 1, warmth: 0 },
  '따뜻한 독서등': { color: '#ffd39c', brightness: 1.1, warmth: .22 },
  '콘텐츠 몰입등': { color: '#8078ed', brightness: .68, warmth: 0 },
  '수면 저조도': { color: '#dcaa78', brightness: .4, warmth: .15 },
  '조명 끄기': { color: 'transparent', brightness: 1, warmth: 0 },
};
const yogaImage = './space-content/assets/images/wellness/yoga/tree-pose.webp';
const t = (ko, en) => window.MoovI18n?.getLanguage() === 'en' ? en : ko;
const labels = { 윈도우: 'Window', OTT: 'OTT', 웰니스: 'Wellness', 테마: 'Theme', 프라이빗: 'Private' };
const lightLabels = ['Mint ambient', 'Warm reading', 'Immersive content', 'Dim sleep', 'Off'];
const savedMode = config => modes.includes(config?.previewMode) ? config.previewMode : config?.privacy && config.tint === 0 ? '프라이빗' : '윈도우';
const modeLabel = config => t(savedMode(config), labels[savedMode(config)]);
function sceneStyle(config) {
  const light = Object.hasOwn(lights, config.light) ? lights[config.light] : lights['민트 앰비언트'];
  const tint = Math.min(100, Math.max(0, Number(config.tint ?? 60)));
  return `--glass-opacity:${1 - tint / 100};--light-color:${light.color};--scene-brightness:${light.brightness};--scene-warmth:${light.warmth};`;
}
const mediaURL = value => new URL(typeof value === 'string' ? value : value.poster || value.src, new URL('./space-content/', location.href)).href;
function activeTheme() {
  let id;
  try { id = localStorage.getItem('moov-active-theme'); } catch {}
  return CONFIG.media.windowThemes.find(theme => theme.id === id) || CONFIG.media.windowThemes.find(theme => theme.id === CONFIG.defaults.windowTheme);
}
function scene(mode, config = { light: '민트 앰비언트', tint: 60 }) {
  const theme = activeTheme();
  const base = './assets/cabin-neutral.png';
  const windows = ['left', 'front', 'right', 'roof'].map(position => {
    let content = '';
    if (mode === '테마' && position !== 'roof') content = `<img src="${mediaURL(theme.screens[position])}" alt="${theme.label}" />`;
    if (mode === 'OTT' && position === 'front') content = `<span class="settings-ott-logos">${OTT_SERVICES.map(service => `<b class="${service.logoClass}" aria-label="${service.name}">${service.logo}</b>`).join('')}</span>`;
    if (mode === '웰니스' && position === 'front') content = `<img class="settings-yoga" src="${yogaImage}" alt="${t('전면 화면의 요가 안내', 'Yoga on the front display')}" />`;
    return `<span class="settings-window is-${position}">${content}<i class="settings-glass"></i></span>`;
  }).join('');
  return `<div class="settings-cabin" data-preview-mode="${mode}" data-theme-id="${theme.id}" data-light="${Object.hasOwn(lights, config.light) ? config.light : '민트 앰비언트'}" style="${sceneStyle(config)}"><img class="settings-cabin-base" src="${base}" alt="${t(mode, labels[mode])} ${t('미리보기', 'preview')}" />${windows}<i class="settings-light-wash"></i><svg class="settings-ambient-lines" viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true"><path d="M180 0 L250 75 Q257 80 278 80 L672 80 L788 0 M50 300 L207 270 M856 277 L960 298 M332 525 L368 507 M579 507 L619 533" /></svg></div>`;
}
function markup(config) {
  const mode = savedMode(config);
  return `<div id="theme-settings" data-i18n-skip><p class="small muted">${t('모드별 공간을 미리 보고 온도, 창문과 조명을 설정하세요.', 'Preview each space and adjust temperature, windows and lighting.')}</p>
    <figure class="settings-preview"><div id="theme-scene">${scene(mode, config)}</div><figcaption id="theme-example-label">${modeLabel(config)} ${t('미리보기', 'preview')}</figcaption></figure>
    <div class="settings-modes">${modes.map(choice => `<button type="button" data-preview-choice="${choice}" aria-pressed="${choice === mode}"><span class="settings-thumb">${scene(choice, config)}</span><span>${t(choice, labels[choice])}</span></button>`).join('')}</div>
    <div class="popup-form">
    <label class="range-row"><span class="row small"><strong>${t('실내 온도', 'Cabin temperature')}</strong><span id="temp-value">${config.temperature}℃</span></span><input id="theme-temp" type="range" min="18" max="28" value="${config.temperature}" /></label>
    <label class="range-row"><span class="row small"><strong>${t('창문 투명도', 'Window transparency')}</strong><span id="tint-value">${config.tint}%</span></span><input id="theme-tint" type="range" min="0" max="100" value="${config.tint}" /></label>
    <label class="form-label">${t('조명', 'Lighting')}<select id="theme-light">${Object.keys(lights).map((light, i) => `<option value="${light}" ${config.light === light ? 'selected' : ''}>${t(light, lightLabels[i])}</option>`).join('')}</select></label>
    <label class="row card padded settings-privacy"><span><strong>${t('프라이버시 글라스', 'Privacy glass')}</strong><br /><small class="muted">${t('외부 시선 차단 · 창문 투명도 0%', 'Blocks outside visibility · 0% transparency')}</small></span><input id="theme-privacy" type="checkbox" ${config.tint === 0 && config.privacy ? 'checked' : ''} /></label></div></div>`;
}
function read(root) {
  return {
    temperature: Number(root.querySelector('#theme-temp').value),
    tint: Number(root.querySelector('#theme-tint').value),
    light: root.querySelector('#theme-light').value,
    privacy: root.querySelector('#theme-privacy').checked,
    previewMode: root.querySelector('#theme-scene .settings-cabin').dataset.previewMode,
  };
}
function attach(root) {
  let mode = savedMode(read(root)), previousTint = Math.max(1, read(root).tint || 60);
  const tint = root.querySelector('#theme-tint'), privacy = root.querySelector('#theme-privacy');
  function update() {
    const config = read(root);
    root.querySelectorAll('.settings-cabin').forEach(preview => {
      preview.style.cssText = sceneStyle(config);
      preview.dataset.light = config.light;
    });
    root.querySelector('#temp-value').textContent = `${config.temperature}℃`;
    root.querySelector('#tint-value').textContent = `${config.tint}%`;
    root.querySelector('#theme-example-label').textContent = `${t(mode, labels[mode])}${mode === '테마' ? ' · ' + activeTheme().label : ''} ${t('미리보기', 'preview')}`;
  }
  function select(next) {
    mode = next;
    if (mode === '프라이빗') { if (Number(tint.value)) previousTint = Number(tint.value); tint.value = 0; privacy.checked = true; }
    root.querySelector('#theme-scene').innerHTML = scene(mode);
    root.querySelectorAll('[data-preview-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.previewChoice === mode)));
    update();
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-preview-choice]');
    if (button) select(button.dataset.previewChoice);
  });
  root.addEventListener('input', event => {
    if (event.target === tint) {
      privacy.checked = Number(tint.value) === 0;
      if (mode === '프라이빗' && Number(tint.value) > 0) select('윈도우');
    }
    update();
  });
  root.addEventListener('change', event => {
    if (event.target === privacy) {
      if (privacy.checked) { previousTint = Number(tint.value) || previousTint; tint.value = 0; }
      else { tint.value = previousTint; if (mode === '프라이빗') select('윈도우'); }
    }
    update();
  });
  update();
}
window.MoovThemeSettings = { markup, attach, read, modeLabel, preview: config => scene(savedMode(config), config) };
