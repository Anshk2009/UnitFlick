/**
 * popup.js — the toolbar popup. It only ever *reads* the last result that the
 * service worker stored; it never converts anything itself.
 *
 * Everything is written with textContent. There is no innerHTML in this file
 * and no template string ever becomes markup.
 */

const $ = (id) => document.getElementById(id);

/** Shape-check whatever came out of storage before it reaches the DOM. */
function readLastResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = (v) => (typeof v === 'string' ? v.slice(0, 200) : '');
  return {
    ok: value.ok === true,
    input: text(value.input),
    output: text(value.output),
    note: text(value.note),
    stale: value.stale === true,
    error: text(value.error),
  };
}

function render(result) {
  if (!result) return; // leave the "how to use" hint visible

  $('empty').hidden = true;

  if (!result.ok) {
    const error = $('error');
    error.textContent = result.error || 'Conversion failed.';
    error.hidden = false;
    return;
  }

  $('from').textContent = result.input;
  $('to').textContent = result.output;

  const note = $('note');
  note.textContent = result.note;
  note.className = result.stale ? 'note stale' : 'note';

  $('conversion').hidden = false;

  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(result.output);
      $('copy').textContent = 'Copied';
    } catch {
      $('copy').textContent = 'Copy failed';
    }
  });
}

$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());

chrome.storage.session
  .get('lastResult')
  .then((stored) => render(readLastResult(stored && stored.lastResult)))
  .catch(() => { /* nothing stored yet; the hint stays */ });
