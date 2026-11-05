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
  await page.getByRole('button', { name: 'Connexion' }).first().click();
  const signIn = page.getByRole('dialog', { name: 'Connexion' });
  await expect(signIn.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', '/api/auth/login');
  await page.keyboard.press('Escape');
  await expect(signIn).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sauvegardez l’essentiel. Lisez-le vraiment.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'L’extension pour capturer. Le web pour lire.' })).toBeVisible();
  await expect(page.getByTestId('demo-library-panel')).toBeVisible();
  await expect(page.getByText('Exemples réels tirés de publications publiques de la bibliothèque.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Télécharger le ZIP' })).toHaveAttribute('href', '/downloads/threadshelf-extension.zip');
  await expect(page.getByRole('link', { name: 'Guide d’installation' })).toHaveAttribute('href', '#installation');
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
  await expect(page.getByTestId('demo-entry-0')).toContainText("I've released a free, open-source speech input app");
  await page.getByTestId('demo-entry-0').click();
  await expect(page.getByTestId('demo-reader-toolbar')).toBeVisible();
  await expect(page.getByTestId('demo-reader-panel').getByRole('heading', { name: "I've released a free, open-source speech input app similar to Aq◯aVo◯ce!" })).toBeVisible();
  await expect(page.getByTestId('demo-library-panel')).toHaveCount(0);
  await expect(page.getByTestId('demo-reader-share')).toBeVisible();
  await expect(page.getByTestId('demo-reader-panel')).toContainText('OpenHinoVoice');
  await expect(page.getByTestId('demo-reader-panel').getByTestId('captured-post')).toHaveCount(2);
  await expect(page.getByTestId('demo-reader-panel')).toContainText('【Main Features】');
  await expect(page.getByTestId('demo-reader-panel')).toContainText('speech.cpp for fully local speech recognition');
  await expect(page.getByTestId('demo-reader-panel').getByRole('link', { name: 'Voir la publication originale · X' })).toHaveAttribute('href', 'https://x.com/inoino65536/status/2116582365950832793');
  await page.getByTestId('demo-reader-favorite').click();
  await expect(page.getByTestId('demo-reader-favorite')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('demo-reader-settings').click();
  await expect(page.getByRole('button', { name: 'Sans', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sans', exact: true }).click();
  await page.getByTestId('demo-reader-settings').click();
  await page.getByTestId('demo-library-tab').click();
  await expect(page.getByTestId('demo-library-panel')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('combobox', { name: 'Langue' }).selectOption('en');
  await expect(page.getByTestId('demo-entry-0')).toContainText("I've released a free, open-source speech input app");
  await expect(page.getByTestId('demo-entry-0')).toContainText('Windows speech input app');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('es');
  await expect(page.getByTestId('demo-entry-0')).toContainText("I've released a free, open-source speech input app");
  await expect(page.getByTestId('demo-entry-0')).toContainText('aplicación de dictado');
});

test('the public demo filters cards, searches, saves favorites and offers grid/list layouts', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await expect(page.getByTestId('demo-library-panel')).toBeVisible();
  await page.getByTestId('demo-search').fill('Benji');
  await expect(page.getByTestId('demo-entry-3')).toBeVisible();
  await expect(page.getByTestId('demo-entry-0')).toHaveCount(0);
  await page.getByTestId('demo-search').fill('');
  await page.getByTestId('demo-nav-favorites').click();
  await expect(page.getByTestId('demo-entry-3')).toBeVisible();
  await expect(page.getByTestId('demo-entry-0')).toHaveCount(0);
  await page.getByTestId('demo-nav-all').click();
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Liste', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: 'Sources' }).selectOption('Reddit');
  await expect(page.getByTestId('demo-entry-2')).toBeVisible();
  await expect(page.getByTestId('demo-entry-0')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Voir la publication originale : u\/Caf_fein/ })).toHaveAttribute('href', /reddit\.com\/r\/macgaming/);
});

test('the public reader shows all saved Reddit comments and flags truncated X captures', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await page.getByTestId('demo-entry-2').click();
  await expect(page.getByTestId('demo-reader-panel').getByTestId('captured-post')).toHaveCount(22);
  await expect(page.getByTestId('demo-reader-panel')).toContainText('thermal throttling');
  await expect(page.getByTestId('demo-reader-panel')).toContainText('Why is no one targeting tears of the kingdom?');
  await page.getByTestId('demo-library-tab').click();
  await page.getByTestId('demo-entry-3').click();
  await expect(page.getByTestId('demo-reader-panel').getByTestId('captured-post')).toHaveCount(5);
  await expect(page.getByTestId('demo-reader-panel')).toContainText('The skill walks the agent through how I');
  await expect(page.getByTestId('demo-reader-panel')).toContainText('Certains messages étaient déjà tronqués');
});

