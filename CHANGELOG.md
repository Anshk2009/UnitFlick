# Changelog

Notable changes to UnitFlick. Follows [Keep a Changelog](https://keepachangelog.com/)
loosely and [semantic versioning](https://semver.org/).

## [Unreleased]

Nothing yet.

## [0.1.0] — 2026-09-06

First working version.

### Added

- Right-click **UnitFlick → Convert** on any selected text.
- Local conversions for length, mass, temperature, area, volume, speed and
  digital storage. No network involved.
- Currency conversion for 27 currencies, using the keyless
  [open.er-api.com](https://www.exchangerate-api.com/) endpoint. Rates are
  cached for 6 hours by default and the age of the rates is always shown.
- Result card next to the selection, with a copy button, Escape to dismiss and
  a 12-second auto-dismiss.
- Toolbar popup showing the most recent result.
- Settings page: target currency, preferred unit system, decimal places,
  enabled categories, and how often rates refresh.
- Test suite covering the parser, every converter, the rate service and the
  end-to-end pipeline, including malformed input and hostile API responses.
- `tools/audit.js`, a security checklist that actually runs — secrets,
  dangerous APIs, inline scripts, URL construction, permissions and CSP.

### Security

The parser and API layer were written defensively from the start; these are the
things that were found and fixed while auditing the finished code:

- Selections are truncated before any parsing, the matcher has no nested
  quantifiers, and numeric magnitude is capped, so a hostile page cannot make
  UnitFlick burn CPU or memory.
- Invisible control, bidi and zero-width characters are stripped from
  selections, so text cannot render as something other than what it is.
- Error messages no longer echo an arbitrary selection back into the UI. Only
  something that looks like a unit name is quoted.
- Exchange-rate responses are size-capped before the body is read, so a
  compromised provider cannot buffer an unbounded response into the worker.
- Concurrent conversions share one in-flight rate request instead of the second
  reporting a failure that had not happened.
- `sanitizeSettings()` no longer hands out a reference to the shared defaults
  array, which could be mutated to corrupt the defaults process-wide.
- The result card removes its keydown listener on every exit path, including
  when a new card replaces it.
- Unit lookup tables are prototype-less, so `__proto__` and `constructor` can
  never resolve to inherited properties.

### Notes

- Not on any extension store yet; load unpacked from source.
- Chromium browsers only. Firefox support is on the roadmap.
- Digital storage uses decimal SI sizes (1 KB = 1000 B).
- `$` means USD and `¥` means JPY. Highlight the ISO code to be explicit.

[Unreleased]: https://github.com/Anshk2009/UnitFlick/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Anshk2009/UnitFlick/releases/tag/v0.1.0
