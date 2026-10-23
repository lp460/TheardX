/**
 * Opt-in compatibility check against the LIVE www.reddit.com (logged out, public posts, a handful of
 * normal page views — no automated collection). Run with: HEADED=1 npm run test:real -- real-reddit
 * Uses the e2e copy of the extension where Reddit access is already granted.
 */
import { test, expect, type Page, type Worker } from '@playwright/test';
import { extensionWorker, launch, redditGrantedDist } from '../e2e/harness';

const LISTINGS = (
  process.env.REAL_REDDIT_LISTINGS ??
  'https://www.reddit.com/r/AskHistorians/top/?t=month,https://www.reddit.com/r/pics/top/?t=week'
).split(',');

async function contentState(worker: Worker) {
  return worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return chrome.tabs.sendMessage(tab!.id!, { type: 'content.state' });
  });
}

async function readDb(page: Page) {
  return page.evaluate(async () => {
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
}

test('live reddit.com: detection, inline UI, discussion capture and reader', async () => {
  test.setTimeout(180_000);
  const { context } = await launch(undefined, { extensionDir: redditGrantedDist() });
  const worker = await extensionWorker(context);
  const extId = new URL(worker.url()).host;
  const report: Record<string, unknown>[] = [];

  for (const listing of LISTINGS) {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /threadshelf/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(listing, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    await page.bringToFront();
    const feed = await contentState(worker);
    console.log('listing', listing, JSON.stringify(feed));
    const feedButtons = await page.locator('threadshelf-action').count();
    const permalink = await page.evaluate(
      () => document.querySelector('shreddit-post')?.getAttribute('permalink') ?? null,
    );
    if (!permalink) {
      report.push({ listing, feed, error: 'no post on the listing' });
      await page.close();
      continue;
    }
    await page.goto(`https://www.reddit.com${permalink}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    await page.bringToFront();
    const state = await contentState(worker);
    const bar = await page
      .locator('threadshelf-bar')
      .innerText({ timeout: 3000 })
      .catch(() => '');
    console.log('post page', permalink, JSON.stringify(state), bar);
    const buttons = await page.locator('threadshelf-action').count();
    const name = permalink.split('/')[2];
    await page
      .locator('threadshelf-bar')
      .scrollIntoViewIfNeeded({ timeout: 3000 })
      .catch(() => undefined);
    await page.screenshot({ path: `artifacts/screenshots/live-reddit-${name}.png` });
    if (buttons) {
      await page
        .locator('threadshelf-action button')
        .nth(1)
        .click({ timeout: 3000 })
        .catch(() => undefined);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `artifacts/screenshots/live-reddit-menu-${name}.png` });
      await page.keyboard.press('Escape');
    }
    const run = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return chrome.tabs.sendMessage(tab!.id!, { type: 'content.run', action: 'save-thread' });
    });
    report.push({ listing, feed, feedButtons, permalink, state, bar, buttons, run, errors });
    await page.close();
  }

  const lib = await context.newPage();
  await lib.goto(`chrome-extension://${extId}/options/index.html`);
  const saved = await readDb(lib);
  type T = {
    id: string;
    platform?: string;
    author: { handle: string };
    article?: { title?: string; blocks: { t: string }[]; partial?: boolean };
    media: { kind: string; url: string }[];
    card?: unknown;
    reddit?: {
      kind: string;
      depth?: number;
      parentId?: string;
      subreddit?: string;
      score?: number;
    };
  };
  type E = {
    id: string;
    platform?: string;
    title: string;
    kind: string;
    tweetIds: string[];
    completeness: { status: string; issues: string[] };
  };
  const entries = saved.entries as E[];
  const tweets = new Map((saved.tweets as T[]).map((t) => [t.id, t]));
  const summary = entries.map((e) => {
    const post = tweets.get(e.tweetIds[0]!);
    const comments = e.tweetIds.slice(1).map((id) => tweets.get(id)!);
    return {
      title: e.title,
      platform: e.platform,
      kind: e.kind,
      messages: e.tweetIds.length,
      completeness: e.completeness,
      post: post && {
        id: post.id,
        author: post.author.handle,
        reddit: post.reddit,
        blocks: post.article?.blocks.map((b) => b.t).join(','),
        media: post.media.map((m) => `${m.kind}:${new URL(m.url).hostname}`),
        card: !!post.card,
      },
      depths: comments.map((c) => c.reddit?.depth),
      emptyComments: comments.filter((c) => !c.article?.blocks.length).length,
    };
  });
  console.log(JSON.stringify({ report, summary }, null, 2));

  for (const e of entries.slice(0, 1)) {
    const r = await context.newPage();
    await r.goto(`chrome-extension://${extId}/reader/index.html?id=${e.id}`);
    await r.waitForTimeout(1500);
    await r.screenshot({ path: 'artifacts/screenshots/live-reddit-reader.png', fullPage: false });
  }

  for (const r of report.filter((x) => !x.error)) {
    expect((r.state as { layout: string }).layout).toBe('reddit');
    expect((r.run as { ok: boolean }).ok).toBe(true);
    expect(r.buttons as number).toBeGreaterThan(0);
    expect(r.errors).toEqual([]);
  }
  expect(entries.length).toBeGreaterThan(0);
  for (const s of summary) {
    expect(s.platform).toBe('reddit');
    expect(s.post?.id).toMatch(/^t3_/);
    expect(s.title.length).toBeGreaterThan(0);
  }
  await context.close();
});
