/**
 * Opt-in compatibility check against the LIVE x.com (logged out, public posts only, a handful of
 * normal page views — no automated collection). Run with: npm run test:real
 * Results depend on X's current markup and on what X shows to logged-out visitors.
 */
import { test, expect } from '@playwright/test';
import { extensionWorker, launch } from '../e2e/harness';

const POSTS = (
  process.env.REAL_X_URLS ??
  'https://x.com/mattpocockuk/status/2079679893479018727,https://x.com/jack/status/20'
).split(',');

test.describe.configure({ mode: 'serial' });

test('live x.com: detection, inline UI and capture', async () => {
  test.setTimeout(120_000);
  const { context } = await launch();
  const worker = await extensionWorker(context);
  const extId = new URL(worker.url()).host;
  const report: Record<string, unknown>[] = [];
  for (const url of POSTS) {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /threadshelf/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await page.bringToFront();
    const state = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return chrome.tabs.sendMessage(tab!.id!, { type: 'content.state' });
    });
    const barVisible = await page
      .locator('threadshelf-bar')
      .isVisible()
      .catch(() => false);
    const buttons = await page.locator('threadshelf-action').count();
    await page.screenshot({
      path: `artifacts/screenshots/live-x-${new URL(url).pathname.split('/')[1]}.png`,
    });
    const run = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return chrome.tabs.sendMessage(tab!.id!, { type: 'content.run', action: 'save-thread' });
    });
    report.push({
      url,
      layout: state.layout,
      focal: state.focal,
      detected: state.detected,
      barVisible,
      buttons,
      run,
      errors,
    });
    await page.close();
  }
  // Inspect what was saved.
  const lib = await context.newPage();
  await lib.goto(`chrome-extension://${extId}/options/index.html`);
  const saved = await lib.evaluate(async () => {
    const req = indexedDB.open('threadshelf');
    const db: IDBDatabase = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const read = (store: string) =>
      new Promise<unknown[]>((res) => {
        const r = db.transaction(store).objectStore(store).getAll();
        r.onsuccess = () => res(r.result as unknown[]);
      });
    const out = { entries: await read('entries'), tweets: await read('tweets') };
    db.close();
    return out;
  });
  console.log(
    JSON.stringify(
      {
        report,
        entries: (
          saved.entries as {
            title: string;
            kind: string;
            tweetIds: string[];
            contextTweetIds: string[];
            completeness: unknown;
          }[]
        ).map((e) => ({
          title: e.title,
          kind: e.kind,
          tweetIds: e.tweetIds,
          context: e.contextTweetIds,
          completeness: e.completeness,
        })),
        tweets: (
          saved.tweets as {
            id: string;
            author: unknown;
            createdAt?: string;
            createdAtSource?: string;
            text: { v: string }[];
            media: unknown[];
            source?: string;
          }[]
        ).map((t) => ({
          id: t.id,
          author: t.author,
          createdAt: t.createdAt,
          src: t.createdAtSource,
          text: t.text
            .map((s) => s.v)
            .join('')
            .slice(0, 80),
          media: t.media.length,
          layout: t.source,
        })),
      },
      null,
      2,
    ),
  );
  for (const r of report) expect((r.run as { ok: boolean }).ok, JSON.stringify(r)).toBe(true);
  await context.close();
});
