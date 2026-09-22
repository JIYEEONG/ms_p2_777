/* Shared vehicle descriptions and rental rates for taxi, rental and policy UI. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MoovVehicleCatalog = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const vehicles = [
    { id: 'standard', name: 'MOOV 컴팩트', nameEn: 'MOOV Compact', seats: '1~2인', seatsEn: '1–2 passengers', baggage: 1, category: '컴팩트', desc: '가벼운 도심 이동', descEn: 'Easy city trips', about: '혼자 또는 둘이 이용하기 좋은 컴팩트형 차량입니다.', image: './moov-home/assets/8934912b44347ad3.png', accent: '#53B175', fareClass: 'small' },
    { id: 'easyfit', name: 'MOOV 이지핏', nameEn: 'MOOV Easyfit', seats: '최대 4인', seatsEn: 'Up to 4 passengers', baggage: 2, category: '이지핏', desc: '넓은 출입구와 휠체어 승하차 지원', descEn: 'Wide doors and wheelchair access', about: '넓은 출입구와 경사로, 여유로운 이동 공간으로 휠체어 이용자도 편안하게 승하차할 수 있는 차량입니다.', image: './moov-home/assets/33b13453f88ad262.png', accent: '#72C9B2', fareClass: 'medium' },
    // Keep the family ID so saved choices continue to select the midsize car.
    { id: 'family', name: 'MOOV 중형', nameEn: 'MOOV Midsize', seats: '최대 4인', seatsEn: 'Up to 4 passengers', baggage: 4, category: '중형', desc: '최대 4명이 함께하는 편안한 이동', descEn: 'Comfortable trips for up to four', about: '일상 이동부터 나들이까지 최대 4명이 편안하게 이용할 수 있는 중형 차량입니다.', image: './moov-home/assets/263af28a256b1278.png', accent: '#61B48B', fareClass: 'medium' },
    { id: 'premium', name: 'MOOV 라운지', nameEn: 'MOOV Lounge', seats: '최대 6인', seatsEn: 'Up to 6 passengers', baggage: 3, category: '프리미엄', desc: '여유로운 라운지형 공간', descEn: 'A spacious lounge cabin', about: '좌석과 실내 공간을 라운지처럼 활용할 수 있도록 구성한 프리미엄 차량입니다.', image: './moov-home/assets/46edadb897016e6a.png', accent: '#9F8DD2', fareClass: 'large' },
  ];
  const rentalRates = {
    standard: { label: '컴팩트', base3: 10180, base24: 56380, hourlyStep: 2200 },
    easyfit: { label: '이지핏', base3: 12900, base24: 69600, hourlyStep: 2700 },
    family: { label: '중형', base3: 12900, base24: 69600, hourlyStep: 2700 },
    premium: { label: '라운지', base3: 29870, base24: 162170, hourlyStep: 6300 },
  };
  const normalizeId = id => id === 'barrierfree' ? 'easyfit' : id;
  function rentalFare(id, hours) {
    const rate = rentalRates[normalizeId(id)] || rentalRates.standard;
    const h = Math.max(3, Math.min(24, Number(hours) || 3));
    return Math.round((rate.base3 + rate.hourlyStep * (h - 3)) / 10) * 10;
  }
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  return freeze({ vehicles, rentalRates, normalizeId, rentalFare });
});
