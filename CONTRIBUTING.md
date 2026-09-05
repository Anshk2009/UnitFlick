# Contributing

Thanks for looking. UnitFlick is small on purpose, so the bar for changes is
mostly "does this keep it small and safe?".

## Getting set up

```bash
git clone https://github.com/Anshk2009/UnitFlick.git
cd UnitFlick
npm run check      # tests + security audit; installs nothing
```

Then load it in the browser: `chrome://extensions` → Developer mode → **Load
unpacked** → pick the repo folder. After editing, hit the reload button on the
extension card. Changes to the service worker need that reload; changes to the
popup and options pages just need the page reopened.

Node 18+ is needed for the built-in test runner. Nothing else.

## Things that will get a PR rejected

Not to be discouraging — these are the constraints the project exists under:

- **A new dependency**, unless it does something genuinely hard that we should
  not write ourselves. "It saves ten lines" is not enough. There are currently
  zero dependencies and that is a feature.
- **`innerHTML`, `eval`, `new Function`, inline scripts, or remote scripts.**
  Build DOM nodes and set `textContent`. `npm run audit` will catch these.
- **New permissions**, especially host permissions or `tabs`. If a feature
  needs one, open an issue first so we can talk about whether it is worth it.
- **Analytics or telemetry** of any kind.
- **A regex with nested quantifiers** in the parsing path. Selections come from
  hostile pages; the matcher has to stay linear.
- **Trusting an API response** without validating every field you use.

## Adding a unit

One line in the right table in `src/converters/units.js`:

```js
nmi: { factor: 1852, label: 'nmi', system: 'metric', aliases: ['nautical mile', 'nautical miles'] },
```

`factor` is how many base units it is worth (metre, gram, square metre, litre,
metre per second, byte). Add an entry to `PAIRS` if there is an obvious unit it
should convert into, then a test in `test/convert.test.js` with a value you have
checked against an independent source.

## Adding a currency

Add the ISO 4217 code to `CURRENCIES` in `src/converters/currency.js`, and a
symbol in `SYMBOLS` if it has a distinctive one. The provider already returns
the rate, so nothing else is needed. If the symbol clashes with one already
mapped, leave it out rather than changing what an existing symbol means —
ambiguity is worse than a missing shortcut.

## Style

- Plain ES modules, no framework, no build step.
- Comment the *why*, not the *what*. If a line is defensive, say what it is
  defending against.
- Keep the layers apart: `converters/` and `utils/` must not touch `chrome.*`
  or the DOM, which is what makes them testable.
- Functions that handle untrusted input return `null` rather than throwing.

## Tests

Every behaviour change needs a test. For anything touching parsing, conversion
or the API, add the failure cases too — malformed input matters more than the
happy path here.

```bash
npm test
npm run audit
```

Both must pass before a PR is merged.

## Commits and pull requests

Short lowercase messages describing what changed: `add nautical miles`,
`fix stale rate label`. One concern per commit. Rebase rather than merge if you
need to update a branch.

In the PR description, say what you changed and how you tested it. Screenshots
help for anything visual.

## Reporting bugs

Include the browser and version, the exact text you highlighted (in backticks
so nothing is lost), what you expected, and what happened. If the console shows
an error, paste it.

Security issues go through [SECURITY.md](SECURITY.md) instead — please do not
open a public issue for those.
