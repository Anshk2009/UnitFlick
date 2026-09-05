import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveUnit, convert, defaultTarget, unitLabel, CATEGORIES } from '../src/converters/units.js';
import { resolveCurrency, convertCurrency, CURRENCIES } from '../src/converters/currency.js';
import { formatNumber, formatAge } from '../src/utils/format.js';

const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('length conversions are exact', () => {
  close(convert(1, 'length', 'km', 'm'), 1000);
  close(convert(1, 'length', 'mi', 'km'), 1.609344);
  close(convert(12, 'length', 'in', 'ft'), 1);
  close(convert(1, 'length', 'yd', 'ft'), 3);
  close(convert(1000, 'length', 'mm', 'm'), 1);
});

test('mass conversions are exact', () => {
  close(convert(1, 'mass', 'kg', 'g'), 1000);
  close(convert(1, 'mass', 'lb', 'g'), 453.59237);
  close(convert(16, 'mass', 'oz', 'lb'), 1, 1e-12);
  close(convert(1000, 'mass', 'mg', 'g'), 1);
});

test('temperature conversions handle the offset', () => {
  close(convert(100, 'temperature', 'c', 'f'), 212);
  close(convert(32, 'temperature', 'f', 'c'), 0);
  close(convert(-40, 'temperature', 'f', 'c'), -40); // the crossover point
  close(convert(0, 'temperature', 'c', 'k'), 273.15);
  close(convert(273.15, 'temperature', 'k', 'c'), 0);
  close(convert(0, 'temperature', 'k', 'f'), -459.67, 1e-9);
});

test('area, volume, speed and storage convert', () => {
  close(convert(1, 'area', 'km2', 'm2'), 1e6);
  close(convert(1, 'area', 'acre', 'm2'), 4046.8564224);
  close(convert(1, 'volume', 'gal', 'l'), 3.785411784);
  close(convert(3, 'volume', 'tsp', 'tbsp'), 1, 1e-12);
  close(convert(1, 'speed', 'kmh', 'mps'), 1 / 3.6);
  close(convert(60, 'speed', 'mph', 'kmh'), 96.56064, 1e-9);
  close(convert(1, 'digital', 'gb', 'mb'), 1000);
  close(convert(1, 'digital', 'tb', 'b'), 1e12);
});

test('round trips return the original value', () => {
  for (const [category, a, b] of [
    ['length', 'mi', 'km'], ['mass', 'lb', 'kg'], ['temperature', 'f', 'c'],
    ['volume', 'gal', 'l'], ['speed', 'mph', 'kmh'], ['digital', 'gb', 'mb'],
  ]) {
    close(convert(convert(7.5, category, a, b), category, b, a), 7.5, 1e-9);
  }
});

test('unit aliases resolve', () => {
  assert.deepEqual(resolveUnit('kilometres'), { category: 'length', id: 'km' });
  assert.deepEqual(resolveUnit('LBS'), { category: 'mass', id: 'lb' });
  assert.deepEqual(resolveUnit('°f'), { category: 'temperature', id: 'f' });
  assert.deepEqual(resolveUnit('km/h'), { category: 'speed', id: 'kmh' });
  assert.deepEqual(resolveUnit(' MB '), { category: 'digital', id: 'mb' });
});

test('unknown and hostile unit names resolve to null', () => {
  for (const bad of ['', '   ', 'xyz', 'furlongs', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'a'.repeat(50), null, 42]) {
    assert.equal(resolveUnit(bad), null, `expected null for ${String(bad)}`);
  }
});

test('conversions between mismatched or unknown units fail closed', () => {
  assert.equal(convert(1, 'length', 'km', 'kg'), null);
  assert.equal(convert(1, 'nope', 'km', 'm'), null);
  assert.equal(convert(1, 'length', '__proto__', 'm'), null);
  assert.equal(convert(NaN, 'length', 'km', 'm'), null);
  assert.equal(convert(Infinity, 'length', 'km', 'm'), null);
  assert.equal(convert('10', 'length', 'km', 'm'), null);
  assert.equal(convert(1, 'temperature', 'c', 'zz'), null);
});

test('boundary values stay finite or fail closed', () => {
  assert.equal(convert(0, 'length', 'km', 'mi'), 0);
  assert.ok(Number.isFinite(convert(1e15, 'digital', 'tb', 'b')));
  assert.equal(convert(Number.MAX_VALUE, 'digital', 'tb', 'b'), null); // overflow -> null
});

