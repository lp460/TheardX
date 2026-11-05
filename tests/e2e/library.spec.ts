import { readFileSync } from 'node:fs';
import {
  test,
  expect,
  ui,
  waitForEntries,
  libraryEntries,
  launch,
  setupRoutes,
  extensionWorker,
  type Harness,
} from './harness';
import { statusPage, threadPosts, replies, type PostSpec } from '../fixtures/x-dom';

const path = (p: PostSpec) => `/${p.handle}/status/${p.id}`;

async function saveThread(h: Harness, posts: PostSpec[], focal = posts[0]!) {
  h.serve(path(focal), statusPage('xds', [...posts, ...replies(1, focal.handle)], focal.id));
  const page = await h.openX(path(focal));
  await ui.barButton(page, /Enregistrer le thread/).click();
  await expect(ui.toast(page).first()).toBeVisible();
  await page.close();
}

async function seed(h: Harness) {
  const a = threadPosts(3, {
    handle: 'ada_dev',
    text: (i) =>
      i === 0
        ? 'Guide TypeScript avancé : génériques et inférence'
        : `Partie ${i + 1} sur les types conditionnels`,
  });
  a[1] = { ...a[1]!, photos: [{ alt: 'Diagramme des types' }] };
  const b = threadPosts(2, {
    handle: 'bob_ops',
    startId: 2079610838143700000n,
    text: (i) =>
      i === 0
        ? 'Kubernetes en production : retour d’expérience'
        : 'Le réseau est toujours le problème',
  });
  const c: PostSpec = {
    id: '2079610838143800000',
    handle: 'cara_ux',
    text: 'Une astuce de design : l’espace blanc est un élément',
  };
  await saveThread(h, a);
  await saveThread(h, b);
  await saveThread(h, [c]);
  await waitForEntries(h, 3);
  return { a, b, c };
}

