/* Connection check only. NAVER_MAP_CLIENT_SECRET never reaches this page. */
(() => {
  const $ = (id) => document.getElementById(id);
  let map, line;
  const markers = {};
  async function api(path, options) {
    const response = await fetch('/api/maps/' + path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '입력값과 API 설정을 확인하세요.');
    return data;
  }
  function point(target) {
    return { lat: Number($(target + '-lat').value), lng: Number($(target + '-lng').value) };
  }
  function selectPoint(target, p) {
    $(target + '-lat').value = p.lat;
    $(target + '-lng').value = p.lng;
    if (!map) return;
    const position = new naver.maps.LatLng(p.lat, p.lng);
    if (markers[target]) markers[target].setPosition(position);
    else markers[target] = new naver.maps.Marker({ map, position, title: target === 'start' ? '출발지' : '목적지' });
  }
  function addressLabel(result) {
    const region = result.region || {}, land = result.land || {};
    const parts = ['area1', 'area2', 'area3', 'area4'].map(key => region[key]?.name).filter(Boolean);
    const number = [land.number1, land.number2].filter(Boolean).join('-');
    return [...parts, land.name, number].filter(Boolean).join(' ');
  }
  $('search-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    $('results').replaceChildren(); $('address-status').textContent = '주소 검색 중…';
    try {
      const data = await api('geocode?query=' + encodeURIComponent($('query').value.trim()));
      $('address-status').textContent = data.addresses.length ? `${data.addresses.length}개 주소를 찾았습니다.` : '검색 결과가 없습니다. 도로명 또는 지번 주소를 입력하세요.';
      for (const place of data.addresses) {
        const row = document.createElement('p'), name = document.createElement('strong'), english = document.createElement('small');
        name.textContent = place.roadAddress || place.jibunAddress; english.textContent = place.englishAddress || '영문 주소가 제공되지 않았습니다.';
        row.append(name, english);
        for (const target of ['start', 'goal']) {
          const choose = document.createElement('button'); choose.textContent = target === 'start' ? '출발지로 선택' : '목적지로 선택';
          choose.onclick = () => { selectPoint(target, place); if (map) map.setCenter(new naver.maps.LatLng(place.lat, place.lng)); };
          row.append(choose);
        }
        $('results').append(row);
      }
    } catch (error) { $('address-status').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('route-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    $('route-status').textContent = '자동차 경로 조회 중…';
    if (line) { line.setMap(null); line = null; }
    try {
      const start = point('start'), goal = point('goal'); selectPoint('start', start); selectPoint('goal', goal);
      const route = await api('directions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ start, goal }) });
      $('route-status').textContent = `${(route.distanceMeters / 1000).toFixed(1)} km · 약 ${Math.ceil(route.durationSeconds / 60)}분 (자동차 이동, 체류 시간 제외)`;
      if (map && route.points.length) {
        const path = route.points.map(([lat, lng]) => new naver.maps.LatLng(lat, lng));
        line = new naver.maps.Polyline({ map, path, strokeColor: '#216843', strokeWeight: 5 });
        const bounds = new naver.maps.LatLngBounds(); path.forEach(p => bounds.extend(p)); map.fitBounds(bounds);
      }
    } catch (error) { $('route-status').textContent = error.message; }
    finally { button.disabled = false; }
  });
  async function init() {
    try {
      const config = await api('config');
      if (!config.clientId) throw new Error('backend/.env의 NAVER_MAP_CLIENT_ID와 NAVER_MAP_CLIENT_SECRET을 입력한 뒤 백엔드를 재시작하세요.');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('지도 로딩 시간이 초과되었습니다. 연결과 키 설정을 확인하세요.')), 15000);
        const fail = message => { clearTimeout(timeout); $('status').textContent = message; reject(new Error(message)); };
        window.navermap_authFailure = () => fail('네이버 지도 인증 실패: Client ID, Dynamic Map 선택, Web 서비스 URL 등록을 확인하세요.');
        const script = document.createElement('script');
        script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + encodeURIComponent(config.clientId);
        script.onload = () => { clearTimeout(timeout); if (window.naver?.maps?.Map) resolve(); else fail('네이버 지도 SDK를 초기화하지 못했습니다.'); };
        script.onerror = () => fail('네이버 지도 SDK를 불러오지 못했습니다. 인터넷 연결을 확인하세요.');
        document.head.append(script);
      });
      map = new naver.maps.Map('map', { center: new naver.maps.LatLng(37.5446, 127.0557), zoom: 14, zoomControl: true });
      selectPoint('start', point('start')); selectPoint('goal', point('goal'));
      let clickVersion = 0;
      naver.maps.Event.addListener(map, 'click', async event => {
        const version = ++clickVersion;
        const p = { lat: event.coord.lat(), lng: event.coord.lng() }; selectPoint($('point-target').value, p);
        $('picked-address').textContent = '선택한 위치의 주소를 찾고 있습니다…';
        try {
          const data = await api('reverse?lat=' + p.lat + '&lng=' + p.lng);
          if (version === clickVersion) $('picked-address').textContent = data.results.map(addressLabel).filter(Boolean).join('\n') || '이 위치에서 확인되는 주소가 없습니다.';
        } catch (error) { if (version === clickVersion) $('picked-address').textContent = error.message; }
      });
      $('status').textContent = config.restConfigured ? '지도 연결 완료. 주소 검색과 자동차 경로를 확인해 보세요.' : '지도 연결 완료. 주소·경로 검색에는 backend/.env의 Client Secret도 필요합니다.';
    } catch (error) { $('status').textContent = error.message; }
  }
  init();
})();
