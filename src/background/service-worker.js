/**
 * UnitFlick service worker.
 *
 * MV3 service workers are short-lived: Chrome starts them when an event fires
 * and kills them when idle. So there is no long-lived state here — anything
 * that must survive lives in chrome.storage.
 */

const MENU_ID = 'unitflick-convert';

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

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  console.log('UnitFlick: selection received');
});
