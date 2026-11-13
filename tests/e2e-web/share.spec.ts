import { test, expect } from '@playwright/test';

const data = {
  id: '01234567890123456789.ABCDEFGHIJKLMNOPQRSTUVWX',
  createdAt: Date.now(),
  expiresAt: Date.now() + 86_400_000,
  snapshot: {
    version: 1,
    type: 'collection',
    title: 'Veille IA',
    description: 'Articles de veille choisis par un lecteur.',
    items: [
      {
        title: 'La première publication',
        sourceUrl: 'https://x.com/test/status/123',
        platform: 'x',
        posts: [
          {
            id: '123',
            url: 'https://x.com/test/status/123',
            author: { handle: 'test', name: 'Test author' },
            text: [{ t: 'text', v: 'Full saved text including an essential paragraph.' }],
            media: [],
            article: {
              title: 'Un article complet',
              blocks: [
                { t: 'heading', level: 2, text: [{ t: 'text', v: 'Partie 1' }] },
                {
                  t: 'paragraph',
                  text: [{ t: 'text', v: 'The long article body is visible to guests.' }],
                },
              ],
            },
          },
        ],
      },
      {
        title: 'Discussion Reddit',
        sourceUrl: 'https://www.reddit.com/r/technology/comments/xyz',
        platform: 'reddit',
        posts: [
          {
            id: 't3_xyz',
            url: 'https://www.reddit.com/r/technology/comments/xyz',
            author: { handle: 'redditor' },
            text: [{ t: 'text', v: 'A complete Reddit discussion.' }],
            media: [],
            reddit: { kind: 'post', subreddit: 'technology' },
          },
        ],
      },
    ],
  },
};

test('a public share renders full X and Reddit text without GitHub sign-in on iPhone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const authRequests: string[] = [];
  await page.route('**/api/auth/**', (route) => {
    authRequests.push(route.request().url());
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/share?id=*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    }),
  );
  await page.goto(`/share/index.html?id=${data.id}`);
  await expect(page.getByRole('heading', { name: 'Veille IA' })).toBeVisible();
  await expect(page.getByTestId('shared-item')).toHaveCount(2);
  await expect(page.getByTestId('shared-post')).toHaveCount(2);
  await expect(page.getByText('The long article body is visible to guests.')).toBeVisible();
  await expect(page.getByText('A complete Reddit discussion.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Publication originale/ }).first()).toHaveAttribute(
    'href',
    'https://x.com/test/status/123',
  );
  // Authentication is checked in the background to display the optional
  // 'save to my library' button, but guests must still read without signing in.
  expect(authRequests).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('combobox', { name: 'Langue' }).selectOption('es');
  await expect(page.getByText('Colección compartida', { exact: false })).toBeVisible();
});

test('an expired or revoked share gives a helpful message without login', async ({ page }) => {
  await page.route('**/api/share?id=*', (route) =>
    route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: '{"error":"Ce lien de partage a expiré."}',
    }),
  );
  await page.goto(`/share/index.html?id=${data.id}`);
  await expect(page.getByRole('alert')).toContainText('Ce lien de partage a expiré.');
  await expect(page.getByTestId('shared-item')).toHaveCount(0);
});

test('a signed-in recipient saves a private copy and participates without changing source text', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ login: 'reader', provider: 'github', accountId: 'github:reader' }),
  }));
  await page.route('**/api/share?id=*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ...data, collaboration: true }),
  }));
  let sharedNotes: unknown[] = [];
  await page.route('**/api/share-notes?id=*', async (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as Record<string, unknown>;
      const note = { ...input, id: 'note1', author: 'reader', authorKey: 'abc', createdAt: Date.now() };
      sharedNotes = [...sharedNotes, note];
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ note }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notes: sharedNotes }) });
  });
  await page.goto(`/share/index.html?id=${data.id}`);
  await page.getByTestId('save-shared-copy').click();
  await expect(page.getByTestId('save-shared-copy')).toContainText('Copie enregistrée');
  await page.getByPlaceholder('Ajouter une idée, une remarque ou un commentaire…').first().fill('Un commentaire utile');
  await page.getByRole('button', { name: 'Publier' }).first().click();
  await expect(page.getByTestId('shared-note')).toContainText('Un commentaire utile');
  await expect(page.getByText('The long article body is visible to guests.')).toBeVisible();
});

test('read-only sharing never exposes collaboration or writes shared notes', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ login: 'reader', provider: 'github', accountId: 'github:reader' }),
  }));
  let sharedNotesCalls = 0;
  await page.route('**/api/share-notes?*', (route) => {
    sharedNotesCalls++;
    return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Collaboration désactivée"}' });
  });
  await page.route('**/api/share?id=*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ...data, collaboration: false }),
  }));
  await page.goto(`/share/index.html?id=${data.id}`);
  await expect(page.getByTestId('shared-post')).toHaveCount(2);
  await expect(page.getByTestId('shared-note')).toHaveCount(0);
  await expect(page.getByTestId('shared-notes-0')).toHaveCount(0);
  await expect(page.getByPlaceholder('Ajouter une idée, une remarque ou un commentaire…')).toHaveCount(0);
  await expect(page.getByText('The long article body is visible to guests.')).toBeVisible();
  expect(sharedNotesCalls).toBe(0);
});
