/**
 * audit.js — the pre-release security checklist, as something you can run.
 *
 *   node tools/audit.js
 *
 * A checklist in a markdown file gets skipped. This one fails loudly, so it
 * can go in CI and in the release steps. It scans what actually ships.
 *
 * Standard library only: no dependencies to audit in the auditor.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Everything the browser actually loads. Tests and tooling are excluded on
// purpose: they are not part of the extension.
const SHIPPED_DIRS = ['src', 'icons'];
const SHIPPED_FILES = ['manifest.json'];

const TEXT_EXTENSIONS = new Set(['.js', '.json', '.html', '.css']);

const failures = [];
const warnings = [];
const passed = [];

const fail = (check, detail) => failures.push(`${check}: ${detail}`);
const warn = (check, detail) => warnings.push(`${check}: ${detail}`);
const pass = (check) => passed.push(check);

/** Every shipped file, recursively. */
function shippedFiles() {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(full);
    }
  };
  for (const dir of SHIPPED_DIRS) walk(join(ROOT, dir));
  for (const file of SHIPPED_FILES) found.push(join(ROOT, file));
  return found;
}

const files = shippedFiles();
const textFiles = files.filter((f) => TEXT_EXTENSIONS.has(extname(f)));
const sources = textFiles.map((f) => ({
  path: relative(ROOT, f).replace(/\\/g, '/'),
  text: readFileSync(f, 'utf8'),
}));

// Comments talk about these APIs by name, so scan code with comments removed.
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');

const code = sources.map((s) => ({ ...s, text: stripComments(s.text) }));

// ---------------------------------------------------------------- secrets

