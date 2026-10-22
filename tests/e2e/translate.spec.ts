import { test, expect, ui, waitForEntries } from './harness';
import { statusPage } from '../fixtures/x-dom';
import { ARTICLE_POST } from '../fixtures/article';

/** On-device translation needs Google Chrome's language models: simulated here with a fake Translator. */
const FAKE_TRANSLATOR = () => {
  (globalThis as unknown as { Translator: unknown }).Translator = {
    availability: async () => 'downloadable',
    create: async ({ targetLanguage }: { targetLanguage: string }) => ({
      translate: async (text: string) => `«${targetLanguage}» ${text}`,
      destroy: () => {},
    }),
  };
};

test('reader: translate, show original, cached for next time, copy and export the translation', async ({
  h,
}) => {
  await h.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const post = { ...ARTICLE_POST, article: { ...ARTICLE_POST.article!, title: '现在大多数代理' } };
  const path = `/make_claude/status/${post.id}`;
  h.serve(path, statusPage('xds', [post], post.id));
  const x = await h.openX(path);
  await ui.barButton(x, /Enregistrer le thread/).click();
  const [entry] = await waitForEntries(h, 1);

  const r = await h.context.newPage();
  await r.addInitScript(FAKE_TRANSLATOR);
  await r.goto(h.ext(`reader/index.html?id=${entry!.id}`));
  const button = r.locator('[data-testid="reader-translate"]');
  await expect(button).toContainText('Traduire');
  await button.click();
  await expect(r.locator('[data-testid="reader-translation-note"]')).toContainText(
    'Traduit depuis le chinois en français',
  );
  await expect(r.locator('[data-testid="reader-title"]')).toHaveText('«fr» 现在大多数代理');
  await expect(r.locator('[data-testid="article-view"]')).toContainText(
    '«fr» La plupart des agents IA',
  );
  await expect(r.locator('[data-testid="article-view"] pre').first()).toHaveText(
    'npm install -g @y0usaf/typesafe-cli',
  );
  await r.screenshot({ path: 'artifacts/screenshots/light-reader-translated.png' });

  // Copy the translation.
  await r.getByRole('button', { name: 'Copier' }).first().click();
  await r.getByRole('menuitem', { name: 'Copier la traduction (Markdown)' }).click();
  await expect
    .poll(() => r.evaluate(() => navigator.clipboard.readText()))
    .toContain('«fr» La plupart');

  // Original again, then translation from the cache (no Translator needed any more).
  await r.keyboard.press('l');
  await expect(r.locator('[data-testid="reader-title"]')).toHaveText('现在大多数代理');
  const again = await h.context.newPage();
  await again.goto(h.ext(`reader/index.html?id=${entry!.id}`));
  await again.locator('[data-testid="reader-translate"]').click();
  await expect(again.locator('[data-testid="reader-title"]')).toHaveText('«fr» 现在大多数代理');

  // Export the translation.
  await again.getByRole('button', { name: 'Exporter' }).click();
  await again.locator('[data-testid="export-translation"]').check();
  const [download] = await Promise.all([
    again.waitForEvent('download'),
    again.locator('[data-testid="export-confirm"]').click(),
  ]);
  const fs = await import('node:fs');
  const md = fs.readFileSync((await download.path())!, 'utf8');
  expect(md).toContain('«fr» La plupart des agents IA');
});

test('reader: clear message and Google Translate fallback when the browser cannot translate', async ({
  h,
}) => {
  const path = `/make_claude/status/${ARTICLE_POST.id}`;
  h.serve(
    path,
    statusPage(
      'xds',
      [{ ...ARTICLE_POST, article: { ...ARTICLE_POST.article!, title: '现在大多数代理' } }],
      ARTICLE_POST.id,
    ),
  );
  const x = await h.openX(path);
  await ui.barButton(x, /Enregistrer le thread/).click();
  const [entry] = await waitForEntries(h, 1);
  const r = await h.context.newPage();
  await r.addInitScript(() => {
    delete (globalThis as unknown as { Translator?: unknown }).Translator;
  });
  await r.goto(h.ext(`reader/index.html?id=${entry!.id}`));
  await r.locator('[data-testid="reader-translate"]').click();
  const err = r.locator('[data-testid="reader-translation-error"]');
  await expect(err).toContainText('n’est pas disponible');
  await expect(err.getByRole('button', { name: 'Ouvrir dans Google Traduction' })).toBeVisible();
});
