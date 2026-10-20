import { toast } from '@/components/ToastNotification';
import { render } from '@/export';
import { repository } from '@/storage/repository';
import { copyText } from '@/utils/clipboard';
import { loadSettings } from '@/settings/store';

export function readerUrl(id: string, print = false): string {
  const path = `reader/index.html?id=${encodeURIComponent(id)}${print ? '&print=1' : ''}`;
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL(path)
    : `/${path}`;
}

export function openReader(id: string, newTab = false): void {
  if (newTab) window.open(readerUrl(id), '_blank', 'noopener');
  else location.href = readerUrl(id);
}

export async function copyEntry(
  id: string,
  format?: 'markdown' | 'text',
  tweetIds?: string[],
): Promise<void> {
  try {
    const settings = await loadSettings();
    const bundle = await repository.getBundle(id);
    if (!bundle) throw new Error('Entrée introuvable.');
    const f = format ?? settings.copy.format;
    await copyText(render(f, bundle, { includeUrls: settings.copy.includeUrls, tweetIds }));
    toast.success(
      f === 'markdown' ? 'Copié en Markdown' : 'Copié en texte brut',
      `${tweetIds?.length ?? bundle.entry.tweetIds.length} publication(s)`,
    );
  } catch (e) {
    toast.error('Copie impossible', e instanceof Error ? e.message : String(e));
  }
}

export async function safely<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    toast.error(label, e instanceof Error ? e.message : String(e));
    return undefined;
  }
}
