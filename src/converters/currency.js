/**
 * currency.js — recognises currency symbols/codes and does the arithmetic.
 *
 * It does NOT fetch anything. Rates are handed in by services/rates.js, so this
 * file stays pure and trivially testable.
 */

// Supported ISO 4217 codes. An allow-list, deliberately: an unknown 3-letter
// token must never be forwarded anywhere or treated as a currency.
export const CURRENCIES = Object.freeze([
  'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
  'SGD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'ZAR', 'BRL', 'MXN',
  'AED', 'KRW', 'HKD', 'TRY', 'RUB', 'THB', 'IDR', 'PHP', 'VND',
]);

const CODE_SET = new Set(CURRENCIES);

/**
 * Symbol -> code. Ambiguous symbols get a documented default:
 *   "$" -> USD (not CAD/AUD/SGD), "¥" -> JPY (not CNY).
 * Users can disambiguate by highlighting the code instead ("250 CAD").
 * Built with Object.create(null) — no inherited keys to trip over.
 */
const SYMBOLS = Object.assign(Object.create(null), {
  $: 'USD', us$: 'USD', usd: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR', rs: 'INR', 'rs.': 'INR',
  '¥': 'JPY',
  'c$': 'CAD', ca$: 'CAD',
  'a$': 'AUD', au$: 'AUD',
  'chf': 'CHF', 'fr.': 'CHF',
  '元': 'CNY', '¥cn': 'CNY',
  'r$': 'BRL',
  '₩': 'KRW',
  '₽': 'RUB',
  '₺': 'TRY',
  '฿': 'THB',
  '₱': 'PHP',
  '₫': 'VND',
  'hk$': 'HKD',
  's$': 'SGD',
  'nz$': 'NZD',
  'kr': 'SEK',
  'zł': 'PLN',
  'r': 'ZAR',
  'د.إ': 'AED',
});

/**
 * Resolve a raw symbol from the parser to an ISO code, or null.
 * @param {string} symbol
 * @returns {string|null} e.g. "USD"
 */
export function resolveCurrency(symbol) {
  if (typeof symbol !== 'string') return null;
  const trimmed = symbol.trim();
  if (trimmed.length === 0 || trimmed.length > 6) return null;

  const upper = trimmed.toUpperCase();
  if (CODE_SET.has(upper)) return upper;

  const key = trimmed.toLowerCase();
  return Object.prototype.hasOwnProperty.call(SYMBOLS, key) ? SYMBOLS[key] : null;
}

/**
 * Convert an amount using a USD-based rate table (rates[X] = X per 1 USD).
 * @param {number} amount
 * @param {string} from ISO code
 * @param {string} to ISO code
 * @param {Object<string, number>} rates validated rate table
 * @returns {number|null} null on missing/invalid rates. Never throws.
 */
export function convertCurrency(amount, from, to, rates) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (!CODE_SET.has(from) || !CODE_SET.has(to)) return null;
  if (!rates || typeof rates !== 'object') return null;

  const has = (c) => Object.prototype.hasOwnProperty.call(rates, c);
  if (!has(from) || !has(to)) return null;

  const fromRate = rates[from];
  const toRate = rates[to];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) return null;

  const result = (amount / fromRate) * toRate;
  return Number.isFinite(result) ? result : null;
}
