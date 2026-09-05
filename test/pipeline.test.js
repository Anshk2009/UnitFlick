import test from 'node:test';
import assert from 'node:assert/strict';

import { runConversion } from '../src/background/convert.js';
import { sanitizeSettings, DEFAULTS } from '../src/utils/settings.js';

const RATES = {
  rates: { USD: 1, EUR: 0.9, GBP: 0.8, INR: 83, JPY: 150 },
  updatedAt: Date.now() - 3600e3,
  provider: 'open.er-api.com',
  stale: false,
};

const withRates = async () => RATES;
const noRates = async () => null;
const staleRates = async () => ({ ...RATES, stale: true });

test('converts units end to end', async () => {
  const r = await runConversion('20 km', DEFAULTS, noRates);
  assert.deepEqual(r, { ok: true, input: '20 km', output: '12.43 mi' });
});

test('converts temperature end to end', async () => {
  const r = await runConversion('72°F', DEFAULTS, noRates);
  assert.equal(r.output, '22.22 °C');
});

test('converts currency end to end and reports the rate age', async () => {
  const r = await runConversion('₹5,000', DEFAULTS, withRates);
  assert.equal(r.ok, true);
  assert.equal(r.input, '5,000 INR');
  assert.equal(r.output, '60.24 USD');
  assert.match(r.note, /open\.er-api\.com/);
  assert.equal(r.stale, false);
});

test('stale rates are shown but clearly labelled', async () => {
  const r = await runConversion('₹5,000', DEFAULTS, staleRates);
  assert.equal(r.ok, true);
  assert.equal(r.stale, true);
  assert.match(r.note, /^Stale rates/);
});

test('a failed rate lookup is an error, never a made-up number', async () => {
  const r = await runConversion('₹5,000', DEFAULTS, noRates);
  assert.equal(r.ok, false);
  assert.match(r.error, /exchange rates/i);
  assert.equal(r.output, undefined);
});

test('hostile selections produce a plain error, never markup', async () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '20 km<script>',
    'javascript:alert(1)',
    '"><svg/onload=alert(1)>',
    'a'.repeat(500_000) + ' km',
  ];
  for (const payload of payloads) {
    const r = await runConversion(payload, DEFAULTS, withRates);
    assert.equal(r.ok, false, `expected failure for ${payload.slice(0, 30)}`);
    assert.equal(typeof r.error, 'string');
    assert.ok(!/[<>]/.test(r.error), 'error text must not carry markup back');
  }
});

test('invisible control characters are stripped, not honoured', async () => {
  // A right-to-left override can make "5 km" render as something else entirely.
  const rtl = await runConversion('‮5 km', DEFAULTS, withRates);
  assert.equal(rtl.ok, true);
  assert.equal(rtl.input, '5 km');

  // A NUL in the middle of a token must not survive into the symbol.
  const nul = await runConversion('100\u0000USD', DEFAULTS, withRates);
  assert.equal(nul.ok, true);
  assert.equal(nul.input, '100 USD');

  // Zero-width characters cannot be used to smuggle a different unit.
  const zw = await runConversion('20 k​m', DEFAULTS, withRates);
  assert.equal(zw.ok, true);
  assert.equal(zw.output, '12.43 mi');
});

test('an unknown unit names the symbol without echoing a payload', async () => {
  const r = await runConversion('10 furlongs', DEFAULTS, withRates);
  assert.equal(r.ok, false);
  assert.match(r.error, /furlongs/);
  assert.ok(r.error.length < 80);
});

test('disabled categories refuse to convert', async () => {
  const settings = sanitizeSettings({ ...DEFAULTS, enabledCategories: ['length'] });
  assert.equal((await runConversion('20 km', settings, withRates)).ok, true);
  assert.equal((await runConversion('10 kg', settings, withRates)).ok, false);
  assert.equal((await runConversion('$10', settings, withRates)).ok, false);
});

test('precision and unit system settings are respected', async () => {
  const imperial = sanitizeSettings({ ...DEFAULTS, unitSystem: 'imperial', precision: 0 });
  // The source is already imperial, so the useful answer is the metric one.
  const r = await runConversion('10 mi', imperial, withRates);
  assert.equal(r.output, '16 km');
});

test('settings are sanitized, never trusted as stored', () => {
  const hostile = sanitizeSettings({
    targetCurrency: 'https://evil.example/steal',
    unitSystem: '<script>',
    precision: 999,
    rateRefreshHours: -1,
    enabledCategories: ['length', '__proto__', 'currency', { toString: () => 'length' }],
    extraKey: 'ignored',
  });
  assert.equal(hostile.targetCurrency, 'USD');
  assert.equal(hostile.unitSystem, 'metric');
  assert.equal(hostile.precision, 2);
  assert.equal(hostile.rateRefreshHours, 6);
  assert.deepEqual(hostile.enabledCategories, ['length', 'currency']);
  assert.equal('extraKey' in hostile, false);
});

test('settings survive junk of any shape', () => {
  for (const junk of [null, undefined, 'string', 42, [], () => {}]) {
    assert.deepEqual(sanitizeSettings(junk), { ...DEFAULTS });
  }
});

test('no settings value can ever be a URL or contain markup', () => {
  const clean = sanitizeSettings({
    targetCurrency: 'javascript:alert(1)',
    unitSystem: 'http://evil.example',
  });
  for (const value of Object.values(clean)) {
    const text = Array.isArray(value) ? value.join(' ') : String(value);
    assert.ok(!/[<>]|https?:|javascript:/i.test(text), `unexpected value: ${text}`);
  }
});
