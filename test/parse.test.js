import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSelection, parseNumber, normalize, MAX_INPUT_LENGTH } from '../src/utils/parse.js';

test('reads a value and a unit', () => {
  assert.deepEqual(parseSelection('20 km'), { value: 20, symbol: 'km' });
  assert.deepEqual(parseSelection('72°F'), { value: 72, symbol: '°F' });
  assert.deepEqual(parseSelection('10 lbs'), { value: 10, symbol: 'lbs' });
  assert.deepEqual(parseSelection('500 MB'), { value: 500, symbol: 'MB' });
});

test('reads currency symbols before and codes after the number', () => {
  assert.deepEqual(parseSelection('$250'), { value: 250, symbol: '$' });
  assert.deepEqual(parseSelection('₹5,000'), { value: 5000, symbol: '₹' });
  assert.deepEqual(parseSelection('100 USD'), { value: 100, symbol: 'USD' });
});

test('handles decimals, grouping and both separator conventions', () => {
  assert.equal(parseNumber('1,234.56'), 1234.56);   // English
  assert.equal(parseNumber('1.234,56'), 1234.56);   // European
  assert.equal(parseNumber('1234'), 1234);
  assert.equal(parseNumber('1,5'), 1.5);            // European decimal
  assert.equal(parseNumber('1,500'), 1500);         // grouping, not a decimal
  assert.equal(parseNumber('.5'), 0.5);
});

test('handles negative values', () => {
  assert.deepEqual(parseSelection('-40 C'), { value: -40, symbol: 'C' });
  assert.equal(parseNumber('-12.5'), -12.5);
});

test('normalizes odd whitespace and unicode', () => {
  assert.deepEqual(parseSelection('20 km'), { value: 20, symbol: 'km' });   // NBSP
  assert.deepEqual(parseSelection('  20   km  '), { value: 20, symbol: 'km' });
  assert.deepEqual(parseSelection('２０ km'), { value: 20, symbol: 'km' });      // fullwidth
  assert.deepEqual(parseSelection('20 km '), { value: 20, symbol: 'km' });  // hair space
});

test('rejects input that is not a value plus a symbol', () => {
  for (const bad of ['', '   ', 'abc', '20', 'km', '<b>20 km</b>', '20 km 30 mi', '$20 km']) {
    assert.equal(parseSelection(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('rejects HTML and script payloads as ordinary unparseable text', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    "20 km'; DROP TABLE rates;--",
    '{{constructor.constructor("alert(1)")()}}',
  ];
  for (const payload of payloads) {
    assert.equal(parseSelection(payload), null);
  }
});

test('rejects malformed and pathological numbers', () => {
  for (const bad of ['1e400 km', 'NaN km', 'Infinity km', '1.2.3.4.5.6.7.8 km', '--5 km']) {
    assert.equal(parseSelection(bad), null);
  }
  assert.equal(parseNumber('1e400'), null);
  assert.equal(parseNumber('9'.repeat(30)), null); // beyond our magnitude cap
});

test('rejects oversized input quickly', () => {
  const huge = '9'.repeat(2_000_000) + ' km';
  const started = Date.now();
  assert.equal(parseSelection(huge), null);
  assert.ok(Date.now() - started < 250, 'oversized input must not be slow');
});

test('a repeated-symbol payload does not blow up the matcher', () => {
  const nasty = '('.repeat(50_000) + '1 km';
  const started = Date.now();
  assert.equal(parseSelection(nasty), null);
  assert.ok(Date.now() - started < 250, 'no catastrophic backtracking');
});

test('normalize truncates before doing any work', () => {
  assert.ok(normalize('a'.repeat(10_000)).length <= MAX_INPUT_LENGTH + 1);
});

test('non-string input is handled', () => {
  for (const bad of [null, undefined, 42, {}, [], Symbol('x')]) {
    assert.equal(parseSelection(bad), null);
  }
});
