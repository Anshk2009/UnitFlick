# UnitFlick

Highlight a value on any webpage, right-click, and convert it.

`20 km` → `12.43 mi` · `72°F` → `22.22 °C` · `₹5,000` → `$60.24`

UnitFlick is a Manifest V3 browser extension with no accounts, no analytics and
no dependencies. Unit conversions happen entirely on your device; only currency
conversion touches the network, and only to fetch a public exchange-rate table.

## Features

- Right-click → **UnitFlick → Convert** on any selected text
- Length, mass, temperature, area, volume, speed and digital storage, all local
- Currency conversion for 27 currencies, with the rate timestamp always shown
- Result card appears next to your selection, with a copy button
- Settings for target currency, unit system, precision and which categories are on
- Stale or unavailable rates are labelled as such — never silently guessed

## Supported units

| Category | Units |
| --- | --- |
| Length | mm, cm, m, km, in, ft, yd, mi |
| Mass | mg, g, kg, oz, lb |
| Temperature | °C, °F, K |
| Area | m², km², ft², acres |
| Volume | mL, L, tsp, tbsp, cup, gal |
| Speed | km/h, m/s, mph |
| Digital storage | B, KB, MB, GB, TB |

Common spellings and plurals work too: `kilometres`, `lbs`, `square feet`,
`fahrenheit`, `kph`.

Two notes on conventions:

- Storage uses decimal SI sizes, so 1 KB = 1000 B. That is what network speeds
  and drive manufacturers use; your file manager may disagree.
- US customary volumes (cup, tsp, tbsp, gal), not imperial ones.

UnitFlick picks the target for you: it converts into the measurement system you
are *not* already looking at, biased toward your preferred system in settings.
`20 km` gives miles; `20 mi` gives kilometres.

## Supported currencies

USD, EUR, GBP, INR, JPY, CAD, AUD, CHF, CNY, SGD, NZD, SEK, NOK, DKK, PLN, ZAR,
BRL, MXN, AED, KRW, HKD, TRY, RUB, THB, IDR, PHP, VND.

Both symbols (`$250`, `₹5,000`, `€90`) and codes (`100 USD`) are recognised.
Ambiguous symbols default to the largest user: `$` is USD and `¥` is JPY. To
convert Canadian dollars or yuan, highlight the code instead — `250 CAD`.

## Installing

Not on the extension stores yet. To run it from source:

1. `git clone https://github.com/Anshk2009/UnitFlick.git`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Turn on **Developer mode**
4. **Load unpacked** → select the cloned folder

Chrome, Edge and other Chromium browsers. Firefox is not supported yet — see
the roadmap.

## Development

There is no build step. The source in `src/` is what runs.

```bash
npm test          # unit, integration and security tests (Node's test runner)
npm run audit     # the pre-release security checklist
npm run check     # both
```

Node 18+ for the test runner. No packages to install — `package.json` has no
dependencies, and none should be added without a good reason.

Icons are generated, not hand-committed binaries: `python tools/make-icons.py`.

## Architecture

```
manifest.json              permissions, CSP, entry points
src/
  background/
    service-worker.js      context menu, the only entry point into the extension
    convert.js             decides what a selection becomes
  content/
    overlay.js             the on-page result card (injected on demand)
  converters/
    units.js               unit tables and the conversion maths
    currency.js            currency codes, symbols, and the rate arithmetic
  services/
    rates.js               the only file that touches the network
  utils/
    parse.js               untrusted text -> {value, symbol}
    settings.js            preferences, validated in both directions
    format.js              number and timestamp formatting
  popup/                   toolbar popup: shows the last result
  options/                 settings page
tools/
  audit.js                 security checklist you can run
  make-icons.py            icon generator
```

The layers do not reach across each other. `converters/` and `utils/` are pure
functions with no browser APIs, which is why they are easy to test. Only
`rates.js` makes network calls. Only `overlay.js` and the two HTML pages touch
the DOM.

Adding a unit is one line in a table in `units.js`. Adding a currency is one
entry in the list in `currency.js`.

## Permissions

| Permission | Why |
| --- | --- |
| `contextMenus` | The right-click menu item |
| `storage` | Settings and the cached rate table |
| `activeTab` | Show the result card in the tab you just used the menu in |
| `scripting` | Inject that card |
| `https://open.er-api.com/` | The only host UnitFlick may contact |

There is no `*://*/*` host permission and no `tabs` permission. UnitFlick
cannot read pages you have not explicitly used it on.

## Exchange rates

Rates come from [ExchangeRate-API](https://www.exchangerate-api.com/)'s free
keyless endpoint, `open.er-api.com`. Keyless was a requirement, not a
convenience: any key shipped inside an extension is public, so a provider
needing one would have meant running a proxy server.

One fixed request, `GET https://open.er-api.com/v6/latest/USD`, with no query
parameters and nothing from your selection in it. The full USD table is
downloaded and the arithmetic happens locally, so the provider cannot tell what
you converted. Cached for 6 hours by default; shown but labelled stale past
that; discarded after 7 days. A failed lookup is an error, never a guess.

## Privacy

No accounts, no analytics, no telemetry, no history. The full detail —
including exactly what is stored and for how long — is in
[PRIVACY.md](PRIVACY.md).

## Security

Every webpage is treated as hostile, and so is every API response. There is no
message listener for a page to forge on, no `innerHTML` anywhere, no `eval`, no
secrets to leak, and one hardcoded URL. The threat model and reporting process
are in [SECURITY.md](SECURITY.md).

## Testing

```bash
npm run check
```

Covers the parser (malformed input, Unicode, oversized selections, ReDoS
attempts), the converters (every category, round trips, boundary values), the
rate service (malformed and hostile API responses, HTTP errors, rate limits),
and the end-to-end pipeline (XSS payloads, settings tampering).

## Roadmap

- Firefox support (MV3 differences around the service worker and `browser.*`)
- A keyboard shortcut, so the mouse is optional
- Choosing the target unit from the result card, not just settings
- Better handling of ambiguous symbols (`$`, `¥`, `kr`)
- Compound units like `5 ft 9 in`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Small, focused pull requests welcome.

## License

MIT — see [LICENSE](LICENSE).
