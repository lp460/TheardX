import type { EntryBundle, Tweet } from '@/types/model';
import { segmentsToPlain } from '@/utils/text';
import { articleToText, textIsOnlyArticleLink } from './article';
import {
  commentLevel,
  dayString,
  mediaLabel,
  redditMeta,
  who,
  withoutRepeatedTitle,
  type ExportOptions,
} from './model';
import { toView } from './model';

function postText(t: Tweet, opts: ExportOptions): string {
  const parts: string[] = [];
  // Links are written as their full destination URL (the page shows a shortened form).
  const text = textIsOnlyArticleLink(t)
    ? ''
    : t.text.map((s) => (s.t === 'link' ? s.href : s.v)).join('');
  if (text) parts.push(text);
  if (t.article) parts.push(articleToText(t.article, opts.includeUrls !== false));
  for (const m of t.media) {
    if (m.kind === 'photo')
      parts.push(
        `[Image${m.alt ? ` : ${m.alt}` : ''}] ${opts.includeUrls !== false ? m.url : ''}`.trim(),
      );
    else parts.push(`[${mediaLabel(m.kind)}] ${m.playbackUrl ?? t.url}`);
  }
  if (t.card && (!t.article || t.article.inline))
    parts.push(`[Lien] ${t.card.title ? `${t.card.title} — ` : ''}${t.card.url}`);
  if (t.quoted) {
    const who = t.quoted.author ? `@${t.quoted.author.handle}` : 'publication citée';
    parts.push(
      `« Citation de ${who} : ${t.quoted.text ? segmentsToPlain(t.quoted.text) : '(contenu non disponible)'} »${t.quoted.url ? ` ${t.quoted.url}` : ''}`,
    );
  }
  if (opts.includeUrls !== false) parts.push(t.url);
  return parts.join('\n\n');
}

export function toPlainText(b: EntryBundle, opts: ExportOptions = {}): string {
  const v = toView(b, opts);
  const out: string[] = [];
  out.push(v.title || `Publication de ${who(v.author.handle, v.platform)}`);
  out.push(
    `${v.author.name ? `${v.author.name} ` : ''}${who(v.author.handle, v.platform)}${v.publishedAt ? ` — ${dayString(v.publishedAt)}` : ''}`,
  );
  out.push(`Source : ${v.sourceUrl}`);
  out.push(v.statusLine);
  const total = v.posts.length;
  if (v.platform === 'reddit') {
    // Comments are indented by depth, like on Reddit.
    for (const raw of v.posts) {
      const t = withoutRepeatedTitle(raw, v.title);
      const pad = '    '.repeat(commentLevel(t));
      const body = `${redditMeta(t)}\n${postText(t, opts)}`;
      out.push(
        '',
        body
          .split('\n')
          .map((l) => (l ? pad + l : ''))
          .join('\n'),
      );
    }
  } else
    v.posts.forEach((t, i) => {
      out.push('', total > 1 ? `${i + 1}/${total}` : '—', postText(t, opts));
    });
  if (v.references.length) {
    out.push('', 'Références :');
    for (const r of v.references) out.push('', `@${r.author.handle}`, postText(r, opts));
  }
  if (v.note.trim()) out.push('', 'Note :', v.note.trim());
  return out.join('\n').trim() + '\n';
}

/** Compact copy of a single post (no header). */
export function tweetToPlainText(t: Tweet, includeUrl = true): string {
  return postText(t, { includeUrls: includeUrl }).trim();
}
