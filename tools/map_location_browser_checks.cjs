const assert=require('node:assert/strict');

module.exports=async function({openPage,base,mapReady,passed}) {
  for(const rental of [true,false]){
    const client=await openPage(base+(rental?'/moov-home/index.html?embed=1&lang=ko':'/moov.html?lang=ko'));
    await client.wait("typeof state==='object' && typeof render==='function'",'app boot');
    if(rental){
      await client.evaluate("clearInterval(ticker);state.homeStep='booking';state.rentalFlowStep='setup';state.tripActive=false;render()");
      await client.wait("state.rentalUX.route?.provider==='naver'",'rental route');
    }else{
      await client.wait("document.querySelector('#app.screen-active')",'authenticated app');
      await client.evaluate("state.homeMode='taxi';state.homeStep='setup';state.tripActive=false;setTab('home')");
      await client.wait("!!currentTaxiQuote()",'taxi route');
    }
    const selector=rental?'#home-booking-map':'#taxi-naver-map';
    const map=rental?'rentalMapView.native':'taxiMapSession.map';
    await client.wait(mapReady(selector),'map ready');
    assert.equal(await client.evaluate("document.querySelectorAll('.mobility-map .map-mode-chip').length"),0);
    const stops=await client.evaluate('JSON.stringify(state.routeStops)');
    if(rental){
      assert.equal(await client.evaluate("document.querySelector('[data-action=setup-next]').textContent"),'렌트 시작');
      assert.equal(await client.evaluate("document.querySelectorAll('.source-demo-note').length"),0);
    }
    await client.evaluate(`Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(){throw Error('Demo mode must not request GPS');}}})`);
    await client.click('.map-locate');
    await client.wait("!!document.querySelector('.moov-current-location')",'demo location marker');
    assert.equal(await client.evaluate(`Math.abs(${map}.getCenter().lat()-37.5446)<.00001 && Math.abs(${map}.getCenter().lng()-127.0557)<.00001`),true);
    assert.match(await client.evaluate("document.querySelector('.moov-current-location').textContent"),/성수역/);
    await client.click(rental?'.route-tools [data-action="locate-rental"]':'.route-tools [data-action="locate-home"]');
    await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')",'demo pickup preview');
    assert.match(await client.evaluate("document.querySelector('.pickup-selection').textContent"),/성수역 3번 출구/);
    await client.click('.pickup-current');
    await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')",'demo pickup current location');
    const beforeDrag=await client.evaluate(`({lat:${map}.getCenter().lat(),lng:${map}.getCenter().lng()})`);
    await client.dragMarker('.pickup-center-pin');
    await client.wait(`Math.abs(${map}.getCenter().lat()-${beforeDrag.lat})+Math.abs(${map}.getCenter().lng()-${beforeDrag.lng})>.000001`,'pickup marker drag changes candidate');
    await client.wait("!!document.querySelector('.pickup-selection .primary-button:not(:disabled)')",'dragged pickup can be confirmed');
    assert.equal(await client.evaluate('JSON.stringify(state.routeStops)'),stops,'draft drag does not silently commit pickup');
    await client.click('.pickup-cancel');
    assert.equal(await client.evaluate('JSON.stringify(state.routeStops)'),stops);
    passed(`${rental?'Rental':'Taxi'} uses Seongsu Station demo location and allows dragging the pickup marker after locating`);
    await client.evaluate(`MoovNaverMap.getCurrentPosition=(success,error,options)=>{window.__gps={success,error,options};}`);
    await client.click('.map-locate');
    assert.equal(await client.evaluate("document.querySelector('.map-locate').disabled"),true);
    await client.evaluate("__gps.success({coords:{latitude:37.5665,longitude:126.978,accuracy:20}})");
    await client.wait("!!document.querySelector('.moov-current-location')",'GPS marker visible');
    assert.equal(await client.evaluate(`Math.abs(${map}.getCenter().lat()-37.5665)<.00001 && Math.abs(${map}.getCenter().lng()-126.978)<.00001`),true);
    assert.equal(await client.evaluate('JSON.stringify(state.routeStops)'),stops);
    assert.equal(await client.evaluate("!!document.querySelector('.pickup-selection')"),false);
    await client.click('.map-locate');
    await client.evaluate("__gps.success({coords:{latitude:37.57,longitude:126.98,accuracy:15}})");
    assert.equal(await client.evaluate("document.querySelectorAll('.moov-current-location').length"),1);
    await client.click('.map-locate');
    await client.evaluate('__gps.error({code:1})');
    assert.equal(await client.evaluate("document.querySelector('.map-locate').disabled"),false);
    assert.match(await client.evaluate("document.querySelector('#toast').textContent"),/위치 권한/);
    await client.click(rental?'[data-action="center-route"]':'[data-action="taxi-center-route"]');
    assert.equal(await client.evaluate('JSON.stringify(state.routeStops)'),stops);
    await client.screenshot(rental?'rental-gps-route':'taxi-gps-route');
    await client.click('.map-locate');
    await client.evaluate('window.__lateGps=__gps.success;render()');
    await client.wait(mapReady(selector),'replacement map');
    await client.evaluate('__lateGps({coords:{latitude:35,longitude:129}})');
    assert.equal(await client.evaluate("document.querySelectorAll('.moov-current-location').length"),0);
    passed(`${rental?'Rental':'Taxi'} GPS centers and marks location, keeps route, handles denial and stale callbacks; map badge removed`);
  }
};
