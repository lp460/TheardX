import { expect, test } from '@playwright/test';

test('iPhone reader keeps Back and More fixed while Export remains accessible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"login":"lp460"}',
  }));
  await page.route('**/api/sync**', (route) => {
    const meta = new URL(route.request().url()).searchParams.has('meta');
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(meta
        ? { repo: { full_name: 'lp460/threadshelf-data', private: true, default_branch: 'main' } }
        : { file: null }),
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('view-title')).toBeVisible();
  await page.evaluate(async () => {
    const request = indexedDB.open('threadshelf');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['entries', 'tweets'], 'readwrite');
    tx.objectStore('tweets').put({
      id: 'mobile-post', url: 'https://x.com/reader/status/123',
      author: { handle: 'reader' }, authorKey: 'reader', lang: 'fr',
      text: [{ t: 'text', v: 'Un article à exporter depuis mon iPhone.' }],
      media: [], linkedTweetIds: [], availability: 'available', context: 'full',
      firstSeenAt: 1, lastSeenAt: 1,
    });
    tx.objectStore('entries').put({
      id: 'mobile-reader-entry', kind: 'thread', title: 'Lecture sur iPhone',
      authorHandle: 'reader', focalTweetId: 'mobile-post', tweetIds: ['mobile-post'],
      contextTweetIds: [], referenceTweetIds: [], externalRefs: [],
      completeness: {
        status: 'complete', startVerified: true, endVerified: true,
        gaps: 0, issues: [], checkedAt: 1,
      },
      sourceUrl: 'https://x.com/reader/status/123',
      savedAt: 1, updatedAt: 1, readState: 'unread', readLater: false,
      favorite: false, readProgress: 0, categoryId: null, tags: [],
      collectionIds: [], note: '', offline: 'full', searchText: '',
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto('/reader/?id=mobile-reader-entry');
  await expect(page.getByTestId('reader-title')).toHaveText('Lecture sur iPhone');

  const back = page.getByRole('button', { name: 'Retour à la bibliothèque' });
  const strip = page.getByTestId('reader-action-strip');
  const exportButton = page.getByTestId('reader-export');
  await expect(strip).toBeVisible();
  await expect(exportButton).toBeAttached();
  expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  // The mobile overflow menu must remain reachable without swiping the actions.
  const more = page.getByTestId('reader-mobile-more');
  await expect(more).toBeInViewport();
  expect(await more.evaluate((el) => !!el.closest('[data-testid="reader-action-strip"]'))).toBe(false);
  const moreBefore = await more.boundingBox();
  const before = await back.boundingBox();
  await strip.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await exportButton.scrollIntoViewIfNeeded();
  await expect(exportButton).toBeInViewport();
  const after = await back.boundingBox();
  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(2);
  await expect(back).toBeInViewport();
  const moreAfter = await more.boundingBox();
  expect(Math.abs((moreAfter?.x ?? 0) - (moreBefore?.x ?? 0))).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await more.click();
  await page.getByRole('menuitem', { name: 'Exporter' }).click();
  await expect(page.getByRole('dialog', { name: 'Exporter' })).toBeVisible();
});