test.describe('library', () => {
  test('lists, searches, filters, favourites and organises entries', async ({ h }) => {
    await seed(h);
    const lib = await h.context.newPage();
    await lib.goto(h.ext('library/index.html'));
    const cards = lib.locator('[data-testid="entry-card"]');
    await expect(cards).toHaveCount(3);

    // Instant search (accent-insensitive) and author filter.
    await lib.locator('[data-testid="library-search"]').fill('generiques');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Guide TypeScript');
    await lib.locator('[data-testid="library-search"]').fill('@bob_ops');
    await expect(cards).toHaveCount(1);
    await lib.locator('[data-testid="library-search"]').fill('');
    await lib.locator('[data-testid="filter-author"]').selectOption('cara_ux');
    await expect(cards).toHaveCount(1);
    await lib.locator('[data-testid="filter-author"]').selectOption('');

    // Favourite.
    await cards
      .filter({ hasText: 'Kubernetes' })
      .getByRole('button', { name: 'Ajouter aux favoris' })
      .click();
    await lib
      .getByRole('navigation')
      .getByRole('button', { name: /^Favoris/ })
      .click();
    await expect(lib.locator('[data-testid="view-title"]')).toHaveText('Favoris');
    await expect(cards).toHaveCount(1);
    await lib.getByRole('navigation').getByRole('button', { name: /^Tout/ }).click();

    // Collection via the manager, then assign from the card menu.
    await lib.getByRole('button', { name: 'Gérer les collections et catégories' }).click();
    await lib.getByLabel('Nom de la nouvelle collection').fill('Dev');
    await lib.getByRole('button', { name: 'Créer la collection' }).click();
    await lib.getByLabel('Nom de la nouvelle catégorie').fill('Tutoriels');
    await lib.getByRole('button', { name: 'Créer la catégorie' }).click();
    await lib.keyboard.press('Escape');
    const card = cards.filter({ hasText: 'Guide TypeScript' });
    await card.getByRole('button', { name: 'Plus d’actions' }).click();
    await lib.getByRole('menuitem', { name: 'Collections' }).focus();
    await lib.keyboard.press('ArrowRight');
    await lib.getByRole('menuitemcheckbox', { name: 'Dev' }).click();
    await lib.keyboard.press('Escape');
    await lib.keyboard.press('Escape');
    await lib.getByRole('navigation').getByRole('button', { name: /Dev/ }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Guide TypeScript');

    // Tags + note.
    await cards.first().getByRole('button', { name: 'Plus d’actions' }).click();
    await lib.getByRole('menuitem', { name: 'Tags et note…' }).click();
    await lib.locator('[data-testid="tags-input"]').fill('typescript, avancé');
    await lib.locator('[data-testid="tags-save"]').click();
    await lib.getByRole('navigation').getByRole('button', { name: /^Tout/ }).click();
    await lib.locator('[data-testid="library-search"]').fill('#typescript');
    await expect(cards).toHaveCount(1);
    await lib.locator('[data-testid="library-search"]').fill('');

    // Read later + unread views.
    await expect(
      lib.getByRole('navigation').getByRole('button', { name: /Non lus/ }),
    ).toContainText('3');

    // Sort.
    await lib.locator('[data-testid="sort"]').selectOption('saved-asc');
    await expect(cards.first()).toContainText('Guide TypeScript');

    // List view.
    await lib.getByRole('radio', { name: 'Liste' }).click();
    await expect(lib.locator('[data-testid="entry-row"]')).toHaveCount(3);
  });

  test('bulk selection and deletion with confirmation', async ({ h }) => {
    await seed(h);
    const lib = await h.context.newPage();
    await lib.goto(h.ext('library/index.html'));
    const cards = lib.locator('[data-testid="entry-card"]');
    await expect(cards).toHaveCount(3);
    await cards.nth(0).getByRole('checkbox').click();
    await cards.nth(1).getByRole('checkbox').click();
    await expect(lib.locator('[data-testid="bulk-bar"]')).toContainText('2 sélectionnées');
    await lib.locator('[data-testid="bulk-delete"]').click();
    await expect(lib.getByRole('alertdialog')).toContainText('Supprimer 2 entrées ?');
    await lib.getByRole('alertdialog').getByRole('button', { name: 'Annuler' }).click();
    await expect(cards).toHaveCount(3);
    await lib.locator('[data-testid="bulk-delete"]').click();
    await lib.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click();
    await expect(cards).toHaveCount(1);
    expect(await libraryEntries(h)).toHaveLength(1);
  });

  test('duplicates are detected and can be resolved', async ({ h }) => {
    const t = threadPosts(3);
    h.serve(path(t[1]!), statusPage('xds', t, t[1]!.id));
    const page = await h.openX(path(t[1]!));
    await ui.openPanel(page);
    await page.locator('threadshelf-root [data-testid="ts-mode-tweet"]').click();
    await page.locator('threadshelf-root [data-testid="ts-save"]').click();
    await waitForEntries(h, 1);
    await page.locator('threadshelf-root [data-testid="ts-mode-thread"]').click();
    await page.locator('threadshelf-root [data-testid="ts-save"]').click();
    await waitForEntries(h, 2);
    const lib = await h.context.newPage();
    await lib.goto(h.ext('library/index.html#/duplicates'));
    await expect(lib.locator('[data-testid="duplicates"]')).toContainText(
      '2 entrées partagent des publications',
    );
    await lib.getByRole('button', { name: 'Garder la plus complète' }).click();
    await expect.poll(async () => (await libraryEntries(h)).map((e) => e.kind)).toEqual(['thread']);
  });

  test('data survives a browser restart', async ({ h }) => {
    await seed(h);
    const dir = h.userDataDir;
    await h.context.close();
    const { context } = await launch(dir);
    await setupRoutes(context, new Map(), { n: 0 });
    const worker = await extensionWorker(context);
    const id = new URL(worker.url()).host;
    const lib = await context.newPage();
    await lib.goto(`chrome-extension://${id}/library/index.html`);
    await expect(lib.locator('[data-testid="entry-card"]')).toHaveCount(3);
    await context.close();
    // The fixture's own teardown closes the (already closed) original context.
    h.context.close = async () => {};
  });
});

test.describe('reader', () => {
  test('editorial view, navigation, theme, copy, note, read state', async ({ h }) => {
    await h.context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { a } = await seed(h);
    const entry = (await libraryEntries(h)).find((e) => e.tweetIds[0] === a[0]!.id)!;
    const r = await h.context.newPage();
    await r.goto(h.ext(`reader/index.html?id=${entry.id}`));
    await expect(r.locator('[data-testid="reader-title"]')).toHaveText(
      'Guide TypeScript avancé : génériques et inférence',
    );
    await expect(r.locator('[data-testid="reader-count"]')).toHaveText('3 publications capturées');
    await expect(r.locator('[data-testid="reader-post"]')).toHaveCount(3);
    await expect(r.getByRole('figure').locator('img')).toHaveAttribute(
      'alt',
      'Diagramme des types',
    );
    await expect(r.getByText('Diagramme des types').first()).toBeVisible();
    // Keyboard: dark theme toggle, font size.
    await r.keyboard.press('t');
    await expect(r.locator('html')).toHaveClass(/dark/);
    // Copy (c) puts Markdown in the clipboard.
    await r.keyboard.press('c');
    await expect.poll(() => r.evaluate(() => navigator.clipboard.readText())).toContain('## 1 / 3');
    const md = await r.evaluate(() => navigator.clipboard.readText());
    expect(md).toContain('# Guide TypeScript avancé : génériques et inférence');
    expect(md).toContain(`https://x.com/ada_dev/status/${a[0]!.id}`);
    // Note autosave.
    await r.locator('[data-testid="reader-note"]').fill('À relire avant la conf');
    await expect(r.getByText('Enregistrée')).toBeVisible({ timeout: 4000 });
    await expect(r.getByTestId('reader-notes-preview')).toContainText('À relire avant la conf');
    await r.getByTestId('reader-notes-preview').click();
    await expect(r.getByTestId('reader-notes-expanded')).toContainText('À relire avant la conf');
    // Reading to the end marks it as read.
    await r.locator('[data-testid="reader-end"]').scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () =>
          (await libraryEntries(h)).find((e) => e.id === entry.id) as unknown as {
            readState: string;
          },
      )
      .toMatchObject({ readState: 'read' });
    // Shortcut help.
    await r.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await r.keyboard.press('?');
    await expect(r.getByRole('dialog', { name: 'Raccourcis clavier' })).toBeVisible();
  });

  test('copy a selection of posts', async ({ h }) => {
    await h.context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { a } = await seed(h);
    const entry = (await libraryEntries(h)).find((e) => e.tweetIds[0] === a[0]!.id)!;
    const r = await h.context.newPage();
    await r.goto(h.ext(`reader/index.html?id=${entry.id}`));
    await r.getByRole('button', { name: 'Copier' }).first().click();
    await r.getByRole('menuitem', { name: 'Copier une sélection…' }).click();
    await r.getByLabel('Sélectionner la publication 2').check();
    await r
      .getByRole('toolbar', { name: 'Copie d’une sélection' })
      .getByRole('button', { name: 'Copier' })
      .click();
    await expect
      .poll(() => r.evaluate(() => navigator.clipboard.readText()))
      .toContain('Partie 2 sur les types conditionnels');
    const md = await r.evaluate(() => navigator.clipboard.readText());
    expect(md).not.toContain('Partie 3');
    expect(md).toContain('1 publication sélectionnée');
  });

  test('shows a clear error for an unknown entry', async ({ h }) => {
    const r = await h.context.newPage();
    await r.goto(h.ext('reader/index.html?id=e_missing'));
    await expect(r.getByText('Entrée introuvable')).toBeVisible();
  });
});

