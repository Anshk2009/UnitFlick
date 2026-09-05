/**
 * convert.js — glue between the parser, the converters and the UI.
 *
 * This is the one place that decides "what does this selection become?".
 * It returns a plain, already-formatted result object. The UI only ever
 * renders strings that were produced here, which keeps the display code dumb
 * and safe.
 */

import { parseSelection } from '../utils/parse.js';
import { resolveUnit, convert, unitLabel, defaultTarget } from '../converters/units.js';
import { resolveCurrency, convertCurrency } from '../converters/currency.js';
import { formatNumber, formatAge } from '../utils/format.js';

/**
 * @typedef {Object} ConversionResult
 * @property {boolean} ok
 * @property {string} [input]   e.g. "20 km"
 * @property {string} [output]  e.g. "12.43 mi"
 * @property {string} [note]    e.g. "Rates from open.er-api.com, 3 h ago"
 * @property {boolean} [stale]  true when currency rates are past their TTL
 * @property {string} [error]   user-facing message when ok is false
 */

/**
 * @param {string} selection raw highlighted text (untrusted)
 * @param {object} settings sanitized settings
 * @param {(ttlMs:number)=>Promise<object|null>} getRates rate provider, injected
 *   so this function stays testable without a network or chrome APIs
 * @returns {Promise<ConversionResult>}
 */
export async function runConversion(selection, settings, getRates) {
  const parsed = parseSelection(selection);
  if (!parsed) {
    return { ok: false, error: 'Could not read a value and unit in that selection.' };
  }

  const { value, symbol } = parsed;
  const enabled = settings.enabledCategories || [];

  // Currency first: "$" and "USD" would otherwise never reach the unit tables.
  const currency = resolveCurrency(symbol);
  if (currency) {
    if (!enabled.includes('currency')) {
      return { ok: false, error: 'Currency conversion is turned off in settings.' };
    }
    return convertMoney(value, currency, settings, getRates);
  }

  const unit = resolveUnit(symbol);
  if (!unit) {
    return { ok: false, error: `"${symbol}" is not a unit UnitFlick knows.` };
  }
  if (!enabled.includes(unit.category)) {
    return { ok: false, error: `${unit.category} conversion is turned off in settings.` };
  }

  const targetId = defaultTarget(unit.category, unit.id, settings.unitSystem);
  const result = convert(value, unit.category, unit.id, targetId);
  if (result === null) {
    return { ok: false, error: 'That conversion is not supported.' };
  }

  return {
    ok: true,
    input: `${formatNumber(value, settings.precision)} ${unitLabel(unit.category, unit.id)}`,
    output: `${formatNumber(result, settings.precision)} ${unitLabel(unit.category, targetId)}`,
  };
}

async function convertMoney(value, from, settings, getRates) {
  // Selecting "$100" when your target currency is already USD should still do
  // something useful, so fall back to the other most common currency.
  const to = settings.targetCurrency === from
    ? (from === 'USD' ? 'EUR' : 'USD')
    : settings.targetCurrency;

  const ttlMs = settings.rateRefreshHours * 60 * 60 * 1000;
  const data = await getRates(ttlMs);

  // No rates means no conversion. We never guess, and we never show an old
  // number as if it were current.
  if (!data) {
    return { ok: false, error: 'Could not get exchange rates. Check your connection and try again.' };
  }

  const result = convertCurrency(value, from, to, data.rates);
  if (result === null) {
    return { ok: false, error: `No exchange rate available for ${from} → ${to}.` };
  }

  const age = formatAge(data.updatedAt);
  return {
    ok: true,
    input: `${formatNumber(value, settings.precision)} ${from}`,
    output: `${formatNumber(result, settings.precision)} ${to}`,
    note: data.stale
      ? `Stale rates from ${data.provider}, updated ${age}`
      : `Rates from ${data.provider}, updated ${age}`,
    stale: Boolean(data.stale),
  };
}
