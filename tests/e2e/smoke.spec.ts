import { test, expect, ui, waitForEntries } from './harness';
import { statusPage, threadPosts, replies } from '../fixtures/x-dom';

test('extension loads and detects a post on a fixture page', async ({ h }) => {
  const t = threadPosts(3);
  h.serve(
    `/ada_dev/status/${t[0]!.id}`,
    statusPage('xds', [...t, ...replies(2, 'ada_dev')], t[0]!.id),
  );
  const page = await h.openX(`/ada_dev/status/${t[0]!.id}`);
  await expect(ui.bar(page)).toBeVisible();
  await expect(ui.bar(page)).toContainText('3 publications');
  await ui.barButton(page, /Enregistrer le thread/).click();
  await expect(ui.toast(page)).toContainText('Thread enregistré — 3 publications');
  const entries = await waitForEntries(h, 1);
  expect(entries[0]!.tweetIds).toEqual(t.map((p) => p.id));
});