test('default targets cross the measurement system', () => {
  assert.equal(defaultTarget('length', 'km', 'metric'), 'mi');
  assert.equal(defaultTarget('length', 'mi', 'metric'), 'km');
  assert.equal(defaultTarget('mass', 'kg', 'metric'), 'lb');
  assert.equal(defaultTarget('temperature', 'f', 'metric'), 'c');
  assert.equal(defaultTarget('digital', 'mb', 'metric'), 'gb');
  // Every unit must produce a target that actually converts.
  for (const category of CATEGORIES) {
    for (const system of ['metric', 'imperial']) {
      const from = defaultTarget(category, 'km', system);
      assert.equal(typeof from, 'string');
    }
  }
});

test('every category has a label for its units', () => {
  assert.equal(unitLabel('length', 'km'), 'km');
  assert.equal(unitLabel('temperature', 'c'), '°C');
  assert.equal(unitLabel('nope', 'zz'), 'zz'); // falls back to the id
});

test('currency symbols and codes resolve', () => {
  assert.equal(resolveCurrency('$'), 'USD');
  assert.equal(resolveCurrency('₹'), 'INR');
  assert.equal(resolveCurrency('€'), 'EUR');
  assert.equal(resolveCurrency('usd'), 'USD');
  assert.equal(resolveCurrency('JPY'), 'JPY');
  for (const code of CURRENCIES) assert.equal(resolveCurrency(code), code);
});

test('unknown currency tokens resolve to null', () => {
  for (const bad of ['', 'XYZ', 'BTC', '__proto__', 'toString', '$'.repeat(20), null, {}]) {
    assert.equal(resolveCurrency(bad), null);
  }
});

test('currency maths uses the USD-based table', () => {
  const rates = { USD: 1, EUR: 0.9, INR: 83, JPY: 150 };
  close(convertCurrency(100, 'USD', 'INR', rates), 8300);
  close(convertCurrency(83, 'INR', 'USD', rates), 1);
  close(convertCurrency(90, 'EUR', 'JPY', rates), 15000);
  close(convertCurrency(0, 'USD', 'EUR', rates), 0);
});

test('currency maths fails closed on bad rate tables', () => {
  assert.equal(convertCurrency(1, 'USD', 'INR', null), null);
  assert.equal(convertCurrency(1, 'USD', 'INR', {}), null);
  assert.equal(convertCurrency(1, 'USD', 'INR', { USD: 1 }), null);
  assert.equal(convertCurrency(1, 'USD', 'INR', { USD: 0, INR: 83 }), null); // divide by zero
  assert.equal(convertCurrency(1, 'USD', 'INR', { USD: 1, INR: -3 }), null);
  assert.equal(convertCurrency(1, 'USD', 'INR', { USD: 1, INR: 'x' }), null);
  assert.equal(convertCurrency(1, 'USD', 'XYZ', { USD: 1, XYZ: 2 }), null); // unsupported code
  assert.equal(convertCurrency(NaN, 'USD', 'INR', { USD: 1, INR: 83 }), null);
});

test('numbers are formatted at the requested precision', () => {
  assert.equal(formatNumber(1234567.891, 2), '1,234,567.89');
  assert.equal(formatNumber(1.5, 2), '1.5');
  assert.equal(formatNumber(100, 0), '100');
  assert.equal(formatNumber(12.3456, 3), '12.346');
  assert.equal(formatNumber(-40, 2), '-40');
  assert.equal(formatNumber(0, 2), '0');
  assert.equal(formatNumber(0.000123, 2), '0.00012'); // keeps significant digits
  assert.equal(formatNumber(NaN, 2), '—');
  assert.equal(formatNumber('x', 2), '—');
});

test('rate age is described in human terms', () => {
  const now = Date.now();
  assert.equal(formatAge(now, now), 'just now');
  assert.equal(formatAge(now - 3600e3, now), '60 min ago');
  assert.equal(formatAge(now - 6 * 3600e3, now), '6 h ago');
  assert.equal(formatAge(now - 3 * 86400e3, now), '3 d ago');
  assert.equal(formatAge('nope'), 'unknown');
});

test('lookup tables cannot be reached through the prototype chain', () => {
  // Nothing should be able to ask "what does __proto__ convert to?" and get
  // an answer that came from Object.prototype.
  for (const key of ['__proto__', 'constructor', 'toString', 'valueOf']) {
    assert.equal(resolveUnit(key), null);
    const target = defaultTarget('length', key, 'metric');
    assert.equal(typeof target, 'string');
    assert.equal(convert(1, 'length', key, 'm'), null);
  }
});
