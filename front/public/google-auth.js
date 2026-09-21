/* Google credentials are handled by the server; the browser only checks its session. */
(() => {
  const auth = { phase: 'checking', configured: false, error: '', busy: false, user: null };
  let hooks = {}, generation = 0, initialized = false;
  const text = (ko, en) => window.MoovI18n?.getLanguage() === 'en' ? en : ko;
  const callbackError = new URLSearchParams(location.search).get('auth_error');
  let pendingCallbackError = callbackError === 'cancelled' ? 'cancelled' : callbackError ? 'failed' : '';
  if (callbackError) {
    const url = new URL(location.href);
    url.searchParams.delete('auth_error');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  function render() {
    const button = document.querySelector('#google-login-button');
    const label = document.querySelector('#google-login-label');
    const status = document.querySelector('#google-auth-status');
    const retry = document.querySelector('#google-auth-retry');
    if (!button || !status) return;
    button.disabled = auth.phase === 'checking' || auth.busy || !auth.configured;
    label.textContent = auth.phase === 'redirecting' ? text('Google로 연결 중…', 'Connecting to Google…') : text('Google로 로그인', 'Sign in with Google');
    const messages = {
      checking: text('로그인 상태를 확인하고 있어요…', 'Checking your sign-in status…'),
      unavailable: text('로그인 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', 'Unable to reach sign-in services. Please try again shortly.'),
      unconfigured: text('Google 로그인을 준비하고 있어요. 잠시 후 다시 확인해 주세요.', 'Google sign-in is not available yet. Please check again shortly.'),
      cancelled: text('Google 로그인이 취소됐어요. 다시 로그인할 수 있어요.', 'Google sign-in was cancelled. You can try again.'),
      failed: text('Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.', 'Google sign-in could not be completed. Please try again.'),
      signedout: text('Google 계정으로 안전하게 시작하세요.', 'Get started securely with your Google account.'),
      redirecting: text('Google에서 사용할 계정을 선택해 주세요.', 'Choose your account on Google.'),
    };
    status.textContent = messages[auth.error || auth.phase] || '';
    status.dataset.state = auth.error || auth.phase;
    retry.hidden = auth.phase === 'checking' || auth.phase === 'redirecting' || (!auth.error && auth.configured);
    retry.textContent = text('다시 확인', 'Try again');
    const intro = document.querySelector('#google-auth-intro');
    if (intro) intro.textContent = text('택시, 여행, 문화를 무인차 안에서. Google 계정으로 MOOV를 시작하세요.', 'Taxi rides, travel and culture in your driverless car. Start MOOV with your Google account.');
  }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`/api/auth/${path}`, { credentials: 'same-origin', cache: 'no-store', ...options, signal: controller.signal });
      if (!response.ok) throw new Error('auth-unavailable');
      return response.status === 204 ? {} : await response.json();
    } finally { clearTimeout(timeout); }
  }
  function validUser(user) {
    return user && typeof user.id === 'string' && /^google:[^\s]{1,57}$/.test(user.id) && typeof user.name === 'string';
  }
  async function retry() {
    if (auth.busy) return;
    const current = ++generation;
    auth.phase = 'checking'; auth.error = ''; render();
    const [configResult, sessionResult] = await Promise.allSettled([request('config'), request('me')]);
    if (current !== generation) return;
    auth.configured = configResult.status === 'fulfilled' && configResult.value.configured === true;
    if (sessionResult.status === 'fulfilled' && sessionResult.value.authenticated === true && validUser(sessionResult.value.user)) {
      auth.phase = 'authenticated'; auth.error = ''; auth.user = sessionResult.value.user;
      pendingCallbackError = '';
      hooks.onAuthenticated?.(auth.user);
    } else {
      auth.user = null; auth.phase = 'signedout';
      auth.error = sessionResult.status === 'rejected' || configResult.status === 'rejected' || sessionResult.value?.authenticated !== false
        ? 'unavailable' : !auth.configured ? 'unconfigured' : pendingCallbackError;
      pendingCallbackError = '';
      hooks.onSignedOut?.();
    }
    render();
  }
  function start() {
    if (!auth.configured || auth.phase === 'checking' || auth.busy) return;
    auth.phase = 'redirecting'; auth.error = ''; auth.busy = true; render();
    // Keep the browser on the same-origin endpoint; never accept a redirect URL from storage.
    window.location.assign('/api/auth/google/start');
  }
  async function logout() {
    if (auth.busy) return false;
    auth.busy = true; ++generation;
    document.querySelectorAll('[data-action="logout"]').forEach(button => { button.disabled = true; });
    try {
      await request('logout', { method: 'POST' });
      auth.user = null; auth.phase = 'signedout'; auth.error = auth.configured ? '' : 'unconfigured';
      hooks.onSignedOut?.();
      try { localStorage.setItem('moov-auth-session-changed', `${Date.now()}:${Math.random()}`); } catch { /* storage is optional */ }
      hooks.onLogoutSuccess?.();
      return true;
    } catch {
      auth.phase = auth.user ? 'authenticated' : 'signedout';
      hooks.onLogoutError?.(text('로그아웃을 완료하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.', 'Sign-out could not be completed. Check your connection and try again.'));
      return false;
    } finally {
      auth.busy = false;
      document.querySelectorAll('[data-action="logout"]').forEach(button => { button.disabled = false; });
      render();
    }
  }
  function init(callbacks) {
    hooks = callbacks || {};
    if (!initialized) {
      initialized = true;
      document.querySelector('#google-login-button')?.addEventListener('click', start);
      document.querySelector('#google-auth-retry')?.addEventListener('click', retry);
      window.addEventListener('moov:language-change', render);
      window.addEventListener('storage', event => { if (event.key === 'moov-auth-session-changed') void retry(); });
      window.addEventListener('pageshow', event => { if (event.persisted) { auth.busy = false; void retry(); } });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && auth.phase !== 'checking') void retry(); });
    }
    return retry();
  }
  window.MoovGoogleAuth = Object.freeze({ init, start, retry, logout, getStatus: () => ({ ...auth }) });
})();
