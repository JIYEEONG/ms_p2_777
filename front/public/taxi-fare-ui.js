/* Taxi estimates share the supplied distance policy. No payment or live meter. */
let taxiFareState = { status: 'idle', key: '', request: 0, quote: null, quotedAt: 0, error: '' };
const TAXI_QUOTE_MAX_AGE_MS = 5 * 60 * 1000;
function taxiText(ko, en) { return window.MoovI18n?.getLanguage() === 'en' ? en : ko; }
function taxiMoney(value) { return taxiText(`${Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원`, `₩${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`); }
function taxiFareRoundingNote() { return `<p class="taxi-fare-note taxi-rounding-note" data-i18n-skip>${taxiText('금액의 소수점은 반올림하여 표시합니다.', 'Amounts are displayed rounded to the nearest won.')}</p>`; }
function taxiDistance(meters) { return `${Number((meters / 1000).toFixed(3)).toLocaleString(window.MoovI18n?.getLanguage() === 'en' ? 'en-US' : 'ko-KR')} km`; }
function taxiVehicle(id = state.taxiVehicleType) { return MoovTaxiFare.vehicles.find(vehicle => vehicle.id === MoovVehicleCatalog.normalizeId(id)) || MoovTaxiFare.vehicles[0]; }
function taxiVehicleName(vehicle) { return taxiText(vehicle.name, vehicle.nameEn || vehicle.name); }
function taxiClassName(value) { return ({ small: taxiText('소형', 'Small'), medium: taxiText('중형', 'Medium'), large: taxiText('대형', 'Large') })[value] || value; }
function taxiPrimaryCard() { return state.paymentCards.find(card => card.primary) || state.paymentCards[0] || null; }
function validTaxiStoredTrip(trip) {
  const q = trip?.quote;
  return Boolean(trip && typeof trip.id === 'string' && typeof trip.userId === 'string' && Number.isFinite(trip.startedAt) &&
    Array.isArray(trip.stops) && trip.stops.length >= 2 && trip.stops.every(stop => typeof stop === 'string') && typeof trip.pickupLocation === 'string' &&
    trip.vehicle && typeof trip.vehicle.id === 'string' && typeof trip.vehicle.name === 'string' && typeof trip.vehicle.fareClass === 'string' &&
    q && typeof q.policyVersion === 'string' && typeof q.vehicleId === 'string' && typeof q.fareClass === 'string' &&
    Number.isSafeInteger(q.total) && q.total >= 0 && Number.isSafeInteger(q.distanceMeters) && q.distanceMeters > 0 &&
    ['baseFare', 'includedMeters', 'extraMeters', 'perKm', 'extraFare', 'unroundedTotal', 'durationSeconds'].every(key => Number.isFinite(q[key]) && q[key] >= 0) && Number.isFinite(q.roundingAdjustment));
}
function freezeTaxiRecord(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freezeTaxiRecord); Object.freeze(value); } return value; }
function activeTaxiTrip() {
  const trip = state.taxiTrip;
  return state.tripActive && state.homeMode === 'taxi' && trip?.userId === state.userId && validTaxiStoredTrip(trip) ? trip : null;
}
function taxiTripLocked() { return state.tripActive && state.homeMode === 'taxi'; }
function preventTaxiTripChange() { if (!taxiTripLocked()) return false; toast(taxiText('택시 이용을 종료한 뒤 차량·경로를 변경해 주세요.', 'End the taxi trip before changing the vehicle or route.')); return true; }
function taxiRouteKey() {
  return JSON.stringify([state.userId, state.pickupLocation, state.taxiPickupCoords, state.routeStops, state.taxiSearchPlaces, state.selectedCourse?.id || null, state.selectedCourse?.stopDetails || null, state.selectedCourse?._dbPoints || null]);
}
function taxiQuoteKey() { return JSON.stringify([taxiRouteKey(), state.taxiVehicleType, MoovTaxiFare.policy.version]); }
function currentTaxiQuote() {
  const trip = activeTaxiTrip();
  if (trip) return trip.quote;
  return taxiFareState.status === 'ready' && taxiFareState.key === taxiQuoteKey() && Date.now() - taxiFareState.quotedAt < TAXI_QUOTE_MAX_AGE_MS ? taxiFareState.quote : null;
}
function beginTaxiFareQuote() {
  if (activeTaxiTrip()) return null;
  const request = ++taxiFareState.request;
  taxiFareState = { status: 'loading', key: taxiQuoteKey(), request, quote: null, quotedAt: 0, error: '' };
  refreshTaxiFareUi();
  return { request, key: taxiFareState.key };
}
function isCurrentTaxiFareRequest(request) { return request && request.request === taxiFareState.request && request.key === taxiFareState.key && request.key === taxiQuoteKey() && !activeTaxiTrip(); }
function acceptTaxiFareRoute(request, route) {
  if (!isCurrentTaxiFareRequest(request)) return;
  if (!Number.isSafeInteger(route.distanceMeters) || route.distanceMeters > MoovTaxiFare.policy.maxDistanceMeters) throw Error(taxiText('경로 거리 정보를 확인하지 못했어요. 다시 조회해 주세요.', 'Could not verify the route distance. Please retry.'));
  if (route.distanceMeters <= 0) throw Error(taxiText('출발지와 목적지를 서로 다른 위치로 선택해 주세요.', 'Choose different pickup and destination locations.'));
  const quote = MoovTaxiFare.quote({ vehicleId: state.taxiVehicleType, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds });
  taxiFareState = { status: 'ready', key: request.key, request: request.request, quote, quotedAt: Date.now(), error: '' };
  if (taxiTripLocked()) {
    state.taxiTrip = createTaxiTripSnapshot(quote, true);
    persist();
  }
  refreshTaxiFareUi();
}
function failTaxiFareQuote(request, error) {
  if (!isCurrentTaxiFareRequest(request)) return;
  taxiFareState.status = 'error'; taxiFareState.quote = null;
  taxiFareState.error = error?.message || taxiText('경로 요금을 확인하지 못했어요.', 'Could not estimate the route fare.');
  refreshTaxiFareUi();
}
function taxiFareBreakdown(quote) {
  return `<dl class="taxi-fare-breakdown"><div><dt>${taxiText('기본요금', 'Base fare')} <small>(${taxiDistance(quote.includedMeters)} ${taxiText('포함', 'included')})</small></dt><dd>${taxiMoney(quote.baseFare)}</dd></div><div><dt>${taxiText('추가 거리', 'Extra distance')} <small>${taxiDistance(quote.extraMeters)} × ${taxiMoney(quote.perKm)}/km</small></dt><dd>${taxiMoney(quote.extraFare)}</dd></div></dl>${taxiFareRoundingNote()}`;
}
function taxiFareEstimate(quote, active = false) {
  return `<div class="taxi-estimate-head"><span>${taxiText(active ? '이동 경로 예상 요금' : '전체 경로 예상 요금', active ? 'Trip fare estimate' : 'Estimated route fare')}</span><strong data-taxi-fare-total="${quote.total}">${taxiMoney(quote.total)}</strong></div><p class="taxi-route-metrics">${taxiDistance(quote.distanceMeters)} · <span data-taxi-duration-seconds="${quote.durationSeconds}">${taxiText(`예상 소요시간 ${Math.max(1, Math.ceil(quote.durationSeconds / 60))}분`, `Estimated travel time ${Math.max(1, Math.ceil(quote.durationSeconds / 60))} min`)}</span> · ${taxiClassName(quote.fareClass)}</p>${taxiFareBreakdown(quote)}<p class="taxi-fare-note">${taxiText('거리 기준 주간 예상 요금 · 시간·심야할증·통행료 미포함', 'Daytime distance estimate · excludes time charges, night surcharges and tolls')}</p>`;
}
function renderTaxiFareCard() {
  const quote = currentTaxiQuote();
  if (quote) return taxiFareEstimate(quote);
  const failed = taxiFareState.key === taxiQuoteKey() && taxiFareState.status === 'error';
  const expired = taxiFareState.key === taxiQuoteKey() && taxiFareState.status === 'ready';
  const noRoute = state.routeStops.length < 2;
  const message = noRoute ? taxiText('목적지를 선택하면 예상 요금을 계산합니다.', 'Select a destination to estimate the fare.') : failed ? taxiFareState.error : expired ? taxiText('예상 요금을 다시 확인해 주세요.', 'Refresh the fare estimate before requesting a taxi.') : taxiText('도로 경로와 예상 요금을 계산하는 중…', 'Calculating the driving route and fare…');
  return `<div class="taxi-estimate-head"><span>${taxiText('전체 경로 예상 요금', 'Estimated route fare')}</span><strong data-taxi-fare-total>—</strong></div><p class="taxi-fare-note" role="status">${escapeHtml(message)}</p>${failed || expired ? `<button class="ghost-button full" data-action="retry-taxi-fare">${taxiText('경로·요금 다시 계산', 'Retry route and fare')}</button>` : ''}`;
}
function renderTaxiVehicleSelector() {
  const vehicle = taxiVehicle(), vehicles = MoovTaxiFare.vehicles;
  const rates = MoovTaxiFare.calculate({ vehicleId: vehicle.id, distanceMeters: 0 });
  const shortName = item => taxiVehicleName(item).replace(/^MOOV\s+/, '');
  const specs = [
    ['user', taxiText(vehicle.seats, vehicle.seatsEn.replace(/ passengers$/, '')), taxiText('탑승 인원', 'Passengers')],
    ['bag', taxiText(`${vehicle.baggage}개`, `${vehicle.baggage} ${vehicle.baggage === 1 ? 'bag' : 'bags'}`), taxiText('수하물', 'Luggage')],
    ['car', taxiText('전기차', 'Electric'), taxiText('동력', 'Power')],
    ['shield', taxiText('자율주행', 'Self-driving'), taxiText('이동 방식', 'Travel mode')],
  ];
  return `<section class="taxi-vehicle-picker" aria-label="${taxiText('택시 차량 선택', 'Select taxi vehicle')}" data-i18n-skip>
    <div class="taxi-vehicle-hero"><span class="taxi-vehicle-badge">${escapeHtml(shortName(vehicle))}</span><img src="${escapeHtml(vehicle.image)}" alt="${escapeHtml(taxiVehicleName(vehicle))}" /><span class="taxi-vehicle-index">${vehicles.indexOf(vehicle) + 1} / ${vehicles.length}</span></div>
    <div class="taxi-vehicle-list" role="group" aria-label="${taxiText('차량 비교', 'Compare vehicles')}">${vehicles.map(item => `<button type="button" class="taxi-vehicle-choice ${item.id === vehicle.id ? 'selected' : ''}" data-action="taxi-vehicle" data-value="${item.id}" aria-pressed="${item.id === vehicle.id}" aria-label="${escapeHtml(taxiText(`${item.name} 선택`, `Select ${item.nameEn}`))}"><img src="${escapeHtml(item.image)}" alt="" draggable="false" /><span>${item.id === vehicle.id ? '✓ ' : ''}${escapeHtml(shortName(item))}</span></button>`).join('')}</div>
    <div class="taxi-vehicle-details" aria-live="polite"><h3>${escapeHtml(taxiVehicleName(vehicle))}</h3><p class="taxi-vehicle-description">${escapeHtml(taxiText(vehicle.desc, vehicle.descEn))}</p>
      <div class="taxi-vehicle-specs">${specs.map(([symbol, value, label]) => `<div class="taxi-vehicle-spec">${icon(symbol)}<strong>${escapeHtml(value)}</strong><small>${label}</small></div>`).join('')}</div>
      <div class="taxi-vehicle-rate"><div class="section-row"><span>${taxiClassName(vehicle.fareClass)} · ${taxiText('기본요금', 'Base fare')}</span><button type="button" class="mini-action" data-action="taxi-fare-calculator">${taxiText('요금표·계산기', 'Rates & calculator')}</button></div><strong>${taxiMoney(rates.baseFare)}</strong><span>${taxiDistance(rates.includedMeters)} ${taxiText('포함', 'included')} · ${taxiText('초과 시', 'then')} +${taxiMoney(rates.perKm)}/km</span>${taxiFareRoundingNote()}</div>
    </div>
  </section>`;
}
function restoreTaxiVehicleSelection(scrollLeft = 0, restoreFocus = false) {
  const list = document.querySelector('.taxi-vehicle-list'), selected = list?.querySelector('.selected');
  if (!selected) return;
  list.scrollLeft = scrollLeft;
  const bounds = list.getBoundingClientRect(), choice = selected.getBoundingClientRect();
  if (choice.left < bounds.left + 10) list.scrollLeft -= bounds.left + 10 - choice.left;
  else if (choice.right > bounds.right - 10) list.scrollLeft += choice.right - bounds.right + 10;
  if (restoreFocus) selected.focus({ preventScroll: true });
}
function renderTaxiPanel() {
  const card = taxiPrimaryCard();
  return `<div class="booking-summary taxi-summary" data-i18n-skip><div class="section-row"><strong>${taxiText('택시 차량 선택', 'Choose your taxi')}</strong><span>${taxiText('아래 차량을 눌러 비교', 'Tap a vehicle to compare')}</span></div>${renderTaxiVehicleSelector()}<section id="taxi-fare-card" class="taxi-fare-card" aria-live="polite">${renderTaxiFareCard()}</section><div class="taxi-payment-note"><span>${taxiText('선택한 결제수단', 'Selected payment method')}</span><strong>${card ? escapeHtml(`${card.name} ${card.number}`) : taxiText('등록된 카드 없음', 'No card registered')}</strong></div><button id="taxi-book-button" class="primary-button full call-button" data-action="request-taxi" ${currentTaxiQuote() && card ? '' : 'disabled'}>${taxiText('택시 호출하기', 'Request a taxi')}</button></div>`;
}
function renderActiveTaxiFare() {
  const trip = activeTaxiTrip();
  return `<section id="taxi-active-fare" class="taxi-fare-card" data-i18n-skip>${trip ? `<p class="taxi-fare-note">${escapeHtml(taxiVehicleName(trip.vehicle))} · ${taxiClassName(trip.quote.fareClass)}</p>${taxiFareEstimate(trip.quote, true)}` : renderTaxiFareCard()}<button class="mini-action" data-action="taxi-fare-calculator">${taxiText('요금표·계산기', 'Rates & calculator')}</button></section>`;
}
function refreshTaxiFareUi() {
  const card = document.querySelector('#taxi-fare-card'); if (card) card.innerHTML = renderTaxiFareCard();
  const book = document.querySelector('#taxi-book-button'); if (book) book.disabled = !currentTaxiQuote() || !taxiPrimaryCard();
  const active = document.querySelector('#taxi-active-fare'); if (active) active.outerHTML = renderActiveTaxiFare();
  document.querySelectorAll('[data-live-fee]').forEach(element => { if (state.homeMode === 'taxi') element.textContent = currentTaxiQuote() ? taxiMoney(currentTaxiQuote().total) : '—'; });
}
function expireTaxiFareQuote() {
  if (!taxiTripLocked() && taxiFareState.status === 'ready' && Date.now() - taxiFareState.quotedAt >= TAXI_QUOTE_MAX_AGE_MS) {
    taxiFareState.status = 'error'; taxiFareState.quote = null; taxiFareState.error = taxiText('예상 요금의 유효 시간이 지났어요. 다시 계산해 주세요.', 'This estimate expired. Please calculate it again.'); refreshTaxiFareUi();
  }
}
function createTaxiTripSnapshot(quote, recovered = false) {
  return freezeTaxiRecord(JSON.parse(JSON.stringify({ id: `taxi-${state.userId}-${recovered ? state.usageStartedAt || Date.now() : Date.now()}`, userId: state.userId, startedAt: state.usageStartedAt || Date.now(), routeKey: taxiRouteKey(), stops: [...state.routeStops], pickupLocation: state.pickupLocation, pickupCoords: state.taxiPickupCoords, quote, vehicle: taxiVehicle(quote.vehicleId), card: taxiPrimaryCard(), recovered, simulated: true })));
}
function requestTaxiBooking() {
  if (taxiTripLocked()) { toast(taxiText('이동 경로의 예상 요금을 표시하고 있어요.', 'Showing your trip fare estimate.')); return; }
  if (state.tripActive) return;
  const quote = currentTaxiQuote(), card = taxiPrimaryCard();
  if (!quote || quote.distanceMeters <= 0) { refreshTaxiFareUi(); toast(taxiText('경로와 예상 요금 계산이 완료된 뒤 호출해 주세요.', 'Wait for the route and fare estimate before requesting a taxi.')); return; }
  if (!card) { toast(taxiText('결제수단을 먼저 등록해 주세요.', 'Register a payment method first.')); return; }
  const key = taxiQuoteKey(), vehicle = taxiVehicle(), cardId = card.id;
  openModal({ title: taxiText('택시 호출 확인', 'Confirm taxi request'), iconName: 'car', body: `<div data-i18n-skip><p>${escapeHtml(taxiVehicleName(vehicle))} · ${escapeHtml(state.pickupLocation)}</p><section class="taxi-fare-card">${taxiFareEstimate(quote)}</section><p>${escapeHtml(card.name)} ${escapeHtml(card.number)}</p><p class="taxi-fare-note">${taxiText('테스트 호출이며 실제 결제는 진행되지 않습니다.', 'This is a test booking. No payment will be charged.')}</p></div>`, primary: taxiText('배차하기', 'Dispatch taxi'), secondary: taxiText('취소', 'Cancel'), actionLayout: 'taxi-dispatch', onConfirm: () => {
    const current = currentTaxiQuote();
    if (state.tripActive || !current || key !== taxiQuoteKey() || current.total !== quote.total || taxiPrimaryCard()?.id !== cardId) { toast(taxiText('호출 정보가 바뀌었어요. 예상 요금을 다시 확인해 주세요.', 'Request details changed. Check the estimate again.')); return false; }
    state.usageStartedAt = Date.now(); state.taxiTrip = createTaxiTripSnapshot(current);
    state.taxiDispatch = { tripId: state.taxiTrip.id, status: 'loading', route: null, startedAt: null };
    state.tripActive = true; state.homeMode = 'taxi'; state.homeStep = 'service'; state.rentalEndsAt = null;
    persist(); render(); content.scrollTo({top:0,behavior:'instant'}); toast(taxiText('택시 호출을 요청했어요.', 'Taxi requested.'));
  } });
}
function openTaxiFareCalculator() {
  const quote = currentTaxiQuote(), distance = quote ? Number((quote.distanceMeters / 1000).toFixed(3)) : '';
  openModal({ title: taxiText('택시 요금표·계산기', 'Taxi rates & calculator'), iconName: 'car', body: `<div class="taxi-calculator" data-i18n-skip><p class="taxi-fare-note">${taxiText('제공된 요금정책의 주간 거리 요금입니다. 시간을 입력하거나 심야할증을 더하지 않습니다.', 'Daytime distance fares from the supplied policy. Time charges and night surcharges are not applied.')}</p><label class="form-label" for="taxi-fare-distance">${taxiText('예상 이동 거리 (km)', 'Estimated travel distance (km)')}<input id="taxi-fare-distance" type="number" inputmode="decimal" min="0.001" max="10000" step="0.001" value="${distance}" placeholder="${taxiText('예: 12.345', 'e.g. 12.345')}" /></label><p id="taxi-calculator-error" role="status"></p><div id="taxi-calculator-results" aria-live="polite"></div><p class="taxi-fare-note">${taxiText('기본요금 + 기본 거리 초과분 × km당 요금. 최종 합계를 1원 단위로 반올림합니다.', 'Base fare + extra distance × per-km rate. The final total is rounded to the nearest won.')}</p><p class="taxi-fare-note">${taxiText('계산기 입력은 선택한 경로와 호출 요금을 변경하지 않습니다.', 'Calculator inputs do not change your selected route or taxi fare.')}</p></div>`, primary: taxiText('닫기', 'Close'), secondary: null });
  updateTaxiFareCalculator();
}
function openVehicleFarePolicy() {
  const cards = MoovTaxiFare.vehicles.map(vehicle => {
    const taxi = MoovTaxiFare.policy.classes[vehicle.fareClass];
    const rental = MoovVehicleCatalog.rentalRates[vehicle.id];
    return `<article class="vehicle-policy-card"><h4>${escapeHtml(taxiVehicleName(vehicle))} <small>${escapeHtml(taxiText(vehicle.seats, vehicle.seatsEn))}</small></h4><p>${escapeHtml(taxiText(vehicle.desc, vehicle.descEn))}</p><dl><div><dt>${taxiText('택시 기본', 'Taxi base')}</dt><dd>${taxiMoney(taxi.baseFare)} / ${taxiDistance(taxi.includedMeters)}</dd></div><div><dt>${taxiText('초과 거리', 'Extra distance')}</dt><dd>${taxiMoney(taxi.perKm)}/km</dd></div><div><dt>${taxiText('렌트 3시간', '3-hour rental')}</dt><dd>${taxiMoney(rental.base3)}</dd></div><div><dt>${taxiText('1시간 추가', 'Additional hour')}</dt><dd>${taxiMoney(rental.hourlyStep)}</dd></div><div><dt>${taxiText('렌트 24시간', '24-hour rental')}</dt><dd>${taxiMoney(rental.base24)}</dd></div></dl></article>`;
  }).join('');
  openModal({ title: taxiText('차량·요금정책', 'Vehicles & fares'), iconName: 'car', body: `<div class="vehicle-policy-list" data-i18n-skip><p>${taxiText('이지핏은 휠체어 승하차를 지원하며 중형 요금을 적용합니다. 중형은 최대 4인까지 탑승할 수 있습니다.', 'Easyfit provides wheelchair access at the midsize rate. Midsize seats up to four passengers.')}</p>${cards}<p>${taxiText('택시는 주간 거리 기준 예상 요금이며 시간·심야할증·통행료는 포함하지 않습니다. 렌트는 3~24시간 이용할 수 있으며 선택 옵션 요금은 별도입니다.', 'Taxi estimates use daytime distance fares, excluding time charges, night surcharges and tolls. Rentals run for 3–24 hours; optional extras are charged separately.')}</p>${taxiFareRoundingNote()}</div>`, primary: taxiText('닫기', 'Close'), secondary: null });
}
function updateTaxiFareCalculator() {
  const input = document.querySelector('#taxi-fare-distance'), result = document.querySelector('#taxi-calculator-results'), error = document.querySelector('#taxi-calculator-error');
  if (!input || !result || !error) return;
  const raw = input.value.trim(), km = Number(raw), meters = Math.round(km * 1000);
  if (!raw || !Number.isFinite(km) || km <= 0 || input.validity.stepMismatch || Math.abs(km * 1000 - meters) > 0.000001 || !Number.isSafeInteger(meters) || meters < 1 || meters > 10000000) {
    error.textContent = taxiText('0.001~10,000 km 범위에서 소수 셋째 자리까지 입력해 주세요.', 'Enter 0.001–10,000 km, with up to three decimal places.'); result.replaceChildren(); return;
  }
  error.textContent = '';
  result.innerHTML = MoovTaxiFare.vehicles.map(vehicle => {
    const quote = MoovTaxiFare.calculate({ vehicleId: vehicle.id, distanceMeters: meters });
    return `<article class="taxi-calculator-result" data-taxi-calculator-vehicle="${vehicle.id}" data-taxi-total="${quote.total}"><div><strong>${escapeHtml(taxiVehicleName(vehicle))}</strong><span>${taxiClassName(quote.fareClass)} · ${taxiText('기본', 'Base')} ${taxiMoney(quote.baseFare)} / ${taxiDistance(quote.includedMeters)}</span><span>+${taxiMoney(quote.perKm)}/km</span></div><b>${taxiMoney(quote.total)}</b></article>`;
  }).join('') + taxiFareRoundingNote();
}
function saveTaxiFareReceipt() {
  const trip = activeTaxiTrip();
  if (!trip) return null;
  const existing = state.taxiReceipts.find(receipt => receipt.id === trip.id && receipt.userId === trip.userId);
  if (existing) return existing;
  const receipt = { ...JSON.parse(JSON.stringify(trip)), completedAt: new Date().toISOString(), status: 'demo-estimate', charged: false };
  state.taxiReceipts.unshift(receipt); state.taxiReceipts = state.taxiReceipts.slice(0, 100); persist(); return receipt;
}
function taxiEndFareSummary() {
  const trip = activeTaxiTrip();
  if (!trip) return `<p class="taxi-fare-note" data-i18n-skip>${taxiText('예상 요금 확인 전 종료 시 요금 내역을 저장할 수 없습니다.', 'Fare details cannot be saved before the route estimate is ready.')}</p>`;
  return `<section class="taxi-fare-card" data-i18n-skip>${taxiFareEstimate(trip.quote, true)}<p class="taxi-fare-note">${taxiText('종료하면 요금 내역을 이용 기록에 저장합니다.', 'Fare details are saved in your trip history when the trip ends.')}</p></section>`;
}
function renderTaxiReceiptRows() {
  return state.taxiReceipts.filter(receipt => receipt.userId === state.userId).map(receipt => `<button class="usage-row" data-action="taxi-receipt" data-value="${escapeHtml(receipt.id)}" data-i18n-skip><span class="history-icon">${icon('car')}</span><span><strong>${taxiText('택시 요금 내역', 'Taxi fare receipt')} · ${taxiMoney(receipt.quote.total)}</strong><small>${escapeHtml(receipt.stops.at(-1))} · ${new Date(receipt.completedAt).toLocaleDateString(taxiText('ko-KR', 'en-US'))}</small></span>${icon('chevron')}</button>`).join('');
}
function openTaxiReceipt(id) {
  const receipt = state.taxiReceipts.find(item => item.id === id && item.userId === state.userId);
  if (!receipt) return;
  openModal({ title: taxiText('택시 요금 내역', 'Taxi fare receipt'), iconName: 'car', body: `<div data-i18n-skip><p>${escapeHtml(taxiVehicleName(receipt.vehicle))}</p><p>${receipt.stops.map(escapeHtml).join(' → ')}</p><section class="taxi-fare-card">${taxiFareEstimate(receipt.quote, true)}</section><small>${escapeHtml(receipt.id)}</small></div>`, primary: taxiText('닫기', 'Close'), secondary: null });
}
document.addEventListener('input', event => { if (event.target.id === 'taxi-fare-distance') updateTaxiFareCalculator(); });

