import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Seed French only for a fresh test context, never overwrite a user-selected language on reload.
  await page.addInitScript(() => {
    if (!localStorage.getItem('theardx.web.language')) {
      localStorage.setItem('theardx.web.language', 'fr');
    }
  });
});

async function mockSignedIn(page: Page) {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"login":"lp460"}',
  }));
  await page.route('**/api/sync**', (route) => {
    const url = new URL(route.request().url());
    const body = route.request().method() === 'PUT'
      ? { ok: true }
      : url.searchParams.has('meta')
        ? { repo: { full_name: 'lp460/threadshelf-data', private: true, default_branch: 'main' } }
        : { file: null };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('the public home explains TheardX, signs in through GitHub and offers the real extension download', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401, contentType: 'application/json', body: '{"error":"Connexion requise"}',
  }));
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('link', { name: /Se connecter avec GitHub/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sauvegardez l’essentiel. Lisez-le vraiment.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'L’extension pour capturer. Le web pour lire.' })).toBeVisible();
  await expect(page.getByTestId('demo-library-panel')).toBeVisible();
  await expect(page.getByText('Aperçu avec des exemples fictifs.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Télécharger le ZIP' })).toHaveAttribute('href', '/downloads/threadshelf-extension.zip');
  const response = await page.request.get('/downloads/threadshelf-extension.zip');
  expect(response.ok()).toBeTruthy();
  expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
});

test('visitors can explore a realistic library and reader before signing in, including on iPhone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401, contentType: 'application/json', body: '{"error":"Connexion requise"}',
  }));
  await page.goto('/');
  await expect(page.getByTestId('landing-demo')).toBeVisible();
  const previewPosition = await page.getByTestId('landing-demo').boundingBox();
  expect(previewPosition?.y ?? Infinity).toBeLessThan(812);
  await expect(page.getByTestId('demo-entry-0')).toContainText('Les idées qui méritent d’être relues');
  await page.getByTestId('demo-entry-0').click();
  await expect(page.getByTestId('demo-reader-panel')).toContainText('Les idées qui méritent d’être relues');
  await page.getByTestId('demo-library-tab').click();
  await expect(page.getByTestId('demo-library-panel')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('combobox', { name: 'Langue' }).selectOption('en');
  await expect(page.getByTestId('demo-entry-0')).toContainText('Ideas worth revisiting');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('es');
  await expect(page.getByTestId('demo-entry-0')).toContainText('Ideas que merecen una segunda lectura');
});

test('the library has a usable mobile navigation without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await mockSignedIn(page);
  await page.goto('/');
  await expect(page.getByTestId('view-title')).toHaveText('Bibliothèque');
  await expect(page.getByRole('navigation', { name: 'Navigation mobile' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Tous les auteurs' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Filtres' }).click();
  await expect(page.getByRole('combobox', { name: 'Tous les auteurs' })).toBeVisible();
  await page.getByRole('button', { name: 'Masquer les filtres' }).click();
  await page.getByRole('navigation', { name: 'Navigation mobile' }).getByText('À lire').click();
  await expect(page.getByTestId('view-title')).toHaveText('À lire plus tard');
  await page.getByRole('navigation', { name: 'Navigation mobile' }).getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('signed-in users can return to the home page to download the extension', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignedIn(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(page.getByRole('heading', { name: 'Sauvegardez l’essentiel. Lisez-le vraiment.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Télécharger le ZIP' })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Accéder à ma bibliothèque' }).click();
  await expect(page.getByTestId('view-title')).toHaveText('Bibliothèque');
});

test('language selector translates the web experience in FR, EN and ES and remembers the choice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignedIn(page);
  await page.goto('/');
  await expect(page.getByTestId('view-title')).toHaveText('Bibliothèque');
  await page.getByRole('combobox', { name: 'Langue' }).selectOption('es');
  await expect(page.getByTestId('view-title')).toHaveText('Biblioteca');
  await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('view-title')).toHaveText('Biblioteca');
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
  await expect(page.getByTestId('view-title')).toHaveText('Library');
});

test('the PWA reopens its local library with no network after first visit', async ({ page, context }) => {
  await mockSignedIn(page);
  await page.goto('/');
  await expect(page.getByTestId('view-title')).toHaveText('Bibliothèque');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error('Service worker missing');
    const cached = await caches.match('/index.html');
    if (!cached) throw new Error('App shell not precached');
  });
  // Precache completion can precede clients.claim() controlling the first page.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('threadshelf.web.account'))).toBe('lp460');
  // Let the auth request fail naturally offline; the online mock must not hide that state.
  await page.unroute('**/api/auth/me');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('view-title')).toHaveText('Bibliothèque');
  await expect(page.getByText('Hors ligne')).toBeVisible();
});