test('the installation guide stays on TheardX and gives official instructions for four browsers', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await page.getByRole('link', { name: 'Guide d’installation' }).click();
  await expect(page).toHaveURL(/#installation$/);
  await expect(page.getByRole('heading', { name: 'Installez TheardX, sans quitter cette page.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Votre premier article' })).toBeVisible();
  await expect(page.getByText(/Le ZIP ne se met pas à jour automatiquement/)).toBeVisible();
  await expect(page.getByTestId('install-address')).toHaveText('chrome://extensions');
  await expect(page.getByRole('link', { name: /Documentation officielle · Chrome/ })).toHaveAttribute('href', /developer\.chrome\.com/);
  await page.getByTestId('install-brave').click();
  await expect(page.getByTestId('install-address')).toHaveText('brave://extensions');
  await expect(page.getByRole('link', { name: /Documentation officielle · Brave/ })).toHaveAttribute('href', /support\.brave\.app/);
  await page.getByTestId('install-edge').click();
  await expect(page.getByTestId('install-address')).toHaveText('edge://extensions');
  await expect(page.getByRole('link', { name: /Documentation officielle · Edge/ })).toHaveAttribute('href', /learn\.microsoft\.com/);
  await page.getByTestId('install-arc').click();
  await expect(page.getByTestId('install-address')).toHaveText('arc://extensions');
  await expect(page.getByRole('link', { name: /Documentation officielle · Arc/ })).toHaveAttribute('href', /start\.arc\.net/);
  await expect(page.getByRole('link', { name: 'Guide d’installation' })).not.toHaveAttribute('href', /github\.com/);
});

test('the extension showcase compares X and Reddit before and after and exercises the actual ThreadShelf controls', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/?home=1#sur-x-et-reddit');
  await expect(page.getByRole('heading', { name: 'Il s’ajoute directement à X et Reddit.' })).toBeVisible();
  await expect.poll(() => page.locator('#sur-x-et-reddit').evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(100);
  await expect(page.getByTestId('extension-added-toolbar')).toBeVisible();
  await expect(page.getByTestId('extension-post-preview')).toContainText('Oliver');
  await expect(page.getByTestId('extension-post-preview')).toContainText('Three.js');
  await page.getByTestId('extension-before').click();
  await expect(page.getByTestId('extension-added-toolbar')).toHaveCount(0);
  await page.getByTestId('extension-after').click();
  await page.getByTestId('extension-more').click();
  await expect(page.getByTestId('extension-action-menu')).toContainText('Enregistrer avec citations et liens');
  await expect.poll(() => page.getByTestId('extension-action-menu').evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await page.getByRole('menuitem', { name: 'Enregistrer avec citations et liens' }).click();
  await expect(page.getByRole('status').last()).toContainText('Publication enregistrée dans la simulation');
  await page.getByRole('button', { name: 'Lire', exact: true }).click();
  await expect(page.getByTestId('extension-reader')).toBeVisible();
  await expect(page.getByTestId('extension-reader').getByTestId('captured-post')).toHaveCount(2);
  await expect(page.getByTestId('extension-reader')).toContainText('Full FP16 weights, dataset and technical report');
  await page.getByRole('button', { name: 'Retour à la publication' }).click();
  await page.getByTestId('extension-platform-reddit').click();
  await expect(page.getByTestId('extension-post-preview')).toContainText('Zelda BOTW Native port');
  await expect(page.getByTestId('extension-post-preview')).toContainText('22 messages · complet');
  await page.getByRole('button', { name: 'Lire', exact: true }).click();
  await expect(page.getByTestId('extension-reader').getByTestId('captured-post')).toHaveCount(22);
  await expect(page.getByTestId('extension-reader')).toContainText('Finally tried the Zelda port on my Mac');
  await page.getByRole('button', { name: 'Retour à la publication' }).click();
  await page.getByTestId('extension-more').click();
  await expect(page.getByTestId('extension-action-menu')).toContainText('Enregistrer la discussion');
  await expect(page.getByTestId('extension-action-menu')).not.toContainText('Enregistrer avec citations et liens');
  await page.getByRole('combobox', { name: 'Langue' }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'It works right inside X and Reddit.' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('es');
  await expect(page.getByRole('heading', { name: 'Se integra directamente en X y Reddit.' })).toBeVisible();
});

test('the original X and Reddit screenshots load and can be enlarged on an iPhone-sized screen', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?home=1#sur-x-et-reddit');
  const gallery = page.getByTestId('extension-real-gallery');
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery.getByRole('img')).toHaveCount(2);
  await expect(gallery.getByRole('img').first()).toHaveAttribute('src', '/showcase/threadshelf-x-post.png');
  await expect(gallery.getByRole('img').first()).toHaveJSProperty('naturalWidth', 611);
  await page.getByTestId('extension-real-screenshot-1').click();
  await expect(page.getByTestId('extension-real-lightbox')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveAttribute('src', '/showcase/threadshelf-x-menu.png');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('extension-real-lightbox')).toHaveCount(0);

  await page.getByTestId('extension-platform-reddit').click();
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery.getByRole('img').first()).toHaveAttribute('src', '/showcase/threadshelf-reddit-post.png');
  await expect(gallery.getByRole('img').first()).toHaveJSProperty('naturalWidth', 728);
  await page.getByTestId('extension-real-screenshot-1').click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveJSProperty('naturalWidth', 817);
  await page.getByRole('button', { name: 'Fermer la capture' }).click();
  await expect(page.getByTestId('extension-real-lightbox')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
  expect(await page.evaluate(() => localStorage.getItem('threadshelf.web.account'))).toBe('github:lp460');
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
