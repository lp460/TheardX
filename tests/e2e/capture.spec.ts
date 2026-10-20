import { test, expect, ui, waitForEntries, libraryEntries } from './harness';
import {
  progressivePage,
  replies,
  spaPage,
  statusPage,
  threadPosts,
  type CellSpec,
  type PostSpec,
} from '../fixtures/x-dom';

const path = (p: PostSpec) => `/${p.handle}/status/${p.id}`;

test.describe('detection and capture on fixtures (X DOM, not the live site)', () => {
  test('single post: inline bar, save, saved state', async ({ h }) => {
    const p: PostSpec = {
      id: '2079610838143600001',
      handle: 'solo_dev',
      name: 'Solo',
      text: 'Un seul post, avec un lien https://example.com/a-propos et #astuce',
    };
    h.serve(path(p), statusPage('xds', [p, ...replies(2, 'solo_dev')], p.id));
    const page = await h.openX(path(p));
    await expect(ui.bar(page)).toBeVisible();
    await expect(ui.postButton(page, p.id)).toBeVisible();
    await ui.barButton(page, /Enregistrer le thread/).click();
    await expect(ui.toast(page).first()).toContainText('Thread enregistré — 1 publication');
    const [e] = await waitForEntries(h, 1);
    expect(e!.tweetIds).toEqual([p.id]);
    await expect(ui.barButton(page, /Mettre à jour/)).toBeVisible();
    // Native X controls are untouched and still present.
    await expect(page.locator('[data-engagement-action="reply"]').first()).toBeVisible();
  });

  for (const n of [2, 10, 30]) {
    test(`thread of ${n} posts is captured complete, without other accounts`, async ({ h }) => {
      const t = threadPosts(n);
      h.serve(path(t[0]!), statusPage('xds', [...t, ...replies(3, 'ada_dev')], t[0]!.id));
      const page = await h.openX(path(t[0]!));
      await expect(ui.bar(page)).toContainText(`${n} publications`);
      await ui.barButton(page, /Enregistrer le thread/).click();
      await expect(ui.toast(page).first()).toContainText(`Thread enregistré — ${n} publications`);
      const [e] = await waitForEntries(h, 1);
      expect(e!.tweetIds).toEqual(t.map((x) => x.id));
      expect(new Set(e!.tweetIds).size).toBe(n);
      expect(e!.completeness.status).toBe('complete');
    });
  }

  test('classic layout (data-testid) thread', async ({ h }) => {
    const t = threadPosts(5);
    h.serve(path(t[2]!), statusPage('classic', [...t, ...replies(2, 'ada_dev')], t[2]!.id));
    const page = await h.openX(path(t[2]!));
    await expect(ui.bar(page)).toContainText('5 publications');
    await ui.barButton(page, /Enregistrer le thread/).click();
    const [e] = await waitForEntries(h, 1);
    expect(e!.tweetIds).toEqual(t.map((x) => x.id));
    expect(e!.completeness.status).toBe('complete');
  });

  test('incomplete thread is reported as such and never as complete', async ({ h }) => {
    const t = threadPosts(9).slice(0, 5);
    h.serve(path(t[0]!), statusPage('xds', t, t[0]!.id));
    const page = await h.openX(path(t[0]!));
    await expect(ui.bar(page)).toContainText('incomplet');
    await ui.barButton(page, /Enregistrer le thread/).click();
    await expect(ui.toast(page).first()).toContainText(
      '5 publications capturées — thread potentiellement incomplet',
    );
    const [e] = await waitForEntries(h, 1);
    expect(e!.completeness.status).toBe('needs_more');
  });

  test('deleted post inside a thread', async ({ h }) => {
    const t = threadPosts(4);
    const cells: CellSpec[] = [t[0]!, { tombstone: 'Ce post n’est pas disponible.' }, t[2]!, t[3]!];
    h.serve(path(t[3]!), statusPage('xds', cells, t[3]!.id));
    const page = await h.openX(path(t[3]!));
    await ui.barButton(page, /Enregistrer le thread/).click();
    const [e] = await waitForEntries(h, 1);
    expect(e!.tweetIds).toEqual([t[0]!.id, t[2]!.id, t[3]!.id]);
    expect(e!.completeness.status).toBe('partial');
    expect(e!.completeness.issues).toContain('deleted-post');
  });

  test('post with image: media extracted and cached for offline reading', async ({ h }) => {
    const p: PostSpec = {
      id: '2079610838143600002',
      handle: 'photo_dev',
      text: 'Regardez ce schéma',
      photos: [{ alt: 'Schéma de l’architecture' }],
    };
    h.serve(path(p), statusPage('xds', [p], p.id));
    const page = await h.openX(path(p));
    await ui.barButton(page, /Enregistrer le thread/).click();
    await waitForEntries(h, 1);
    await expect
      .poll(async () => (await libraryEntries(h))[0]!.offline, { timeout: 10_000 })
      .toBe('full');
    expect(h.mediaRequests()).toBeGreaterThan(0);
  });

  test('quoted post: separated from the thread, captured as reference in mode C', async ({ h }) => {
    const q: PostSpec = {
      id: '2070000000000000001',
      handle: 'quoted_one',
      name: 'Quoted',
      text: 'Le texte original cité',
    };
    const p: PostSpec = {
      id: '2079610838143600003',
      handle: 'ada_dev',
      text: 'Je cite ceci',
      quote: q,
    };
    h.serve(path(p), statusPage('xds', [p], p.id));
    const page = await h.openX(path(p));
    await ui.barButton(page, /Plus d’options/).click();
    await page.locator('threadshelf-root [data-testid="ts-mode-references"]').click();
    await expect(ui.panel(page)).toContainText('Citation · capturée');
    await page.locator('threadshelf-root [data-testid="ts-save"]').click();
    const [e] = await waitForEntries(h, 1);
    expect(e!.kind).toBe('references');
    expect(e!.tweetIds).toEqual([p.id]);
    expect((e as unknown as { referenceTweetIds: string[] }).referenceTweetIds).toEqual([q.id]);
  });

  test('manual selection (mode D) keeps page order', async ({ h }) => {
    const t = threadPosts(5);
    const r = replies(2, 'ada_dev');
    h.serve(path(t[0]!), statusPage('xds', [...t, ...r], t[0]!.id));
    const page = await h.openX(path(t[0]!));
    await ui.barButton(page, /Plus d’options/).click();
    await page.locator('threadshelf-root [data-testid="ts-mode-selection"]').click();
    await ui.postButton(page, r[1]!.id).click();
    await ui.postButton(page, t[3]!.id).click();
    await expect(page.locator('threadshelf-root [data-testid="ts-selection"]')).toContainText(
      '3 publications sélectionnées',
    );
    await page.locator('threadshelf-root [data-testid="ts-save"]').click();
    const [e] = await waitForEntries(h, 1);
    expect(e!.kind).toBe('selection');
    expect(e!.tweetIds).toEqual([t[0]!.id, t[3]!.id, r[1]!.id]);
  });

  test('progressive loading + virtualisation: the saved thread grows to 30 without duplicates', async ({
    h,
  }) => {
    const t = threadPosts(30);
    h.serve(path(t[0]!), progressivePage([...t, ...replies(2, 'ada_dev')], t[0]!.id, 10));
    const page = await h.openX(path(t[0]!));
    await expect(ui.bar(page)).toContainText('10 publications');
    await ui.barButton(page, /Enregistrer le thread/).click();
    await expect(ui.toast(page).first()).toContainText(
      '10 publications capturées — thread potentiellement incomplet',
    );
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(150);
      if ((await page.evaluate(() => document.body.dataset.remaining)) === '0') break;
    }
    await expect
      .poll(async () => (await libraryEntries(h))[0]?.tweetIds.length, { timeout: 15_000 })
      .toBe(30);
    const [e] = await libraryEntries(h);
    expect(e!.tweetIds).toEqual(t.map((x) => x.id));
    expect(e!.completeness.status).toBe('complete');
    expect((await libraryEntries(h)).length).toBe(1);
    // Early posts were unmounted by the page; the session still holds them.
    expect(await page.locator('article').count()).toBeLessThan(30);
  });

  test('SPA navigation (pushState) and URL change without reload', async ({ h }) => {
    const a = threadPosts(2, { handle: 'first_one' });
    const b = threadPosts(3, { handle: 'second_one', startId: 2079610838143900000n });
    h.serve(path(a[0]!), spaPage({ cells: a, focal: a[0]! }, { cells: b, focal: b[0]! }));
    const page = await h.openX(path(a[0]!));
    await expect(ui.bar(page)).toContainText('2 publications');
    await page.evaluate(() => (window as unknown as { __go: () => void }).__go());
    await expect(page).toHaveURL(new RegExp(`/second_one/status/${b[0]!.id}`));
    await expect(ui.bar(page)).toContainText('3 publications');
    await expect(ui.bar(page)).toHaveCount(1);
    await ui.barButton(page, /Enregistrer le thread/).click();
    const [e] = await waitForEntries(h, 1);
    expect(e!.tweetIds).toEqual(b.map((x) => x.id));
  });

  test('replaceState navigation is followed too', async ({ h }) => {
    const a = threadPosts(2, { handle: 'first_one' });
    const b = threadPosts(4, { handle: 'second_one', startId: 2079610838143900000n });
    h.serve(path(a[0]!), spaPage({ cells: a, focal: a[0]! }, { cells: b, focal: b[0]! }));
    const page = await h.openX(path(a[0]!));
    await expect(ui.bar(page)).toBeVisible();
    await page.evaluate(() => (window as unknown as { __go: (m: string) => void }).__go('replace'));
    await expect(ui.bar(page)).toContainText('4 publications');
  });

  test('DOM changed in place: re-extracted, saved again without duplicates', async ({ h }) => {
    const t = threadPosts(2);
    h.serve(path(t[0]!), statusPage('xds', t, t[0]!.id));
    const page = await h.openX(path(t[0]!));
    await ui.barButton(page, /Enregistrer le thread/).click();
    await waitForEntries(h, 1);
    await page.evaluate(() => {
      const span = document.querySelector('li article .whitespace-pre-wrap span')!;
      span.textContent = 'Texte modifié après rendu.';
    });
    await page.waitForTimeout(400);
    await ui.barButton(page, /Mettre à jour/).click();
    await expect(ui.toast(page).first()).toBeVisible();
    await page.waitForTimeout(500);
    const entries = await libraryEntries(h);
    expect(entries).toHaveLength(1);
    const lib = await h.context.newPage();
    await lib.goto(h.ext(`reader/index.html?id=${entries[0]!.id}`));
    await expect(lib.locator('[data-testid="reader-post"]').first()).toContainText(
      'Texte modifié après rendu.',
    );
  });

  test('no double injection and bounded work under heavy DOM churn', async ({ h }) => {
    const t = threadPosts(6);
    h.serve(path(t[0]!), statusPage('xds', [...t, ...replies(4, 'ada_dev')], t[0]!.id));
    const page = await h.openX(path(t[0]!));
    await expect(ui.bar(page)).toBeVisible();
    // 300 unrelated mutations in a burst.
    await page.evaluate(() => {
      const box = document.createElement('div');
      document.body.appendChild(box);
      for (let i = 0; i < 300; i++) box.appendChild(document.createElement('span'));
    });
    await page.waitForTimeout(800);
    await expect(ui.bar(page)).toHaveCount(1);
    await expect(page.locator('threadshelf-action')).toHaveCount(10);
    const state = await h.worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return chrome.tabs.sendMessage(tab!.id!, { type: 'content.state' });
    });
    expect(state.debug.scans).toBeLessThan(15);
    expect(state.debug.observing).toBe(true);
  });

  test('actions from the popup / keyboard shortcut path (messages to the content script)', async ({
    h,
  }) => {
    const t = threadPosts(3);
    h.serve(path(t[0]!), statusPage('xds', t, t[0]!.id));
    const page = await h.openX(path(t[0]!));
    await expect(ui.bar(page)).toBeVisible();
    const res = await h.worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const state = await chrome.tabs.sendMessage(tab!.id!, { type: 'content.state' });
      const run = await chrome.tabs.sendMessage(tab!.id!, {
        type: 'content.run',
        action: 'save-thread',
      });
      return { state, run };
    });
    expect(res.state.focal.threadCount).toBe(3);
    expect(res.run).toMatchObject({ ok: true, message: 'Thread enregistré — 3 publications' });
    await waitForEntries(h, 1);
  });
});
