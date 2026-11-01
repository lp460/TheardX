import { test, expect, type Page } from '@playwright/test';

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

test('the web app requires GitHub sign-in when online', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401, contentType: 'application/json', body: '{"error":"Connexion requise"}',
  }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Se connecter avec GitHub/ })).toBeVisible();
  await expect(page.getByText('Votre bibliothèque, partout.')).toBeVisible();
});

test('the library has a usable mobile navigation without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await mockSignedIn(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bibliothèque' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation mobile' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Navigation mobile' }).getByText('À lire').click();
  await expect(page.getByRole('heading', { name: 'À lire plus tard' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Navigation mobile' }).getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the PWA reopens its local library with no network after first visit', async ({ page, context }) => {
  await mockSignedIn(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bibliothèque' })).toBeVisible();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error('Service worker missing');
    const cached = await caches.match('/index.html');
    if (!cached) throw new Error('App shell not precached');
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bibliothèque' })).toBeVisible();
  await expect(page.getByText('Hors ligne')).toBeVisible();
});
