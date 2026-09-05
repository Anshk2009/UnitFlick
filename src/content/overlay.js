/**
 * overlay.js — the little result card that appears on the page.
 *
 * This function is injected into the page by chrome.scripting.executeScript,
 * so it must be SELF-CONTAINED: no imports, no closure variables, nothing from
 * the service worker's scope. Everything it needs arrives in `result`.
 *
 * Safety rules this file follows, deliberately:
 *   - every string is written with textContent, never innerHTML,
 *   - styles live in a closed shadow root so the page's CSS cannot restyle us
 *     and our CSS cannot leak onto the page,
 *   - the card holds nothing sensitive, because the page can always see and
 *     remove any element in its own DOM. Isolation here is about correctness
 *     and appearance, not about hiding secrets from the page.
 *
 * @param {{ok:boolean,input?:string,output?:string,note?:string,stale?:boolean,error?:string}} result
 */
export function renderResult(result) {
  const HOST_ID = 'unitflick-result-host';

  // Replace any card left over from a previous conversion. The old card is
  // asked to clean itself up first, otherwise its keydown listener would be
  // left behind on the page once its element is gone.
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    existing.dispatchEvent(new Event('unitflick-dismiss'));
    existing.remove();
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';

  // Closed mode: page scripts cannot reach in through host.shadowRoot.
  const root = host.attachShadow({ mode: 'closed' });

  // Defined up front because both the Close button and the Escape key need it.
  // Every exit path goes through here, so the page is never left holding a
  // listener for a card that is gone.
  const onKey = (event) => { if (event.key === 'Escape') dismiss(); };
  const dismiss = () => {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey, true);
    host.remove();
  };
  // Cards should not linger. 12s is long enough to read and copy.
  const timer = setTimeout(() => dismiss(), 12000);
  document.addEventListener('keydown', onKey, true);
  host.addEventListener('unitflick-dismiss', dismiss);

  const style = document.createElement('style');
  style.textContent = `
    .card {
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1e1f22;
      color: #f2f2f2;
      border: 1px solid #3a3c40;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      padding: 10px 12px;
      min-width: 180px;
      max-width: 300px;
    }
    .from { color: #9aa0a6; font-size: 12px; }
    .to { font-size: 17px; font-weight: 600; margin: 2px 0 0; word-break: break-word; }
    .note { color: #9aa0a6; font-size: 11px; margin-top: 6px; }
    .note.stale { color: #e8b339; }
    .error { color: #ff9a8a; word-break: break-word; }
    .row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    button {
      font: inherit; font-size: 12px;
      background: #33353a; color: #f2f2f2;
      border: 1px solid #4a4d52; border-radius: 6px;
      padding: 3px 9px; cursor: pointer;
    }
    button:hover { background: #3d4046; }
  `;
  root.appendChild(style);

  const card = document.createElement('div');
  card.className = 'card';

  if (result && result.ok) {
    const from = document.createElement('div');
    from.className = 'from';
    from.textContent = String(result.input || '');

    const to = document.createElement('div');
    to.className = 'to';
    to.textContent = String(result.output || '');

    card.append(from, to);

    const row = document.createElement('div');
    row.className = 'row';

    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      const text = String(result.output || '');
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Copied';
      } catch {
        copy.textContent = 'Copy failed';
      }
    });

    const close = document.createElement('button');
    close.textContent = 'Close';
    close.addEventListener('click', dismiss);

    row.append(copy, close);
    card.appendChild(row);

    if (result.note) {
      const note = document.createElement('div');
      note.className = result.stale ? 'note stale' : 'note';
      note.textContent = String(result.note);
      card.appendChild(note);
    }
  } else {
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = String((result && result.error) || 'Conversion failed.');
    card.appendChild(error);
  }

  root.appendChild(card);
  document.body.appendChild(host);

  // Place the card just under the selection when we can work out where it is,
  // otherwise pin it to the top-right corner.
  let top = 16;
  let left = window.innerWidth - 316;
  try {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect && (rect.width || rect.height)) {
        top = Math.min(rect.bottom + 8, window.innerHeight - host.offsetHeight - 8);
        left = Math.min(rect.left, window.innerWidth - host.offsetWidth - 8);
      }
    }
  } catch {
    // Some pages throw on getSelection inside odd frames; the corner is fine.
  }
  host.style.top = `${Math.max(8, top)}px`;
  host.style.left = `${Math.max(8, left)}px`;
}