test('Safari-style web reader auto-translates with consent and reuses cached text offline', async ({ page, context }) => {
  await mockSignedIn(page);
  await page.addInitScript(() => { delete (globalThis as { Translator?: unknown }).Translator; });
  let requests = 0;
  await page.route('**/api/translate', async (route) => {
    requests++;
    expect(route.request().method()).toBe('POST');
    const body = route.request().postDataJSON() as { source: string; target: string; texts: string[] };
    expect(body.source).toBe('en');
    expect(body.target).toBe('fr');
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ translations: body.texts.map((t) => `FR : ${t}`) }) });
  });
  await page.goto('/');
  await expect(page.getByTestId('view-title')).toHaveText('Bibliothèque');
  await page.evaluate(async () => {
    const handle = indexedDB.open('threadshelf');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      handle.onsuccess = () => resolve(handle.result);
      handle.onerror = () => reject(handle.error);
    });
    const tx = db.transaction(['entries', 'tweets'], 'readwrite');
    tx.objectStore('tweets').put({
      id: 'web-post-1', url: 'https://x.com/someone/status/1', author: { handle: 'someone' },
      authorKey: 'someone', lang: 'en', text: [{ t: 'text', v: 'The weather is nice.' }],
      media: [], linkedTweetIds: [], availability: 'available', context: 'full',
      firstSeenAt: 1, lastSeenAt: 1,
      article: {
        url: 'https://x.com/someone/article/1', title: 'The weather is nice.',
        blocks: [{ t: 'paragraph', text: [{ t: 'text', v: 'A beautiful day to read.' }] }],
      },
    });
    tx.objectStore('entries').put({
      id: 'web-entry-1', kind: 'thread', title: 'The weather is nice.', authorHandle: 'someone',
      focalTweetId: 'web-post-1', tweetIds: ['web-post-1'], contextTweetIds: [],
      referenceTweetIds: [], externalRefs: [], completeness: {
        status: 'complete', startVerified: true, endVerified: true, gaps: 0, issues: [], checkedAt: 1,
      }, sourceUrl: 'https://x.com/someone/status/1', savedAt: 1, updatedAt: 1,
      readState: 'unread', readLater: false, favorite: false, readProgress: 0,
      categoryId: null, tags: [], collectionIds: [], note: '', offline: 'full', searchText: '',
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.setItem('threadshelf.settings', JSON.stringify({
      translateTo: 'fr', webTranslation: { automatic: true, consentAt: Date.now() },
    }));
  });

  await page.goto('/reader/?id=web-entry-1');
  await expect(page.getByTestId('reader-title')).toHaveText('FR : The weather is nice.');
  await expect(page.getByTestId('reader-article')).toContainText('FR : A beautiful day to read.');
  await expect(page.getByTestId('reader-translation-note')).toContainText('Vercel AI Gateway');
  expect(requests).toBe(1);

  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.unroute('**/api/translate');
  await page.unroute('**/api/auth/me');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('reader-title')).toHaveText('FR : The weather is nice.');
  expect(requests).toBe(1);
  await page.getByTestId('reader-translate').click();
  await expect(page.getByTestId('reader-title')).toHaveText('The weather is nice.');
  await expect(page.getByTestId('reader-translation-note')).not.toBeVisible();
});
