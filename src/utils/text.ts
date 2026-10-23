import type { Segment, Tweet } from '@/types/model';

/** Lower-case, strip diacritics and collapse whitespace — used for search. */
export function fold(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function segmentsToPlain(segments: Segment[]): string {
  return segments.map((s) => s.v).join('');
}

export function tweetPlainText(tweet: Pick<Tweet, 'text'>): string {
  return segmentsToPlain(tweet.text);
}

/** Plain text of an X Article (title + blocks), for search and previews. */
export function articlePlainText(article: NonNullable<Tweet['article']>): string {
  const parts: string[] = article.title ? [article.title] : [];
  for (const b of article.blocks) {
    if (b.t === 'heading' || b.t === 'paragraph' || b.t === 'quote')
      parts.push(segmentsToPlain(b.text));
    else if (b.t === 'list') parts.push(...b.items.map(segmentsToPlain));
    else if (b.t === 'code') parts.push(b.code);
    else if (b.t === 'image' && b.media.alt) parts.push(b.media.alt);
  }
  return parts.join('\n');
}

/** Text that best represents a post: its own text, or its Article when the text is only a link. */
export function postPreviewText(tweet: Pick<Tweet, 'text' | 'article'>): string {
  const own = segmentsToPlain(tweet.text).trim();
  const onlyLink =
    tweet.text.length > 0 &&
    tweet.text.every((s) => s.t === 'link' || (s.t === 'text' && !s.v.trim()));
  if (tweet.article && (!own || onlyLink)) return articlePlainText(tweet.article);
  return own;
}

/** Merges adjacent text segments and trims trailing whitespace at the very end. */
export function compactSegments(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    if (seg.t === 'text' && seg.v === '') continue;
    const prev = out[out.length - 1];
    if (seg.t === 'text' && prev?.t === 'text' && !!prev.b === !!seg.b && !!prev.i === !!seg.i) {
      out[out.length - 1] = { ...prev, v: prev.v + seg.v };
    } else {
      out.push(seg);
    }
  }
  // Trim leading/trailing whitespace of the whole text.
  const first = out[0];
  if (first?.t === 'text') out[0] = { ...first, v: first.v.replace(/^\s+/, '') };
  const last = out[out.length - 1];
  if (last?.t === 'text') out[out.length - 1] = { ...last, v: last.v.replace(/\s+$/, '') };
  return out.filter((s) => !(s.t === 'text' && s.v === ''));
}

/** First meaningful line of a post, for titles. */
export function deriveTitle(text: string, max = 90): string {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.replace(/[\p{P}\p{S}\s]/gu, '').length > 0);
  if (!line) return '';
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '') + '…';
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : input.slice(0, max - 1).trimEnd() + '…';
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Author as written on its site: « @handle » on X, « u/name » on Reddit. */
export function authorLabel(tweet: Pick<Tweet, 'author' | 'platform'>): string {
  return tweet.platform === 'reddit' ? `u/${tweet.author.handle}` : `@${tweet.author.handle}`;
}

/** Fallback titles, replaced by a better one when the entry is updated. */
export const GENERIC_TITLE_RE = /^(Publication de @|Post de u\/|Commentaire de u\/)/;

/** Title of a new entry: Article / Reddit post title, else the first line, else a generic label. */
export function autoEntryTitle(first: Tweet): string {
  const generic =
    first.platform === 'reddit'
      ? `${first.reddit?.kind === 'comment' ? 'Commentaire' : 'Post'} de u/${first.author.handle}`
      : `Publication de @${first.author.handle}`;
  return first.article?.title?.trim() || deriveTitle(postPreviewText(first)) || generic;
}

/** Author of an entry as written on its site. */
export function entryAuthorLabel(entry: {
  authorHandle: string;
  platform?: Tweet['platform'];
}): string {
  return entry.platform === 'reddit' ? `u/${entry.authorHandle}` : `@${entry.authorHandle}`;
}
