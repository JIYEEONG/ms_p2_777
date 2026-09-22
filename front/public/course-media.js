(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./course-photos.js') : root.MoovCoursePhotos);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.MoovCourseMedia = api;
    // Image errors do not bubble; capture them for cards and modal content.
    document.addEventListener('error', event => {
      const image = event.target;
      if (image.tagName !== 'IMG' || !image.hasAttribute('data-course-photos')) return;
      api.markFailed(image.getAttribute('src'));
      if (image.hasAttribute('data-course-cover')) {
        const courses = new Map(api.repairSequence().map(course => [String(course.id), course]));
        document.querySelectorAll('img[data-course-cover]').forEach(element => {
          const course = courses.get(element.dataset.courseCover);
          if (!course) return;
          const options = api.candidates(course);
          if (!options.length) { element.remove(); return; }
          element.dataset.coursePhotos = JSON.stringify(options.slice(1));
          element.dataset.representative = String(api.isRepresentative(course, options[0]));
          if (element.getAttribute('src') !== options[0]) element.src = options[0];
        });
        if (!image.isConnected || api.available(image.getAttribute('src'))) return;
      }
      const remaining = JSON.parse(image.dataset.coursePhotos || '[]').filter(api.available);
      image.dataset.coursePhotos = JSON.stringify(remaining.slice(1));
      if (remaining.length) {
        image.dataset.representative = String(api.isRepresentative(null,remaining[0]));
        image.src = remaining[0];
      }
      else {
        image.remove();
      }
    }, true);
  }
})(typeof globalThis === 'object' ? globalThis : this, function (photos) {
  const failed = new Set();
  const selections = new Map();
  const displayed = new Map();
  let activeSequence = [];
  let sequenceCache = null;
  const REPEAT_WINDOW = 50;
  const normalized = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const hash = value => [...String(value)].reduce((n,ch)=>(n*31+ch.codePointAt(0))>>>0,0);
  const bySource = new Map(photos.map(photo=>[photo.src,photo]));
  const byAssetPath = new Map(photos.map(photo=>[photo.src.replace(/^\.\//, '/'), photo]));
  const food = ['korean-food','grill','steak','seafood','taco'];
  const categories = { '카페':['coffee','cafe-space','bakery','macaron'], '음식점':food,
    '전시':['gallery'], '관광':['city-view'], '쇼핑':['mall'], '체험':['pottery','craft','technology'] };
  const topicRules = [
    [/마카롱/,['macaron']], [/제과|베이커리|빵/ ,['bakery']],
    [/커피|카페|콘피|베르시|타이파|어니언|블루보틀/i,['coffee','cafe-space']],
    [/등심|스테이크/ ,['steak']], [/돼지|삼겹|갈비/ ,['grill']],
    [/갓잇|타코|멕시/ ,['taco']], [/수산|횟집|해물/ ,['seafood']],
    [/부엌|식당|조양관|음식|다이닝|냉면|돈까스/ ,['korean-food']],
    [/미술|갤러리|전시|문화역|박물|역사관|그라운드시소|브이스퀘어|엘씨오|커넥트투/ ,['gallery']],
    [/쇼핑|시장|던던|쌈지길/ ,['mall']], [/공방|도자|물레/ ,['pottery','craft']],
    [/AI|기술|로봇/i,['technology']], [/숲|공원|호수|일감호|한강|전망|타워|산|거리|광장|길|궁|한옥|롯데월드/ ,['city-view']],
  ];
  // Match identifiable places, not general categories such as "cafe".
  const places = [
    [/경복궁|근정전|gyeongbokgung|geunjeongjeon/i, 'place-gyeongbokgung.jpg'],
    [/광화문|gwanghwamun/i, 'place-gwanghwamun.jpg'],
    [/숭례문|남대문|sungnyemun|namdaemun/i, 'place-sungnyemun.jpg'],
    [/서울숲|가족마당/, 'course-seoulforest.jpg'],
    [/어니언 성수|대림창고|성수.*카페/, 'course-cafe.jpg'],
    [/난지|캠핑/, 'course-camping.jpg'],
    [/뚝섬|반포|한강|달빛광장/, 'course-hangang-sunset.jpg'],
    [/야구|잠실새내/, 'course-baseball.jpg'],
    [/재즈|경리단/, 'course-jazz.jpg'],
    [/북악|팔각정|부암동/, 'course-bugak.jpg'],
    [/인사동|익선동|쌈지길/, 'course-insadong.jpg'],
    [/이천|도자|설봉/, 'course-pottery.jpg'],
    [/롯데월드|매직아일랜드|회전목마/, 'course-lotteworld.jpg'],
    [/석촌|송리단길/, 'course-seokchon.jpg'],
    [/예술의전당|한가람|오페라|음악분수/, 'course-artscenter.jpg'],
    [/냉면/, 'course-naengmyeon.jpg'],
    [/돈까스/, 'course-tonkatsu.jpg'],
    [/서울도서관|정동길|청계천 책쉼터/, 'course-library.jpg'],
  ];
  function placeImage(name) {
    const file = places.find(([pattern]) => pattern.test(name || ''))?.[1];
    return file ? './assets/' + file : photos.find(photo=>photo.places.some(place=>normalized(name).includes(normalized(place))))?.src || null;
  }
  function available(src) {
    return typeof src === 'string' && src.trim() !== '' && !failed.has(src) &&
      /^(?:https?:\/\/|\.?\.?\/|data:image\/(?:jpeg|png|webp|gif);|blob:)/i.test(src);
  }
  function topicsFor(course) {
    const stops = course.stops?.length ? course.stops : [course.name];
    const fallback = (course._dbTags?.category || course.tagProfile?.category || course.tags?.category || []).flatMap(category=>categories[category] || []);
    const topics = stops.flatMap(name=>topicRules.find(([rule])=>rule.test(name || ''))?.[1] || fallback);
    return [...new Set(topics.length ? topics : ['city-view'])];
  }
  function representatives(course) {
    const topics = topicsFor(course);
    return photos.filter(photo=>!photo.places.length && topics.includes(photo.topic)).map(photo=>photo.src).filter(available);
  }
  function placePhotos(course) {
    const names=[course.name,...(course.stops || [])].map(normalized);
    return [...(course.stopDetails || []).map(stop => stop?.photo), placeImage(course.name),
      ...(course.stops || []).map(placeImage), ...photos.filter(photo=>photo.places.some(place=>names.some(name=>name.includes(normalized(place))))).map(photo=>photo.src)].filter(available);
  }
  function actualPhotos(course) { return [course.image, ...placePhotos(course)].filter(available); }
  function photoKey(photo) {
    const path = String(photo).replace(/^https?:\/\/[^/]+/, '').replace(/^\.\//, '/').split(/[?#]/)[0];
    const catalogPhoto = byAssetPath.get(path);
    if (catalogPhoto) return 'catalog:' + catalogPhoto.sha256;
    const files = new Set(places.map(([,file]) => file));
    const local = path.match(/^\/assets\/([^/]+)$/);
    const hosted = photo.match(/^https:\/\/[^/]+\.blob\.core\.windows\.net\/course-images\/([^/?#]+)(?:[?#].*)?$/);
    const file = (local || hosted)?.[1];
    return file && files.has(file) ? 'bundled:' + file : photo;
  }
  function candidates(course, index = null) {
    const stop = index == null ? null : course.stops?.[index];
    const sources = index == null
      ? [displayed.get(identity(course)), course._displayCover, ...(course._photoChoices || []), ...actualPhotos(course).filter(photo => !(course._duplicatePhotos || []).includes(photo)), ...representatives(course)]
      : [course.stopDetails?.[index]?.photo, placeImage(stop)];
    return [...new Set(sources.filter(available))];
  }
  function identity(course) {
    return JSON.stringify([course.id, course.name, course.stops, course.image]);
  }
  // List colouring: nearby cards must use different photos. Assign the most
  // constrained course first so flexible courses leave its photos available.
  // The input order and recommendation scores are never changed.
  function planSequence(options, preferred, windowSize) {
    const domains = options.map(values => new Set(values.map(photoKey)));
    const neighbours = options.map((_, i) => {
      const start = Math.max(0, i - windowSize + 1);
      const end = Math.min(options.length, i + windowSize);
      return Array.from({length: end - start}, (_, n) => start + n).filter(n => n !== i);
    });
    const assigned = Array(options.length).fill(null);
    let attempts = 0;
    function assign(remaining) {
      if (!remaining) return true;
      if (++attempts > 6000) return false;
      let index = -1;
      for (let i = 0; i < domains.length; i++) {
        if (assigned[i] !== null) continue;
        if (!domains[i].size) return false;
        if (index < 0 || domains[i].size < domains[index].size) index = i;
      }
      const pressure = key => neighbours[index].reduce((sum, i) => sum + (assigned[i] === null && domains[i].has(key) ? 1 / domains[i].size : 0), 0);
      const choices = [...domains[index]].sort((a, b) => Number(preferred[index].has(b)) - Number(preferred[index].has(a)) || pressure(a) - pressure(b));
      for (const key of choices) {
        assigned[index] = key;
        const removed = neighbours[index].filter(i => assigned[i] === null && domains[i].delete(key));
        if (assign(remaining - 1)) return true;
        removed.forEach(i => domains[i].add(key));
        assigned[index] = null;
      }
      return false;
    }
    return assign(options.length) ? assigned : null;
  }
  function sequenceCovers(courses) {
    activeSequence = courses;
    const options = courses.map(course => [...new Map(candidates(course).map(src => [photoKey(src), src])).values()]);
    const preferred = courses.map(course => new Set(actualPhotos(course).filter(src => !(course._duplicatePhotos || []).includes(src)).map(photoKey)));
    const signature = JSON.stringify([courses.map(identity), options.map(values => values.map(photoKey).sort())]);
    let chosen = sequenceCache?.signature === signature ? sequenceCache.chosen : null;
    if (!chosen) {
      chosen = planSequence(options, preferred, REPEAT_WINDOW);
      if (!chosen) {
        // A new narrowly filtered dataset may have too few suitable photos.
        // Keep every course and its subject, preferring the least recently used
        // suitable photo instead of hiding courses or showing unrelated places.
        const lastUsed = new Map();
        chosen = options.map((values, index) => {
          const keys = values.map(photoKey);
          keys.sort((a, b) => (lastUsed.get(a) ?? -Infinity) - (lastUsed.get(b) ?? -Infinity));
          if (keys[0]) lastUsed.set(keys[0], index);
          return keys[0];
        });
      }
      sequenceCache = {signature, chosen};
    }
    return courses.map((course, index) => {
      const cover = options[index].find(src => photoKey(src) === chosen[index]);
      if (displayed.size > 2000) displayed.clear();
      displayed.set(identity(course), cover);
      return {...course, _displayCover: cover};
    });
  }
  function repairSequence() { return sequenceCovers(activeSequence); }
  function distinguishCovers(courses) {
    const used = new Map(), result = new Map(), recent=[];
    const counts = new Map();
    courses.filter(course=>available(course.image)).forEach(course=>counts.set(photoKey(course.image),(counts.get(photoKey(course.image))||0)+1));
    const shared = course => available(course.image) && counts.get(photoKey(course.image)) > 1;
    // Sorting makes the same course keep its image when sort/filter order changes.
    const ordered = [...courses].sort((a,b) => Number(Boolean(b.image))-Number(Boolean(a.image)) || String(a.id || a.name).localeCompare(String(b.id || b.name)));
    for (const course of ordered) {
      // Reused generic uploads may be unrelated to the places (e.g. palace/cafe).
      const exact = placePhotos(course);
      const options = [...new Set([...exact,...representatives(course)])];
      const offset=options.length ? hash(course.id || course.name)%options.length : 0;
      const rotated=[...options.slice(offset),...options.slice(0,offset)];
      const penalty=src=>(used.get(photoKey(src)) || 0)*4+(recent.includes(photoKey(src))?20:0)+(exact.includes(src)?0:1);
      const ranked=rotated.sort((a,b)=>penalty(a)-penalty(b));
      const signature=JSON.stringify([course.id,course.name,course.stops,topicsFor(course),course.image,shared(course)]);
      const previous=selections.get(signature);
      const chosen=available(previous) ? previous : available(course.image)&&!shared(course) ? course.image : ranked[0];
      if(chosen){if(selections.size>2000)selections.clear();selections.set(signature,chosen);}
      if(chosen){const key=photoKey(chosen);used.set(key,(used.get(key)||0)+1);recent.push(key);if(recent.length>4)recent.shift();}
      result.set(course,{...course,_displayCover:chosen,_photoChoices:ranked});
    }
    return courses.map(course => ({...result.get(course), _duplicatePhotos:shared(course) && !placePhotos(course).includes(course.image) ? [course.image] : []}));
  }
  function isRepresentative(course, photo) {
    return bySource.has(photo) && bySource.get(photo).places.length === 0;
  }
  return { candidates, representatives, isRepresentative, topicsFor, photoKey, placeImage, distinguishCovers, sequenceCovers, repairSequence, REPEAT_WINDOW, photos, available, markFailed: src => failed.add(src) };
});
