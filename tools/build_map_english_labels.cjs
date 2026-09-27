/* Refresh major-area label anchors using the configured NAVER geocoder. */
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://localhost:3000';
const districts = [
  ['종로구','Jongno-gu'],['중구','Jung-gu'],['용산구','Yongsan-gu'],
  ['성동구','Seongdong-gu'],['광진구','Gwangjin-gu'],['동대문구','Dongdaemun-gu'],
  ['중랑구','Jungnang-gu'],['성북구','Seongbuk-gu'],['강북구','Gangbuk-gu'],
  ['도봉구','Dobong-gu'],['노원구','Nowon-gu'],['은평구','Eunpyeong-gu'],
  ['서대문구','Seodaemun-gu'],['마포구','Mapo-gu'],['양천구','Yangcheon-gu'],
  ['강서구','Gangseo-gu'],['구로구','Guro-gu'],['금천구','Geumcheon-gu'],
  ['영등포구','Yeongdeungpo-gu'],['동작구','Dongjak-gu'],['관악구','Gwanak-gu'],
  ['서초구','Seocho-gu'],['강남구','Gangnam-gu'],['송파구','Songpa-gu'],['강동구','Gangdong-gu'],
];
const neighborhoods = [
  ['성동구 성수동1가','Seongsu-dong 1-ga'],['성동구 성수동2가','Seongsu-dong 2-ga'],
  ['성동구 송정동','Songjeong-dong'],['광진구 화양동','Hwayang-dong'],
  ['종로구 삼청동','Samcheong-dong'],['종로구 안국동','Anguk-dong'],
  ['종로구 익선동','Ikseon-dong'],['종로구 인사동','Insa-dong'],
  ['용산구 이태원동','Itaewon-dong'],['용산구 한남동','Hannam-dong'],
  ['마포구 서교동','Seogyo-dong'],['마포구 연남동','Yeonnam-dong'],
  ['마포구 망원동','Mangwon-dong'],['영등포구 여의도동','Yeouido-dong'],
  ['강남구 역삼동','Yeoksam-dong'],['강남구 삼성동','Samseong-dong'],
  ['강남구 압구정동','Apgujeong-dong'],['서초구 반포동','Banpo-dong'],
  ['서초구 서초동','Seocho-dong'],['송파구 잠실동','Jamsil-dong'],
  ['송파구 석촌동','Seokchon-dong'],['중구 명동','Myeong-dong'],
];
(async () => {
  const labels = [];
  for (const [items,kind] of [[districts,'district'],[neighborhoods,'neighborhood']]) {
    for (const [ko,name] of items) {
      const query = '서울특별시 ' + ko;
      const response = await fetch(base+'/api/maps/geocode?query='+encodeURIComponent(query));
      if (!response.ok) throw Error('Geocoding failed: '+query);
      const data = await response.json();
      const found = data.addresses?.filter(p=>p.roadAddress===query || p.jibunAddress===query);
      if (found?.length !== 1) throw Error('Ambiguous label anchor: '+query);
      const {lat,lng} = found[0];
      if (!Number.isFinite(lat)||!Number.isFinite(lng)) throw Error('Invalid coordinates: '+query);
      labels.push({name,lat,lng,kind});
    }
  }
  fs.writeFileSync(path.join(__dirname,'../front/public/map-en-labels.json'),JSON.stringify({source:'NAVER geocoding API; administrative-area anchors',labels},null,2)+'\n');
  console.log('Exported '+labels.length+' English area labels');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
