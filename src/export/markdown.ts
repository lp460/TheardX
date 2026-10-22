import type { EntryBundle, Segment, Tweet } from '@/types/model';
import { cashtagUrl, hashtagUrl, linkLabel, profileUrl, safeHref } from '@/utils/url';
import { articleToMarkdown, textIsOnlyArticleLink } from './article';
import { dayString, mediaLabel, toView, type ExportOptions } from './model';

/** Escapes characters that would change Markdown rendering. */
export function escapeMarkdown(input: string): string {
  return input
    .replace(/([\\`*_[\]<>|~])/g, '\\$1')
    .replace(/^(\s*)([#>+-])(?=\s)/gm, '$1\\$2')
    .replace(/^(\s*)(\d+)\.(?=\s)/gm, '$1$2\\.');
}

function escapeLinkText(input: string): string {
  return input.replace(/([\\[\]])/g, '\\$1');
}

function mdUrl(url: string): string {
  return url.replace(/[()\s]/g, (c) => encodeURIComponent(c));
}

export function segmentsToMarkdown(segments: Segment[]): string {
  const raw = segments
    .map((s) => {
      switch (s.t) {
        case 'text': {
          const v = escapeMarkdown(s.v);
          if (!s.b && !s.i) return v;
          // Keep surrounding spaces outside the markers: "**bold** text", not "**bold **text".
          const mark = s.b && s.i ? '***' : s.b ? '**' : '*';
          const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v)!;
          return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : v;
        }
        case 'link': {
          const href = safeHref(s.href);
          return href
            ? `[${escapeLinkText(linkLabel(s.v, href))}](${mdUrl(href)})`
            : escapeMarkdown(s.v);
        }
        case 'mention':
          return `[${escapeLinkText(s.v)}](${profileUrl(s.handle)})`;
        case 'hashtag':
          return `[${escapeLinkText(s.v)}](${hashtagUrl(s.tag)})`;
        case 'cashtag':
          return `[${escapeLinkText(s.v)}](${mdUrl(cashtagUrl(s.tag))})`;
      }
    })
    .join('');
  // Paragraphs stay paragraphs; single line breaks become hard breaks.
  return raw
    .split(/\n{2,}/)
    .map((p) => p.split('\n').join('  \n'))
    .join('\n\n');
}

function postBody(t: Tweet, opts: ExportOptions): string {
  const parts: string[] = [];
  const text = textIsOnlyArticleLink(t) ? '' : segmentsToMarkdown(t.text);
  if (text) parts.push(text);
  if (t.article)
    parts.push(articleToMarkdown(t.article, segmentsToMarkdown, escapeMarkdown, mdUrl));
  if (t.textTruncated) parts.push('_(texte tronqué sur la page au moment de la capture)_');
  for (const m of t.media) {
    if (m.kind === 'photo')
      parts.push(
        `![${escapeLinkText(m.alt ?? '')}](${mdUrl(m.url)})${m.alt ? `\n*${escapeMarkdown(m.alt)}*` : ''}`,
      );
    else parts.push(`[${mediaLabel(m.kind)} — voir sur X](${mdUrl(m.playbackUrl ?? t.url)})`);
  }
  if (t.card && !t.article)
    parts.push(
      `> 🔗 [${escapeLinkText(t.card.title ?? t.card.domain ?? t.card.url)}](${mdUrl(t.card.url)})${t.card.domain ? ` — ${escapeMarkdown(t.card.domain)}` : ''}`,
    );
  if (t.quoted) {
    const q = t.quoted;
    const who = q.author ? `@${q.author.handle}` : 'publication citée';
    const body = q.text
      ? segmentsToMarkdown(q.text)
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n')
      : '> _(contenu non disponible)_';
    parts.push(
      `> **Citation — ${escapeMarkdown(who)}**${q.url ? ` · [source](${mdUrl(q.url)})` : ''}\n>\n${body}`,
    );
  }
  if (opts.includeUrls !== false) parts.push(`[Voir la publication](${t.url})`);
  return parts.join('\n\n');
}

export function toMarkdown(b: EntryBundle, opts: ExportOptions = {}): string {
  const v = toView(b, opts);
  const lines: string[] = [];
  lines.push(`# ${escapeMarkdown(v.title || `Publication de @${v.author.handle}`)}`, '');
  lines.push(
    `Auteur : ${v.author.name ? `${escapeMarkdown(v.author.name)} ` : ''}[@${v.author.handle}](${profileUrl(v.author.handle)})  `,
  );
  lines.push(`Source : ${v.sourceUrl}  `);
  if (v.publishedAt) lines.push(`Publié le : ${dayString(v.publishedAt)}  `);
  lines.push(`Capture : ${v.statusLine}`);
  if (v.incomplete) lines.push('', '> ⚠️ Le thread n’a pas pu être vérifié comme complet.');
  if (v.context.length) {
    lines.push('', '---', '', '**En réponse à :**', '');
    for (const c of v.context)
      lines.push(
        `> **@${c.author.handle}** — ${segmentsToMarkdown(c.text).split('\n').join('\n> ')}`,
        `> [source](${c.url})`,
      );
  }
  const total = v.posts.length;
  v.posts.forEach((t, i) => {
    lines.push('', total > 1 ? `## ${i + 1} / ${total}` : '## Publication', '');
    if (t.author.handle.toLowerCase() !== v.author.handle.toLowerCase())
      lines.push(`**@${t.author.handle}**`, '');
    lines.push(postBody(t, opts));
  });
  if (v.references.length) {
    lines.push('', '## Références', '');
    for (const r of v.references)
      lines.push(
        `### @${r.author.handle}${r.createdAt ? ` — ${dayString(r.createdAt)}` : ''}`,
        '',
        postBody(r, opts),
        '',
      );
  }
  if (v.note.trim()) lines.push('', '## Note personnelle', '', escapeMarkdown(v.note.trim()));
  if (v.tags.length) lines.push('', `Tags : ${v.tags.map((t) => `#${t}`).join(' ')}`);
  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}
