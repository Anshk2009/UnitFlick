/**
 * units.js — non-currency conversion. 100% local: no network, ever.
 *
 * Every unit is defined by how many BASE units it is worth (metre, gram, ...).
 * Converting is then just `value * from.factor / to.factor`.
 * Adding a unit = adding one line to a table.
 */

const UNITS = {
  length: {
    units: {
      mm: { factor: 0.001, label: 'mm', system: 'metric', aliases: ['millimeter', 'millimetre', 'millimeters', 'millimetres'] },
      cm: { factor: 0.01, label: 'cm', system: 'metric', aliases: ['centimeter', 'centimetre', 'centimeters', 'centimetres'] },
      m: { factor: 1, label: 'm', system: 'metric', aliases: ['meter', 'metre', 'meters', 'metres'] },
      km: { factor: 1000, label: 'km', system: 'metric', aliases: ['kilometer', 'kilometre', 'kilometers', 'kilometres'] },
      in: { factor: 0.0254, label: 'in', system: 'imperial', aliases: ['inch', 'inches'] },
      ft: { factor: 0.3048, label: 'ft', system: 'imperial', aliases: ['foot', 'feet'] },
      yd: { factor: 0.9144, label: 'yd', system: 'imperial', aliases: ['yard', 'yards'] },
      mi: { factor: 1609.344, label: 'mi', system: 'imperial', aliases: ['mile', 'miles'] },
    },
  },
  mass: {
    units: {
      mg: { factor: 0.001, label: 'mg', system: 'metric', aliases: ['milligram', 'milligrams'] },
      g: { factor: 1, label: 'g', system: 'metric', aliases: ['gram', 'grams', 'gramme', 'grammes'] },
      kg: { factor: 1000, label: 'kg', system: 'metric', aliases: ['kilogram', 'kilograms', 'kilo', 'kilos'] },
      oz: { factor: 28.349523125, label: 'oz', system: 'imperial', aliases: ['ounce', 'ounces'] },
      lb: { factor: 453.59237, label: 'lb', system: 'imperial', aliases: ['lbs', 'pound', 'pounds'] },
    },
  },
};

/**
 * Lookup table built once at load: lowercased alias -> {category, id}.
 * Object.create(null) has no prototype, so a selection of "__proto__" or
 * "constructor" can never resolve to an inherited property.
 */
const INDEX = Object.create(null);

function register(category, id, def) {
  for (const k of [id, def.label, ...(def.aliases || [])]) {
    const key = String(k).toLowerCase();
    if (!(key in INDEX)) INDEX[key] = Object.freeze({ category, id });
  }
}

for (const [category, group] of Object.entries(UNITS)) {
  for (const [id, def] of Object.entries(group.units)) register(category, id, def);
}

/** Resolve a raw symbol from the parser to a known unit, or null if unsupported. */
export function resolveUnit(symbol) {
  if (typeof symbol !== 'string') return null;
  const key = symbol.toLowerCase().trim();
  if (key.length === 0 || key.length > 20) return null;
  return Object.prototype.hasOwnProperty.call(INDEX, key) ? INDEX[key] : null;
}

/** Human-readable label for a resolved unit id. */
export function unitLabel(category, id) {
  const g = UNITS[category];
  return g && g.units[id] ? g.units[id].label : id;
}

function unitSystem(category, id) {
  const g = UNITS[category];
  return g && g.units[id] && g.units[id].system;
}

// Opinionated pairings so "1 km" gives "mi" rather than "in".
const PAIRS = {
  mm: 'in', cm: 'in', m: 'ft', km: 'mi', in: 'cm', ft: 'm', yd: 'm', mi: 'km',
  mg: 'oz', g: 'oz', kg: 'lb', oz: 'g', lb: 'kg',
};

/**
 * Pick what to convert INTO: show the user the *other* measurement system.
 * If the source is already in their preferred system we convert away from it,
 * otherwise we convert into it.
 */
export function defaultTarget(category, id, preferredSystem = 'metric') {
  const from = unitSystem(category, id);
  const want = from === preferredSystem
    ? (preferredSystem === 'metric' ? 'imperial' : 'metric')
    : preferredSystem;

  const paired = PAIRS[id];
  if (paired && unitSystem(category, paired) === want) return paired;

  const group = UNITS[category];
  if (!group) return paired || id;
  const match = Object.entries(group.units).find(([other, def]) => other !== id && def.system === want);
  return match ? match[0] : (paired || id);
}

/**
 * Convert a value between two units of the SAME category.
 * @returns {number|null} null if units are unknown/mismatched or the result is
 *   not finite. Never throws.
 */
export function convert(value, category, fromId, toId) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const group = UNITS[category];
  if (!group) return null;
  const has = (id) => Object.prototype.hasOwnProperty.call(group.units, id);
  if (!has(fromId) || !has(toId)) return null;
  const result = (value * group.units[fromId].factor) / group.units[toId].factor;
  return Number.isFinite(result) ? result : null;
}

/** All unit ids in a category — used by the popup's "convert to" dropdown. */
export function unitsIn(category) {
  return UNITS[category] ? Object.keys(UNITS[category].units) : [];
}

/** Category ids, for the options page's "enabled categories" checkboxes. */
export const CATEGORIES = Object.keys(UNITS);
