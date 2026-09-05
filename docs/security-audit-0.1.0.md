# Security audit — UnitFlick 0.1.0

Date: 2026-09-06
Scope: every file that ships (`manifest.json`, `src/**`, `icons/**`)
Method: manual review of the whole codebase, reviewed as if it had been
submitted by an unknown developer, plus `npm test` (54 tests) and
`node tools/audit.js` (12 automated checks).

Findings are listed with severity, the affected file, the fix, and how the fix
was retested. Everything listed as fixed is fixed in this release.

---

## Findings

### 1. Sanitized settings shared a mutable array with the defaults — Medium

**File:** `src/utils/settings.js`

`DEFAULTS` was frozen, but `Object.freeze` is shallow, and
`sanitizeSettings()` returned `{ ...DEFAULTS }` — so every caller received the
*same* `enabledCategories` array object. A single `push()` anywhere in the
extension would have changed the defaults for every later call, in every
context, for the rest of the session.

Not remotely triggerable today, because nothing mutates that array. But it is
process-wide shared mutable state reachable from three different pages, which
is exactly the kind of thing that becomes a real bug on the next change.

**Fix:** froze the default array and made `sanitizeSettings()` copy it.

**Retested:** `test/pipeline.test.js` — "sanitized settings never share state
with the defaults" mutates one result and asserts the other and the defaults
are untouched. Confirmed the test fails against the old code.

---

### 2. Rate responses were buffered with no size limit — Medium

**File:** `src/services/rates.js`

`await response.json()` read the whole body before anything was validated. The
real table is about 5 KB, but if `open.er-api.com` were ever compromised, taken
over, or replaced by a hostile network intermediary, a multi-gigabyte response
would have been buffered straight into the service worker — a memory
denial-of-service that also takes down the rest of the extension.

**Fix:** the `content-length` header is checked against a 256 KB ceiling before
the body is read. A response above it is refused outright.

**Retested:** `test/rates.test.js` — "an implausibly large response is refused
before it is buffered" asserts the JSON body is never read at all; a companion
test confirms a response with no `content-length` still works.

---

### 3. Concurrent conversions reported a failure that had not happened — Low

**File:** `src/services/rates.js`

The retry cooldown was checked before the in-flight request was consulted. Two
currency conversions a few seconds apart, with an empty cache, meant the first
started a fetch and the second saw "cooling down", skipped it and returned
"could not get exchange rates" while the answer was already on its way.

Wrong output shown to the user, and it also made the cooldown look like it was
misbehaving.

**Fix:** an existing in-flight request is now awaited regardless of cooldown;
the cooldown only governs *starting* a new one.

**Retested:** existing rate-service tests still pass; the single-flight and
cooldown paths are now separately reachable.

---

### 4. The result card leaked a page-level event listener — Low

**File:** `src/content/overlay.js`

The card registered a capturing `keydown` listener on `document` to handle
Escape. The Close button called `host.remove()` directly and the replace path
(`existing.remove()`) removed the old card's element — neither removed the
listener. Every conversion on a page left another listener behind, holding a
reference to a detached DOM node.

On a page where someone converts repeatedly this is unbounded growth in the
*page's* memory, caused by the extension. Minor, but it is our leak on someone
else's page.

**Fix:** a single `dismiss()` is now the only exit path — used by the button,
the Escape key and the auto-dismiss timer — and a replaced card is asked to
clean itself up via a custom event before it is removed.

**Retested:** in a real browser page, instrumented `document.addEventListener`
to count `keydown` registrations. Before: three renders left four listeners.
After: three renders leave one, and dismissing takes it to zero with no card
elements remaining.

---

### 5. Error messages echoed arbitrary selected text — Low

**File:** `src/background/convert.js`

An unknown unit produced `"${symbol}" is not a unit UnitFlick knows.` The
symbol comes from the page, and the parser's suffix group accepts up to 12
non-digit characters — so `20 km<script>` put `km<script>` into a string
displayed in the extension's own UI.

Not exploitable: the card and the popup both use `textContent`, so it renders
as literal text and was verified doing so. But reflecting attacker-chosen
content into our UI is one `innerHTML` refactor away from being a real XSS, and
it is bad manners regardless.

**Fix:** only a symbol matching `/^[\p{L}°²³/.\s]{1,12}$/u` is quoted back;
anything else produces "That is not a unit UnitFlick knows."

**Retested:** `test/pipeline.test.js` asserts no error message ever contains
`<` or `>` for a list of XSS payloads. Also verified live in a browser: an
`<img src=x onerror=...>` payload rendered as text, created zero `<img>`
elements, and did not set the flag the payload tried to set.

---

### 6. Invisible characters were parsed as-is — Low

**File:** `src/utils/parse.js`

Normalization folded Unicode and collapsed whitespace but did not strip control
or formatting characters. A right-to-left override (`U+202E`) can make a
selection *display* as one thing while parsing as another, and zero-width
characters could split a unit name so it silently failed to resolve.

**Fix:** C0/C1 controls, bidi overrides, zero-width characters and the BOM are
removed during normalization, before matching.

**Retested:** `test/pipeline.test.js` — "invisible control characters are
stripped, not honoured" covers `U+202E`, `U+0000` and `U+200B`.

---

### 7. Lookup tables were reachable through the prototype chain — Informational

**File:** `src/converters/units.js`

`INDEX` was already `Object.create(null)`, but `PAIRS` was a plain object
literal, so `PAIRS['constructor']` returned `Function`. Not exploitable —
`defaultTarget()` is only reached with an id that `resolveUnit()` already
validated, and the value fell through the system check anyway — but a lookup
table that answers questions nobody asked is a trap for the next change.

