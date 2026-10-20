import { test, expect, ui, waitForEntries, libraryEntries } from './harness';
import { statusPage, threadPosts, replies, type PostSpec } from '../fixtures/x-dom';

const path = (p: PostSpec) => `/${p.handle}/status/${p.id}`;

test.describe('ThreadShelf button and action menu on X', () => {
  test('the button on each post opens a menu with every action', async ({ h }) => {
    await h.context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'https://x.com',
    });
    const t = threadPosts(4);
    const r = replies(2, 'ada_dev');
    h.serve(path(t[0]!), statusPage('xds', [...t, ...r], t[0]!.id));
    const page = await h.openX(path(t[0]!));
    await ui.postButton(page, t[2]!.id).click();
    const menu = ui.menu(page);
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('@ada_dev');
    await expect(menu).toContainText('Enregistrer le thread (4)');
    for (const a of [
      'save-thread',
      'save-tweet',
      'save-references',
      'select',
      'copy-thread',
      'copy-tweet',
      'copy-text',
      'read',
      'options',
      'library',
    ]) {
      await expect(ui.menuItem(page, a)).toBeVisible();
    }
    // Keyboard: Escape closes.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // Copy the thread from a reply's menu.
    await ui.postButton(page, t[2]!.id).click();
    await ui.menuItem(page, 'copy-thread').click();
    await expect(ui.toast(page).first()).toContainText('4 publications copiées (Markdown)');
    const md = await page.evaluate(() => navigator.clipboard.readText());
    expect(md).toContain('## 4 / 4');
    expect(md).not.toContain('Reply number');

    // Save only this post.
    await ui.postButton(page, t[2]!.id).click();
    await ui.menuItem(page, 'save-tweet').click();
    const [e] = await waitForEntries(h, 1);
    expect(e!.kind).toBe('tweet');
    expect(e!.tweetIds).toEqual([t[2]!.id]);

    // The button now shows the saved state and the menu offers deletion.
    await ui.postButton(page, t[2]!.id).click();
    await expect(ui.menu(page)).toContainText('Enregistré');
    await expect(ui.menuItem(page, 'delete')).toBeVisible();
    await page.keyboard.press('Escape');

    // Read: saves the thread and opens the reader.
    const [reader] = await Promise.all([
      h.context.waitForEvent('page'),
      (async () => {
        await ui.postButton(page, t[0]!.id).click();
        await ui.menuItem(page, 'read').click();
      })(),
    ]);
    await reader.waitForLoadState();
    expect(reader.url()).toContain('/reader/index.html?id=');
    await expect(reader.locator('[data-testid="reader-post"]')).toHaveCount(4);
  });

  test('the "•••" of the inline bar opens the same menu; clicking outside closes it', async ({
    h,
  }) => {
    const t = threadPosts(2);
    h.serve(path(t[0]!), statusPage('xds', t, t[0]!.id));
    const page = await h.openX(path(t[0]!));
    await page
      .locator('threadshelf-bar')
      .getByRole('button', { name: /Toutes les actions/ })
      .click();
    await expect(ui.menu(page)).toBeVisible();
    await page
      .locator('threadshelf-root [data-testid="ts-menu-backdrop"]')
      .click({ position: { x: 20, y: 400 } });
    await expect(ui.menu(page)).toBeHidden();
  });

  test('floating button: always visible, targets the post being read, works on timelines', async ({
    h,
  }) => {
    const t = threadPosts(3);
    h.serve('/home', statusPage('xds', t));
    const page = await h.openX('/home');
    await expect(ui.fab(page)).toBeVisible();
    await ui.fab(page).click();
    await expect(ui.menu(page)).toContainText('@ada_dev');
    await expect(ui.menuItem(page, 'save-thread')).toContainText(
      'Ouvrez la publication pour un thread vérifié',
    );
    await ui.menuItem(page, 'save-thread').click();
    const [e] = await waitForEntries(h, 1);
    expect(e!.completeness.status).toBe('partial');
    expect(e!.completeness.issues).toContain('not-status-page');
  });

  test('floating button on a page without posts: library + privacy-safe diagnostic', async ({
    h,
  }) => {
    await h.context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'https://x.com',
    });
    h.serve(
      '/explore',
      '<!doctype html><html><body><main><h1>Explorer</h1><p>Rien à voir</p></main></body></html>',
    );
    const page = await h.openX('/explore');
    await ui.fab(page).click();
    await expect(ui.menu(page)).toContainText('Aucune publication détectée');
    await ui.menuItem(page, 'diagnostics').click();
    await expect(ui.toast(page).first()).toContainText('Diagnostic copié');
    const diag = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(diag).toMatchObject({ host: 'x.com', layout: 'unknown', counts: { articles: 0 } });
    expect(JSON.stringify(diag)).not.toContain('Rien à voir');
  });

  test('the floating button can be turned off', async ({ h }) => {
    const t = threadPosts(2);
    h.serve(path(t[0]!), statusPage('xds', t, t[0]!.id));
    const page = await h.openX(path(t[0]!));
    await expect(ui.fab(page)).toBeVisible();
    const opts = await h.context.newPage();
    await opts.goto(h.ext('options/index.html'));
    await opts.getByRole('switch', { name: 'Bouton flottant ThreadShelf' }).click();
    await expect(ui.fab(page)).toBeHidden();
    await expect(ui.bar(page)).toBeVisible();
    expect(await libraryEntries(h)).toHaveLength(0);
  });
});
