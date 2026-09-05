/**
 * options.js — the settings page.
 *
 * Every control is built from a hardcoded list (supported currencies, known
 * categories), so the page can only ever offer valid values. Whatever is
 * chosen still goes through sanitizeSettings() before it is stored, so a
 * tampered form or a stale stored value cannot produce invalid settings.
 */

import { loadSettings, saveSettings, DEFAULTS } from '../utils/settings.js';
import { CURRENCIES } from '../converters/currency.js';
import { CATEGORIES } from '../converters/units.js';

const $ = (id) => document.getElementById(id);

const CATEGORY_LABELS = {
  length: 'Length',
  mass: 'Mass',
  temperature: 'Temperature',
  area: 'Area',
  volume: 'Volume',
  speed: 'Speed',
  digital: 'Digital storage',
  currency: 'Currency',
};

function buildCurrencyOptions() {
  const select = $('targetCurrency');
  for (const code of CURRENCIES) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code; // textContent, not innerHTML
    select.appendChild(option);
  }
}

function buildCategoryCheckboxes() {
  const container = $('categories');
  for (const category of [...CATEGORIES, 'currency']) {
    const label = document.createElement('label');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = category;
    input.dataset.category = category;

    const text = document.createElement('span');
    text.textContent = CATEGORY_LABELS[category] || category;

    label.append(input, text);
    container.appendChild(label);
  }
}

function fillForm(settings) {
  $('targetCurrency').value = settings.targetCurrency;
  $('unitSystem').value = settings.unitSystem;
  $('precision').value = String(settings.precision);
  $('rateRefreshHours').value = String(settings.rateRefreshHours);

  const enabled = new Set(settings.enabledCategories);
  for (const box of document.querySelectorAll('#categories input')) {
    box.checked = enabled.has(box.dataset.category);
  }
}

function readForm() {
  const enabled = [...document.querySelectorAll('#categories input')]
    .filter((box) => box.checked)
    .map((box) => box.dataset.category);

  // parseInt on an empty or garbage field gives NaN, which sanitizeSettings
  // turns back into the default.
  return {
    targetCurrency: $('targetCurrency').value,
    unitSystem: $('unitSystem').value,
    precision: parseInt($('precision').value, 10),
    rateRefreshHours: parseInt($('rateRefreshHours').value, 10),
    enabledCategories: enabled,
  };
}

async function init() {
  buildCurrencyOptions();
  buildCategoryCheckboxes();
  fillForm(await loadSettings());

  $('save').addEventListener('click', async () => {
    try {
      const stored = await saveSettings(readForm());
      // Re-render from what was actually saved, so the user sees any value
      // that got corrected rather than what they typed.
      fillForm(stored);
      $('status').textContent = 'Saved';
    } catch {
      $('status').textContent = 'Could not save settings';
    }
    setTimeout(() => { $('status').textContent = ''; }, 2000);
  });
}

init().catch(() => fillForm(DEFAULTS));
