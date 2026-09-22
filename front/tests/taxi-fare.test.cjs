'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { policy, vehicles, calculate, quote } = require('../public/taxi-fare.js');

// Source: 택시_요금정책.xlsx > 요금정책_요약 > final taxi table B5:D7.
// Its explicit final small-car base is 3,223, not the 3,223.2 intermediate
// calculation in 택시요금정책_근거!B44. Whole-won rounding is an app rule.
const classes = [
  { vehicleId: 'standard', fareClass: 'small', baseFare: 3223, includedMeters: 1600, perKm: 671.5, exampleTotal: 5842 },
  { vehicleId: 'easyfit', fareClass: 'medium', baseFare: 4080, includedMeters: 1600, perKm: 850, exampleTotal: 7395 },
  { vehicleId: 'family', fareClass: 'medium', baseFare: 4080, includedMeters: 1600, perKm: 850, exampleTotal: 7395 },
  { vehicleId: 'premium', fareClass: 'large', baseFare: 5950, includedMeters: 3000, perKm: 1126.25, exampleTotal: 8766 },
];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);

test('the four consolidated vehicles use the selected taxi classes and 5.5 km fares', () => {
  for (const expected of classes) {
    const fare = calculate({ vehicleId: expected.vehicleId, distanceMeters: 5500 });
    for (const key of ['vehicleId', 'fareClass', 'baseFare', 'includedMeters', 'perKm']) assert.equal(fare[key], expected[key]);
    assert.equal(fare.distanceMeters, 5500);
    assert.equal(fare.extraMeters, 5500 - expected.includedMeters);
    assert.equal(fare.total, expected.exampleTotal);
    assert.ok(typeof fare.policyVersion === 'string' && fare.policyVersion.length > 0);
    close(fare.baseFare + fare.extraFare, fare.unroundedTotal);
    close(fare.unroundedTotal + fare.roundingAdjustment, fare.total);
  }
});

test('zero and every distance up to the included threshold cost only the base fare', () => {
  for (const vehicle of classes) {
    for (const distanceMeters of [0, 1, vehicle.includedMeters - 1, vehicle.includedMeters]) {
      const fare = calculate({ vehicleId: vehicle.vehicleId, distanceMeters });
      assert.equal(fare.total, vehicle.baseFare);
      assert.equal(fare.extraMeters, 0);
      assert.equal(fare.extraFare, 0);
      assert.equal(fare.roundingAdjustment, 0);
    }
  }
});

test('only the distance beyond the threshold is charged, including the first metre', () => {
  const expected = [
    ['standard', 1601, 0.6715, 3224],
    ['easyfit', 1601, 0.85, 4081],
    ['family', 1601, 0.85, 4081],
    ['premium', 3001, 1.12625, 5951],
  ];
  for (const [vehicleId, distanceMeters, extraFare, total] of expected) {
    const fare = calculate({ vehicleId, distanceMeters });
    assert.equal(fare.extraMeters, 1);
    close(fare.extraFare, extraFare);
    assert.equal(fare.total, total);
  }
});

test('fractional rate calculations round the total once, including exact half-won boundaries', () => {
  const expected = [
    ['standard', 1602, 3224.343, 3224], // Rounding each metre would incorrectly charge 3,225.
    ['standard', 2600, 3894.5, 3895],
    ['easyfit', 1610, 4088.5, 4089],
    ['premium', 3004, 5954.505, 5955],
    ['premium', 3400, 6400.5, 6401],
    ['standard', 5500, 5841.85, 5842],
    ['premium', 5500, 8765.625, 8766],
    ['family', 1610, 4088.5, 4089],
  ];
  for (const [vehicleId, distanceMeters, unroundedTotal, total] of expected) {
    const fare = calculate({ vehicleId, distanceMeters });
    close(fare.unroundedTotal, unroundedTotal);
    assert.equal(fare.total, total);
    close(fare.roundingAdjustment, total - unroundedTotal);
  }
});

