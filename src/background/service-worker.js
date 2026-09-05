/**
 * UnitFlick service worker.
 *
 * MV3 service workers are short-lived: Chrome starts them when an event fires
 * and kills them when idle. So there is no long-lived state here — anything
 * that must survive lives in chrome.storage.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('UnitFlick installed');
});
