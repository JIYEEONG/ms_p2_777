/* Shared taxi fare calculations. The team's final workbook table is the source. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./taxi-fare-policy.js'), require('./vehicle-catalog.js'));
  else root.MoovTaxiFare = factory(root.MoovTaxiFarePolicy, root.MoovVehicleCatalog);
})(typeof globalThis === 'object' ? globalThis : this, function (sourcePolicy, catalog) {
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
  const vehicles = catalog.vehicles;
  function invalid(code, message) {
    const error = new RangeError(message);
    error.code = code;
    return error;
  }
  function calculate(input = {}) {
    const { distanceMeters } = input || {};
    const vehicleId = catalog.normalizeId(input?.vehicleId);
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