// Deliberately broad. A false positive costs a minute; a leaked key costs more.
const SECRET_PATTERNS = [
  [/\bapi[_-]?key\s*[:=]\s*['"][^'"]{8,}/i, 'a literal api key'],
  [/\b(secret|password|passwd|token)\s*[:=]\s*['"][^'"]{8,}/i, 'a literal secret'],
  [/\bBearer\s+[A-Za-z0-9._-]{16,}/, 'a bearer token'],
  [/\bsk-[A-Za-z0-9]{16,}/, 'an OpenAI-style key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bghp_[A-Za-z0-9]{20,}/, 'a GitHub token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./, 'a JWT'],
];

for (const { path, text } of code) {
  for (const [pattern, what] of SECRET_PATTERNS) {
    if (pattern.test(text)) fail('no secrets in shipped code', `${path} looks like it contains ${what}`);
  }
}
if (!failures.length) pass('no secrets in shipped code');

// ------------------------------------------------------- dangerous APIs

const DANGEROUS = [
  [/\beval\s*\(/, 'eval()'],
  [/new\s+Function\s*\(/, 'new Function()'],
  [/\.innerHTML\s*=/, 'innerHTML assignment'],
  [/\.outerHTML\s*=/, 'outerHTML assignment'],
  [/insertAdjacentHTML\s*\(/, 'insertAdjacentHTML()'],
  [/document\.write\s*\(/, 'document.write()'],
  [/setTimeout\s*\(\s*['"`]/, 'setTimeout with a string body'],
  [/setInterval\s*\(\s*['"`]/, 'setInterval with a string body'],
  [/\bimportScripts\s*\(/, 'importScripts()'],
  [/javascript:/i, 'a javascript: URL'],
];

let dangerousFound = false;
for (const { path, text } of code) {
  for (const [pattern, what] of DANGEROUS) {
    if (pattern.test(text)) {
      fail('no dynamic code execution or HTML injection', `${path} uses ${what}`);
      dangerousFound = true;
    }
  }
}
if (!dangerousFound) pass('no dynamic code execution or HTML injection');

// --------------------------------------------------------- inline script

for (const { path, text } of sources) {
  if (!path.endsWith('.html')) continue;
  // <script> tags must have a src; an inline body would be blocked by the CSP
  // anyway, but it should not be there in the first place.
  for (const tag of text.match(/<script\b[^>]*>/gi) || []) {
    if (!/\bsrc\s*=/.test(tag)) fail('no inline scripts', `${path} has an inline <script>`);
  }
  if (/\son[a-z]+\s*=/i.test(text)) fail('no inline event handlers', `${path} has an inline on* attribute`);
}
pass('no inline scripts or event handlers');

// ------------------------------------------------------------------ URLs

const ALLOWED_HOSTS = new Set(['open.er-api.com']);
const urlPattern = /\bhttps?:\/\/[^\s'"`)<>]+/gi;

for (const { path, text } of code) {
  for (const url of text.match(urlPattern) || []) {
    if (url.startsWith('http://')) {
      fail('https only', `${path} contains an http:// URL: ${url}`);
      continue;
    }
    let host;
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    // Links to our own repo/docs are fine; network calls are not.
    if (!ALLOWED_HOSTS.has(host) && !/github\.com|exchangerate-api\.com/.test(host)) {
      warn('known hosts only', `${path} references ${host}`);
    }
  }
}
pass('https only, known hosts only');

// --------------------------------------------------- URL construction

// A fetch() whose argument is not a plain string literal is how SSRF starts.
for (const { path, text } of code) {
  for (const call of text.match(/fetch(?:Impl)?\s*\(([^,)]{0,120})/g) || []) {
    const arg = call.replace(/^fetch(?:Impl)?\s*\(/, '').trim();
    const literal = /^['"]https:\/\//.test(arg);
    const constant = /^[A-Z][A-Z0-9_]*$/.test(arg);   // e.g. RATES_URL
    if (!literal && !constant) {
      fail('no dynamic request URLs', `${path} calls fetch with a computed argument: ${arg.slice(0, 60)}`);
    }
  }
}
pass('no dynamic request URLs');

// -------------------------------------------------------------- manifest

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

if (manifest.manifest_version !== 3) fail('manifest v3', `got version ${manifest.manifest_version}`);
else pass('manifest v3');

const ALLOWED_PERMISSIONS = new Set(['contextMenus', 'storage', 'activeTab', 'scripting']);
for (const permission of manifest.permissions || []) {
  if (!ALLOWED_PERMISSIONS.has(permission)) {
    fail('minimal permissions', `unexpected permission "${permission}"`);
  }
}
for (const risky of ['tabs', 'webRequest', 'cookies', 'history', 'downloads', 'management', 'debugger', '<all_urls>']) {
  if ((manifest.permissions || []).includes(risky)) fail('minimal permissions', `${risky} must not be requested`);
}
pass('minimal permissions');

for (const host of manifest.host_permissions || []) {
  if (!host.startsWith('https://')) fail('host permissions are https', host);
  if (/\*:\/\/|\/\/\*\./.test(host)) fail('no wildcard host permissions', host);
  const hostname = host.replace(/^https:\/\//, '').replace(/\/.*$/, '');
  if (!ALLOWED_HOSTS.has(hostname)) fail('host permissions match the provider', host);
}
pass('host permissions are https and specific');

if (manifest.content_scripts) {
  fail('no always-on content scripts', 'manifest declares content_scripts');
} else {
  pass('no always-on content scripts');
}

const csp = (manifest.content_security_policy || {}).extension_pages || '';
if (!/script-src\s+'self'/.test(csp)) fail('strict CSP', 'script-src must be \'self\'');
if (/unsafe-inline|unsafe-eval|wasm-unsafe-eval/.test(csp)) fail('strict CSP', 'CSP allows unsafe code');
if (!/object-src\s+'none'/.test(csp)) fail('strict CSP', "object-src must be 'none'");
if (!failures.some((f) => f.startsWith('strict CSP'))) pass('strict CSP');

// ------------------------------------------------- manifest references

// A manifest pointing at a file that is not there is a broken extension that
// still passes every other check, so confirm each referenced path exists.
const referenced = [
  manifest.background && manifest.background.service_worker,
  manifest.action && manifest.action.default_popup,
  manifest.options_page,
  ...Object.values(manifest.icons || {}),
];

let missing = false;
for (const path of referenced.filter(Boolean)) {
  try {
    statSync(join(ROOT, path));
  } catch {
    fail('manifest references exist', `${path} is referenced but missing`);
    missing = true;
  }
}

// The reverse direction: every script an HTML page loads must exist too.
for (const { path, text } of sources) {
  if (!path.endsWith('.html')) continue;
  const dir = path.split('/').slice(0, -1).join('/');
  for (const match of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const ref = match[1];
    if (/^(https?:|data:|#)/.test(ref)) continue;
    try {
      statSync(join(ROOT, dir, ref));
    } catch {
      fail('page references exist', `${path} loads ${ref}, which is missing`);
      missing = true;
    }
  }
}
if (!missing) pass('every referenced file exists');

// ---------------------------------------------------------- dependencies

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
if (Object.keys(deps).length > 0) {
  warn('no dependencies', `${Object.keys(deps).length} declared: review each one`);
} else {
  pass('no dependencies');
}

// -------------------------------------------------------------- logging

// console.log in shipped code is how selections end up in a user's devtools.
for (const { path, text } of code) {
  if (/console\.(log|debug|info|warn|error)\s*\(/.test(text)) {
    warn('no logging of user data', `${path} calls console.*; check it cannot log a selection`);
  }
}

// ---------------------------------------------------------------- report

const line = '-'.repeat(60);
console.log('UnitFlick security audit');
console.log(line);
for (const check of passed) console.log(`  PASS  ${check}`);
for (const detail of warnings) console.log(`  WARN  ${detail}`);
for (const detail of failures) console.log(`  FAIL  ${detail}`);
console.log(line);
console.log(`${passed.length} passed, ${warnings.length} warnings, ${failures.length} failures`);
console.log(`scanned ${files.length} shipped files`);

process.exit(failures.length > 0 ? 1 : 0);
