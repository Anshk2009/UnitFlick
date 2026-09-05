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
  area: {
    units: {
      m2: { factor: 1, label: 'm²', system: 'metric', aliases: ['sqm', 'sq m', 'square meter', 'square metre', 'square meters', 'square metres'] },
      km2: { factor: 1e6, label: 'km²', system: 'metric', aliases: ['sqkm', 'sq km', 'square kilometer', 'square kilometre'] },
      ft2: { factor: 0.09290304, label: 'ft²', system: 'imperial', aliases: ['sqft', 'sq ft', 'square foot', 'square feet'] },
      acre: { factor: 4046.8564224, label: 'acres', system: 'imperial', aliases: ['acres'] },
    },
  },
  volume: {
    units: {
      ml: { factor: 0.001, label: 'mL', system: 'metric', aliases: ['milliliter', 'millilitre', 'milliliters', 'millilitres'] },
      l: { factor: 1, label: 'L', system: 'metric', aliases: ['liter', 'litre', 'liters', 'litres'] },
      tsp: { factor: 0.00492892159375, label: 'tsp', system: 'imperial', aliases: ['teaspoon', 'teaspoons'] },
      tbsp: { factor: 0.01478676478125, label: 'tbsp', system: 'imperial', aliases: ['tablespoon', 'tablespoons'] },
      cup: { factor: 0.2365882365, label: 'cup', system: 'imperial', aliases: ['cups'] },
      gal: { factor: 3.785411784, label: 'gal', system: 'imperial', aliases: ['gallon', 'gallons'] },
    },
  },
  speed: {
    units: {
      kmh: { factor: 1 / 3.6, label: 'km/h', system: 'metric', aliases: ['km/h', 'kph', 'kmph'] },
      mps: { factor: 1, label: 'm/s', system: 'metric', aliases: ['m/s'] },
      mph: { factor: 0.44704, label: 'mph', system: 'imperial', aliases: ['mi/h'] },
    },
  },
  // Decimal (SI) sizes: 1 KB = 1000 B. Called out in the README so nobody is
  // surprised that this disagrees with what a file manager shows.
  digital: {
    units: {
      b: { factor: 1, label: 'B', system: 'metric', aliases: ['byte', 'bytes'] },
      kb: { factor: 1e3, label: 'KB', system: 'metric', aliases: ['kilobyte', 'kilobytes'] },
      mb: { factor: 1e6, label: 'MB', system: 'metric', aliases: ['megabyte', 'megabytes'] },
      gb: { factor: 1e9, label: 'GB', system: 'metric', aliases: ['gigabyte', 'gigabytes'] },
      tb: { factor: 1e12, label: 'TB', system: 'metric', aliases: ['terabyte', 'terabytes'] },
    },
  },
};

// Temperature is scale + offset, not just a scale, so it cannot live in the
// factor tables above and gets its own pair of conversions below.
const TEMPERATURE = {
  c: { label: '°C', system: 'metric', aliases: ['°c', 'celsius', 'centigrade'] },
  f: { label: '°F', system: 'imperial', aliases: ['°f', 'fahrenheit'] },
  k: { label: 'K', system: 'metric', aliases: ['kelvin'] },
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
for (const [id, def] of Object.entries(TEMPERATURE)) register('temperature', id, def);

/** Resolve a raw symbol from the parser to a known unit, or null if unsupported. */
export function resolveUnit(symbol) {
  if (typeof symbol !== 'string') return null;
  const key = symbol.toLowerCase().trim();
  if (key.length === 0 || key.length > 20) return null;
  return Object.prototype.hasOwnProperty.call(INDEX, key) ? INDEX[key] : null;
}

/** Human-readable label for a resolved unit id. */
export function unitLabel(category, id) {
  if (category === 'temperature') return TEMPERATURE[id] ? TEMPERATURE[id].label : id;
  const g = UNITS[category];
  return g && g.units[id] ? g.units[id].label : id;
}

function unitSystem(category, id) {
  if (category === 'temperature') return TEMPERATURE[id] && TEMPERATURE[id].system;
  const g = UNITS[category];
  return g && g.units[id] && g.units[id].system;
}

// Opinionated pairings so "1 km" gives "mi" rather than "in".
const PAIRS = {
  mm: 'in', cm: 'in', m: 'ft', km: 'mi', in: 'cm', ft: 'm', yd: 'm', mi: 'km',
  mg: 'oz', g: 'oz', kg: 'lb', oz: 'g', lb: 'kg',
  m2: 'ft2', km2: 'acre', ft2: 'm2', acre: 'km2',
  ml: 'tsp', l: 'gal', tsp: 'ml', tbsp: 'ml', cup: 'ml', gal: 'l',
  kmh: 'mph', mph: 'kmh', mps: 'kmh',
  // Digital sizes have no "other system", so these just step up a scale.
  b: 'kb', kb: 'mb', mb: 'gb', gb: 'mb', tb: 'gb',
  c: 'f', f: 'c', k: 'c',
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

  // m/s is a scientific unit rather than an everyday one, so we always show it
  // as km/h regardless of which system the user prefers.
  if (id === 'mps') return 'kmh';

  const paired = PAIRS[id];
  if (paired && (category === 'temperature' || unitSystem(category, paired) === want)) return paired;
  if (category === 'temperature') return id === 'c' ? 'f' : 'c';

  const group = UNITS[category];
  if (!group) return paired || id;
  const match = Object.entries(group.units).find(([other, def]) => other !== id && def.system === want);
  return match ? match[0] : (paired || id);
}

function convertTemperature(value, from, to) {
  let c; // everything routes via Celsius
  if (from === 'c') c = value;
  else if (from === 'f') c = (value - 32) * (5 / 9);
  else if (from === 'k') c = value - 273.15;
  else return null;

  if (to === 'c') return c;
  if (to === 'f') return c * (9 / 5) + 32;
  if (to === 'k') return c + 273.15;
  return null;
}

/**
 * Convert a value between two units of the SAME category.
 * @returns {number|null} null if units are unknown/mismatched or the result is
 *   not finite. Never throws.
 */
export function convert(value, category, fromId, toId) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (category === 'temperature') {
    const r = convertTemperature(value, fromId, toId);
    return Number.isFinite(r) ? r : null;
  }
  const group = UNITS[category];
  if (!group) return null;
  const has = (id) => Object.prototype.hasOwnProperty.call(group.units, id);
  if (!has(fromId) || !has(toId)) return null;
  const result = (value * group.units[fromId].factor) / group.units[toId].factor;
  return Number.isFinite(result) ? result : null;
}

/** All unit ids in a category — used by the popup's "convert to" dropdown. */
export function unitsIn(category) {
  if (category === 'temperature') return Object.keys(TEMPERATURE);
  return UNITS[category] ? Object.keys(UNITS[category].units) : [];
}

/** Category ids, for the options page's "enabled categories" checkboxes. */
export const CATEGORIES = [...Object.keys(UNITS), 'temperature'];
