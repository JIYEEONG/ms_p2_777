/* Read-only live NAVER regression: English tiles, station lookup and route. */
const assert = require('node:assert/strict');
module.exports = async ({openPage,base,mapReady,passed}) => {
  const client = await openPage(base+'/moov-home/index.html?embed=1&lang=en');
  await client.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await client.wait("typeof MOOVHome==='object'",'English rental boot');
  await client.evaluate(`clearInterval(ticker);state.tripActive=false;MOOVHome.setRoute([
    {name:'성수역 3번 출구',lat:37.5446,lng:127.0557},
    {name:'안국역',dwell:10},
    {name:'북촌한옥마을',lat:37.5826,lng:126.9831,dwell:20},
    {name:'삼청동 카페거리',lat:37.5843,lng:126.9817,dwell:20}
  ])`);
  await client.wait("state.rentalUX.route?.provider==='naver'||state.rentalUX.route?.routeError||state.rentalUX.route?.unresolved&&state.rentalUX.route?.locationLookupDone",'Anguk route resolution',45000);
  assert.equal(await client.evaluate('state.rentalUX.route.provider'),'naver',JSON.stringify(await client.evaluate('state.rentalUX.route')));
  await client.wait(mapReady('#home-booking-map'),'English rental map');
  assert.equal(await client.evaluate('rentalMapView.native.getMapTypeId()'),'moov-en');
  await client.wait("[...document.querySelectorAll('#home-booking-map img')].some(i=>i.complete&&i.naturalWidth>0&&i.src.includes('len'))",'English NAVER tiles loaded');
  assert.deepEqual(await client.evaluate("[...document.querySelectorAll('.route-location-form input')].map(i=>i.value).filter(v=>/[가-힣]/.test(v))"),[]);
  const route = await client.evaluate('state.rentalUX.route.stops.map(p=>[p.name,p.lat,p.lng])');
  await client.evaluate("document.querySelector('.route-location-form[data-route-index=\"1\"] input').focus()");
  await client.wait("!!document.querySelector('.route-location-form[data-route-index=\"1\"] .route-location-results button')",'Existing Anguk field shows detailed results').catch(async error=>{console.log(await client.evaluate("({active:document.activeElement.outerHTML,html:document.querySelector('.route-location-form[data-route-index=\"1\"]').outerHTML})"));throw error;});
  const result = await client.evaluate("document.querySelector('.route-location-form[data-route-index=\"1\"] .route-location-results button').textContent");
  assert.match(result,/Anguk Station, Line 3/);
  assert.match(result,/62/);
  assert.doesNotMatch(result,/[가-힣]/);
  await client.screenshot('english-anguk-route-addresses');
  await client.evaluate("MoovI18n.setLanguage('ko')");
  await client.wait("rentalMapView?.native.getMapTypeId()==='moov-ko'",'Korean map language');
  await client.evaluate("MoovI18n.setLanguage('en')");
  await client.wait("rentalMapView?.native.getMapTypeId()==='moov-en'",'English map language restored');
  assert.deepEqual(await client.evaluate('state.rentalUX.route.stops.map(p=>[p.name,p.lat,p.lng])'),route,'Language switch retains canonical route');
  assert.equal(await client.evaluate('state.rentalUX.route.provider'),'naver');
  passed('English NAVER tiles, real Anguk route, existing-value address search and language round trip');
  const taxi = await openPage(base+'/moov.html?lang=en');
  await taxi.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await taxi.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await taxi.wait("typeof render==='function' && state.isAuthenticated",'English taxi boot');
  await taxi.evaluate(`enterAuthenticatedScreen();state.tripActive=false;state.homeMode='taxi';state.homeStep='setup';state.activeTab='home';state.selectedCourse=null;state.taxiSearchPlaces={};state.taxiPickupCoords={lat:37.5446,lng:127.0557};state.pickupLocation='현재 위치 · 서울 성수동';state.routeStops=[state.pickupLocation,'한가람미술관','예술의전당 오페라하우스','서래마을'];render()`);
  await taxi.wait('!!currentTaxiQuote()','English taxi route and quote',45000);
  await taxi.wait(mapReady('#taxi-naver-map'),'English taxi map');
  assert.equal(await taxi.evaluate('taxiMapSession.map.getMapTypeId()'),'moov-en');
  assert.deepEqual(await taxi.evaluate("[...document.querySelectorAll('.route-location-form input')].map(i=>i.value)"),['Current location · Seongsu-dong, Seoul','Hangaram Art Museum','Seoul Arts Center Opera House','Seorae Village']);
  await taxi.evaluate("document.querySelector('.route-location-form[data-route-index=\"2\"] input').focus()");
  await taxi.wait("!!document.querySelector('.route-location-form[data-route-index=\"2\"] .route-location-results button')",'Existing taxi stop address lookup');
  assert.doesNotMatch(await taxi.evaluate("document.querySelector('.route-location-form[data-route-index=\"2\"] .route-location-results').textContent"),/[가-힣]/);
  await taxi.screenshot('english-taxi-opera-route-addresses');
  passed('English taxi course names, real multi-stop route and address lookup without retyping');
};
