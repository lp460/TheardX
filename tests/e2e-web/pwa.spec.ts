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
  await expect(page.getByRole('heading', { name: 'Gardez les contenus qui comptent.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'L’extension pour capturer. Le web pour lire.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Télécharger le ZIP' })).toHaveAttribute('href', '/downloads/threadshelf-extension.zip');
  const response = await page.request.get('/downloads/threadshelf-extension.zip');
  expect(response.ok()).toBeTruthy();
  expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
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
  await expect(page.getByRole('heading', { name: 'Gardez les contenus qui comptent.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Télécharger le ZIP' })).toBeVisible();
  await page.getByRole('link', { name: 'Accéder à ma bibliothèque' }).click();
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