test('legacy accessible selections migrate to Easyfit and share the midsize fare', () => {
  for (const distanceMeters of [0, 2999, 3000, 3400, 5500, 18532]) {
    const easyfit = calculate({ vehicleId: 'easyfit', distanceMeters });
    for (const vehicleId of ['family', 'barrierfree']) {
      const fare = calculate({ vehicleId, distanceMeters });
      assert.deepEqual({ ...fare, vehicleId: 'easyfit' }, easyfit);
    }
  }
});

test('invalid, fractional, or oversized distances are rejected instead of coerced or silently rounded', () => {
  for (const distanceMeters of [undefined, null, '', '5500', false, true, NaN, Infinity, -Infinity, -1, -0.1, 1.5, 1600.001, 10000001, Number.MAX_SAFE_INTEGER, {}, []]) {
    assert.throws(() => calculate({ vehicleId: 'standard', distanceMeters }), `Invalid distance accepted: ${String(distanceMeters)}`);
  }
  assert.throws(() => calculate());
  assert.throws(() => calculate(null));
  assert.throws(() => calculate({ vehicleId: 'standard' }));
  assert.equal(calculate({ vehicleId: 'standard', distanceMeters: 10000000 }).total, 6717149);
  assert.equal(calculate({ vehicleId: 'easyfit', distanceMeters: 10000000 }).total, 8502720);
  assert.equal(calculate({ vehicleId: 'family', distanceMeters: 10000000 }).total, 8502720);
  assert.equal(calculate({ vehicleId: 'premium', distanceMeters: 10000000 }).total, 11265071);
});

test('unknown vehicle identifiers cannot inherit a default rate or prototype entry', () => {
  for (const vehicleId of [undefined, null, '', 'small', 'unknown', 'STANDARD', '__proto__', 'constructor', 'toString', 0, {}, []]) {
    assert.throws(() => calculate({ vehicleId, distanceMeters: 5500 }), `Invalid vehicle accepted: ${String(vehicleId)}`);
  }
});

test('quotes retain route duration as information without charging a time-based fare', () => {
  const input = Object.freeze({ vehicleId: 'easyfit', distanceMeters: 5500, durationSeconds: 990 });
  const fare = quote(input);
  assert.equal(fare.total, 7395);
  assert.equal(fare.durationSeconds, 990);
  assert.equal(fare.distanceMeters, 5500);
  for (const durationSeconds of [0, 60.5, 3600]) {
    const alternative = quote({ ...input, durationSeconds });
    assert.equal(alternative.durationSeconds, durationSeconds);
    assert.equal(alternative.total, fare.total);
  }
  assert.equal(input.durationSeconds, 990);
  for (const durationSeconds of [undefined, null, '', '990', NaN, Infinity, -Infinity, -1, false, {}, []]) {
    assert.throws(() => quote({ ...input, durationSeconds }), `Invalid duration accepted: ${String(durationSeconds)}`);
  }
  assert.throws(() => quote({ vehicleId: 'easyfit', distanceMeters: 5500 }));
});

test('policy metadata is deeply immutable and cannot change later calculations', () => {
  function assertFrozen(value) {
    if (!value || typeof value !== 'object') return;
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) assertFrozen(child);
  }
  assert.ok(policy && typeof policy === 'object');
  assert.ok(vehicles && typeof vehicles === 'object');
  assertFrozen(policy);
  assertFrozen(vehicles);
  assert.throws(() => { policy.unapprovedSurcharge = 1000; });
  assert.equal(calculate({ vehicleId: 'standard', distanceMeters: 5500 }).total, 5842);
});

test('whole-won fares stay nondecreasing across base and rounding boundaries', () => {
  for (const { vehicleId } of classes) {
    let previous = 0;
    for (let distanceMeters = 0; distanceMeters <= 20000; distanceMeters += 37) {
      const fare = calculate({ vehicleId, distanceMeters });
      assert.equal(Number.isSafeInteger(fare.total), true);
      assert.ok(fare.total >= previous);
      assert.ok(Math.abs(fare.roundingAdjustment) <= 0.500000001);
      previous = fare.total;
    }
  }
});
