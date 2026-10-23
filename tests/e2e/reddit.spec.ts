import { test, expect, ui, waitForEntries, redditGrantedDist } from './harness';
import {
  DISCUSSION_COMMENTS,
  DISCUSSION_POST,
  redditCommentHtml,
  redditPostPage,
} from '../fixtures/reddit-dom';

const PATH = '/r/AskHistorians/comments/1xb56ky/what_was_the_deal/';

test.describe('Reddit (fixtures reproducing www.reddit.com, not the live site)', () => {
  test.use({ extensionDir: redditGrantedDist() });

  test('save a discussion, follow « more replies », read it with the comment tree', async ({
    h,
  }) => {
    h.serve(PATH, redditPostPage(DISCUSSION_POST, DISCUSSION_COMMENTS));
    const page = await h.openReddit(PATH);

    // Bar under the post, a button on the post and on every comment.
    await expect(ui.bar(page)).toContainText('6 messages · incomplet');
    await expect(ui.postButton(page, 't3_1xb56ky')).toBeVisible();
    await expect(ui.postButton(page, 't1_qq1')).toBeVisible();
    await expect(page.locator('threadshelf-action[data-ts-id="t3_1xb56ky"]')).toHaveAttribute(
      'slot',
      'action-row-whitespace',
    );

    await ui.barButton(page, /Enregistrer la discussion/).click();
    await expect(ui.toast(page).first()).toContainText(
      '6 messages enregistrés — des commentaires restent à charger',
    );
    let [e] = await waitForEntries(h, 1);
    expect(e).toMatchObject({ platform: 'reddit', kind: 'thread', title: DISCUSSION_POST.title });
    expect(e!.tweetIds).toHaveLength(6);

    // « 3 more replies » is expanded: Reddit inserts the replies and removes the control.
    await page.evaluate(
      ({ html }) => {
        const more = document.querySelector('faceplate-partial[src*="/more-comments/"]')!;
        more.insertAdjacentHTML('beforebegin', html);
        more.remove();
      },
      {
        html: redditCommentHtml(
          { id: 'late1', author: 'latecomer', body: '<p>A late reply.</p>' },
          { id: DISCUSSION_POST.id, subreddit: DISCUSSION_POST.subreddit },
          2,
          1,
          't1_19rhkyxlp7mox',
        ),
      },
    );
    await expect(ui.bar(page)).toContainText('7 messages', { timeout: 8000 });
    await expect
      .poll(async () => (await waitForEntries(h, 1))[0]!.tweetIds.length, { timeout: 10_000 })
      .toBe(7);
    [e] = await waitForEntries(h, 1);
    expect(e!.completeness.status).toBe('complete');
    expect(e!.tweetIds.indexOf('t1_late1')).toBe(e!.tweetIds.indexOf('t1_qq1') + 1);

    // Reader: title once, the post, then the comments indented by depth.
    const r = await h.context.newPage();
    await r.goto(h.ext(`reader/index.html?id=${e!.id}`));
    await expect(r.getByTestId('reader-title')).toHaveText(DISCUSSION_POST.title);
    await expect(r.getByTestId('reader-post')).toHaveCount(7);
    await expect(r.getByTestId('reader-count')).toHaveText('7 messages');
    await expect(r.getByRole('link', { name: 'r/AskHistorians' }).first()).toBeVisible();
    const op = r.locator('[data-testid="reader-post"][data-depth="2"]').first();
    await expect(op).toContainText('u/ExternalBoysenberry');
    await expect(op).toContainText('OP');
    expect(await op.evaluate((el) => getComputedStyle(el).marginLeft)).toBe('36px');
    await expect(r.getByRole('link', { name: /Voir sur Reddit/ })).toBeVisible();
    await expect(r.locator('body')).not.toContainText('Voir sur X');
    await r.screenshot({ path: 'artifacts/screenshots/light-reader-reddit.png', fullPage: true });

    // Library: source filter and Reddit labels.
    const lib = await h.context.newPage();
    await lib.goto(h.ext('library/index.html'));
    await expect(lib.getByTestId('filter-platform')).toBeVisible();
    await expect(lib.locator('body')).toContainText('r/AskHistorians · u/ExternalBoysenberry');
    await expect(lib.locator('body')).toContainText('7 messages');
  });

  test('menu wording and single comment save', async ({ h }) => {
    h.serve(PATH, redditPostPage(DISCUSSION_POST, DISCUSSION_COMMENTS));
    const page = await h.openReddit(PATH);
    await ui.postButton(page, 't1_qq1').click();
    await expect(ui.menu(page)).toContainText('u/ExternalBoysenberry');
    await expect(ui.menuItem(page, 'save-thread')).toContainText('Enregistrer la discussion');
    await expect(ui.menuItem(page, 'save-references')).toHaveCount(0);
    await ui.menuItem(page, 'save-tweet').click();
    await expect(ui.toast(page).first()).toContainText('Message enregistré');
    const [e] = await waitForEntries(h, 1);
    expect(e).toMatchObject({ kind: 'tweet', tweetIds: ['t1_qq1'] });
    expect(e!.contextTweetIds).toEqual(['t3_1xb56ky', 't1_19rhkvwj72ld1', 't1_19rhkyxlp7mox']);
  });
});

test('settings offer to turn Reddit on (optional permission)', async ({ h }) => {
  const opts = await h.context.newPage();
  await opts.goto(h.ext('options/index.html'));
  const sw = opts.getByRole('switch', { name: 'Activer ThreadShelf sur Reddit' });
  await expect(sw).toBeVisible();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
});