// Approach distance is deliberately separate from the passenger's frozen fare.
const taxiApproachRequests = new WeakMap();
function taxiApproachPending() {
  const d = state.taxiDispatch;
  return Boolean(d && state.tripActive && state.homeMode === 'taxi' && activeTaxiTrip()?.id === d.tripId && d.status !== 'driving');
}
function taxiApproachProgress(dispatch) {
  return dispatch.status === 'arrived' ? 1 : Math.max(0, Math.min(1, (Date.now() - dispatch.startedAt) / dispatch.route.durationMs));
}
function renderTaxiApproach() {
  const d = state.taxiDispatch, arrived = d.status === 'arrived';
  return `<div class="active-route" data-taxi-approach data-i18n-skip><section class="taxi-fare-card" aria-live="polite"><small>${taxiText('출발지까지 도착 예상', 'Arrival at your starting point')}</small><h2 data-taxi-arrival-eta>${arrived ? taxiText('도착했어요', 'Arrived') : d.route ? `${Math.max(1, Math.ceil(d.route.durationSeconds * (1-taxiApproachProgress(d)) / 60))}${taxiText('분', ' min')}` : taxiText('경로 확인 중', 'Finding a route')}</h2><span data-taxi-arrival-distance></span><p>${escapeHtml(activeTaxiTrip()?.pickupLocation || state.pickupLocation)}</p><p class="taxi-fare-note">${taxiText('차량 접근을 약 18초로 줄여 보여주는 체험입니다.', 'This demo shows the vehicle approaching in about 18 seconds.')}</p>${d.status === 'error' ? `<p role="alert">${escapeHtml(d.error)}</p><button class="ghost-button full" data-action="taxi-retry-approach">${taxiText('접근 경로 다시 찾기', 'Retry arrival route')}</button>` : ''}<button class="primary-button full" data-action="taxi-boarded" ${arrived ? '' : 'disabled'}>${arrived ? taxiText('탑승하기', 'Board taxi') : taxiText('차량 도착을 기다리는 중', 'Waiting for your taxi')}</button><button class="taxi-cancel-link" data-action="taxi-cancel-approach">${taxiText('배차 취소', 'Cancel taxi')}</button></section>${renderActiveTaxiFare()}</div>`;
}
function refreshTaxiApproachPanel() {
  const panel = document.querySelector('[data-taxi-approach]');
  if (panel && taxiApproachPending()) panel.outerHTML = renderTaxiApproach();
}
async function initTaxiApproachMap(session, pickup, current, status) {
  const d = state.taxiDispatch, maps = window.naver.maps;
  taxiMapMarker(session, pickup, 'start', taxiText('출발', 'Start'));
  status.textContent = taxiText('차량에서 출발지까지 경로를 확인하는 중…', 'Finding the route from your taxi to your starting point…');
  try {
    if (!d.route && d.status !== 'error') {
      let request = taxiApproachRequests.get(d);
      if (!request) {
        request = MoovNaverMap.pickupApproach(pickup).then(route => {
          if (!taxiApproachPending() || state.taxiDispatch !== d) return;
          d.route = route; d.startedAt = Date.now(); d.status = 'approaching'; persist();
        }).catch(error => {
          if (!taxiApproachPending() || state.taxiDispatch !== d) return;
          d.status = 'error'; d.error = error.message; persist();
        });
        taxiApproachRequests.set(d, request);
      }
      await request;
    }
    if (!current() || state.taxiDispatch !== d || !taxiApproachPending()) return;
    refreshTaxiApproachPanel();
    if (!d.route) { status.textContent = d.error || taxiText('접근 경로를 다시 확인해 주세요.', 'Please retry the arrival route.'); return; }
    const position = MoovNaverMap.approachPosition(d.route, taxiApproachProgress(d));
    session.dispatch = d;
    session.vehicle = taxiMapMarker(session, position, 'vehicle', taxiText('차량', 'Taxi'));
    session.points = [position, pickup]; session.routePoints = d.route.points;
    session.line = new maps.Polyline({ map: session.map, path: position.remainingPoints.map(([lat,lng]) => new maps.LatLng(lat,lng)), strokeColor: '#246f48', strokeWeight: 5, strokeOpacity: .9 });
    if (!session.map.moovInteracted) MoovNaverMap.fitRoute(session.map, [...d.route.points, pickup]);
    tickTaxiApproach();
  } catch (error) {
    if (current()) status.textContent = error.message;
  }
}
function tickTaxiApproach() {
  if (!taxiApproachPending()) return;
  const d = state.taxiDispatch;
  if (!d.route || !['approaching', 'arrived'].includes(d.status)) return;
  const progress = taxiApproachProgress(d), position = MoovNaverMap.approachPosition(d.route, progress);
  if (progress >= 1 && d.status !== 'arrived') { d.status = 'arrived'; persist(); refreshTaxiApproachPanel(); }
  const session = taxiMapSession;
  if (session?.dispatch !== d) return;
  const maps = window.naver.maps;
  session.vehicle.setPosition(new maps.LatLng(position.lat, position.lng));
  session.line.setPath(position.remainingPoints.map(([lat,lng]) => new maps.LatLng(lat,lng)));
  const eta = document.querySelector('[data-taxi-arrival-eta]'), distance = document.querySelector('[data-taxi-arrival-distance]');
  if (eta) eta.textContent = d.status === 'arrived' ? taxiText('도착했어요', 'Arrived') : `${Math.max(1, Math.ceil(d.route.durationSeconds*(1-progress)/60))}${taxiText('분', ' min')}`;
  if (distance) distance.textContent = d.status === 'arrived' ? taxiText('차량을 확인한 뒤 탑승해 주세요.', 'Check your vehicle before boarding.') : `${(position.remainingMeters/1000).toFixed(1)} km ${taxiText('남음', 'remaining')}`;
  const status = document.querySelector('#taxi-map-status');
  if (status) status.textContent = d.status === 'arrived' ? taxiText('차량이 출발지에 도착했어요.', 'Your taxi has arrived at your starting point.') : taxiText('차량이 출발지로 이동 중이에요.', 'Your taxi is heading to your starting point.');
}
function handleTaxiApproachAction(action) {
  if (!taxiApproachPending()) return;
  const d = state.taxiDispatch;
  if (action === 'taxi-boarded') {
    if (d.status !== 'arrived') return;
    d.status = 'driving'; state.usageStartedAt = Date.now();
  } else if (action === 'taxi-cancel-approach') {
    state.taxiDispatch = null; state.taxiTrip = null; state.tripActive = false; state.usageStartedAt = null; state.homeStep = 'setup';
  } else if (action === 'taxi-retry-approach') {
    if (d.status !== 'error') return;
    state.taxiDispatch = { tripId: d.tripId, status: 'loading', route: null, startedAt: null };
  } else return;
  persist(); render();
}
