import type { EntryBundle } from '@/types/model';
import { toHtml } from './html';
import { toJson } from './json';
import { toMarkdown } from './markdown';
import type { ExportOptions } from './model';
import { toPlainText } from './text';

export type ExportFormat = 'markdown' | 'text' | 'html' | 'json';

export { toHtml, toJson, toMarkdown, toPlainText };
export type { ExportOptions };

export const FORMAT_META: Record<ExportFormat, { ext: string; mime: string; label: string }> = {
  markdown: { ext: 'md', mime: 'text/markdown;charset=utf-8', label: 'Markdown' },
  text: { ext: 'txt', mime: 'text/plain;charset=utf-8', label: 'Texte brut' },
  html: { ext: 'html', mime: 'text/html;charset=utf-8', label: 'HTML autonome' },
  json: { ext: 'json', mime: 'application/json;charset=utf-8', label: 'JSON structuré' },
};

export function render(
  format: ExportFormat,
  bundle: EntryBundle,
  opts: ExportOptions = {},
): string {
  switch (format) {
    case 'markdown':
      return toMarkdown(bundle, opts);
    case 'text':
      return toPlainText(bundle, opts);
    case 'html':
      return toHtml(bundle, opts);
    case 'json':
      return toJson(bundle);
  }
}

/** Safe, readable file name: "threadshelf-ada_dev-2026-07-21-first-words.md". */
export function exportFileName(bundle: EntryBundle, format: ExportFormat | 'pdf'): string {
  const slug = bundle.entry.title
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const day = (bundle.entry.publishedAt ?? new Date(bundle.entry.savedAt).toISOString()).slice(
    0,
    10,
  );
  const ext = format === 'pdf' ? 'pdf' : FORMAT_META[format].ext;
  return `threadshelf-${bundle.entry.authorHandle}-${day}${slug ? `-${slug}` : ''}.${ext}`;
}
