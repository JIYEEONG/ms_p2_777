/* Shared, reversible Korean/English presentation for the MOOV pages. */
(() => {
  const STORAGE_KEY = "moov-language";
  const english = window.MOOV_EN || {};
  const textState = new WeakMap();
  const attributeState = new WeakMap();
  const attributes = ["aria-label", "alt", "placeholder", "title"];
  const skippedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);
  const originalTitle = document.title;
  const originalDescription = document.querySelector('meta[name="description"]')?.content || "";
  let language = readLanguage();

  function readLanguage() {
    try {
      const requested = new URLSearchParams(location.search).get("lang");
      if (requested === "ko" || requested === "en") return requested;
      return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ko";
    } catch { return "ko"; }
  }

  function dictionaryValue(source) {
    const normalized = source.replace(/\s+/g, " ").trim();
    if (Object.prototype.hasOwnProperty.call(english, normalized)) return english[normalized];

    let quoted = normalized.match(/^["“](.+)["”]$/);
    if (quoted && Object.prototype.hasOwnProperty.call(english, quoted[1])) return `“${english[quoted[1]]}”`;
    let match = normalized.match(/^(.+?)님, MOOV에 오신 것을 환영해요\.$/);
    if (match) return `Welcome to MOOV, ${match[1]}.`;
    match = normalized.match(/^가까운 차량 약 (\d+)분$/);
    if (match) return `Nearby vehicle · about ${match[1]} min`;
    match = normalized.match(/^시간당 ([\d,]+)원부터$/);
    if (match) return `From ₩${match[1]} per hour`;
    match = normalized.match(/^총 (\d+)개 코스$/);
    if (match) return `${match[1]} trips in total`;
    match = normalized.match(/^전체 (\d+)개 중 (\d+)개 표시$/);
    if (match) return `Showing ${match[2]} of ${match[1]} items`;
    match = normalized.match(/^(\d+)분 전 · (\d+)개 메시지$/);
    if (match) return `${match[1]} min ago · ${match[2]} messages`;
    match = normalized.match(/^경유지 (\d+)$/);
    if (match) return `Stop ${match[1]}`;
    match = normalized.match(/^예상 이동 경로 · ([\d.]+)km$/);
    if (match) return `Estimated route · ${match[1]} km`;
    match = normalized.match(/^(\d+)분 머무름$/);
    if (match) return `Stay ${match[1]} min`;
    match = normalized.match(/^(.+?)님의 선택 취향을 반영해 (.+?) 중심으로 구성한 추천 코스입니다\.$/);
    if (match) return `A recommended trip focused on ${translateCore(match[2])}, based on ${match[1]}'s preferences.`;
    match = normalized.match(/^예산 약 (\d+)만원 안에서 이동 시간과 체류 시간을 맞췄어요\. 운영시간과 혼잡도를 확인한 뒤 출발 20분 전에 차량을 호출하는 것을 추천합니다\.$/);
    if (match) return `Travel and visit times fit a budget of about ₩${(Number(match[1]) * 10000).toLocaleString("en-US")}. Check opening hours and crowd levels, then request a vehicle 20 minutes before departure.`;
    match = normalized.match(/^(.+?)님의 취향과 예산으로 코스를 만들고, 기존 코스도 함께 추천합니다\.$/);
    if (match) return `We'll build a trip around ${match[1]}'s preferences and budget and suggest existing trips too.`;
    match = normalized.match(/^(.+?)님의 코스 · ([\d.]+)km$/);
    if (match) return `${translateCore(match[1])}'s trip · ${match[2]} km`;
    match = normalized.match(/^(\d+)개 장소$/);
    if (match) return `${match[1]} places`;
    match = normalized.match(/^저장·등록한 코스 (\d+)개$/);
    if (match) return `${match[1]} saved or added trips`;
    match = normalized.match(/^(\d+)℃ · 창문 농도 (\d+)% · (.+)$/);
    if (match) return `${match[1]}°C · Window tint ${match[2]}% · ${translateCore(match[3])}`;
    match = normalized.match(/^차량 재고 (\d+)$/);
    if (match) return `On-board stock ${match[1]}`;
    match = normalized.match(/^내 테마 (\d+)$/);
    if (match) return `My theme ${match[1]}`;
    match = normalized.match(/^(.+) 배경음$/);
    if (match) return `${translateCore(match[1])} ambience`;
    match = normalized.match(/^(.+) 모드 미리보기$/);
    if (match) return `${translateCore(match[1])} mode preview`;
    match = normalized.match(/^(.+) 공간 테마 예시$/);
    if (match) return `${translateCore(match[1])} space theme preview`;
    match = normalized.match(/^(.+) 테마가 적용된 차량 3면 창문$/);
    if (match) return `${translateCore(match[1])} theme applied to all three vehicle windows`;
    match = normalized.match(/^(좌측|정면|우측) 창문$/);
    if (match) return `${translateCore(match[1])} window`;
    match = normalized.match(/^(.+) 테마 (좌측|정면|우측) 화면$/);
    if (match) return `${translateCore(match[1])} theme · ${translateCore(match[2]).toLowerCase()} screen`;
    match = normalized.match(/^(.+) 계정 로그인 화면$/);
    if (match) return `${translateCore(match[1])} account sign-in screen`;
    match = normalized.match(/^(.+) 상품 사진$/);
    if (match) return `${translateCore(match[1])} product photo`;
    match = normalized.match(/^(.+) 코스 이미지$/);
    if (match) return `${translateCore(match[1])} trip image`;
    match = normalized.match(/^(.+) 확대 이미지$/);
    if (match) return `${translateCore(match[1])} enlarged image`;
    match = normalized.match(/^(.+) 상세 보기$/);
    if (match) return `View details for ${translateCore(match[1])}`;
    match = normalized.match(/^(.+) 공간 테마가 적용된 차량 내부$/);
    if (match) return `Vehicle interior with the ${translateCore(match[1])} space theme`;
    match = normalized.match(/^음성 안내 (끄기|켜기)$/);
    if (match) return match[1] === "끄기" ? "Turn voice guidance off" : "Turn voice guidance on";
    match = normalized.match(/^사진을 눌러 (계속 재생|일시정지)$/);
    if (match) return match[1] === "일시정지" ? "Tap the photo to pause" : "Tap the photo to resume";
    match = normalized.match(/^경유지 (\d+) 장소명을 입력하세요$/);
    if (match) return `Enter the name of stop ${match[1]}`;
    match = normalized.match(/^(.+) 시작$/);
    if (match && translateCore(match[1]) !== match[1]) return `Start ${translateCore(match[1])}`;
    match = normalized.match(/^(.+) · 선택됨$/);
    if (match) return `${translateCore(match[1])} · Selected`;
    match = normalized.match(/^신한카드 ([•\s\d]+)$/);
    if (match) return `Shinhan Card ${match[1]}`;
    match = normalized.match(/^(.+), 3초 후 시작합니다\.$/);
    if (match) return `${translateCore(match[1])}, starting in 3 seconds.`;
    match = normalized.match(/^(왼쪽|오른쪽) (.+)$/);
    if (match && Object.prototype.hasOwnProperty.call(english, match[2])) return `${translateCore(match[1])}: ${translateCore(match[2])}`;
    match = normalized.match(/^(.+) 완료$/);
    if (match && Object.prototype.hasOwnProperty.call(english, match[1])) return `${translateCore(match[1])} complete`;
    match = normalized.match(/^(.+)님$/);
    if (match) return match[1];
    match = normalized.match(/^(\d+)초 남음$/);
    if (match) return `${match[1]} sec left`;
    match = normalized.match(/^(\d+)초 후 시작합니다$/);
    if (match) return `Starts in ${match[1]} sec`;
    match = normalized.match(/^(\d+)초씩$/);
    if (match) return `${match[1]} sec each`;
    match = normalized.match(/^(\d+)초$/);
    if (match) return `${match[1]} sec`;
    match = normalized.match(/^(\d+)분 남음$/);
    if (match) return `${match[1]} min left`;
    match = normalized.match(/^(\d+)분$/);
    if (match) return `${match[1]} min`;
    match = normalized.match(/^(\d+)분 (\d+)초$/);
    if (match) return `${match[1]} min ${match[2]} sec`;
    match = normalized.match(/^(\d+)시간$/);
    if (match) return `${match[1]} hr`;
    match = normalized.match(/^(\d+)곳$/);
    if (match) return `${match[1]} stops`;
    match = normalized.match(/^([\d,]+)원$/);
    if (match) return `₩${match[1]}`;
    return null;
  }

  function translateCore(source) {
    if (language !== "en" || typeof source !== "string") return source;
    const direct = dictionaryValue(source);
    if (direct !== null) return direct;

    // Many cards combine translated labels with changing prices or durations.
    const fragments = source.split(/(\s*[·|]\s*)/);
    if (fragments.length > 1) {
      const translated = fragments.map((part, index) => index % 2 ? part : dictionaryValue(part) ?? part).join("");
      if (translated !== source && !/[가-힣]/.test(translated)) return translated;
    }
    return source;
  }

  function translate(source) {
    if (language !== "en" || typeof source !== "string") return source;
    const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) return source;
    return match[1] + translateCore(match[2]) + match[3];
  }

  function skip(element) {
    return !element || skippedTags.has(element.tagName) || !!element.closest("[data-i18n-skip], [contenteditable], .detail-message-row.user");
  }

  function translateText(node) {
    if (skip(node.parentElement) || !node.nodeValue.trim()) return;
    let state = textState.get(node);
    if (!state || node.nodeValue !== state.rendered) state = { source: node.nodeValue, rendered: node.nodeValue };
    const next = language === "en" ? node.parentElement.dataset.i18nEn || translate(state.source) : state.source;
    state.rendered = next;
    textState.set(node, state);
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function translateAttribute(element, name) {
    if (skip(element) || !element.hasAttribute(name)) return;
    let states = attributeState.get(element);
    if (!states) { states = {}; attributeState.set(element, states); }
    const current = element.getAttribute(name);
    let state = states[name];
    if (!state || current !== state.rendered) state = { source: current, rendered: current };
    const next = language === "en" ? translate(state.source) : state.source;
    state.rendered = next;
    states[name] = state;
    if (current !== next) element.setAttribute(name, next);
  }

  function visit(root) {
    if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE || skip(root)) return;
    // An option without a value uses its visible label as its form value.
    // Freeze that internal value before translating the label.
    if (root.tagName === "OPTION" && !root.hasAttribute("value")) root.setAttribute("value", root.textContent);
    for (const name of attributes) translateAttribute(root, name);
    for (const child of root.childNodes) visit(child);
  }

  function refresh() {
    document.documentElement.lang = language;
    document.title = language === "en" ? translate(originalTitle) : originalTitle;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = language === "en" ? translate(originalDescription) : originalDescription;
    if (document.body) visit(document.body);
    document.querySelectorAll("[data-language]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.language === language));
      button.classList.toggle("is-active", button.dataset.language === language);
    });
  }

  function setLanguage(next, save = true) {
    if (next !== "ko" && next !== "en") return;
    if (language === next) return;
    language = next;
    if (save) try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage may be unavailable */ }
    window.speechSynthesis?.cancel();
    refresh();
    window.dispatchEvent(new CustomEvent("moov:language-change", { detail: { language } }));
  }

  function utterance(source) {
    const translated = translate(source);
    const safeText = language === "en" && /[가-힣]/.test(translated)
      ? "Please follow the on-screen guidance."
      : translated;
    const message = new SpeechSynthesisUtterance(safeText);
    message.lang = language === "en" ? "en-US" : "ko-KR";
    const voices = window.speechSynthesis?.getVoices() || [];
    message.voice = voices.find((voice) => voice.lang.toLowerCase() === message.lang.toLowerCase())
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(language))
      || null;
    return message;
  }

  window.MoovI18n = Object.freeze({
    getLanguage: () => language,
    locale: () => language === "en" ? "en-US" : "ko-KR",
    translate,
    refresh,
    setLanguage,
    utterance
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-language]");
    if (button) setLanguage(button.dataset.language);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) setLanguage(event.newValue === "en" ? "en" : "ko", false);
  });
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") translateText(record.target);
      else if (record.type === "attributes") translateAttribute(record.target, record.attributeName);
      else for (const node of record.addedNodes) visit(node);
    }
  }).observe(document.documentElement, {
    childList: true, characterData: true, attributes: true, subtree: true,
    attributeFilter: attributes
  });
  refresh();
})();
