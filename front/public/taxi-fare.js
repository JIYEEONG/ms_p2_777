/* Shared taxi fare calculations. The team's final workbook table is the source. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./taxi-fare-policy.js'));
  else root.MoovTaxiFare = factory(root.MoovTaxiFarePolicy);
})(typeof globalThis === 'object' ? globalThis : this, function (sourcePolicy) {
  'use strict';
  function immutable(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(immutable);
      Object.freeze(value);
    }
    return value;
  }
  if (!sourcePolicy?.classes || !sourcePolicy?.vehicleClasses) throw new Error('Taxi fare policy is unavailable.');
  const policy = immutable(sourcePolicy);
  const vehicles = immutable([
    { id: 'standard', name: 'MOOV 컴팩트', nameEn: 'MOOV Compact', seats: '1~2인', seatsEn: '1–2 passengers', desc: '가벼운 도심 이동', descEn: 'Easy city trips', image: './moov-home/assets/8934912b44347ad3.png' },
    { id: 'easyfit', name: 'MOOV 이지핏', nameEn: 'MOOV Easyfit', seats: '최대 4인', seatsEn: 'Up to 4 passengers', desc: '편안한 승하차와 넓은 실내', descEn: 'Easy access and a roomy cabin', image: './moov-home/assets/33b13453f88ad262.png' },
    { id: 'family', name: 'MOOV 패밀리', nameEn: 'MOOV Family', seats: '최대 6인', seatsEn: 'Up to 6 passengers', desc: '가족·친구와 함께하는 이동', descEn: 'Trips with family and friends', image: './moov-home/assets/263af28a256b1278.png' },
    { id: 'premium', name: 'MOOV 라운지', nameEn: 'MOOV Lounge', seats: '최대 6인', seatsEn: 'Up to 6 passengers', desc: '여유로운 라운지형 공간', descEn: 'A spacious lounge cabin', image: './moov-home/assets/46edadb897016e6a.png' },
    { id: 'barrierfree', name: 'MOOV 배리어프리', nameEn: 'MOOV Accessible', seats: '최대 5인', seatsEn: 'Up to 5 passengers', desc: '휠체어 승하차 지원', descEn: 'Wheelchair access', image: './moov-home/assets/faa24cc841b99c10.png' },
  ].map(vehicle => ({ ...vehicle, baggage: { standard: 1, easyfit: 2, family: 4, premium: 3, barrierfree: 2 }[vehicle.id], fareClass: policy.vehicleClasses[vehicle.id] })));
  function invalid(code, message) {
    const error = new RangeError(message);
    error.code = code;
    return error;
  }
  function calculate(input = {}) {
    const { vehicleId, distanceMeters } = input || {};
    if (!vehicles.some(vehicle => vehicle.id === vehicleId)) throw invalid('vehicle', 'Select a supported taxi vehicle.');
    if (typeof distanceMeters !== 'number' || !Number.isSafeInteger(distanceMeters) || distanceMeters < 0 || distanceMeters > policy.maxDistanceMeters) {
      throw invalid('distance', 'Distance must be a whole number of meters between 0 and 10,000,000.');
    }
    const fareClass = policy.vehicleClasses[vehicleId];
    const rate = policy.classes[fareClass];
    const extraMeters = Math.max(0, distanceMeters - rate.includedMeters);
    // Rates have at most two decimal places. Use integer hundred-thousandths
    // of a won so half-won boundaries are stable and we round only once.
    const rateHundredths = Math.round(rate.perKm * 100);
    const extraUnits = extraMeters * rateHundredths;
    const totalUnits = rate.baseFare * 100000 + extraUnits;
    const total = Math.floor((totalUnits + 50000) / 100000);
    return immutable({
      policyVersion: policy.version, vehicleId, fareClass,
      baseFare: rate.baseFare, includedMeters: rate.includedMeters,
      distanceMeters, extraMeters, perKm: rate.perKm,
      extraFare: extraUnits / 100000,
      unroundedTotal: totalUnits / 100000,
      total, roundingAdjustment: (total * 100000 - totalUnits) / 100000,
    });
  }
  function quote(input = {}) {
    const { durationSeconds } = input || {};
    if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
      throw invalid('duration', 'Estimated travel time must be a finite, nonnegative number of seconds.');
    }
    return immutable({ ...calculate(input), durationSeconds });
  }
  return immutable({ policy, vehicles, calculate, quote });
});
