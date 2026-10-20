/**
 * Captures screenshots of every surface (light + dark) into artifacts/screenshots for visual review.
 * Assertions here only check that the screens render; the images are inspected manually.
 */
import { test, expect, ui, waitForEntries } from './harness';
import { statusPage, threadPosts, replies, type PostSpec } from '../fixtures/x-dom';

const SHOTS = 'artifacts/screenshots';

function richThread(): PostSpec[] {
  const texts = [
    'Comment nous avons divisé par 5 le temps de build de notre monorepo — un thread 🧵\n\nTout a commencé par une mesure honnête : https://example.com/blog/build-times-deep-dive #performance',
    'D’abord, mesurer. Sans profil, on optimise au hasard. Nous avons activé les traces de @vite_js et regardé où partait le temps.',
    'Résultat : 62 % du temps passait dans la transformation TypeScript. La correction a été simple.',
    'Ensuite, le cache. Un cache distant partagé entre la CI et les postes a supprimé 80 % des reconstructions.',
    'Enfin, découper : les paquets rarement modifiés sont précompilés une fois par semaine.',
    'Bilan : 11 min → 2 min 10 en CI. Le détail complet et les scripts sont dans l’article. Merci d’avoir lu !',
  ];
  const t = threadPosts(texts.length, { handle: 'ada_dev', text: (i) => texts[i]! });
  t[2] = {
    ...t[2]!,
    photos: [{ alt: 'Graphique : répartition du temps de build avant et après', w: 1600, h: 900 }],
  };
  t[3] = {
    ...t[3]!,
    quote: {
      id: '2070000000000000001',
      handle: 'grace_ops',
      name: 'Grace Ops',
      text: 'Un cache distant bien configuré est le meilleur investissement CI que vous ferez cette année.',
    },
  };
  t[5] = {
    ...t[5]!,
    card: {
      url: 'https://example.com/blog',
      title: 'Diviser par 5 le temps de build : retour d’expérience',
      domain: 'example.com',
    },
  };
  return t.map((p) => ({ ...p, name: 'Ada Lovelace', verified: true }));
}

for (const scheme of ['light', 'dark'] as const) {
  test(`screens — ${scheme}`, async ({ h }) => {
    const t = richThread();
    const html = statusPage('xds', [...t, ...replies(2, 'ada_dev')], t[0]!.id)
      .replace('data-theme="light"', `data-theme="${scheme}"`)
      .replace(
        'background:#fff;color:#0f1419',
        scheme === 'dark' ? 'background:#000;color:#e7e9ea' : 'background:#fff;color:#0f1419',
      );
    h.serve(`/ada_dev/status/${t[0]!.id}`, html);
    const page = await h.openX(`/ada_dev/status/${t[0]!.id}`);
    await page.emulateMedia({ colorScheme: scheme });
    await expect(ui.bar(page)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/${scheme}-x-inline-bar.png` });
    await ui.barButton(page, /Plus d’options/).click();
    await expect(ui.panel(page)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/${scheme}-x-panel.png` });
    await page.locator('threadshelf-root [data-testid="ts-save"]').click();
    await expect(ui.toast(page)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/${scheme}-x-saved-toast.png` });
    const [entry] = await waitForEntries(h, 1);

    // A second, incomplete thread so the library shows several states.
    const u = threadPosts(8, {
      handle: 'grace_ops',
      startId: 2079610838143700000n,
      text: (i) => `Notes sur Kubernetes, partie ${i + 1} : réseau, stockage et observabilité.`,
    }).slice(0, 4);
    h.serve(`/grace_ops/status/${u[0]!.id}`, statusPage('xds', u, u[0]!.id));
    await page.goto(`https://x.com/grace_ops/status/${u[0]!.id}`);
    await ui.barButton(page, /Enregistrer le thread/).click();
    await waitForEntries(h, 2);

    const lib = await h.context.newPage();
    await lib.setViewportSize({ width: 1360, height: 860 });
    await lib.emulateMedia({ colorScheme: scheme });
    await lib.goto(h.ext('library/index.html'));
    await expect(lib.locator('[data-testid="entry-card"]')).toHaveCount(2);
    await lib.waitForTimeout(400);
    await lib.screenshot({ path: `${SHOTS}/${scheme}-library-cards.png` });
    await lib.getByRole('radio', { name: 'Liste' }).click();
    await lib.screenshot({ path: `${SHOTS}/${scheme}-library-list.png` });
    await lib.getByRole('radio', { name: 'Cartes' }).click();
    await lib.keyboard.press('Meta+k');
    await lib.locator('[data-testid="command-input"]').fill('cache');
    await lib.waitForTimeout(200);
    await lib.screenshot({ path: `${SHOTS}/${scheme}-library-command.png` });
    await lib.keyboard.press('Escape');
    await lib.goto(h.ext('library/index.html#/settings'));
    await expect(lib.locator('[data-testid="settings-panel"]')).toBeVisible();
    await lib.screenshot({ path: `${SHOTS}/${scheme}-settings.png`, fullPage: true });

    const reader = await h.context.newPage();
    await reader.setViewportSize({ width: 1360, height: 900 });
    await reader.emulateMedia({ colorScheme: scheme });
    await reader.goto(h.ext(`reader/index.html?id=${entry!.id}`));
    await expect(reader.locator('[data-testid="reader-post"]')).toHaveCount(6);
    await reader.waitForTimeout(500);
    await reader.screenshot({ path: `${SHOTS}/${scheme}-reader-top.png` });
    await reader.locator('#post-3').scrollIntoViewIfNeeded();
    await reader.waitForTimeout(300);
    await reader.screenshot({ path: `${SHOTS}/${scheme}-reader-media.png` });

    const popup = await h.context.newPage();
    await popup.setViewportSize({ width: 360, height: 560 });
    await popup.emulateMedia({ colorScheme: scheme });
    await popup.goto(h.ext('popup/index.html'));
    await expect(popup.locator('[data-testid="popup-recent"] li').first()).toBeVisible();
    await popup.waitForTimeout(300);
    await popup.screenshot({ path: `${SHOTS}/${scheme}-popup.png` });
  });
}
