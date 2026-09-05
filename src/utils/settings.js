/**
 * settings.js — user preferences, with validation on the way in AND out.
 *
 * Extension storage is only writable by UnitFlick itself, but we still validate
 * everything we read back. If a stored value is ever corrupted, we want a
 * default, not an undefined flowing into the converter or the DOM. Validation
 * is also what guarantees no setting can ever be a URL, a script, or HTML.
 */

import { CURRENCIES } from '../converters/currency.js';
import { CATEGORIES } from '../converters/units.js';

export const DEFAULTS = Object.freeze({
  targetCurrency: 'USD',
  unitSystem: 'metric',      // 'metric' | 'imperial'
  precision: 2,              // decimal places, 0-6
  // Frozen too: Object.freeze is shallow, and without this a caller that
  // mutates its own settings object would corrupt the defaults for everyone.
  enabledCategories: Object.freeze([...CATEGORIES, 'currency']),
  rateRefreshHours: 6,       // 1-72
});

const SYSTEMS = new Set(['metric', 'imperial']);
const ALL_CATEGORIES = new Set([...CATEGORIES, 'currency']);

/**
 * Coerce anything into a valid settings object. Unknown keys are dropped,
 * invalid values fall back to the default. Never throws.
 */
export function sanitizeSettings(input) {
  // Copy the array rather than handing out a reference to the frozen default.
  const out = { ...DEFAULTS, enabledCategories: [...DEFAULTS.enabledCategories] };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;

  if (typeof input.targetCurrency === 'string' && CURRENCIES.includes(input.targetCurrency)) {
    out.targetCurrency = input.targetCurrency;
  }

  if (typeof input.unitSystem === 'string' && SYSTEMS.has(input.unitSystem)) {
    out.unitSystem = input.unitSystem;
  }

  if (Number.isInteger(input.precision) && input.precision >= 0 && input.precision <= 6) {
    out.precision = input.precision;
  }

  if (Array.isArray(input.enabledCategories)) {
    // Filter against the known list, so an injected value cannot enable
    // anything that does not exist.
    const picked = input.enabledCategories.filter((c) => typeof c === 'string' && ALL_CATEGORIES.has(c));
    out.enabledCategories = [...new Set(picked)];
  }

  if (Number.isInteger(input.rateRefreshHours) && input.rateRefreshHours >= 1 && input.rateRefreshHours <= 72) {
    out.rateRefreshHours = input.rateRefreshHours;
  }

  return out;
}

/** Read settings from sync storage, falling back to defaults on any problem. */
export async function loadSettings() {
  try {
    const stored = await chrome.storage.sync.get('settings');
    return sanitizeSettings(stored && stored.settings);
  } catch {
    return { ...DEFAULTS };
  }
}

/** Validate then persist. Returns what was actually stored. */
export async function saveSettings(input) {
  const clean = sanitizeSettings(input);
  await chrome.storage.sync.set({ settings: clean });
  return clean;
}
