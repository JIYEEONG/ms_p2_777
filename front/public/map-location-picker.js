/* Shared coordinate picker for taxi and rental journeys. */
(() => {
  const text = (ko, en) => document.documentElement.lang === 'en' ? en : ko;
  let dispose = null;
  function open({ openModal, closeModal, center, role = 'pickup', chooseRole = true, onSelect }) {
    dispose?.();
    let selected = null, view = null, marker = null, selectionVersion = 0, searchVersion = 0, closed = false;
    openModal({
      title: text('지도에서 장소 선택', 'Choose a location'), iconName: 'pin',
      body: `<div class="map-location-picker" data-i18n-skip>
        <form class="map-location-search"><label>${text('주소 또는 장소 검색', 'Search address or place')}<input type="search" maxlength="200" required placeholder="${text('도로명·지번 주소 입력', 'Enter a street or parcel address')}" /></label><button type="submit">${text('검색', 'Search')}</button></form>
        <div class="map-location-results" aria-live="polite"></div>
        <div class="map-location-canvas"></div>
        <p class="map-location-status" role="status">${text('지도를 불러오는 중…', 'Loading map…')}</p>
        <p>${text('지도를 누르거나 핀을 끌어서 위치를 조정하세요.', 'Click the map or drag the pin to adjust the location.')}</p>
        <label>${text('설정할 위치', 'Use as')} <select class="map-location-role" ${chooseRole ? '' : 'disabled'}><option value="pickup">${text('출발지', 'Pickup')}</option><option value="goal">${text('목적지', 'Destination')}</option></select></label>
      </div>`,
      primary: text('이 위치 적용', 'Use this location'), secondary: text('취소', 'Cancel'),
      onConfirm: () => {
        if (!selected || closed) return false;
        const place = { ...selected }, target = root.querySelector('select').value;
        cleanup(); closeModal(); onSelect(place, target);
        return false;
      },
    });
    const root = document.querySelector('.map-location-picker');
    const status = root.querySelector('.map-location-status');
    const results = root.querySelector('.map-location-results');
    const confirm = document.querySelector('#modal-actions .primary-button');
    if (confirm) confirm.disabled = true;
    root.querySelector('select').value = role;
    const current = () => !closed && root.isConnected && !!root.closest('.open');
    const observer = new MutationObserver(() => { if (!current()) cleanup(); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    function cleanup() {
      if (closed) return;
      closed = true; selectionVersion++; searchVersion++; observer.disconnect(); view?.remove();
      if (dispose === cleanup) dispose = null;
    }
    dispose = cleanup;
    async function select(p, named = false) {
      const version = ++selectionVersion;
      selected = null;
      if (confirm) confirm.disabled = true;
      marker?.setLatLng(p); view?.panTo(p);
      status.textContent = text('위치를 확인하는 중…', 'Checking location…');
      const place = named ? p : await MoovNaverMap.describePoint(p);
      if (!current() || version !== selectionVersion) return;
      selected = place; status.textContent = place.name;
      if (confirm) confirm.disabled = false;
    }
    root.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault(); event.stopPropagation();
      const version = ++searchVersion;
      results.textContent = text('검색 중…', 'Searching…');
      try {
        const places = await MoovNaverMap.searchPlaces(root.querySelector('input').value);
        if (!current() || version !== searchVersion) return;
        results.replaceChildren();
        if (!places.length) results.textContent = text('검색 결과가 없어요. 도로명·지번 주소로 검색하거나 지도에서 선택해 주세요.', 'No results. Try a street or parcel address, or select on the map.');
        places.forEach(place => {
          const button = document.createElement('button'); button.type = 'button';
          button.textContent = [place.name, place.address].filter(Boolean).join(' · ');
          button.onclick = () => void select(place, true); results.append(button);
        });
      } catch (error) { if (current() && version === searchVersion) results.textContent = error.message; }
    });
    void (async () => {
      try {
        await MoovNaverMap.ready(); if (!current()) return;
        view = MoovNaverMap.createView(root.querySelector('.map-location-canvas'), center, 15);
        const pin = document.createElement('div'); pin.className = 'map-location-pin'; pin.textContent = text('선택', 'Pin');
        marker = MoovNaverMap.marker(center, { element: pin, draggable: true, title: text('위치 조정', 'Adjust location') }).addTo(view);
        marker.on('dragstart', () => { selectionVersion++; selected = null; if (confirm) confirm.disabled = true; });
        marker.on('dragend', () => void select(marker.getLatLng()));
        view.on('click', event => void select(event.latlng));
        if (!selected) await select(center);
        else { marker.setLatLng(selected); view.panTo(selected); }
      } catch (error) { if (current()) status.textContent = error.message; }
    })();
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let routeHandlers = {}, selection = 0;
  const forms = new WeakMap();
  function field({ index, value, label, kind, address = '' }) {
    // Format old saved pickup labels without altering stored trip/fare records.
    if(index===0)value=String(value??'').replace(/\s+인근$/,'').replace(/^Near\s+/,'');
    return `<form class="route-location-form" data-route-index="${index}" data-i18n-skip>
      <div class="route-line ${kind}"><span class="route-mark"></span><label><small>${escape(label)}</small><input type="search" enterkeyhint="search" maxlength="200" value="${escape(value)}" aria-label="${escape(label)}" placeholder="${text('주소 또는 장소 검색', 'Search address or place')}" autocomplete="off" /></label></div>
      ${address && address !== value ? `<p class="route-pickup-address">${escape(address)}</p>` : ''}<div class="route-location-results" aria-live="polite" hidden></div></form>`;
  }
  function formState(form) {
    if (!forms.has(form)) forms.set(form, { version: 0, timer: null });
    return forms.get(form);
  }
  async function search(form) {
    const state = formState(form); clearTimeout(state.timer);
    const version = ++state.version, query = form.querySelector('input').value.trim();
    const results = form.querySelector('.route-location-results');
    const current = () => form.isConnected && state.version === version;
    results.hidden = false; results.textContent = text('검색 중…', 'Searching…');
    try {
      if (query.length < 2) { results.textContent = text('주소 또는 장소를 두 글자 이상 입력하세요.', 'Enter at least two characters.'); return; }
      const places = await (routeHandlers.search || MoovNaverMap.searchPlaces)(query);
      if (!current()) return;
      results.replaceChildren();
      if (!places.length) results.textContent = text('검색 결과가 없어요. 도로명·지번 주소로 검색하거나 지도에서 선택하세요.', 'No results. Try a street or parcel address, or choose on the map.');
      places.forEach(place => {
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = [place.name, place.address].filter(Boolean).join(' · ');
        button.onclick = async () => {
          const ticket = ++selection;
          const valid = () => current() && ticket === selection;
          results.querySelectorAll('button').forEach(b => { b.disabled = true; });
          try {
            const index = Number(form.dataset.routeIndex);
            if (index === 0 && routeHandlers.onPreviewPickup) {
              await routeHandlers.onPreviewPickup(place);
              results.hidden = true;
              results.querySelectorAll('button').forEach(b => { b.disabled = false; });
            } else await routeHandlers.onSelect?.(place, index, valid);
          } catch (error) {
            if (valid()) { results.textContent = text('경로를 확인하지 못했어요. 다시 검색하거나 다른 위치를 선택하세요.', 'Could not find a route. Search again or choose another location.'); }
          }
        };
        results.append(button);
      });
    } catch (error) { if (current()) results.textContent = error.message; }
  }
  document.addEventListener('submit', event => {
    if (!event.target.matches('.route-location-form')) return;
    event.preventDefault(); void search(event.target);
  });
  document.addEventListener('input', event => {
    const form = event.target.closest('.route-location-form'); if (!form) return;
    const state = formState(form); state.version++; selection++; clearTimeout(state.timer);
    const results = form.querySelector('.route-location-results'); results.hidden = true;
    if(!event.isComposing)state.timer = setTimeout(() => { if (form.isConnected) void search(form); }, 400);
  });
  document.addEventListener('compositionend', event => {
    const form=event.target.closest('.route-location-form');if(form)void search(form);
  });
  document.addEventListener('focusin', event => {
    if (event.target.matches('.route-location-form input')) event.target.select();
  });
  let cancelMapSelection = null;
  let chooseExistingPoint = null;
  function selectOnMap({ element, map, index, initial }) {
    cancelMapSelection?.();
    if (!element?.isConnected || !map) return;
    if (index === 0) return selectPickup({ element, map, initial });
    map.stop();
    let closed = false, version = 0, selected = null, pin = null;
    const panel = document.createElement('div'); panel.className = 'inplace-map-selection';
    panel.setAttribute('data-i18n-skip', '');
    const label = index === 0 ? text('출발지', 'Pickup') : text('목적지·경유지', 'Destination / stop');
    panel.innerHTML = `<p role="status"></p><button type="button" class="primary-button" disabled>${text('이 위치 적용', 'Use this location')}</button><button type="button" class="ghost-button">${text('취소', 'Cancel')}</button>`;
    const status = panel.querySelector('p'), confirm = panel.querySelector('.primary-button');
    status.textContent = text(`${label}: 위 지도에서 원하는 위치를 누르세요.`, `${label}: click a location on the map above.`);
    const host = element.closest('.mobility-map') || element;
    host.after(panel);
    const current = () => !closed && element.isConnected && panel.isConnected;
    const listener = naver.maps.Event.addListener(map, 'click', event => void choose({lat:event.coord.lat(),lng:event.coord.lng()}));
    const observer = new MutationObserver(() => { if (!current()) cleanup(); });
    observer.observe(document.body, { childList:true, subtree:true });
    function cleanup() {
      if (closed) return;
      closed=true;version++;observer.disconnect();naver.maps.Event.removeListener(listener);pin?.remove();panel.remove();
      document.querySelectorAll('.route-map-select[aria-pressed="true"]').forEach(button=>button.removeAttribute('aria-pressed'));
      if(cancelMapSelection===cleanup){cancelMapSelection=null;chooseExistingPoint=null;}
    }
    cancelMapSelection=cleanup;
    chooseExistingPoint=point=>void choose(point);
    document.querySelector(`.route-location-form[data-route-index="${index}"] .route-map-select`)?.setAttribute('aria-pressed','true');
    panel.querySelector('.ghost-button').onclick=cleanup;
    async function choose(point) {
      const request=++version;selected=null;confirm.disabled=true;
      status.textContent=text('선택한 위치를 확인하는 중…','Checking selected location…');
      if(!pin){
        const icon=document.createElement('div');icon.className='map-location-pin';icon.textContent=text('선택','Pin');
        pin=MoovNaverMap.marker(point,{element:icon,draggable:true,title:label}).addTo(map);
        pin.on('dragstart',()=>{version++;selected=null;confirm.disabled=true;});
        pin.on('dragend',()=>void choose(pin.getLatLng()));
      }else pin.setLatLng(point);
      const place=await MoovNaverMap.describePoint(point);
      if(!current()||request!==version)return;
      selected=place;status.textContent=`${label} · ${place.name}`;confirm.disabled=false;
    }
    confirm.onclick=async()=>{
      if(!selected||!current())return;
      const request=version;confirm.disabled=true;
      try{
        await routeHandlers.onSelect?.(selected,index,()=>current()&&request===version);
        if(current()&&request===version)cleanup();
      }catch{
        if(current()&&request===version){status.textContent=text('경로를 찾지 못했어요. 지도에서 다른 위치를 선택하세요.','No route found. Choose another location on the map.');confirm.disabled=false;}
      }
    };
    host.scrollIntoView({block:'start',behavior:'smooth'});
    if(initial)void choose(initial);
  }

  // The pickup can be adjusted by dragging its marker or by moving the map.
  // The draft never changes the journey until the explicit confirmation button.
  function selectPickup({ element, map, initial }) {
    map.stop();
    const oldCenter = map.getCenter(), oldZoom = map.getZoom();
    let closed = false, version = 0, timer = null, selected = null, lastKey = '', locating = 0, pinDragging = false;
    const listeners = [];
    const host = element.closest('.mobility-map') || element;
    const panel = document.createElement('section');
    panel.className = 'inplace-map-selection pickup-selection';
    panel.setAttribute('data-i18n-skip', '');
    panel.innerHTML = `<h3>${text('어디서 탑승하시나요?', 'Where should we pick you up?')}</h3><p class="pickup-instruction">${text('출발 핀을 드래그하거나 지도를 움직여 승차 위치를 조정해 주세요.', 'Drag the start pin or move the map to adjust your pickup point.')}</p><strong class="pickup-place" role="status"></strong><p class="pickup-address"></p><p class="pickup-guidance">${text('건물 출입구와 도로 방향을 확인해 주세요.', 'Check the entrance and the side of the road.')}</p><button type="button" class="pickup-current ghost-button">${text('내 위치', 'My location')}</button><button type="button" class="primary-button" disabled>${text('여기서 탑승', 'Confirm pickup')}</button><button type="button" class="pickup-cancel ghost-button">${text('취소', 'Cancel')}</button>`;
    const pin = document.createElement('div'); pin.className = 'pickup-center-pin draggable';
    pin.innerHTML = `<span>${text('출발', 'Start')}</span><i></i>`;
    pin.setAttribute('aria-label',text('드래그하여 출발 위치 조정','Drag to adjust pickup'));
    const pinMarker = MoovNaverMap.marker(initial || {lat:oldCenter.lat(),lng:oldCenter.lng()}, {
      element:pin,title:text('출발 위치 조정','Adjust pickup'),size:[60,62],anchor:[30,62],draggable:true,
    }).addTo(map);
    element.classList.add('pickup-selecting'); host.after(panel);
    const status = panel.querySelector('.pickup-place'), address = panel.querySelector('.pickup-address');
    const confirm = panel.querySelector('.primary-button');
    const current = () => !closed && element.isConnected && panel.isConnected;
    const observer = new MutationObserver(() => { if (!current()) cleanup(false); });
    observer.observe(document.body, { childList: true, subtree: true });
    function cleanup(restore = false) {
      if (closed) return;
      closed = true; version++; locating++; clearTimeout(timer); observer.disconnect();
      listeners.forEach(listener => naver.maps.Event.removeListener(listener));
      element.classList.remove('pickup-selecting'); pinMarker.remove(); panel.remove();
      if (restore && element.isConnected) map.updateBy(oldCenter, oldZoom);
      if (cancelMapSelection === cancel) { cancelMapSelection = null; chooseExistingPoint = null; }
      document.dispatchEvent(new CustomEvent('moov:pickup-selection-end'));
    }
    const cancel = () => cleanup(true);
    cancelMapSelection = cancel;
    function centerPoint() { const c = map.getCenter(); return { lat: c.lat(), lng: c.lng() }; }
    function busy() {
      version++; selected = null; confirm.disabled = true;
      status.textContent = text('승차 위치를 확인하는 중…', 'Checking pickup location…'); address.textContent = '';
    }
    async function describe(named = null) {
      if (!current()) return;
      const point = centerPoint(), key = `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`;
      if (key === lastKey) return;
      lastKey = key; busy(); const request = version;
      const place = named?.name && named.category !== '주소' ? { ...named, ...point } : await MoovNaverMap.describePoint(point);
      if (!current() || request !== version) return;
      selected = place; status.textContent = place.name;
      address.textContent = place.address && place.address !== place.name ? place.address : text('핀 위치를 확인하고 확정해 주세요.', 'Check the pin position before confirming.');
      confirm.disabled = false;
    }
    function move(point) {
      if (!current()) return;
      locating++; clearTimeout(timer); lastKey = ''; busy();
      pinMarker.setLatLng(point);
      map.updateBy(new naver.maps.LatLng(point.lat, point.lng), Math.max(17, map.getZoom()));
      clearTimeout(timer); void describe(point);
    }
    chooseExistingPoint = move;
    pinMarker.on('dragstart',()=>{pinDragging=true;locating++;clearTimeout(timer);lastKey='';busy();});
    pinMarker.on('dragend',()=>{pinDragging=false;move(pinMarker.getLatLng());});
    listeners.push(naver.maps.Event.addListener(map, 'center_changed', () => {
      if(pinDragging)return;
      pinMarker.setLatLng(centerPoint());
      locating++; panel.querySelector('.pickup-current').disabled = false;
      clearTimeout(timer); lastKey = ''; busy();
      timer = setTimeout(() => void describe(), 450);
    }));
    listeners.push(naver.maps.Event.addListener(map, 'click', event => move({ lat: event.coord.lat(), lng: event.coord.lng() })));
    panel.querySelector('.pickup-cancel').onclick = cancel;
    panel.querySelector('.pickup-current').onclick = () => {
      const ticket = ++locating, button = panel.querySelector('.pickup-current');
      button.disabled = true;
      const fail = () => { if (current() && ticket === locating) { button.disabled = false; address.textContent = text('내 위치를 찾지 못했어요. 지도를 움직여 선택해 주세요.', 'Could not locate you. Move the map to choose your pickup.'); } };
      MoovNaverMap.getCurrentPosition(position => {
        if (!current() || ticket !== locating) return;
        button.disabled = false; move({ ...position.place, lat: position.coords.latitude, lng: position.coords.longitude });
      }, fail, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    };
    confirm.onclick = async () => {
      if (!selected || !current()) return;
      const place = selected, request = version; confirm.disabled = true;
      try {
        await routeHandlers.onSelect?.(place, 0, () => current() && request === version);
        if (current() && request === version) cleanup(false);
      } catch {
        if (current() && request === version) { confirm.disabled = false; address.textContent = text('출발지를 적용하지 못했어요. 다시 시도해 주세요.', 'Could not update pickup. Please try again.'); }
      }
    };
    host.scrollIntoView({ block: 'start', behavior: 'smooth' });
    move(initial || centerPoint());
  }
  window.MoovLocationPicker = { open, field, selectOnMap,
    showLocationError(index,message) {
      const form=document.querySelector(`.route-location-form[data-route-index="${index}"]`);
      if(!form)return;
      const results=form.querySelector('.route-location-results');
      results.hidden=false;results.textContent=message;
      const button=document.createElement('button');button.type='button';button.textContent=text('이 장소 검색','Search this place');
      button.onclick=()=>{form.querySelector('input').focus();void search(form);};results.append(button);
    },
    cancelSelection() { cancelMapSelection?.(); },
    isSelectingPickup() { return !!document.querySelector('.pickup-selection'); },
    selectExistingPoint(point) { if(!chooseExistingPoint)return false;chooseExistingPoint(point);return true; },
    configureRouteSearch(handlers) { routeHandlers = handlers; } };
})();
