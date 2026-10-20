import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const DIST = resolve(process.cwd(), 'dist');
const PNG = readFileSync(resolve(process.cwd(), 'public/icons/icon-128.png'));

export interface Harness {
  context: BrowserContext;
  extensionId: string;
  worker: Worker;
  /** Serve an HTML document for an x.com path (both x.com and twitter.com). */
  serve: (path: string, html: string) => void;
  /** Number of image requests served to the extension (media cache). */
  mediaRequests: () => number;
  ext: (path: string) => string;
  openX: (path: string) => Promise<Page>;
  userDataDir: string;
}

export async function launch(
  userDataDir?: string,
): Promise<{ context: BrowserContext; dir: string; ownDir: boolean }> {
  const dir = userDataDir ?? mkdtempSync(join(tmpdir(), 'threadshelf-e2e-'));
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    headless: process.env.HEADED ? false : true,
    viewport: { width: 1360, height: 900 },
    locale: 'fr-FR',
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  return { context, dir, ownDir: !userDataDir };
}

export async function setupRoutes(
  context: BrowserContext,
  pages: Map<string, string>,
  counter: { n: number },
) {
  const handler = async (route: import('@playwright/test').Route) => {
    const url = new URL(route.request().url());
    const html = pages.get(url.pathname);
    if (!html)
      return route.fulfill({
        status: 404,
        contentType: 'text/html',
        body: '<html><body>Not found</body></html>',
      });
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  };
  await context.route(/^https:\/\/(x|twitter)\.com\//, handler);
  await context.route(/^https:\/\/pbs\.twimg\.com\//, (route) => {
    counter.n += 1;
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
  await context.route(/^https:\/\/(abs\.twimg\.com|t\.co|example\.com)\//, (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
}

export async function extensionWorker(context: BrowserContext): Promise<Worker> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return worker;
}

export const test = base.extend<{ h: Harness }>({
  // eslint-disable-next-line no-empty-pattern
  h: async ({}, use) => {
    const { context, dir } = await launch();
    const pages = new Map<string, string>();
    const counter = { n: 0 };
    await setupRoutes(context, pages, counter);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    // Close the welcome tab opened on install.
    await new Promise((r) => setTimeout(r, 300));
    for (const p of context.pages()) if (p.url().includes('#welcome')) await p.close();
    const h: Harness = {
      context,
      extensionId,
      worker,
      userDataDir: dir,
      serve: (path, html) => pages.set(path, html),
      mediaRequests: () => counter.n,
      ext: (path) => `chrome-extension://${extensionId}/${path}`,
      openX: async (path) => {
        const page = await context.newPage();
        await page.goto(`https://x.com${path}`);
        return page;
      },
    };
    await use(h);
    await context.close();
    rmSync(dir, { recursive: true, force: true });
  },
});

export { expect };

/** Shadow-DOM aware locators for the injected UI (Playwright pierces open shadow roots). */
export const ui = {
  bar: (page: Page) => page.locator('threadshelf-bar'),
  barButton: (page: Page, name: RegExp | string) =>
    page.locator('threadshelf-bar').getByRole('button', { name }),
  postButton: (page: Page, id: string) =>
    page.locator(`threadshelf-action[data-ts-id="${id}"] button`),
  panel: (page: Page) => page.locator('threadshelf-root [data-testid="ts-panel"]'),
  toast: (page: Page) => page.locator('threadshelf-root [data-testid="ts-toast"]'),
};

/** Reads the library straight from the extension's IndexedDB via an extension page. */
export async function libraryEntries(
  h: Harness,
): Promise<
  {
    id: string;
    kind: string;
    tweetIds: string[];
    completeness: { status: string; issues: string[] };
    title: string;
    offline: string;
  }[]
> {
  const page = await h.context.newPage();
  await page.goto(h.ext('options/index.html'));
  const entries = await page.evaluate(async () => {
    const req = indexedDB.open('threadshelf');
    const db: IDBDatabase = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const tx = db.transaction('entries', 'readonly');
    const all = tx.objectStore('entries').getAll();
    const rows = await new Promise<unknown[]>((res) => {
      all.onsuccess = () => res(all.result as unknown[]);
    });
    db.close();
    return rows;
  });
  await page.close();
  return entries as never;
}

export async function waitForEntries(h: Harness, n: number, timeout = 8000) {
  const start = Date.now();
  for (;;) {
    const e = await libraryEntries(h);
    if (e.length >= n) return e;
    if (Date.now() - start > timeout) throw new Error(`Expected ${n} entries, got ${e.length}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
