import { test, expect } from '@playwright/test';

test('user can import saved X and Reddit links from a file without duplicate records', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"login":"lp460"}',
  }));
  await page.route('**/api/sync**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: route.request().method() === 'PUT' ? '{"ok":true}' : '{"file":null}',
  }));
  await page.goto('/?import=1');
  await expect(page.getByRole('dialog', { name: 'Importer les favoris X et Reddit' })).toBeVisible();
  const file = { name: 'x-bookmarks.csv', mimeType: 'text/csv',
    buffer: Buffer.from('url\nhttps://x.com/i/status/1860000000000000001\nhttps://x.com/i/status/1860000000000000001\n') };
  await page.getByLabel('Fichiers de favoris à importer').setInputFiles(file);
  await expect(page.getByTestId('saved-import-preview')).toContainText('1 favoris identifiés');
  await page.getByRole('button', { name: 'Importer les favoris', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('1 ajoutés');
  await expect(page.getByText('Import terminé.')).toBeVisible();
  await page.getByRole('dialog', { name: 'Importer les favoris X et Reddit' })
    .getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByTestId('entry-card')).toHaveCount(1);
  await expect(page.getByTestId('entry-card')).toContainText('Publication de @inconnu');
});
