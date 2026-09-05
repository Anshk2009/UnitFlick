/**
 * format.js — turning numbers into strings people want to read.
 * Pure string/number work, no DOM, no storage.
 */

/**
 * Format a converted number.
 * Small values keep enough significant digits to stay useful (0.0001 in should
 * not round to "0.00"), big values keep thousands separators.
 * @param {number} value
 * @param {number} precision decimal places, 0-6
 */
export function formatNumber(value, precision = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';

  const abs = Math.abs(value);
  // Very large or very small: exponent notation is more honest than 20 zeroes.
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) return value.toExponential(2);

  // Keep at least a couple of significant digits for small numbers.
  let decimals = precision;
  if (abs !== 0 && abs < 1) {
    const leadingZeros = Math.floor(-Math.log10(abs));
    decimals = Math.min(6, Math.max(precision, leadingZeros + 2));
  }

  const fixed = value.toFixed(decimals);
  // Drop trailing zeroes ("1.50" -> "1.5") but keep whole numbers whole.
  const trimmed = decimals > 0 ? fixed.replace(/\.?0+$/, '') : fixed;

  const [whole, fraction] = trimmed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** "3 hours ago" style label for the exchange-rate timestamp. */
export function formatAge(timestamp, now = Date.now()) {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return 'unknown';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 90) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
