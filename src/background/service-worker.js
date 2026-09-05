/**
 * UnitFlick service worker.
 *
 * MV3 service workers are short-lived: Chrome starts them when an event fires
 * and kills them when idle. So there is no long-lived state here — anything
 * that must survive lives in chrome.storage.
 */

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

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const selection = readSelection(info);
  if (!selection) return;
  console.log('UnitFlick: got selection of', selection.length, 'chars');
});
