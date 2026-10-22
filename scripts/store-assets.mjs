#!/usr/bin/env node
/**
 * Generates Chrome Web Store images from the real built extension (dist/):
 *   artifacts/store/screenshot-1..5.png (1280×800), promo-small.png (440×280), icon-128.png
 * Uses fictitious fixture content (no real X posts). Run after `npm run build`.
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const DIST = resolve('dist');
const OUT = resolve('artifacts/store');
mkdirSync(OUT, { recursive: true });

const { statusPage, threadPosts } = await import('../tests/fixtures/x-dom.ts').catch(async () => {
  console.error('Run with: npx tsx scripts/store-assets.mjs (needs TypeScript fixtures)');
  process.exit(1);
});

const dir = mkdtempSync(join(tmpdir(), 'threadshelf-store-'));
const context = await chromium.launchPersistentContext(dir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  locale: 'fr-FR',
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const png = (await import('node:fs')).readFileSync(resolve('public/icons/icon-128.png'));
const texts = [
  'Comment nous avons divisé par 5 le temps de build de notre monorepo — un thread 🧵\n\nTout a commencé par une mesure honnête. #performance',
  'D’abord, mesurer. Sans profil, on optimise au hasard. Nous avons activé les traces et regardé où partait le temps.',
  'Résultat : 62 % du temps passait dans la transformation TypeScript. La correction a été simple.',
  'Ensuite, le cache. Un cache distant partagé entre la CI et les postes a supprimé 80 % des reconstructions.',
  'Bilan : 11 min → 2 min 10 en CI. Merci d’avoir lu !',
];
const t = threadPosts(texts.length, { handle: 'ada_dev', text: (i) => texts[i] }).map((p) => ({
  ...p,
  name: 'Ada Lovelace',
  verified: true,
}));
t[2] = { ...t[2], photos: [{ alt: 'Graphique du temps de build', w: 1600, h: 900 }] };
const pages = new Map([[`/ada_dev/status/${t[0].id}`, statusPage('xds', t, t[0].id)]]);
await context.route(/^https:\/\/x\.com\//, (r) =>
  r.fulfill({
    contentType: 'text/html',
    body: pages.get(new URL(r.request().url()).pathname) ?? '',
  }),
);
await context.route(/^https:\/\/pbs\.twimg\.com\//, (r) =>
  r.fulfill({ contentType: 'image/png', body: png }),
);
let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent('serviceworker');
const ext = (p) => `chrome-extension://${new URL(worker.url()).host}/${p}`;
await new Promise((r) => setTimeout(r, 400));
for (const p of context.pages()) if (p.url().includes('#welcome')) await p.close();

const x = await context.newPage();
await x.goto(`https://x.com/ada_dev/status/${t[0].id}`);
await x.locator('threadshelf-bar').waitFor();
await x.locator(`threadshelf-action[data-ts-id="${t[1].id}"] button`).click();
await x.waitForTimeout(400);
await x.screenshot({ path: join(OUT, 'screenshot-1.png') });
await x.keyboard.press('Escape');
await x
  .locator('threadshelf-bar')
  .getByRole('button', { name: /Enregistrer le thread/ })
  .click();
await x.waitForTimeout(1500);

const lib = await context.newPage();
await lib.goto(ext('library/index.html'));
await lib.locator('[data-testid="entry-card"]').first().waitFor();
await lib.waitForTimeout(500);
await lib.screenshot({ path: join(OUT, 'screenshot-2.png') });

const id = await lib.locator('[data-testid="entry-card"]').first().getAttribute('data-entry-id');
const reader = await context.newPage();
await reader.goto(ext(`reader/index.html?id=${id}`));
await reader.locator('[data-testid="reader-post"]').first().waitFor();
await reader.waitForTimeout(500);
await reader.screenshot({ path: join(OUT, 'screenshot-3.png') });
await reader.emulateMedia({ colorScheme: 'dark' });
await reader.keyboard.press('t');
await reader.waitForTimeout(300);
await reader.screenshot({ path: join(OUT, 'screenshot-4.png') });

const opts = await context.newPage();
await opts.goto(ext('options/index.html'));
await opts.locator('[data-testid="sync-settings"]').scrollIntoViewIfNeeded();
await opts.waitForTimeout(300);
await opts.screenshot({ path: join(OUT, 'screenshot-5.png') });

const promo = await context.newPage();
await promo.setViewportSize({ width: 440, height: 280 });
await promo.setContent(`<html><body style="margin:0;width:440px;height:280px;display:flex;align-items:center;justify-content:center;gap:18px;background:linear-gradient(135deg,#8b7bff,#4b37d0);font-family:-apple-system,system-ui,sans-serif;color:#fff">
<img src="data:image/png;base64,${png.toString('base64')}" width="88" height="88" style="border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
<div><div style="font-size:34px;font-weight:700;letter-spacing:-.02em">ThreadShelf</div><div style="font-size:15px;opacity:.9;margin-top:6px;max-width:230px;line-height:1.35">Enregistrez, lisez et organisez vos threads X.</div></div></body></html>`);
await promo.screenshot({ path: join(OUT, 'promo-small.png') });
copyFileSync(resolve('public/icons/icon-128.png'), join(OUT, 'icon-128.png'));

await context.close();
rmSync(dir, { recursive: true, force: true });
console.log(`Images du Store écrites dans ${OUT}`);
