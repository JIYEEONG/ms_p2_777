/* Shared by the embedded home and the main app; dispose on screen replacement. */
(() => {
  const carousels = new Map();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const label = (ko, en) => document.documentElement.lang === 'en' ? en : ko;
  function mount(slider) {
    const slides = [...slider.querySelectorAll('.home-promo-slide')];
    if (slides.length < 2) return () => {};
    const section = slider.closest('.home-promo-section');
    const controls = document.createElement('div');
    controls.className = 'promo-controls';
    controls.setAttribute('data-i18n-skip', '');
    let index = 0, timer, scrollTimer, hovered = false, touching = false, visible = false, focusPaused = false;
    let paused = reducedMotion.matches;
    const controller = new AbortController();
    const listen = (el, event, fn) => el.addEventListener(event, fn, { signal: controller.signal });
    const dots = slides.map((slide, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'promo-dot';
      listen(button, 'click', () => show(i));
      controls.append(button);
      return button;
    });
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'promo-toggle';
    listen(toggle, 'click', () => { paused = !paused; if (!paused) focusPaused = false; update(); schedule(); });
    controls.append(toggle); section.append(controls);
    function update() {
      dots.forEach((dot, i) => {
        dot.setAttribute('aria-label', label(`광고 ${i + 1} 보기`, `Show ad ${i + 1}`));
        dot.setAttribute('aria-current', String(i === index));
        slides[i].tabIndex = i === index ? 0 : -1;
      });
      toggle.textContent = paused ? '▶' : 'Ⅱ';
      toggle.setAttribute('aria-label', paused ? label('광고 자동 넘김 시작', 'Start ad rotation') : label('광고 자동 넘김 일시정지', 'Pause ad rotation'));
    }
    function schedule() {
      clearTimeout(timer);
      if (paused || hovered || touching || !visible || document.hidden || focusPaused) return;
      timer = setTimeout(() => show((index + 1) % slides.length), 4500);
    }
    function show(next) {
      index = next;
      slider.scrollTo({ left: index * slider.clientWidth, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      update(); schedule();
    }
    listen(slider, 'scroll', () => {
      clearTimeout(timer); clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        index = Math.max(0, Math.min(slides.length - 1, Math.round(slider.scrollLeft / (slider.clientWidth || 1))));
        update(); schedule();
      }, 160);
    });
    listen(section, 'pointerenter', event => { hovered = event.pointerType === 'mouse'; schedule(); });
    listen(section, 'pointerleave', () => { hovered = false; schedule(); });
    listen(section, 'focusin', () => { focusPaused = true; schedule(); });
    listen(section, 'focusout', () => queueMicrotask(() => { focusPaused = section.contains(document.activeElement); schedule(); }));
    listen(slider, 'pointerdown', () => { touching = true; schedule(); });
    listen(window, 'pointerup', () => { touching = false; schedule(); });
    listen(window, 'pointercancel', () => { touching = false; schedule(); });
    listen(document, 'visibilitychange', schedule);
    listen(document, 'moov:language-change', update);
    listen(reducedMotion, 'change', () => { paused = reducedMotion.matches; update(); schedule(); });
    const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: 0.5 });
    visibility.observe(slider);
    const resize = new ResizeObserver(() => slider.scrollTo({ left: index * slider.clientWidth, behavior: 'instant' }));
    resize.observe(slider);
    update();
    return () => {
      clearTimeout(timer); clearTimeout(scrollTimer); controller.abort();
      visibility.disconnect(); resize.disconnect(); controls.remove();
    };
  }
  function sync() {
    for (const [slider, dispose] of carousels) if (!slider.isConnected) { dispose(); carousels.delete(slider); }
    document.querySelectorAll('.home-promo-slider').forEach(slider => {
      if (!carousels.has(slider)) carousels.set(slider, mount(slider));
    });
  }
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  sync();
})();