test.describe('exports', () => {
  test('TXT, Markdown, HTML and JSON downloads have the expected content; PDF print view renders', async ({
    h,
  }) => {
    const { a } = await seed(h);
    const entry = (await libraryEntries(h)).find((e) => e.tweetIds[0] === a[0]!.id)!;
    const r = await h.context.newPage();
    await r.goto(h.ext(`reader/index.html?id=${entry.id}`));
    const formats: [RegExp, string, (s: string) => void][] = [
      [
        /^Markdown/,
        '.md',
        (s) => {
          expect(s).toMatch(/^# Guide TypeScript/);
          expect(s).toContain('## 3 / 3');
          expect(s).toContain('![Diagramme des types](https://pbs.twimg.com/media/');
        },
      ],
      [
        /^Texte brut/,
        '.txt',
        (s) => {
          expect(s.split('\n')[0]).toBe('Guide TypeScript avancé : génériques et inférence');
          expect(s).toContain('2/3');
        },
      ],
      [
        /^HTML autonome/,
        '.html',
        (s) => {
          expect(s).toMatch(/^<!doctype html>/);
          expect(s).not.toMatch(/<script/i);
          expect(s).toContain('data:image/png;base64,');
          expect(s).toContain('<div class="num">1 / 3</div>');
        },
      ],
      [
        /^JSON structuré/,
        '.json',
        (s) => {
          const j = JSON.parse(s);
          expect(j.format).toBe('threadshelf.entry');
          expect(j.posts).toHaveLength(3);
        },
      ],
    ];
    // Wait until images are cached so the HTML export can embed them.
    await expect
      .poll(async () => (await libraryEntries(h)).find((e) => e.id === entry.id)!.offline, {
        timeout: 10_000,
      })
      .toBe('full');
    for (const [label, ext, check] of formats) {
      await r.getByRole('button', { name: 'Exporter' }).click();
      await r.getByRole('radio', { name: label }).click();
      const [download] = await Promise.all([
        r.waitForEvent('download'),
        r.locator('[data-testid="export-confirm"]').click(),
      ]);
      expect(download.suggestedFilename()).toMatch(new RegExp(`^threadshelf-ada_dev-.*\\${ext}$`));
      const file = await download.path();
      check(readFileSync(file!, 'utf8'));
    }
    // PDF: the print view hides the chrome and renders to PDF.
    const p = await h.context.newPage();
    await p.goto(h.ext(`reader/index.html?id=${entry.id}`));
    await expect(p.locator('[data-testid="reader-post"]')).toHaveCount(3);
    await p.emulateMedia({ media: 'print' });
    await expect(p.getByRole('button', { name: 'Exporter' })).toBeHidden();
    const pdf = await p.pdf({ format: 'A4' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5_000);
  });

  test('full library backup: export, clear, import restores everything', async ({ h }) => {
    await seed(h);
    const lib = await h.context.newPage();
    await lib.goto(h.ext('library/index.html#/settings'));
    const [download] = await Promise.all([
      lib.waitForEvent('download'),
      lib.locator('[data-testid="backup-export"]').click(),
    ]);
    const file = (await download.path())!;
    const backup = JSON.parse(readFileSync(file, 'utf8'));
    expect(backup.format).toBe('threadshelf.backup');
    expect(backup.data.entries).toHaveLength(3);
    await lib.getByRole('button', { name: /Effacer…/ }).click();
    await lib.getByRole('alertdialog').getByRole('button', { name: 'Tout effacer' }).click();
    await expect.poll(async () => (await libraryEntries(h)).length).toBe(0);
    await lib.locator('[data-testid="backup-import-input"]').setInputFiles(file);
    await expect(lib.locator('[data-testid="import-report"]')).toContainText('3 ajoutée(s)');
    expect(await libraryEntries(h)).toHaveLength(3);
    // Re-import: conflicts, no duplicates.
    await lib.locator('[data-testid="backup-import-input"]').setInputFiles(file);
    await expect(lib.locator('[data-testid="import-report"]')).toContainText('3 conflit(s)');
    expect(await libraryEntries(h)).toHaveLength(3);
    // Malformed file is refused without changes.
    await lib.locator('[data-testid="backup-import-input"]').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"nope"}'),
    });
    await expect(lib.getByText('Import refusé')).toBeVisible();
    expect(await libraryEntries(h)).toHaveLength(3);
  });
});

