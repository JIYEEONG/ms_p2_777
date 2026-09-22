/* Shared vehicle descriptions and rental rates for taxi, rental and policy UI. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MoovVehicleCatalog = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const vehicles = [
    { id: 'standard', name: 'MOOV 컴팩트', nameEn: 'MOOV Compact', seats: '1~2인', seatsEn: '1-2 passengers', baggage: 1, category: '컴팩트', desc: '가벼운 도심 이동', descEn: 'Easy city trips', about: '혼자 또는 둘이 이용하기 좋은 컴팩트형 차량입니다.', image: './moov-home/assets/8934912b44347ad3.png', accent: '#53B175', fareClass: 'small' },
    { id: 'family', name: 'MOOV 패밀리', nameEn: 'MOOV Family', seats: '최대 4인', seatsEn: 'Up to 4 passengers', baggage: 2, category: '패밀리', desc: '넓은 출입구와 휠체어 승하차 지원', descEn: 'Wide doors and wheelchair access', about: '넓은 출입구와 경사로, 여유로운 이동 공간으로 휠체어 이용자도 편안하게 승하차할 수 있는 차량입니다.', image: './moov-home/assets/263af28a256b1278.png', accent: '#72C9B2', fareClass: 'medium' },
    { id: 'premium', name: 'MOOV 라운지', nameEn: 'MOOV Lounge', seats: '최대 6인', seatsEn: 'Up to 6 passengers', baggage: 3, category: '프리미엄', desc: '여유로운 라운지형 공간', descEn: 'A spacious lounge cabin', about: '좌석과 실내 공간을 라운지처럼 사용할 수 있도록 구성된 프리미엄 차량입니다.', image: './moov-home/assets/46edadb897016e6a.png', accent: '#9F8DD2', fareClass: 'large' },
    { id: 'barrierfree', name: 'MOOV 배리어프리', nameEn: 'MOOV Accessible', seats: '최대 5인', seatsEn: 'Up to 5 passengers', baggage: 2, category: '배리어프리', desc: '휠체어 승하차 지원', descEn: 'Wheelchair access', about: '넓은 출입구와 경사로로 휠체어 이용자도 편안하게 승하차할 수 있는 차량입니다.', image: './moov-home/assets/faa24cc841b99c10.png', accent: '#5C9EAD', fareClass: 'medium' },
  ];
  const rentalRates = {
    standard: { label: '컴팩트', base3: 10180, base24: 56380, hourlyStep: 2200 },
    family: { label: '패밀리', base3: 12900, base24: 69600, hourlyStep: 2700 },
    premium: { label: '라운지', base3: 29870, base24: 162170, hourlyStep: 6300 },
    barrierfree: { label: '배리어프리', base3: 12900, base24: 69600, hourlyStep: 2700 },
  };
  const normalizeId = id => id === 'easyfit' ? 'family' : id;
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