import { test, expect, ui, waitForEntries } from './harness';
import { statusPage } from '../fixtures/x-dom';
import { ARTICLE_POST } from '../fixtures/article';

test('personal passage comments survive a reader reload and can be resolved and deleted', async ({ h }) => {
  const path = `/make_claude/status/${ARTICLE_POST.id}`;
  h.serve(path, statusPage('xds', [ARTICLE_POST], ARTICLE_POST.id));
  const page = await h.openX(path);
  await ui.barButton(page, /Enregistrer le thread/).click();
  const [entry] = await waitForEntries(h, 1);
  const reader = await h.context.newPage();
  await reader.goto(h.ext(`reader/index.html?id=${entry!.id}`));
  const phrase = reader.getByTestId('article-view').getByText('Jev en commande shell');
  await expect(phrase).toBeVisible();
  // A real user scrolls to the passage before selecting it; make the headless
  // click exercise the same visible selection instead of an off-screen range.
  await phrase.scrollIntoViewIfNeeded();
  await phrase.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await expect(reader.getByRole('button', { name: 'Commenter' })).toBeVisible();
  await reader.getByRole('button', { name: 'Commenter' }).click({ timeout: 10_000 });
  await reader.getByRole('textbox', { name: 'Commentaire personnel' }).fill('À examiner pour Hermes');
  await reader.getByRole('button', { name: 'Enregistrer' }).click({ timeout: 10_000 });
  await expect(reader.getByTestId('reader-annotations-panel')).toContainText('À examiner pour Hermes');
  await expect(reader.getByTestId('reader-annotations-panel')).toContainText('Jev en commande shell');
  await reader.reload();
  await reader.getByTestId('reader-annotations').click({ timeout: 10_000 });
  const panel = reader.getByTestId('reader-annotations-panel');
  await expect(panel).toContainText('À examiner pour Hermes');
  await panel.getByTitle('Résoudre').click({ timeout: 10_000 });
  await expect(panel).toContainText('Résolu');
  reader.once('dialog', (dialog) => void dialog.accept());
  await panel.getByTitle('Supprimer').click({ timeout: 10_000 });
  await expect(panel).toContainText('Mes annotations (0)');
});
