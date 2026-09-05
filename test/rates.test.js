import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRatesPayload, fetchRates } from '../src/services/rates.js';

const good = {
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: 1788566552,
  rates: { USD: 1, EUR: 0.9, GBP: 0.8, INR: 83, JPY: 150 },
};

const respond = (body, ok = true) => async () => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => body,
});

test('a well-formed response is accepted', () => {
  const parsed = validateRatesPayload(good);
  assert.ok(parsed);
  assert.equal(parsed.rates.INR, 83);
  assert.equal(parsed.updatedAt, 1788566552 * 1000);
  assert.equal(parsed.provider, 'open.er-api.com');
});

test('malformed responses are rejected rather than half-trusted', () => {
  const bad = [
    null, undefined, 'not json', 42, [],
    {},
    { result: 'error', 'error-type': 'unsupported-code' },
    { result: 'success' },                                    // no rates
    { result: 'success', base_code: 'EUR', rates: good.rates }, // wrong base
    { result: 'success', base_code: 'USD', rates: [] },        // array, not object
    { result: 'success', base_code: 'USD', rates: { USD: 2, EUR: 0.9, GBP: 1, INR: 83, JPY: 150 } }, // base != 1
    { result: 'success', base_code: 'USD', rates: { USD: 1 } }, // too few
  ];
  for (const body of bad) {
    assert.equal(validateRatesPayload(body), null, `should reject ${JSON.stringify(body)}`);
  }
});

test('individually broken rates are dropped, not trusted', () => {
  const parsed = validateRatesPayload({
    ...good,
    rates: {
      ...good.rates,
      CHF: 0.88, CNY: 7.1, SGD: 1.35, SEK: 10.4, // enough valid ones to stay usable
      EUR: 'free', GBP: -1, JPY: Infinity, CAD: null, AUD: 0,
    },
  });
  assert.ok(parsed);
  assert.equal('EUR' in parsed.rates, false);
  assert.equal('GBP' in parsed.rates, false);
  assert.equal('JPY' in parsed.rates, false);
  assert.equal('CAD' in parsed.rates, false);
  assert.equal('AUD' in parsed.rates, false);
});

test('a response cannot pollute Object.prototype', () => {
  const payload = JSON.parse(
    '{"result":"success","base_code":"USD","rates":{"USD":1,"EUR":0.9,"GBP":0.8,"INR":83,"JPY":150,"__proto__":{"polluted":true}}}'
  );
  const parsed = validateRatesPayload(payload);
  assert.ok(parsed);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(parsed.rates), null);
});

test('only supported currencies survive validation', () => {
  const parsed = validateRatesPayload({ ...good, rates: { ...good.rates, ZZZ: 5, XBT: 0.00002 } });
  assert.equal('ZZZ' in parsed.rates, false);
  assert.equal('XBT' in parsed.rates, false);
});

test('HTTP errors, non-JSON bodies and network failures all return null', async () => {
  assert.equal(await fetchRates(respond(good, false)), null);          // 500
  assert.equal(await fetchRates(async () => ({ ok: true, json: async () => { throw new Error('bad json'); } })), null);
  assert.equal(await fetchRates(async () => { throw new Error('offline'); }), null);
  assert.equal(await fetchRates(async () => null), null);
  assert.equal(await fetchRates(respond({ result: 'error' })), null);
});

test('a rate-limit response is treated as a failure, not as data', async () => {
  const limited = async () => ({ ok: false, status: 429, json: async () => ({ result: 'error' }) });
  assert.equal(await fetchRates(limited), null);
});

test('the provider URL is fixed and https', async () => {
  let seen = null;
  await fetchRates(async (url, options) => {
    seen = { url, options };
    return { ok: true, json: async () => good };
  });
  assert.equal(seen.url, 'https://open.er-api.com/v6/latest/USD');
  assert.equal(seen.options.credentials, 'omit');
  assert.equal(seen.options.referrerPolicy, 'no-referrer');
  assert.ok(seen.options.signal, 'a timeout signal must be set');
});

test('an implausibly large response is refused before it is buffered', async () => {
  let bodyRead = false;
  const huge = async () => ({
    ok: true,
    headers: { get: (name) => (name === 'content-length' ? '900000000' : null) },
    json: async () => { bodyRead = true; return good; },
  });
  assert.equal(await fetchRates(huge), null);
  assert.equal(bodyRead, false, 'the body must not be read at all');
});

test('a response with no content-length is still processed', async () => {
  const noHeader = async () => ({ ok: true, headers: { get: () => null }, json: async () => good });
  assert.ok(await fetchRates(noHeader));
});
