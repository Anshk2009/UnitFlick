/**
 * UnitFlick service worker.
 *
 * MV3 service workers are short-lived: Chrome starts them when an event fires
 * and kills them when idle. So there is no long-lived state here — anything
 * that must survive lives in chrome.storage.
 *
 * Note there is no message listener and no always-on content script. The only
 * way into this extension is the context-menu event, which the browser itself
 * raises. A hostile page therefore has no channel to forge a request on.
 */

import { runConversion } from './convert.js';
import { getRates } from '../services/rates.js';
import { loadSettings } from '../utils/settings.js';
import { renderResult } from '../content/overlay.js';

const MENU_ID = 'unitflick-convert';

// Nothing sensible to convert is longer than this. Cutting early means we never
// hand a multi-megabyte selection to the parser.
const MAX_SELECTION = 200;

// The menu only exists on text selections, which is also why we never need a
// content script running on every page.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'UnitFlick → Convert',
      contexts: ['selection'],
    });
  });
});

/**
 * Pull the highlighted text out of the context-menu event.
 * Treated as fully untrusted: it is whatever text happened to be on the page.
 * @returns {string} a bounded string, possibly empty
 */
function readSelection(info) {
  const raw = info && info.selectionText;
  if (typeof raw !== 'string') return '';
  return raw.slice(0, MAX_SELECTION);
}

/**
 * Show a result on the page. `activeTab` gives us permission to inject into
 * exactly this tab, only because the user just clicked our menu item there —
 * which is why UnitFlick asks for no host permissions on webpages at all.
 */
async function showOnPage(tabId, result) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: renderResult,
      args: [result],
    });
  } catch {
    // Injection is blocked on chrome:// pages, the Web Store, PDFs and so on.
    // Nothing we can do there; the popup still shows the last result.
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!tab || typeof tab.id !== 'number') return;

  const selection = readSelection(info);
  if (!selection) return;

  // Kept as a promise chain rather than an async listener so the worker is not
  // torn down mid-conversion.
  (async () => {
    const settings = await loadSettings();
    const result = await runConversion(selection, settings, getRates);
    // Remember only the latest result so the toolbar popup can show it too.
    // It is overwritten every time — UnitFlick keeps no conversion history.
    await chrome.storage.session.set({ lastResult: result });
    await showOnPage(tab.id, result);
  })();
});
