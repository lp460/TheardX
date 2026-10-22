import type { BrowserContext, Page, Worker } from '@playwright/test';
import {
  test,
  expect,
  ui,
  waitForEntries,
  launch,
  setupRoutes,
  extensionWorker,
  libraryEntries,
} from './harness';
import { statusPage, threadPosts } from '../fixtures/x-dom';
import { fakeGitHub, type FakeGitHub } from '../helpers/fake-github';
import { GITHUB_OAUTH_CLIENT_ID } from '../../src/sync/github-app';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
};

/** Serves the in-memory GitHub (device flow + REST API) to a browser context. */
async function routeGitHub(context: BrowserContext, gh: FakeGitHub) {
  await context.route(/^https:\/\/github\.com\/login\/device$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><h1>Device activation</h1></body></html>',
    }),
  );
  await context.route(
    /^https:\/\/(api\.github\.com\/|github\.com\/login\/(device\/code|oauth\/access_token))/,
    async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const res = await gh.fetcher(req.url(), {
        method: req.method(),
        headers: await req.allHeaders(),
        body: req.postData() ?? undefined,
      });
      return route.fulfill({
        status: res.status,
        body: await res.text(),
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    },
  );
}

/** The browser's own "allow access to github.com?" prompt cannot be clicked by automation: answered "yes". */
async function grantGitHub(page: Page, worker: Worker) {
  await page.addInitScript(() => {
    chrome.permissions.request = (async () => true) as typeof chrome.permissions.request;
  });
  await worker.evaluate(() => {
    chrome.permissions.contains = (async () => true) as typeof chrome.permissions.contains;
  });
}

/** « Se connecter avec GitHub » → code shown → the user authorises on GitHub (simulated) → connected. */
async function signIn(page: Page, extUrl: string, gh: FakeGitHub) {
  await page.goto(extUrl);
  await expect(page.locator('[data-testid="sync-settings"]')).toBeVisible();
  // The ThreadShelf GitHub app is built in: no setup step, just the sign-in button.
  await expect(page.locator('[data-testid="sync-app-setup"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="sync-signin"]')).toBeEnabled();
  await page.locator('summary', { hasText: 'Options avancées' }).click();
  await page.getByRole('switch', { name: 'Chiffrer la bibliothèque' }).click();
  await page.locator('[data-testid="sync-passphrase"]').fill('ma phrase secrète');
  await page.locator('[data-testid="sync-signin"]').click();
  await expect(page.locator('[data-testid="sync-user-code"]')).toHaveText('WDJB-MJHT');
  gh.approveAll();
  await expect(page.locator('[data-testid="sync-account"]')).toContainText('@lorry', {
    timeout: 20_000,
  });
  await expect(page.locator('[data-testid="sync-status"]')).toContainText(
    'Dernière synchronisation',
  );
}

test('GitHub sync: sign in with a code, library saved on PC A appears on PC B (encrypted)', async ({
  h,
}) => {
  test.setTimeout(120_000);
  const gh = fakeGitHub({ clientId: GITHUB_OAUTH_CLIENT_ID });
  gh.repoExists = false;
  await routeGitHub(h.context, gh);

  // PC A: save a thread, then sign in.
  const t = threadPosts(3, { text: (i) => `Thread synchronisé, partie ${i + 1}` });
  h.serve(`/ada_dev/status/${t[0]!.id}`, statusPage('xds', t, t[0]!.id));
  const x = await h.openX(`/ada_dev/status/${t[0]!.id}`);
  await ui.barButton(x, /Enregistrer le thread/).click();
  await waitForEntries(h, 1);
  const optsA = await h.context.newPage();
  await grantGitHub(optsA, h.worker);
  await signIn(optsA, h.ext('options/index.html'), gh);
  expect(gh.reposCreated).toBe(1);
  expect(gh.repoPrivate).toBe(true);
  expect(gh.commits).toBe(1);
  const raw = gh.rawText('threadshelf/library.json')!;
  expect(raw).toContain('threadshelf.encrypted');
  expect(raw).not.toContain('Thread synchronisé');

  // PC B: another browser profile, same GitHub account.
  const b = await launch();
  try {
    await setupRoutes(b.context, new Map(), { n: 0 });
    await routeGitHub(b.context, gh);
    const workerB = await extensionWorker(b.context);
    const idB = new URL(workerB.url()).host;
    const optsB = await b.context.newPage();
    await grantGitHub(optsB, workerB);
    await signIn(optsB, `chrome-extension://${idB}/options/index.html`, gh);
    expect(gh.reposCreated).toBe(1); // found, not created again
    await expect(optsB.locator('[data-testid="sync-status"]')).toContainText('1 ajoutée(s)');
    const lib = await b.context.newPage();
    await lib.goto(`chrome-extension://${idB}/library/index.html`);
    await expect(lib.locator('[data-testid="entry-card"]')).toHaveCount(1);
    await expect(lib.locator('[data-testid="entry-card"]')).toContainText(
      'Thread synchronisé, partie 1',
    );

    // Deleting on B, then syncing both, removes it on A too.
    await lib
      .locator('[data-testid="entry-card"]')
      .getByRole('button', { name: 'Plus d’actions' })
      .click();
    await lib.getByRole('menuitem', { name: 'Supprimer…' }).click();
    await lib.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click();
    await expect(lib.locator('[data-testid="entry-card"]')).toHaveCount(0);
    await optsB.locator('[data-testid="sync-now"]').click();
    await expect(optsB.locator('[data-testid="sync-status"]')).toContainText('envoyée');
    await optsA.locator('[data-testid="sync-now"]').click();
    await expect(optsA.locator('[data-testid="sync-status"]')).toContainText('1 supprimée(s)');
    expect(await libraryEntries(h)).toHaveLength(0);

    // Sign out keeps the local library.
    await optsB.locator('[data-testid="sync-disconnect"]').click();
    await expect(optsB.locator('[data-testid="sync-signin"]')).toBeVisible();
  } finally {
    await b.context.close();
  }
});
