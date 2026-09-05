/**
 * parse.js — turns a raw highlighted string into a structured {value, symbol} pair.
 *
 * SECURITY NOTE: everything that arrives here is attacker-controlled. It comes from
 * whatever text the user happened to highlight on an arbitrary (possibly hostile)
 * webpage. So this file:
 *   - hard-caps the input length BEFORE doing any work,
 *   - uses only bounded, non-backtracking regexes (no nested quantifiers -> no ReDoS),
 *   - never evaluates, never builds HTML, never builds a URL.
 * It returns plain data or null. It never throws for bad input.
 */

// Longest selection we are willing to even look at. A real conversion target
// ("1,234.56 kilometres per hour") is tiny; anything bigger is noise or an attack.
export const MAX_INPUT_LENGTH = 120;

// Characters that different fonts/locales use for spaces. We flatten them all to " ".
// (NBSP, narrow NBSP, thin space, figure space, en/em spaces, ideographic space...)
const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

// Invisible control and formatting characters: C0/C1 controls, bidi overrides,
// zero-width joiners, the BOM. Stripped outright — they can only ever be used to
// make a string display as something other than what it is.
const INVISIBLES = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;

// Characters used as "fancy" minus signs.
const UNICODE_MINUS = /[\u2212\u2012\u2013\u2014]/g;

/**
 * Step 1: normalise. Makes the string boring and predictable.
 * NFKC folds look-alike Unicode (e.g. fullwidth "１２３" -> "123", "℃" -> "°C").
 */
export function normalize(raw) {
  if (typeof raw !== 'string') return '';
  // Truncate FIRST. We must never run normalize()/regex over a 50 MB string.
  const capped = raw.length > MAX_INPUT_LENGTH ? raw.slice(0, MAX_INPUT_LENGTH + 1) : raw;
  let s;
  try {
    s = capped.normalize('NFKC');
  } catch {
    s = capped; // normalize() can throw on lone surrogates; degrade gracefully.
  }
  return s
    .replace(INVISIBLES, '')
    .replace(UNICODE_SPACES, ' ')
    .replace(UNICODE_MINUS, '-')
    .replace(/\s+/g, ' ') // collapse runs of whitespace
    .trim();
}

/**
 * The whole grammar, in one bounded regex:
 *   [prefix symbol]  [number]  [suffix symbol]
 * Every quantifier has an explicit upper bound, and none of them are nested,
 * so matching is linear in the input length. That is what makes it ReDoS-proof.
 *
 *   prefix  = up to 5 symbol chars (no digits, spaces or signs)  e.g. "$", "US$", "₹"
 *             signs are excluded so "-40 C" reads as a negative number,
 *             not as a prefix of "-" plus a suffix of "C".
 *   number  = digits with optional , . group/decimal separators
 *   suffix  = up to 12 chars of unit text                   e.g. "km/h", "°F", "MB"
 */
const PATTERN = /^([^\d\s+.,-]{0,5})\s?(-?\d{1,20}(?:[.,]\d{1,3}){0,6}|-?[.,]\d{1,20})\s?([^\d]{0,12})$/u;

/**
 * Step 2: work out what the digits mean.
 * Handles "1,234.56" (English), "1.234,56" (European) and plain "1234.56".
 * Returns a finite number, or null. Never returns NaN/Infinity.
 */
export function parseNumber(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > 40) return null;

  const negative = text.startsWith('-');
  let body = negative ? text.slice(1) : text;

  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: whichever comes LAST is the decimal separator.
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const groupSep = decimalSep === ',' ? '.' : ',';
    body = body.split(groupSep).join('');
    body = body.replace(decimalSep, '.');
  } else if (lastComma >= 0) {
    // Only commas. "1,234" is grouping; "1,5" is a European decimal.
    // Rule of thumb: exactly 3 digits after the last comma => grouping.
    const tail = body.slice(lastComma + 1);
    body = tail.length === 3 ? body.split(',').join('') : body.replace(/,/g, '.');
  }
  // Only dots (or neither): already fine, except "1.234.567" style grouping.
  if (lastDot >= 0 && lastComma < 0 && (body.match(/\./g) || []).length > 1) {
    body = body.split('.').join('');
  }

  if (!/^\d*\.?\d*$/.test(body) || body === '' || body === '.') return null;

  const n = Number(body);
  // Reject NaN, Infinity, and absurd magnitudes that would produce useless output.
  if (!Number.isFinite(n) || Math.abs(n) > 1e15) return null;
  return negative ? -n : n;
}

/**
 * Step 3: the public entry point.
 * @returns {{value:number, symbol:string} | null}
 *   `symbol` is the raw (normalised) unit/currency token — resolving it to a real
 *   unit is the converter's job, not the parser's.
 */
export function parseSelection(raw) {
  const text = normalize(raw);
  if (text.length === 0 || text.length > MAX_INPUT_LENGTH) return null;

  const m = PATTERN.exec(text);
  if (!m) return null;

  const [, prefix, numberText, suffix] = m;
  const value = parseNumber(numberText);
  if (value === null) return null;

  // A selection may carry its symbol before ("$5") or after ("5 km") the number,
  // but not both ("$5 km" is ambiguous garbage -> reject).
  const pre = prefix.trim();
  const post = suffix.trim();
  if (pre && post) return null;

  const symbol = pre || post;
  if (!symbol) return null; // a bare number has nothing to convert

  return { value, symbol };
}
