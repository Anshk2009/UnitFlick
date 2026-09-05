# Privacy

UnitFlick is built so that there is very little to say here. It has no
accounts, no analytics, no telemetry, no crash reporting, and no server of its
own.

## What UnitFlick processes

Only the text you highlight, and only at the moment you choose
**UnitFlick → Convert** from the right-click menu.

That text is truncated to 200 characters, parsed into a number and a unit, and
then thrown away. UnitFlick never reads the page around your selection, never
watches what you highlight without being asked, and has no content script
running in the background on any site.

## What UnitFlick stores

Three things, all stored by the browser rather than by any server of mine:

| What | Where | Why | How long |
| --- | --- | --- | --- |
| Your settings | `chrome.storage.sync` | Target currency, unit system, precision, enabled categories, refresh interval | Until you change them or uninstall |
| Exchange-rate table | `chrome.storage.local` | So a conversion does not need a network call every time | Refreshed on the interval you set (default 6 hours); a table older than 7 days is discarded rather than used |
| The most recent conversion result | `chrome.storage.session` | So the toolbar popup can show the result you just got | Overwritten by the next conversion, and cleared when you close the browser |

One honest caveat about that first row: `chrome.storage.sync` means the browser
syncs those settings to your other signed-in devices, which is the point — but
it also means they pass through your browser vendor's sync service, the same
way your bookmarks do. That is five short values with no personal information
in them (see the validation in
[`src/utils/settings.js`](src/utils/settings.js), which is why none of them can
ever be anything but a currency code, a unit system, or a small number). If you
would rather they never left the device, sign out of browser sync or turn off
extension syncing in your browser's settings.

The last one is a single result — the formatted input and output, e.g.
`20 km` → `12.43 mi`. It is not a history. There is no history.

UnitFlick does **not** store or collect: browsing history, page contents,
selected-text history, passwords, cookies, form data, IP addresses, device
identifiers, or anything that identifies you.

## What leaves your device

Unit conversions (length, mass, temperature, area, volume, speed, storage) are
pure arithmetic and happen entirely on your device. They involve no network
traffic at all.

Currency conversion needs exchange rates, which come from one request:

```
GET https://open.er-api.com/v6/latest/USD
```

That is the whole request. It is a fixed URL, hardcoded in
[`src/services/rates.js`](src/services/rates.js) — no query parameters, no
part of your selection, no amount, no currency pair, no page URL, no
identifier. The extension downloads the full USD rate table and does the
arithmetic locally, so the provider cannot tell what you converted or how much
of it.

The request is sent with `credentials: 'omit'` and
`referrerPolicy: 'no-referrer'`, so no cookies and no referring page are
attached. What the provider sees is what any web server sees from any visitor:
your IP address, the time, and a request for a public rates file. Their privacy
policy applies to that: <https://www.exchangerate-api.com/privacy>

It happens at most once per refresh interval (default: every 6 hours), and no
more than once per minute even if the provider is failing.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `contextMenus` | To add the "UnitFlick → Convert" item to the right-click menu |
| `storage` | To keep your settings and the cached rate table |
| `activeTab` | To show the result card in the tab you just used the menu in. This grants access to one tab, only after you click UnitFlick's menu item, and it expires |
| `scripting` | To inject the result card into that tab |
| `https://open.er-api.com/` | The only host UnitFlick may contact |

Note what is *not* in that list: there is no `*://*/*` host permission and no
`tabs` permission. UnitFlick cannot read pages you have not explicitly used it
on, and cannot see your open tabs or their URLs.

## Third parties

One: [ExchangeRate-API](https://www.exchangerate-api.com/) via
`open.er-api.com`, for exchange rates. There are no other network destinations,
no CDNs, no fonts loaded from the web, and no third-party JavaScript. UnitFlick
has zero runtime dependencies.

## Changes

If any of this ever changes, it will be noted in
[CHANGELOG.md](CHANGELOG.md) and in this file. Analytics, if ever added, would
be opt-in and off by default — but there is no plan to add any.

Questions: open an issue at
<https://github.com/Anshk2009/UnitFlick/issues>.