test.describe('settings and offline', () => {
  test('global disable removes all injected UI; visual injection can be turned off separately', async ({
    h,
  }) => {
    const t = threadPosts(2);
    h.serve(path(t[0]!), statusPage('xds', t, t[0]!.id));
    const page = await h.openX(path(t[0]!));
    await expect(ui.bar(page)).toBeVisible();
    const opts = await h.context.newPage();
    await opts.goto(h.ext('options/index.html'));
    await opts.getByRole('switch', { name: 'Interface dans la page' }).click();
    await expect(ui.bar(page)).toHaveCount(0);
    await expect(page.locator('threadshelf-action')).toHaveCount(0);
    // Without injected UI, saving still works through the popup/shortcut path.
    await page.bringToFront();
    const run = await h.worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return chrome.tabs.sendMessage(tab!.id!, { type: 'content.run', action: 'save-thread' });
    });
    expect(run.ok).toBe(true);
    await opts.getByRole('switch', { name: 'Interface dans la page' }).click();
    await expect(ui.bar(page)).toBeVisible();
    await opts.getByRole('switch', { name: 'Activer ThreadShelf sur X' }).click();
    await expect(ui.bar(page)).toHaveCount(0);
    await page.bringToFront();
    const state = await h.worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return chrome.tabs.sendMessage(tab!.id!, { type: 'content.state' });
    });
    expect(state.active).toBe(false);
    // Per-domain switch: x.com unchecked keeps it off even if globally on.
    await opts.getByRole('switch', { name: 'Activer ThreadShelf sur X' }).click();
    await opts.getByRole('checkbox', { name: 'x.com' }).uncheck();
    await page.reload();
    await page.waitForTimeout(800);
    await expect(ui.bar(page)).toHaveCount(0);
  });

  test('saved threads are readable offline, including cached images', async ({ h }) => {
    const { a } = await seed(h);
    const entry = (await libraryEntries(h)).find((e) => e.tweetIds[0] === a[0]!.id)!;
    await expect
      .poll(async () => (await libraryEntries(h)).find((e) => e.id === entry.id)!.offline, {
        timeout: 10_000,
      })
      .toBe('full');
    await h.context.setOffline(true);
    const r = await h.context.newPage();
    await r.goto(h.ext(`reader/index.html?id=${entry.id}`));
    await expect(r.locator('[data-testid="reader-post"]')).toHaveCount(3);
    await expect(r.getByText('Hors ligne', { exact: true })).toBeVisible();
    const src = await r.getByRole('figure').locator('img').getAttribute('src');
    expect(src).toMatch(/^blob:chrome-extension:\/\//);
    const lib = await h.context.newPage();
    await lib.goto(h.ext('library/index.html'));
    await expect(lib.locator('[data-testid="entry-card"]')).toHaveCount(3);
    await h.context.setOffline(false);
  });
});
