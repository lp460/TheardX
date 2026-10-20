/** Copies text, with a fallback for contexts where the async Clipboard API is refused. */
export async function copyText(text: string, html?: string): Promise<void> {
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
      return;
    }
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fallback below.
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
  (document.body ?? document.documentElement).appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('Copie refusée par le navigateur.');
}