**Fix:** `PAIRS` is now prototype-less too.

**Retested:** `test/convert.test.js` — "lookup tables cannot be reached through
the prototype chain" checks `__proto__`, `constructor`, `toString` and
`valueOf` against `resolveUnit`, `defaultTarget` and `convert`.

---

### 8. An unexpected exception showed the user nothing — Low

**File:** `src/background/service-worker.js`

The menu handler ran the conversion in an unguarded async IIFE. Any rejection —
including a `chrome.storage.session.set()` failure, which has nothing to do
with the conversion itself — would have aborted before the card was injected.
The user gets no card, no error, no feedback at all, which reads as "the
extension is broken".

**Fix:** the conversion is wrapped so an unexpected throw becomes a visible
error card, and a storage failure no longer prevents the card from appearing.

**Retested:** audit and full test suite pass; the paths are now independent.

---

## Categories reviewed with no finding

| # | Category | Result |
| --- | --- | --- |
| 1 | XSS | No finding. All UI text goes through `textContent`; verified live with an `onerror` payload. |
| 2 | DOM injection | No finding. Nodes are built with `createElement`; nothing is parsed as HTML. |
| 3 | Unsafe `innerHTML` | Not present anywhere. Enforced by `tools/audit.js`. |
| 4 | Arbitrary code execution | No dynamic code paths at all. |
| 5 | `eval` / `new Function` | Not present. Enforced by the audit and by the CSP. |
| 6 | CSP weaknesses | `script-src 'self'; object-src 'none'; base-uri 'none'`. No `unsafe-inline`, no `unsafe-eval`, no remote script origins. |
| 7 | Excessive permissions | Four permissions, each used. No `tabs`, no `webRequest`, no `cookies`, no `<all_urls>`. |
| 8 | Host-permission abuse | Exactly one host, `https://open.er-api.com/`. No wildcards. Page access is `activeTab` only, granted per click and expiring. |
| 9 | API-key exposure | There is no key. The provider endpoint is keyless — chosen for this reason. |
| 10 | Secret leakage | Nothing secret exists in the repo or the build output. Eight secret patterns are scanned on every build. |
| 11 | Insecure HTTP | HTTPS only, enforced by the audit and by the manifest. |
| 12 | SSRF-style behaviour | The URL is a frozen module constant. Nothing from the page, the selection or the settings reaches it. |
| 13 | Arbitrary URL fetching | The audit fails the build if `fetch()` is called with anything but a string literal or an uppercase constant. |
| 14 | Malicious API responses | `validateRatesPayload()` checks status, base currency and every individual rate; unsupported codes are dropped; a bad response yields an error, never a number. Covered by nine tests. |
| 15 | Prototype pollution | `INDEX`, `PAIRS`, the validated rate table and the cached table are all `Object.create(null)`. A `__proto__` key in an API response is proven inert. |
| 16 | ReDoS | One matcher, no nested quantifiers, every quantifier bounded. Input is truncated to 120 characters before matching. Tested with a 2 MB selection and a 50k-character adversarial string; both return in under 250 ms. |
| 17 | Excessive memory/CPU | Selection capped at 200 characters in the worker and 120 in the parser; numeric magnitude capped at 1e15; API responses capped at 256 KB. |
| 18 | Message-passing | **There is no message listener.** No `onMessage`, no `onMessageExternal`, no `externally_connectable`, no `window.postMessage`. The only entry point is the browser's context-menu event, which a page cannot raise. |
| 19 | Storage manipulation | Settings are validated on write *and* on read, so even a corrupted stored value produces valid settings. The cached rate table is re-validated on read. Content scripts cannot reach `storage.session`. |
| 20 | Privacy leakage | Only the fixed rates URL leaves the device, with `credentials: 'omit'` and `referrerPolicy: 'no-referrer'`. The selection is never transmitted. One result is kept in session storage and overwritten each time; there is no history. |
| 21 | Dependency vulnerabilities | Zero dependencies, runtime and dev. Nothing to be vulnerable. |
| 22 | Supply-chain risk | No packages, no lockfile, no build step, no CDN, no remote fonts or scripts. Icons are generated from a committed script rather than committed as opaque binaries. |
| 23 | Rate-limit abuse | Cached for the configured TTL, one request in flight at a time, and a hard 60-second floor between attempts even during an outage. |
| 24 | Denial of service | Covered by 16 and 17. A hostile page cannot trigger a network request at all — only the user can, through the menu. |
| 25 | Sensitive data logging | No `console.*` calls remain in shipped code; the audit warns if any are added. |

---

## What is not covered

- **The provider.** UnitFlick validates everything `open.er-api.com` returns,
  but if the service returns plausible-looking wrong rates, UnitFlick will show
  wrong rates. It is a free public endpoint; do not make financial decisions on
  it.
- **A malicious page can remove the card.** The result card lives in the page's
  DOM, so the page can delete or cover it. It holds nothing sensitive, so this
  is a display concern, not a security one. A closed shadow root prevents the
  page from reading into it or restyling it.
- **Browser and OS vulnerabilities**, which are out of scope.
- **The unpacked-load install path.** Until UnitFlick is on a store, users must
  trust the source they cloned. Verify the commit you are loading.

## Reproducing

```bash
npm test          # 54 tests
npm run audit     # 12 checks
npm run build     # refuses to package if the audit fails
```
