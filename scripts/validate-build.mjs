#!/usr/bin/env node
/**
 * Static checks on dist/: manifest validity, referenced files, MV3 security rules
 * (no remote code, no eval, minimal permissions, CSP), bundle sizes.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve(process.argv[2] ?? 'dist');
const errors = [];
const warn = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => errors.push(msg);

if (!existsSync(join(dist, 'manifest.json'))) {
  console.error(`✗ ${dist}/manifest.json missing — run npm run build`);
  process.exit(1);
}
const m = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
console.log(`ThreadShelf ${m.version} — ${dist}`);

if (m.manifest_version !== 3) fail('manifest_version must be 3');
else ok('Manifest V3');
for (const k of [
  'name',
  'version',
  'description',
  'icons',
  'action',
  'background',
  'content_scripts',
])
  if (!m[k]) fail(`manifest.${k} missing`);
if (!/^\d+(\.\d+){0,3}$/.test(m.version)) fail(`invalid version ${m.version}`);

const referenced = [
  m.background?.service_worker,
  m.action?.default_popup,
  m.options_ui?.page,
  ...Object.values(m.icons ?? {}),
  ...Object.values(m.action?.default_icon ?? {}),
  ...(m.content_scripts ?? []).flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
].filter(Boolean);
for (const f of referenced) if (!existsSync(join(dist, f))) fail(`referenced file missing: ${f}`);
ok(`${referenced.length} referenced files present`);

const ALLOWED_PERMS = new Set([
  'storage',
  'unlimitedStorage',
  'contextMenus',
  'clipboardWrite',
  'alarms',
  // Required only by builds with a configured Google Chrome Extension OAuth client.
  'identity',
  // Only used to register the Reddit content script on hosts the user granted (optional permission).
  'scripting',
]);
for (const p of m.permissions ?? []) if (!ALLOWED_PERMS.has(p)) fail(`unexpected permission: ${p}`);
for (const p of [
  'tabs',
  'cookies',
  'webRequest',
  'history',
  '<all_urls>',
  'debugger',
]) {
  if ((m.permissions ?? []).includes(p) || (m.host_permissions ?? []).includes(p))
    fail(`forbidden permission: ${p}`);
}
const OPTIONAL_HOSTS = new Set([
  'https://github.com/*',
  'https://api.github.com/*',
  'https://www.googleapis.com/*',
  'https://openidconnect.googleapis.com/*',
  'https://www.reddit.com/*',
  'https://reddit.com/*',
  'https://i.redd.it/*',
  'https://preview.redd.it/*',
  'https://cf.preview.redd.it/*',
  'https://external-preview.redd.it/*',
  'https://styles.redditmedia.com/*',
  'https://www.redditstatic.com/*',
]);
if ((m.optional_host_permissions ?? []).some((h) => !OPTIONAL_HOSTS.has(h)))
  fail(`optional_host_permissions too broad: ${m.optional_host_permissions}`);
if (m.oauth2) {
  if (!m.permissions.includes('identity') || !m.oauth2.client_id ||
      [...m.oauth2.scopes].sort().join(',') !==
        ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'].sort().join(','))
    fail('invalid Google OAuth extension configuration');
} else if (m.permissions.includes('identity')) {
  fail('identity permission must not be requested without an OAuth client');
}
if ((m.host_permissions ?? []).some((h) => !/^https:\/\/pbs\.twimg\.com\/\*$/.test(h)))
  fail(`host_permissions too broad: ${m.host_permissions}`);
ok(
  `permissions: ${(m.permissions ?? []).join(', ')} · hosts: ${(m.host_permissions ?? []).join(', ')}`,
);
const matches = (m.content_scripts ?? []).flatMap((c) => c.matches);
if (matches.some((u) => !/^https:\/\/(mobile\.)?(x|twitter)\.com\/\*$/.test(u)))
  fail(`content script matches too broad: ${matches}`);
ok(`content script limited to ${matches.join(', ')}`);

const csp = m.content_security_policy?.extension_pages ?? '';
if (!/script-src 'self'/.test(csp) || /unsafe-eval|unsafe-inline|https?:/.test(csp))
  fail(`weak CSP: ${csp}`);
else ok(`CSP: ${csp}`);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}
let total = 0;
for (const file of walk(dist)) {
  const size = statSync(file).size;
  total += size;
  if (/\.(js|html)$/.test(file)) {
    const src = readFileSync(file, 'utf8');
    const rel = file.slice(dist.length + 1);
    if (/\beval\s*\(/.test(src)) fail(`eval() found in ${rel}`);
    if (/new\s+Function\s*\(/.test(src)) fail(`new Function() found in ${rel}`);
    if (/<script[^>]+src=["']https?:/i.test(src)) fail(`remote script in ${rel}`);
    if (/import\s*\(\s*["']https?:/.test(src)) fail(`remote import in ${rel}`);
    if (
      /\b(googletagmanager|google-analytics|segment\.io|sentry\.io|mixpanel|amplitude)\b/.test(src)
    )
      fail(`analytics SDK reference in ${rel}`);
  }
}
ok('no eval / new Function / remote code / analytics in bundles');
const kb = (f) => Math.round(statSync(join(dist, f)).size / 1024);
console.log(
  `  · content.js ${kb('content.js')} KB · background.js ${kb('background.js')} KB · total ${Math.round(total / 1024)} KB`,
);
if (kb('content.js') > 600) warn.push('content.js is larger than 600 KB');

for (const w of warn) console.log(`  ! ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('Build valid.');
