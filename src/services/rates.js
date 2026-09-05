/**
 * rates.js — the only file in UnitFlick that touches the network.
 *
 * Provider: open.er-api.com (the free, keyless tier of ExchangeRate-API).
 * Keyless matters: there is no secret to hide, so nothing to leak from a
 * browser extension and no proxy backend to run. See PRIVACY.md.
 *
 * The URL is a hardcoded constant. Nothing from the page, the selection, or
 * the settings is ever concatenated into it — that is what stops UnitFlick
 * from being turned into an open proxy.
 */

import { CURRENCIES } from '../converters/currency.js';

// Frozen so nothing later in the process can point us somewhere else.
const RATES_URL = Object.freeze('https://open.er-api.com/v6/latest/USD');
const PROVIDER = 'open.er-api.com';

const REQUEST_TIMEOUT_MS = 8000;

// How long a cached table is considered current.
export const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
// Past the TTL we still show the rates, clearly marked stale, up to this age.
export const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Hard floor between two network calls, even on repeated failures. Without it a
// provider outage plus an impatient user becomes a request loop.
const MIN_REFETCH_INTERVAL_MS = 60 * 1000;

const STORAGE_KEY = 'rates';

/**
 * Check a parsed JSON body from the provider before we trust a single number.
 * Anything unexpected -> null, and the caller falls back to cache or an error.
 * @returns {{rates, fetchedAt, updatedAt, provider}|null}
 *   `fetchedAt` is when we asked; `updatedAt` is when the provider says the
 *   rates were last set. The popup shows `updatedAt`, because that is the
 *   number the user actually cares about.
 */
export function validateRatesPayload(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  if (json.result !== 'success') return null;
  if (json.base_code !== 'USD') return null;

  const table = json.rates;
  if (!table || typeof table !== 'object' || Array.isArray(table)) return null;

  // Copy only the currencies we support, onto a prototype-less object.
  // This drops the ~160 rates we do not need and makes "__proto__" in the
  // response inert.
  const rates = Object.create(null);
  for (const code of CURRENCIES) {
    if (!Object.prototype.hasOwnProperty.call(table, code)) continue;
    const value = table[code];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    rates[code] = value;
  }

  // USD is the base and must be exactly 1. If it is missing or wrong, the
  // response is not what we think it is.
  if (rates.USD !== 1) return null;
  // A response with almost nothing in it is not usable.
  if (Object.keys(rates).length < 5) return null;

  // The provider publishes once a day and tells us when. Fall back to "now"
  // only if that field is missing or nonsensical.
  const published = json.time_last_update_unix;
  const updatedAt = (typeof published === 'number' && Number.isFinite(published) && published > 0)
    ? published * 1000
    : Date.now();

  return { rates, fetchedAt: Date.now(), updatedAt, provider: PROVIDER };
}

/**
 * Fetch a fresh table. Exported with an injectable `fetchImpl` so tests can
 * feed it malformed responses without a network.
 * @returns {Promise<{rates, fetchedAt, provider}|null>}
 */
export async function fetchRates(fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(RATES_URL, {
      method: 'GET',
      // No cookies, no credentials, no referrer — the provider learns only
      // that some IP asked for public exchange rates.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null; // network error, DNS failure, or timeout
  }

  if (!response || !response.ok) return null; // covers 4xx, 5xx and 429

  let json;
  try {
    json = await response.json();
  } catch {
    return null; // not JSON at all
  }

  return validateRatesPayload(json);
}

/** Read the cached table, or null if there is nothing usable stored. */
async function readCache() {
  let stored;
  try {
    stored = await chrome.storage.local.get(STORAGE_KEY);
  } catch {
    return null;
  }
  const entry = stored && stored[STORAGE_KEY];
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.fetchedAt !== 'number' || !Number.isFinite(entry.fetchedAt)) return null;

  // Storage is only writable by this extension, but re-validating costs
  // nothing and protects against a corrupted or downgraded entry.
  const rates = Object.create(null);
  for (const code of CURRENCIES) {
    const value = entry.rates && entry.rates[code];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) rates[code] = value;
  }
  if (rates.USD !== 1) return null;

  const updatedAt = typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
    ? entry.updatedAt
    : entry.fetchedAt;

  return { rates, fetchedAt: entry.fetchedAt, updatedAt, provider: String(entry.provider || PROVIDER).slice(0, 60) };
}

// Single-flight guard: if two conversions ask at once, they share one request.
let inFlight = null;
let lastAttemptAt = 0;

/**
 * Get exchange rates, preferring a fresh cache.
 * @param {number} ttlMs how long a cached table counts as current
 * @returns {Promise<{rates, fetchedAt, provider, stale: boolean} | null>}
 *   null means "we genuinely do not have rates" — the caller must show an
 *   error rather than inventing a number.
 */
export async function getRates(ttlMs = DEFAULT_TTL_MS) {
  const cached = await readCache();
  const now = Date.now();

  if (cached && now - cached.fetchedAt < ttlMs) {
    return { ...cached, stale: false };
  }

  // Rate-limit our own retries so a failing provider cannot be hammered.
  const canRetry = now - lastAttemptAt > MIN_REFETCH_INTERVAL_MS;
  if (canRetry) {
    lastAttemptAt = now;
    inFlight = inFlight || fetchRates().finally(() => { inFlight = null; });
    const fresh = await inFlight;
    if (fresh) {
      try {
        await chrome.storage.local.set({ [STORAGE_KEY]: fresh });
      } catch {
        // Cache write failures are not fatal; we still have the numbers.
      }
      return { ...fresh, stale: false };
    }
  }

  // Refresh failed (or we are cooling down). Old rates are better than none,
  // but only within reason, and always labelled.
  if (cached && now - cached.fetchedAt < MAX_STALE_MS) {
    return { ...cached, stale: true };
  }
  return null;
}
