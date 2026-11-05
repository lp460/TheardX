import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
});

test('Connexion lets the visitor choose Google or GitHub by their logos', async ({ page }) => {
  await page.route('**/api/auth/providers', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"google":true}' }),
  );
  await page.goto('/');

  await page.getByRole('button', { name: 'Connexion' }).first().click();
  const chooser = page.getByRole('dialog', { name: 'Connexion' });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('link', { name: /Google/ })).toHaveAttribute(
    'href',
    '/api/auth/google/login',
  );
  await expect(chooser.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
    'href',
    '/api/auth/login',
  );
  await expect(chooser.locator('svg[data-provider-logo="google"]')).toHaveCount(1);
  await expect(chooser.locator('svg[data-provider-logo="github"]')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(chooser).not.toBeVisible();
});

test('when Google is not configured, GitHub remains available', async ({ page }) => {
  await page.route('**/api/auth/providers', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"google":false}' }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Connexion' }).first().click();
  const chooser = page.getByRole('dialog', { name: 'Connexion' });
  await expect(chooser.getByRole('link', { name: /GitHub/ })).toBeVisible();
  await expect(chooser.getByRole('link', { name: /Google/ })).toHaveCount(0);
});
