# Security

## Reporting a vulnerability

Please report security issues privately, not as a public GitHub issue.

- Preferred: [open a private security advisory](https://github.com/Anshk2009/UnitFlick/security/advisories/new)
- Or email: anshkash2009@gmail.com with `UnitFlick security` in the subject

Helpful things to include: what the issue is, which file or component it
affects, the steps or the page that triggers it, and what an attacker could do
with it.

This is a small hobby project maintained by one person, so please be realistic
about timelines. What you can expect:

- an acknowledgement within about a week
- a fix or an explanation of why it is not a vulnerability within 30 days for
  anything serious
- credit in the changelog if you would like it

Please give me a chance to ship a fix before disclosing publicly. There is no
bug bounty.

## Threat model

UnitFlick runs on arbitrary websites, so **every webpage is assumed to be
hostile**. The design goal is that a malicious page cannot:

- run code in the extension's context
- read or change your settings
- read the cached rate table or the last result
- inject HTML into UnitFlick's UI
- forge a message that makes UnitFlick do something
- redirect the extension to a different API
- extract credentials (there are none — see below)
- use the extension as a proxy for requests of its choosing
- cause unbounded network requests or CPU use

The highlighted text itself is treated as untrusted input at all times. So is
every byte returned by the exchange-rate API.

## How that is enforced

**No attack surface for pages to reach.** UnitFlick has no persistent content
script and **no `chrome.runtime.onMessage` listener at all**. The only entry
point is the browser's own context-menu event. A page cannot raise one, so
there is no message channel to forge on.

**No secrets.** The rate provider (`open.er-api.com`) is keyless. There is no
API key, token or credential anywhere in the extension, so none can leak. This
was a deliberate choice over providers that would have required a key —
anything shipped in an extension is public.

**One fixed URL.** The rates URL is a hardcoded constant. Nothing from the
page, the selection or the settings is ever concatenated into a URL, and
`host_permissions` lists exactly one host, so even a bug could not send a
request somewhere else.

**Responses are validated before use.** `validateRatesPayload()` checks the
result status, the base currency, and every individual rate, and copies only
supported currency codes onto a `null`-prototype object. A malformed, hostile
or empty response yields no rates and a visible error — never a made-up number.

**Output is never markup.** Both the on-page card and the popup build DOM nodes
and set `textContent`. There is no `innerHTML`, no `eval`, no `new Function`,
no `document.write`, and no inline script anywhere in the codebase. The CSP
allows scripts only from the extension itself.

**Bounded parsing.** Selections are cut to 200 characters before any work
happens, the matcher is a single regex with no nested quantifiers (so no
catastrophic backtracking), and numeric magnitude is capped. Invisible control
and bidi characters are stripped.

**Least privilege.** `activeTab` + `scripting` instead of a host permission on
every site: UnitFlick can only touch the tab where you just used its menu item.

**No dependencies.** Zero runtime and zero build dependencies, so there is no
third-party code to be compromised. Tests use Node's built-in test runner.

## Verifying it yourself

```bash
npm test                 # includes the security-focused tests
node tools/audit.js      # the pre-release security checklist
```

The audit script checks the built extension for secrets, dangerous APIs, HTTP
URLs, unexpected permissions and CSP weaknesses. Both should pass before any
release.

## Past audits

The full review of 0.1.0, including the eight findings that were fixed before
release, is in
[docs/security-audit-0.1.0.md](docs/security-audit-0.1.0.md).

## Scope

In scope: anything in this repository.

Out of scope: vulnerabilities in the browser itself, in the exchange-rate
provider's service, and social-engineering attacks on the maintainer.
