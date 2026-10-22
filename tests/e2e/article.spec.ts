import { test, expect, ui, waitForEntries } from './harness';
import { statusPage } from '../fixtures/x-dom';
import { ARTICLE_POST } from '../fixtures/article';

test('X Article: the whole long-form content is saved, readable and copyable', async ({ h }) => {
  await h.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const path = `/make_claude/status/${ARTICLE_POST.id}`;
  h.serve(path, statusPage('xds', [ARTICLE_POST], ARTICLE_POST.id));
  const page = await h.openX(path);
  await ui.barButton(page, /Enregistrer le thread/).click();
  const [entry] = await waitForEntries(h, 1);
  expect(entry!.title).toBe('JEV ne veut pas remplacer Claude');

  const r = await h.context.newPage();
  await r.goto(h.ext(`reader/index.html?id=${entry!.id}`));
  const art = r.locator('[data-testid="article-view"]');
  // Title shown once, in the reader header (not repeated inside the Article).
  await expect(r.locator('[data-testid="reader-title"]')).toHaveText(
    'JEV ne veut pas remplacer Claude',
  );
  await expect(art.locator('h2')).toHaveCount(0);
  await expect(art.locator('pre')).toHaveCount(2);
  await expect(art.locator('pre').first()).toHaveText('npm install -g @y0usaf/typesafe-cli');
  await expect(art.getByText('Jev en commande shell')).toBeVisible();
  await expect(art.locator('strong', { hasText: 'un seul bit' })).toBeVisible();
  await expect(art.locator('img')).toHaveCount(2); // cover + figure
  await r.screenshot({ path: 'artifacts/screenshots/light-reader-article.png' });

  await r.keyboard.press('c');
  await expect.poll(() => r.evaluate(() => navigator.clipboard.readText())).toContain('```bash');
  const md = await r.evaluate(() => navigator.clipboard.readText());
  expect(md).toContain('### JEV ne veut pas remplacer Claude');
  expect(md).toContain('**un seul bit**');

  const lib = await h.context.newPage();
  await lib.goto(h.ext('library/index.html'));
  await expect(lib.locator('[data-testid="entry-card"]')).toContainText(
    'JEV ne veut pas remplacer Claude',
  );
  await lib.locator('[data-testid="library-search"]').fill('typesafe-cli');
  await expect(lib.locator('[data-testid="entry-card"]')).toHaveCount(1);
});
