import { expect, test, type Page } from '@playwright/test';

type RemoteFile = { id: string; name: string; createdTime: string; text: string };

async function mockGoogle(page: Page, files: RemoteFile[]) {
  await page.addInitScript(() => localStorage.setItem('theardx.web.language', 'fr'));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        login: 'lorry@example.com',
        provider: 'google',
        accountId: 'google:1234567890123456789',
      }),
    }),
  );
  await page.route('**/api/google/sync**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { deviceId: string; revisionId: string; text: string };
      files.push({
        id: `snapshot${String(files.length).padStart(5, '0')}`,
        name: `theardx-${body.deviceId}-${body.revisionId}.json`,
        createdTime: new Date(Date.UTC(2026, 10, 5, 12, files.length)).toISOString(),
        text: body.text,
      });
      return route.fulfill({ contentType: 'application/json', body: '{}' });
    }
    const fileId = new URL(request.url()).searchParams.get('file');
    const data = fileId
      ? { text: files.find((file) => file.id === fileId)?.text }
      : { files: files.map(({ text: _text, ...file }) => file) };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
}

test('first Google login automatically syncs plain, without a protection dialog', async ({
  page,
}) => {
  const files: RemoteFile[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGoogle(page, files);
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Protéger votre bibliothèque Google Drive ?' });
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => files.length).toBe(1);
  expect(JSON.parse(files[0]!.text)).toMatchObject({ mode: 'plain', root: true });
  await page.reload();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText('Bibliothèque chiffrée : saisissez votre phrase secrète'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await expect(page.getByText('Sécurité avancée (facultative)')).toBeVisible();
  await page.getByText('Sécurité avancée (facultative)').click();
  await expect(page.getByText('Mode standard : aucune phrase secrète')).toBeVisible();
});

test('the settings allow opting into encrypted Google Drive snapshots', async ({ page }) => {
  const files: RemoteFile[] = [];
  await mockGoogle(page, files);
  await page.goto('/');
  await expect.poll(() => files.length).toBe(1);
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.getByText('Sécurité avancée (facultative)').click();
  await page.getByRole('button', { name: 'Modifier la protection' }).click();
  await page.getByLabel('Nouvelle phrase secrète').fill('test-encryption-key-2026');
  await page.getByRole('button', { name: 'Confirmer le changement' }).click();
  await expect(page.getByText('Chiffrement renforcé activé')).toBeVisible();
  await expect.poll(() => files.length).toBe(2);
  expect(JSON.parse(files[1]!.text)).toMatchObject({ mode: 'encrypted', root: true });
  expect(files[1]!.text).not.toContain('"format":"threadshelf.backup"');
  await page.reload();
  await expect(
    page.getByText('Bibliothèque chiffrée : saisissez votre phrase secrète', { exact: false }).first(),
  ).toBeVisible();
});
