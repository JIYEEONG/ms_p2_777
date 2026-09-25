(() => {
  'use strict';

  const STORAGE = {
    products: 'moov_admin_products_v3',
    activities: 'moov_admin_activities_v3',
    themes: 'moov_admin_themes_v2',
    selectedTheme: 'moov_admin_selected_theme_v2',
    members: 'moov_admin_members_v1'
  };

  const defaultProducts = [
    { id: 1, name: '무라벨 생수', sku: 'MV-DR-001', category: '음료·간식', price: 1800, sold7: 82, stock: 10, change: -4, forecast: 6, recommended: 0, vehicle: 'MOOV 24', currentLocation: '성수역 북측 승하차존', inventoryConfirmed: true, icon: '♢' },
    { id: 2, name: '탄산수', sku: 'MV-DR-002', category: '음료·간식', price: 2200, sold7: 64, stock: 6, change: -5, forecast: 1, recommended: 11, vehicle: 'MOOV 24', currentLocation: '성수동 운영 구역', inventoryConfirmed: false, icon: '◉' },
    { id: 3, name: '프로틴바', sku: 'MV-SN-003', category: '음료·간식', price: 3200, sold7: 58, stock: 7, change: -3, forecast: 4, recommended: 8, vehicle: 'MOOV 18', currentLocation: '강남역 7번 출구', inventoryConfirmed: true, icon: '▰' },
    { id: 4, name: '과자-허니버터칩', sku: 'MV-SN-004', category: '음료·간식', price: 2600, sold7: 73, stock: 6, change: -4, forecast: 2, recommended: 10, vehicle: 'MOOV 31', currentLocation: '여의도 환승센터', inventoryConfirmed: false, icon: '◇' },
    { id: 5, name: '한입 주먹밥', sku: 'MV-ME-005', category: '식사', price: 4900, sold7: 51, stock: 4, change: -3, forecast: 1, recommended: 9, vehicle: 'MOOV 24', currentLocation: '서울숲 동문', inventoryConfirmed: false, icon: '◒' },
    { id: 6, name: '미니 샌드위치', sku: 'MV-ME-006', category: '식사', price: 5900, sold7: 46, stock: 3, change: -3, forecast: 0, recommended: 12, vehicle: 'MOOV 18', currentLocation: '창고 이동 중', inventoryConfirmed: true, icon: '▱' },
    { id: 7, name: '컷 과일컵', sku: 'MV-ME-007', category: '식사', price: 6500, sold7: 43, stock: 3, change: -2, forecast: 1, recommended: 9, vehicle: 'MOOV 31', currentLocation: 'IFC몰 서측', inventoryConfirmed: false, icon: '●' },
    { id: 8, name: '손소독 물티슈', sku: 'MV-CV-008', category: '편의용품', price: 2800, sold7: 39, stock: 8, change: -2, forecast: 6, recommended: 0, vehicle: 'MOOV 24', currentLocation: '뚝섬역 3번 출구', inventoryConfirmed: true, icon: '▤' },
    { id: 9, name: '목베개', sku: 'MV-CV-009', category: '편의용품', price: 14900, sold7: 21, stock: 2, change: -1, forecast: 1, recommended: 5, vehicle: 'MOOV 18', currentLocation: '테헤란로 운영 구역', inventoryConfirmed: false, icon: '◡' },
    { id: 10, name: '휴대용 담요', sku: 'MV-CV-010', category: '편의용품', price: 12900, sold7: 24, stock: 2, change: -2, forecast: 0, recommended: 6, vehicle: 'MOOV 31', currentLocation: '여의나루역 2번 출구', inventoryConfirmed: false, icon: '▧' }
  ];

  const defaultMembers = [
    { id: 'MBR-026501', name: '지영', email: 'jiyoung.kim@example.com', auth: 'Google', joined: '2026.04.18', purchases: 6, purchaseAmount: 53500, taxiCount: 3, taxiDuration: '6시간 9분', taxiFare: 46200, rentalCount: 3, rentalDuration: '12시간 42분', rentalFare: 52300, total: 152000, status: '활성', last: '방금 전', distance: '128km', theme: '기본', consent: '정상', security: '이전 이용 데이터 삭제 확인', trips: ['2026.09.10 · 렌트 3시간 12분 · 성수 → 한강 야경', '2026.09.07 · 택시 2시간 5분 · 북촌 산책 코스', '2026.08.22 · 렌트 4시간 20분 · 잠실 호수 나들이'] },
    { id: 'MBR-026184', name: '김민서', email: 'minseo.kim@example.com', auth: 'Google', joined: '2026.08.14', purchases: 12, purchaseAmount: 128400, taxiCount: 8, taxiDuration: '9시간 22분', taxiFare: 142800, rentalCount: 3, rentalDuration: '6시간 9분', rentalFare: 120000, total: 391200, status: '활성', last: '9분 전', distance: '94km', theme: '웰니스', consent: '정상', security: '삭제 확인' },
    { id: 'MBR-026017', name: '박도윤', email: 'doyun.park@example.com', auth: '일반', joined: '2026.08.02', purchases: 8, purchaseAmount: 82000, taxiCount: 7, taxiDuration: '8시간 31분', taxiFare: 116500, rentalCount: 1, rentalDuration: '4시간', rentalFare: 42000, total: 240500, status: '활성', last: '12분 전', distance: '71km', theme: '콘텐츠', consent: '정상', security: '삭제 확인' },
    { id: 'MBR-025892', name: '이서아', email: 'seoa.lee@example.com', auth: 'Google', joined: '2026.07.21', purchases: 21, purchaseAmount: 204200, taxiCount: 12, taxiDuration: '18시간 11분', taxiFare: 252400, rentalCount: 5, rentalDuration: '11시간 2분', rentalFare: 214000, total: 670600, status: '활성', last: '1시간 전', distance: '221km', theme: '수면', consent: '정상', security: '삭제 확인' },
    { id: 'MBR-025410', name: '정하준', email: 'hajun.jung@example.com', auth: '일반', joined: '2026.06.11', purchases: 3, purchaseAmount: 19800, taxiCount: 4, taxiDuration: '4시간 8분', taxiFare: 72400, rentalCount: 0, rentalDuration: '-', rentalFare: 0, total: 92200, status: '휴면', last: '62일 전', distance: '36km', theme: '기본', consent: '재동의 필요', security: '삭제 확인' },
    { id: 'MBR-024987', name: '최유진', email: 'yujin.choi@example.com', auth: 'Google', joined: '2026.05.28', purchases: 16, purchaseAmount: 166000, taxiCount: 14, taxiDuration: '21시간 44분', taxiFare: 241000, rentalCount: 2, rentalDuration: '6시간 6분', rentalFare: 98000, total: 505000, status: '주의', last: '3일 전', distance: '162km', theme: '프라이빗', consent: '정상', security: '점검 필요' }
  ];

  const defaultActivities = [
    { title: '탄산수 +12개', meta: 'MOOV 24 · 김현우 관리자 · 12분 전' },
    { title: '미니 샌드위치 +10개', meta: 'MOOV 18 · 이지안 관리자 · 1시간 전' },
    { title: '손소독 물티슈 +16개', meta: 'MOOV 31 · 자동 입고 · 오늘 09:20' }
  ];

  const pristineThemes = [
    { id: 'default', name: '기본', description: '22℃ · 창문 60% · 민트 앰비언트', primary: '#17b7a3', secondary: '#55d4c4', background: '#edf9f7', radius: 16, density: 'comfortable', temperature: 22, window: 60, lighting: '민트 앰비언트', privacy: true },
    { id: 'content', name: '콘텐츠', description: '21℃ · 창문 35% · 콘텐츠 몰입등', primary: '#5a63e8', secondary: '#8b63f6', background: '#f0f1ff', radius: 16, density: 'comfortable', temperature: 21, window: 35, lighting: '콘텐츠 몰입등', privacy: true },
    { id: 'wellness', name: '웰니스', description: '23℃ · 창문 50% · 민트 앰비언트', primary: '#29a77e', secondary: '#75c899', background: '#eef8f2', radius: 28, density: 'spacious', temperature: 23, window: 50, lighting: '민트 앰비언트', privacy: false },
    { id: 'sleep', name: '수면', description: '21℃ · 창문 10% · 수면 저조도', primary: '#344b7a', secondary: '#7a88b8', background: '#e9edf6', radius: 28, density: 'spacious', temperature: 21, window: 10, lighting: '수면 저조도', privacy: true },
    { id: 'private', name: '프라이빗', description: '22℃ · 창문 0% · 따뜻한 독서등', primary: '#47305f', secondary: '#8a5a82', background: '#f2edf5', radius: 16, density: 'compact', temperature: 22, window: 0, lighting: '따뜻한 독서등', privacy: true }
  ];

  const clone = value => JSON.parse(JSON.stringify(value));
  const readStorage = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? clone(fallback); }
    catch { return clone(fallback); }
  };
  let products = readStorage(STORAGE.products, defaultProducts);
  let activities = readStorage(STORAGE.activities, defaultActivities);
  let themes = readStorage(STORAGE.themes, pristineThemes);
  let members = readStorage(STORAGE.members, defaultMembers);
  let selectedThemeId = localStorage.getItem(STORAGE.selectedTheme) || 'default';
  let activeProductId = null;
  const selectedStatuses = new Set(['안정', '주의', '위험']);
  const selectedVehicles = new Set(defaultProducts.map(product => product.vehicle));

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = value => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value);
  const number = value => new Intl.NumberFormat('ko-KR').format(value);
  const statusFor = product => product.forecast <= 2 ? '위험' : product.forecast <= 5 ? '주의' : '안정';
  const persistProducts = () => localStorage.setItem(STORAGE.products, JSON.stringify(products));

  function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function setView(view) {
    const requested = view === 'inventory' ? 'products' : view;
    const valid = $(`[data-view-panel="${requested}"]`) ? requested : 'dashboard';
    $$('[data-view-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.viewPanel === valid));
    $$('[data-view]').forEach(link => link.classList.toggle('is-active', link.dataset.view === valid));
    document.title = `${$(`[data-view-panel="${valid}"] h1`)?.textContent || '대시보드'} · MOOV 운영 센터`;
    $('#sidebar').classList.remove('is-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    $('#toast-region').append(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function openModal(id) {
    const modal = $(`#${id}`);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.querySelector('input, select, button')?.focus(), 30);
  }

  function closeModals() {
    $$('.modal').forEach(modal => { modal.hidden = true; });
    document.body.style.overflow = '';
  }

  function drawRevenueChart() {
    const primary = [1.7, 2.1, 1.9, 2.6, 2.4, 3.0, 3.2];
    const secondary = [0.8, 1.1, 1.0, 1.3, 1.2, 1.5, 1.7];
    const labels = ['9/15', '9/16', '9/17', '9/18', '9/19', '9/20', '오늘'];
    const width = 720, height = 230, left = 42, top = 18, bottom = 28;
    const x = index => left + index * ((width - left - 12) / (labels.length - 1));
    const y = value => top + (4 - value) * ((height - top - bottom) / 4);
    const points = values => values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    const area = `${left},${height-bottom} ${points(primary)} ${x(primary.length-1)},${height-bottom}`;
    $('#revenue-chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f62f2"/><stop offset="1" stop-color="#2f62f2" stop-opacity="0"/></linearGradient></defs>
      ${[0,1,2,3,4].map(v => `<line class="chart-grid-line" x1="${left}" y1="${y(v)}" x2="${width-10}" y2="${y(v)}"/><text class="chart-label" x="4" y="${y(v)+3}">${v}M</text>`).join('')}
      <polygon class="chart-area" points="${area}"/><polyline class="chart-line-secondary" points="${points(secondary)}"/><polyline class="chart-line-primary" points="${points(primary)}"/>
      ${primary.map((v,i) => `<circle class="chart-point" cx="${x(i)}" cy="${y(v)}" r="3.5"/>`).join('')}
      ${labels.map((label,i) => `<text class="chart-label" x="${x(i)}" y="${height-5}" text-anchor="middle">${label}</text>`).join('')}
    </svg>`;
  }

  function getVehicleSummary() {
    if (window.moovVehicleSnapshot) return window.moovVehicleSnapshot;
    try {
      const stored = JSON.parse(localStorage.getItem('moov_vehicle_current_v1') || '[]');
      if (Array.isArray(stored) && stored.length) {
        const activeStates = new Set(['TAXI_ASSIGNED','TAXI_ACTIVE','RENTAL_ACTIVE','REBALANCING']);
        const exceptionStates = new Set(['OFFLINE','MAINTENANCE','QUARANTINED']);
        const eligible = stored.filter(v => v.safetyOk && v.securityOk && v.soc >= 35 && ['READY_TAXI','REBALANCING'].includes(v.state)).length;
        const active = stored.filter(v => activeStates.has(v.state)).length;
        const exceptions = stored.filter(v => exceptionStates.has(v.state) || !v.securityOk || !v.safetyOk).length;
        return { total: stored.length, eligible, active, exceptions, vehicles: stored };
      }
    } catch {}
    return { total: 12, eligible: 3, active: 4, exceptions: 3, vehicles: [] };
  }

  function updateDashboardOverview() {
    const vehicleSummary = getVehicleSummary();
    const productRevenue = products.reduce((sum, product) => sum + product.price * product.sold7, 0);
    const memberRevenue = members.reduce((sum, member) => sum + member.total, 0);
    const productSales = products.reduce((sum, product) => sum + product.sold7, 0);
    const riskCount = products.filter(item => statusFor(item) === '위험').length;
    const movingCount = products.filter(item => item.currentLocation === '창고 이동 중').length;
    const activeMembers = members.filter(member => member.status === '활성').length;
    const attentionMembers = members.filter(member => member.status !== '활성').length;

    $('#dashboard-total-revenue').textContent = money(memberRevenue + productRevenue);
    $('#dashboard-revenue-trend').textContent = `상품 ${money(productRevenue)}`;
    $('#dashboard-vehicle-count').innerHTML = `${vehicleSummary.total} <em>대</em>`;
    $('#dashboard-vehicle-detail').textContent = `배차 가능 ${vehicleSummary.eligible} · 운행/이동 ${vehicleSummary.active} · 확인 필요 ${vehicleSummary.exceptions}`;
    $('#dashboard-vehicle-status').textContent = vehicleSummary.exceptions ? `확인 ${vehicleSummary.exceptions}` : '정상';
    $('#dashboard-product-sales').innerHTML = `${number(productSales)} <em>건</em>`;
    $('#dashboard-product-detail').textContent = `상품 ${products.length}종 · 입고 필요 ${riskCount}종 · 창고 이동 ${movingCount}건`;
    $('#dashboard-product-status').textContent = riskCount ? `입고 ${riskCount}` : '안정';
    $('#dashboard-member-count').innerHTML = `${number(members.length)} <em>명</em>`;
    $('#dashboard-member-detail').textContent = `활성 ${activeMembers} · 주의/휴면 ${attentionMembers} · 결제 ${money(memberRevenue)}`;
    $('#dashboard-member-status').textContent = attentionMembers ? `관리 ${attentionMembers}` : '정상';

    $('#linked-vehicles-main').textContent = `배차 가능 ${vehicleSummary.eligible}대`;
    $('#linked-vehicles-sub').textContent = `전체 ${vehicleSummary.total}대 · 확인 필요 ${vehicleSummary.exceptions}대 · 지도 위치 확인`;
    $('#linked-products-main').textContent = `입고 필요 ${riskCount}종`;
    $('#linked-products-sub').textContent = `전체 ${products.length}종 · 창고 이동 ${movingCount}건 · 재고 확정 가능`;
    $('#linked-members-main').textContent = `활성 회원 ${activeMembers}명`;
    $('#linked-members-sub').textContent = `전체 ${members.length}명 · 주의/휴면 ${attentionMembers}명 · 결제 이력 연결`;
  }

  function renderDashboardLists() {
    const ranked = [...products].sort((a,b) => b.sold7 - a.sold7).slice(0,5);
    const max = Math.max(...ranked.map(item => item.sold7), 1);
    $('#demand-list').innerHTML = ranked.map(item => `<div class="demand-row"><span class="demand-row__label"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.category)}</small></span><span class="demand-bar"><i style="width:${Math.round(item.sold7/max*100)}%"></i></span><b>${item.sold7}건</b></div>`).join('');
    const vehicleRows = getVehicleSummary().vehicles;
    const fallbackFleets = [...new Set(products.map(product => product.vehicle))].map(name => {
      const vehicleProducts = products.filter(product => product.vehicle === name);
      const stock = vehicleProducts.reduce((sum, product) => sum + product.stock, 0);
      const forecast = vehicleProducts.reduce((sum, product) => sum + product.forecast, 0);
      const ratio = Math.min(100, Math.round(forecast / Math.max(stock + 12, 1) * 100));
      const location = vehicleProducts.find(product => product.currentLocation !== '창고 이동 중')?.currentLocation || '창고 이동 중';
      return { name, area: `${location} · 적재 ${stock}개`, stock: `${ratio}%`, state: vehicleProducts.some(product => statusFor(product) === '위험') ? '입고 필요' : '재고 안정' };
    });
    $('#fleet-list').innerHTML = vehicleRows.slice(0,5).map(vehicle => {
      const vehicleProducts = products.filter(product => product.vehicle === vehicle.id);
      const stock = vehicleProducts.reduce((sum, product) => sum + product.stock, 0);
      const risk = vehicleProducts.filter(product => statusFor(product) === '위험').length;
      return `<button class="fleet-card fleet-card--button" type="button" data-view-target="vehicles"><span class="fleet-icon">▱</span><span><strong>${escapeHTML(vehicle.id)}</strong><small>${escapeHTML(vehicle.zone)} · SOC ${vehicle.soc}% · 적재 ${stock}개</small></span><span class="fleet-stock"><b>${vehicle.soc}%</b><span>${risk ? `입고 필요 ${risk}` : '배차 상태'}</span></span></button>`;
    }).join('') || fallbackFleets.map(fleet => `<button class="fleet-card fleet-card--button" type="button" data-view-target="products"><span class="fleet-icon">▱</span><span><strong>${escapeHTML(fleet.name)}</strong><small>${escapeHTML(fleet.area)}</small></span><span class="fleet-stock"><b>${fleet.stock}</b><span>${fleet.state}</span></span></button>`).join('');
    updateDashboardOverview();
  }

  function productRow(product) {
    const status = statusFor(product);
    const moving = product.currentLocation === '창고 이동 중';
    const canMove = product.stock > 0 && product.inventoryConfirmed && !moving;
    const image = product.image || window.MoovAdminBridge?.productImages?.[product.sku];
    return `<tr><td><span class="product-cell"><span class="product-thumb">${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy">` : escapeHTML(product.icon || '')}</span><span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.sku)} · ${escapeHTML(product.category)}</small></span></span></td><td>${money(product.price)}</td><td><b>${escapeHTML(product.vehicle)}</b></td><td><span class="location ${moving ? 'location--moving' : ''}">${escapeHTML(product.currentLocation)}</span></td><td><span class="stock-number">${product.stock}개</span><small class="stock-confirmation">${product.inventoryConfirmed ? '확정됨' : '미확정'}</small></td><td><span class="stock-change ${product.change < 0 ? 'is-negative' : 'is-positive'}">${product.change > 0 ? '+' : ''}${product.change}개</span></td><td>${product.forecast}개</td><td><b>${product.recommended ? product.recommended + '개' : '-'}</b></td><td><span class="status status--${status}">${status}</span></td><td><span class="row-actions"><button class="table-action" data-restock-id="${product.id}" type="button">재고 관리</button><button class="table-action table-action--move" data-move-id="${product.id}" type="button" ${canMove ? '' : 'disabled'}>${moving ? '이동 중' : '창고 이동'}</button></span></td></tr>`;
  }

  function renderProducts() {
    const query = ($('#product-search')?.value || '').trim().toLowerCase();
    const category = $('#product-category')?.value || 'all';
    const filtered = products.filter(product => {
      const haystack = `${product.name} ${product.sku} ${product.vehicle} ${product.currentLocation}`.toLowerCase();
      return (!query || haystack.includes(query)) && (category === 'all' || product.category === category) && selectedStatuses.has(statusFor(product)) && selectedVehicles.has(product.vehicle);
    });
    $('#product-table-body').innerHTML = filtered.length ? filtered.map(productRow).join('') : emptyRow(10);
    $('#product-filter-result').textContent = `${filtered.length}개 상품 표시`;
    updateFilterLabels();
  }

  function renderInventory() {
    $('#inventory-activity').innerHTML = activities.slice(0,6).map(item => `<div class="activity-item"><span>⇧</span><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.meta)}</small></div></div>`).join('');
    const riskCount = products.filter(item => statusFor(item) === '위험').length;
    const warningCount = products.filter(item => statusFor(item) === '주의').length;
    const safeCount = products.filter(item => statusFor(item) === '안정').length;
    if ($('#low-stock-count')) $('#low-stock-count').innerHTML = `${riskCount} <em>종</em>`;
    $('#stock-alert-badge').textContent = riskCount;
    $('#stock-safe-count').textContent = safeCount;
    $('#stock-warning-count').textContent = warningCount;
    $('#stock-danger-count').textContent = riskCount;
    $('#stock-safe-inline').textContent = `${safeCount}종`;
    $('#stock-warning-inline').textContent = `${warningCount}종`;
    $('#stock-danger-inline').textContent = `${riskCount}종`;
    $('#warehouse-moving-count').textContent = `${products.filter(item => item.currentLocation === '창고 이동 중').length}건`;
    const total = Math.max(products.length, 1);
    const safeEnd = safeCount / total * 100;
    const warningEnd = (safeCount + warningCount) / total * 100;
    $('#stock-donut').style.background = `conic-gradient(var(--success) 0 ${safeEnd}%, var(--warning) ${safeEnd}% ${warningEnd}%, var(--danger) ${warningEnd}% 100%)`;
    $('#stock-donut strong').textContent = Math.round((safeCount + warningCount * .6) / total * 100);
  }

  function updateFilterLabels() {
    const statusLabel = selectedStatuses.size === 3 ? '전체 상태' : [...selectedStatuses].join(', ') || '선택 없음';
    const vehicleCount = selectedVehicles.size;
    $('#status-filter-label').textContent = statusLabel;
    $('#vehicle-filter-label').textContent = vehicleCount === 3 ? '전체 차량' : `${vehicleCount}대 선택`;
    $$('[data-status-filter]').forEach(input => { input.checked = selectedStatuses.has(input.value); });
    $$('[data-vehicle-filter]').forEach(input => { input.checked = selectedVehicles.has(input.value); });
    $('#status-all').checked = selectedStatuses.size === 3;
    $('#vehicle-all').checked = selectedVehicles.size === 3;
  }

  function emptyRow(columns) {
    return `<tr><td colspan="${columns}" style="padding:38px;text-align:center;color:#8b94a6">조건에 맞는 데이터가 없습니다.</td></tr>`;
  }

  function renderMembers() {
    const query = ($('#member-search')?.value || '').trim().toLowerCase();
    const auth = $('#member-auth')?.value || 'all';
    const status = $('#member-status')?.value || 'all';
    const filtered = members.filter(member => {
      const haystack = `${member.id} ${member.name} ${member.email}`.toLowerCase();
      return (!query || haystack.includes(query)) && (auth === 'all' || member.auth === auth) && (status === 'all' || member.status === status);
    });
    $('#member-table-body').innerHTML = filtered.length ? filtered.map(member => `<tr><td><span class="product-cell"><span class="avatar">${escapeHTML(member.name.slice(-2))}</span><span><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.email)}</small></span></span></td><td>${member.id}</td><td><span class="auth-badge ${member.auth === 'Google' ? 'auth-badge--google' : ''}">${member.auth}</span></td><td>${member.purchases}건</td><td>${member.taxiCount}회 · ${escapeHTML(member.taxiDuration)}</td><td>${member.rentalCount}회 · ${escapeHTML(member.rentalDuration)}</td><td>${escapeHTML(member.theme)}</td><td><b>${money(member.total)}</b></td><td><span class="status status--${member.status}">${member.status}</span></td><td><button class="table-action" data-member-id="${member.id}" type="button">상세 보기</button></td></tr>`).join('') : emptyRow(10);
  }

  function renderMemberUsageChart() {
    const totals = [
      { label: '공간 상품', value: members.reduce((sum, member) => sum + member.purchaseAmount, 0), color: '#2f62f2' },
      { label: '택시', value: members.reduce((sum, member) => sum + member.taxiFare, 0), color: '#54c3d5' },
      { label: '렌트', value: members.reduce((sum, member) => sum + member.rentalFare, 0), color: '#7d67ee' }
    ];
    const grandTotal = totals.reduce((sum, item) => sum + item.value, 0) || 1;
    $('#member-usage-chart').innerHTML = `<div class="usage-chart__bar">${totals.map(item => `<i style="width:${item.value / grandTotal * 100}%;background:${item.color}"></i>`).join('')}</div><div class="usage-chart__legend">${totals.map(item => `<span><i style="background:${item.color}"></i><b>${item.label}</b><small>${Math.round(item.value / grandTotal * 100)}% · ${money(item.value)}</small></span>`).join('')}</div>`;
  }

  function openMember(memberId) {
    const member = members.find(item => item.id === memberId);
    if (!member) return;
    const trips = member.trips || ['연동된 이용 기록이 없습니다.'];
    $('#member-detail').innerHTML = `<div class="member-detail__hero"><span class="avatar">${escapeHTML(member.name.slice(-2))}</span><div><h2 id="member-modal-title">${escapeHTML(member.name)}</h2><p>${member.id} · ${escapeHTML(member.email)} · ${member.auth} 로그인</p></div><button class="icon-button" type="button" data-close-modal aria-label="닫기">×</button></div>
      <div class="member-detail__stats"><div><span>가입일</span><b>${member.joined}</b></div><div><span>누적 이동</span><b>${member.distance}</b></div><div><span>누적 결제</span><b>${money(member.total)}</b></div><div><span>선호 공간 테마</span><b>${member.theme}</b></div></div>
      <div class="detail-section"><h3>이용 요약</h3><ul class="history-list"><li><span>공간 상품</span><span>${member.purchases}건 구매</span><b>${money(member.purchaseAmount)}</b></li><li><span>택시</span><span>${member.taxiCount}회 · ${member.taxiDuration}</span><b>${money(member.taxiFare)}</b></li><li><span>렌트</span><span>${member.rentalCount}회 · ${member.rentalDuration}</span><b>${money(member.rentalFare)}</b></li></ul></div>
      <div class="detail-section"><h3>계정·보안</h3><ul class="history-list"><li><span>동의 상태</span><span>개인정보·서비스 이용 동의</span><b>${member.consent}</b></li><li><span>차량 보안</span><span>Zero Trust Cabin</span><b>${member.security}</b></li><li><span>최근 활동</span><span>앱 접속</span><b>${member.last}</b></li></ul></div>
      <div class="detail-section"><h3>최근 이용 기록</h3><ul class="history-list">${trips.map((trip, index) => `<li><span>${index + 1}</span><span>${escapeHTML(trip)}</span><b>상세 보기</b></li>`).join('')}</ul></div>`;
    openModal('member-modal');
    window.dispatchEvent(new CustomEvent('moov-member-open',{detail:{memberId}}));
  }

  function refreshRestockOptions(selectedId) {
    $('#restock-product').innerHTML = products.map(product => `<option value="${product.id}">${escapeHTML(product.name)} · ${escapeHTML(product.vehicle)}</option>`).join('');
    const id = selectedId || activeProductId || products[0]?.id;
    if (id) $('#restock-product').value = String(id);
    updateRestockSummary();
  }

  function updateRestockSummary() {
    const product = products.find(item => item.id === Number($('#restock-product').value));
    if (!product) return;
    activeProductId = product.id;
    $('#restock-current').textContent = `${product.stock}개`;
    $('#restock-change').textContent = `${product.change > 0 ? '+' : ''}${product.change}개`;
    $('#restock-recommended').textContent = product.recommended ? `${product.recommended}개` : '보충 불필요';
    $('#restock-quantity').value = product.recommended || 1;
    $('#restock-location').textContent = product.currentLocation;
    $('#restock-moving-note').hidden = product.currentLocation !== '창고 이동 중';
    $('#restock-form [name="vehicle"]').value = product.vehicle;
  }

  function validateProductSku() {
    const input = $('#product-form [name="sku"]');
    const message = $('#product-sku-message');
    const sku = input.value.trim().toUpperCase();
    const duplicate = Boolean(sku && products.some(product => product.sku.toUpperCase() === sku));
    input.setCustomValidity(duplicate ? '현재 있는 상품입니다.' : '');
    message.textContent = duplicate ? '현재 있는 상품입니다.' : sku ? '사용 가능한 SKU입니다.' : '';
    message.classList.toggle('is-error', duplicate);
    return !duplicate;
  }

  function renderThemes() {
    $('#theme-grid').innerHTML = themes.map(theme => `<button class="theme-card ${theme.id === selectedThemeId ? 'is-active' : ''}" type="button" data-theme-id="${theme.id}" style="--theme-primary:${theme.primary};--theme-secondary:${theme.secondary};--theme-bg:${theme.background};--theme-radius:${theme.radius}"><span class="theme-card__visual"><span></span><span></span><i></i></span><span class="theme-card__copy"><span><strong>${escapeHTML(theme.name)}</strong><small>${theme.temperature}℃ · 창문 ${theme.window}% · ${escapeHTML(theme.lighting)}</small></span><span class="theme-card__check">✓</span></span></button>`).join('');
    loadThemeEditor();
  }

  function selectedTheme() { return themes.find(theme => theme.id === selectedThemeId) || themes[0]; }
  function loadThemeEditor() {
    const theme = selectedTheme();
    if (!theme) return;
    $('#theme-name').value = theme.name;
    $('#theme-primary').value = theme.primary;
    $('#theme-secondary').value = theme.secondary;
    $('#theme-background').value = theme.background;
    $('#theme-radius').value = String(theme.radius);
    $('#theme-density').value = theme.density;
    $('#theme-temperature').value = String(theme.temperature);
    $('#theme-window').value = String(theme.window);
    $('#theme-lighting').value = theme.lighting;
    $('#theme-privacy').checked = Boolean(theme.privacy);
    updateThemePreview(false);
  }

  function updateThemePreview(updateData = true) {
    const theme = selectedTheme();
    if (!theme) return;
    if (updateData) {
      theme.name = $('#theme-name').value || theme.name;
      theme.primary = $('#theme-primary').value;
      theme.secondary = $('#theme-secondary').value;
      theme.background = $('#theme-background').value;
      theme.radius = Number($('#theme-radius').value);
      theme.density = $('#theme-density').value;
      theme.temperature = Number($('#theme-temperature').value);
      theme.window = Number($('#theme-window').value);
      theme.lighting = $('#theme-lighting').value;
      theme.privacy = $('#theme-privacy').checked;
      theme.description = `${theme.temperature}℃ · 창문 ${theme.window}% · ${theme.lighting}`;
    }
    $('#theme-primary-output').value = theme.primary;
    $('#theme-secondary-output').value = theme.secondary;
    $('#theme-background-output').value = theme.background;
    $('#theme-temperature-output').value = `${theme.temperature}℃`;
    $('#theme-window-output').value = `${theme.window}%`;
    const preview = $('#phone-preview');
    preview.style.setProperty('--preview-primary', theme.primary);
    preview.style.setProperty('--preview-secondary', theme.secondary);
    preview.style.setProperty('--preview-bg', theme.background);
    preview.style.setProperty('--preview-radius', `${theme.radius}px`);
    preview.style.setProperty('--preview-density', theme.density === 'compact' ? '.88' : theme.density === 'spacious' ? '1.12' : '1');
    $('#preview-title').style.fontSize = `calc(20px * var(--preview-density))`;
    $('#preview-description').textContent = theme.privacy ? '프라이버시 글라스가 켜진 나만의 이동 공간입니다.' : '개방감 있는 창문 설정으로 이동을 즐겨보세요.';
    $('#preview-theme-name').textContent = `${theme.name} 모드 적용 중`;
    $('#preview-temperature').textContent = `${theme.temperature}℃`;
    $('#preview-window').textContent = `창문 ${theme.window}%`;
    $('#preview-lighting').textContent = theme.lighting;
  }

  function exportCSV(filename, rows) {
    const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);
    showToast(`${filename} 파일을 만들었습니다.`);
  }

  function bindEvents() {
    window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
    $$('.period-control button').forEach(button => button.addEventListener('click', () => { $$('.period-control button').forEach(item => item.classList.remove('is-active')); button.classList.add('is-active'); showToast(`${button.textContent} 기준으로 지표를 갱신했습니다.`); }));
    $('#menu-button').addEventListener('click', () => $('#sidebar').classList.add('is-open'));
    $('#sidebar-close').addEventListener('click', () => $('#sidebar').classList.remove('is-open'));
    document.addEventListener('click', event => {
      const viewTarget = event.target.closest('[data-view-target]');
      const restock = event.target.closest('[data-restock-id]');
      const move = event.target.closest('[data-move-id]');
      const member = event.target.closest('[data-member-id]');
      const action = event.target.closest('[data-action]');
      const close = event.target.closest('[data-close-modal]');
      if (viewTarget) location.hash = viewTarget.dataset.viewTarget;
      if (restock) { activeProductId = Number(restock.dataset.restockId); refreshRestockOptions(activeProductId); openModal('restock-modal'); }
      if (move && !move.disabled) {
        const product = products.find(item => item.id === Number(move.dataset.moveId));
        if (product && product.stock > 0 && product.inventoryConfirmed) {
          product.currentLocation = '창고 이동 중';
          product.movementStartedAt = new Date().toISOString();
          activities.unshift({ title: `${product.name} 창고 이동 시작`, meta: `${product.vehicle} · 재고 ${product.stock}개 · 방금 전` });
          persistProducts(); localStorage.setItem(STORAGE.activities, JSON.stringify(activities));
          renderProducts(); renderInventory(); renderDashboardLists(); showToast(`${product.vehicle}의 현재 위치를 창고 이동 중으로 변경했습니다.`);
        }
      }
      if (member) openMember(member.dataset.memberId);
      if (action?.dataset.action === 'add-product') openModal('product-modal');
      if (action?.dataset.action === 'quick-restock') { refreshRestockOptions(); openModal('restock-modal'); }
      if (close) closeModals();
    });
    document.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-view-target][role="button"]')) {
        event.preventDefault();
        location.hash = event.target.dataset.viewTarget;
      }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModals(); });
    ['product-search','product-category'].forEach(id => $(`#${id}`).addEventListener(id.includes('search') ? 'input' : 'change', renderProducts));
    $$('[data-status-filter]').forEach(input => input.addEventListener('change', () => {
      input.checked ? selectedStatuses.add(input.value) : selectedStatuses.delete(input.value);
      $('#status-all').checked = selectedStatuses.size === 3;
      renderProducts();
    }));
    $$('[data-vehicle-filter]').forEach(input => input.addEventListener('change', () => {
      input.checked ? selectedVehicles.add(input.value) : selectedVehicles.delete(input.value);
      $('#vehicle-all').checked = selectedVehicles.size === 3;
      renderProducts();
    }));
    $('#status-all').addEventListener('change', event => {
      selectedStatuses.clear(); if (event.target.checked) ['안정','주의','위험'].forEach(value => selectedStatuses.add(value)); renderProducts();
    });
    $('#vehicle-all').addEventListener('change', event => {
      selectedVehicles.clear(); if (event.target.checked) ['MOOV 24','MOOV 18','MOOV 31'].forEach(value => selectedVehicles.add(value)); renderProducts();
    });
    ['member-search','member-auth','member-status'].forEach(id => $(`#${id}`).addEventListener(id.includes('search') ? 'input' : 'change', renderMembers));
    $('#restock-product').addEventListener('change', updateRestockSummary);
    $('#product-form [name="sku"]').addEventListener('input', validateProductSku);

    $('#product-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget; // await 이후 currentTarget이 null이 되므로 미리 저장
      const data = new FormData(form);
      if (!validateProductSku()) { form.reportValidity(); return; }

      const submitButton = form.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true; // 중복 등록 방지

      try {
        // ① 이미지 업로드 (선택)
        let imageFilename = null;
        let image = '';
        const file = data.get('image');
        if (file && file.size > 0) {
          if (file.size > 20 * 1024 * 1024) { showToast('이미지는 20MB 이하만 등록할 수 있습니다.'); return; }
          const uploaded = await fetch('/api/admin/product-images', {
            method: 'POST',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
            credentials: 'same-origin',
          });
          if (!uploaded.ok) { showToast('이미지 업로드에 실패했습니다. 관리자 로그인 상태를 확인하세요.'); return; }
          const result = await uploaded.json();
          imageFilename = result.image_filename;
          image = result.url;
        }

        // ② 상품 DB 저장
        const sku = String(data.get('sku')).trim().toUpperCase();
        const saved = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku, name: data.get('name'), category: data.get('category'), price: Number(data.get('price')), image_filename: imageFilename }),
          credentials: 'same-origin',
        });
        if (saved.status === 409) { showToast('이미 등록된 SKU입니다.'); return; }
        if (!saved.ok) { showToast('상품을 저장하지 못했습니다.'); return; }
        const { app_product_id } = await saved.json();

        // ③ 관리자 화면 목록에 반영 (재고·위치는 기존처럼 관리자 상태에 저장)
        const stock = Number(data.get('stock'));
        products.unshift({ id: Date.now(), name: data.get('name'), sku, category: data.get('category'), price: Number(data.get('price')), sold7: 0, stock, change: 0, forecast: stock, recommended: stock <= 5 ? 12 - stock : 0, vehicle: data.get('vehicle'), currentLocation: '차고지 대기', inventoryConfirmed: false, icon: '◇', image, appProductId: app_product_id });
        persistProducts(); renderProducts(); renderInventory(); renderDashboardLists(); refreshRestockOptions(); closeModals(); form.reset(); showToast('새 공간 상품을 등록했습니다.');
      } catch {
        showToast('네트워크 오류로 등록하지 못했습니다.');
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });

    $('#restock-form').addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const product = products.find(item => item.id === Number(data.get('productId')));
      if (!product) return;
      const quantity = Number(data.get('quantity'));
      const type = data.get('type');
      product.stock = type === '차감' ? Math.max(0, product.stock - quantity) : type === '실사 조정' ? quantity : product.stock + quantity;
      product.forecast = Math.max(0, product.stock + product.change);
      product.recommended = product.forecast <= 5 ? Math.max(0, 12 - product.forecast) : 0;
      product.vehicle = data.get('vehicle');
      product.inventoryConfirmed = true;
      activities.unshift({ title: `${product.name} ${type === '차감' ? '-' : type === '실사 조정' ? '→' : '+'}${quantity}개`, meta: `${product.vehicle} · 신승준 관리자 · 방금 전${data.get('memo') ? ' · ' + data.get('memo') : ''}` });
      persistProducts(); localStorage.setItem(STORAGE.activities, JSON.stringify(activities));
      renderProducts(); renderInventory(); renderDashboardLists(); closeModals(); showToast(`${product.name} 재고를 확정했습니다. 재고가 있으면 창고 이동을 시작할 수 있습니다.`);
    });

    $('#apply-recommendations').addEventListener('click', () => {
      const target = [...products].filter(item => item.recommended > 0).sort((a,b) => b.recommended - a.recommended)[0];
      activeProductId = target?.id || products[0]?.id; refreshRestockOptions(activeProductId); openModal('restock-modal');
    });

    $('#export-inventory').addEventListener('click', () => exportCSV('moov-products-inventory.csv', [['SKU','상품명','배치 차량','현재 위치','현재 재고','재고 확정','예상 변화','7일 예상','권장 입고','상태'], ...products.map(p => [p.sku,p.name,p.vehicle,p.currentLocation,p.stock,p.inventoryConfirmed?'확정':'미확정',p.change,p.forecast,p.recommended,statusFor(p)])]));
    $('#export-members').addEventListener('click', () => exportCSV('moov-members.csv', [['회원번호','이름','이메일','가입방식','가입일','상품구매','택시이용','택시기간','렌트이용','렌트기간','선호테마','누적이동','누적결제','동의상태','보안상태','회원상태'], ...members.map(m => [m.id,m.name,m.email,m.auth,m.joined,m.purchases,m.taxiCount,m.taxiDuration,m.rentalCount,m.rentalDuration,m.theme,m.distance,m.total,m.consent,m.security,m.status])]));

    $('#theme-grid').addEventListener('click', event => {
      const card = event.target.closest('[data-theme-id]'); if (!card) return;
      selectedThemeId = card.dataset.themeId; localStorage.setItem(STORAGE.selectedTheme, selectedThemeId); renderThemes();
    });
    ['theme-name','theme-primary','theme-secondary','theme-background','theme-radius','theme-density','theme-temperature','theme-window','theme-lighting','theme-privacy'].forEach(id => $(`#${id}`).addEventListener(id.includes('name') || id.includes('temperature') || id.includes('window') ? 'input' : 'change', () => updateThemePreview(true)));
    ['theme-primary','theme-secondary','theme-background'].forEach(id => $(`#${id}`).addEventListener('input', () => updateThemePreview(true)));
    $('#save-theme').addEventListener('click', () => { updateThemePreview(true); localStorage.setItem(STORAGE.themes, JSON.stringify(themes)); renderThemes(); showToast('테마 변경사항을 저장했습니다.'); });
    $('#reset-theme').addEventListener('click', () => {
      const original = pristineThemes.find(theme => theme.id === selectedThemeId); const index = themes.findIndex(theme => theme.id === selectedThemeId);
      if (original && index >= 0) themes[index] = clone(original); renderThemes(); showToast('선택 테마를 기본값으로 복원했습니다.');
    });
  }

  function init() {
    const now = new Intl.DateTimeFormat('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'short' }).format(new Date());
    $('#current-date').textContent = now;
    window.addEventListener('moov-vehicles-updated', () => { renderDashboardLists(); updateDashboardOverview(); });
    window.addEventListener('moov-product-images', renderProducts);
    drawRevenueChart(); renderDashboardLists(); renderProducts(); renderInventory(); renderMembers(); renderMemberUsageChart(); renderThemes(); refreshRestockOptions(); bindEvents(); updateDashboardOverview();
    setView(location.hash.slice(1) || 'dashboard');
  }

  init();
})();
