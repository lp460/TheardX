import type { EntryBundle, Platform, Tweet } from '@/types/model';
import { redditUserUrl } from '@/utils/reddit-url';
import { profileUrl } from '@/utils/url';
import { vocab } from '@/utils/vocab';

export interface ExportOptions {
  /** Add the URL of each post. */
  includeUrls?: boolean;
  /** Only these posts (copy a selection). Defaults to every post of the entry. */
  tweetIds?: string[];
  /** Include the quoted / linked posts captured with the entry. */
  includeReferences?: boolean;
  /** Include the context post the thread replies to. */
  includeContext?: boolean;
  /** HTML: embed cached images as data: URIs (offline-ready file). */
  embedImages?: boolean;
  /** HTML: data: URIs for cached media, keyed by remote URL. */
  dataUris?: Record<string, string>;
}

export interface ExportView {
  platform: Platform;
  title: string;
  author: { handle: string; name?: string };
  sourceUrl: string;
  publishedAt?: string;
  savedAt: number;
  statusLine: string;
  incomplete: boolean;
  posts: Tweet[];
  context: Tweet[];
  references: Tweet[];
  note: string;
  tags: string[];
}

export function statusLine(b: EntryBundle, count: number): { line: string; incomplete: boolean } {
  const c = b.entry.completeness;
  if (b.entry.platform === 'reddit') {
    const n = vocab('reddit').posts(count);
    if (c.status === 'manual') return { line: `${n} — sélection`, incomplete: false };
    if (b.entry.kind !== 'thread') return { line: n, incomplete: false };
    return c.status === 'complete'
      ? { line: `${n} — tous les commentaires chargés`, incomplete: false }
      : { line: `${n} — des commentaires n’étaient pas chargés`, incomplete: true };
  }
  const posts = `${count} publication${count > 1 ? 's' : ''}`;
  switch (c.status) {
    case 'complete':
      return { line: `${posts} — thread complet vérifié`, incomplete: false };
    case 'partial':
      return {
        line: `${posts} capturée${count > 1 ? 's' : ''} — thread partiel`,
        incomplete: true,
      };
    case 'needs_more':
      return {
        line: `${posts} capturée${count > 1 ? 's' : ''} — thread potentiellement incomplet`,
        incomplete: true,
      };
    case 'unreconstructable':
      return { line: `${posts} — structure du thread non vérifiable`, incomplete: true };
    case 'manual':
      return { line: `${posts} — sélection manuelle`, incomplete: false };
    default:
      return { line: posts, incomplete: false };
  }
}

export function toView(b: EntryBundle, opts: ExportOptions = {}): ExportView {
  const ids = opts.tweetIds?.length
    ? b.entry.tweetIds.filter((id) => opts.tweetIds!.includes(id))
    : b.entry.tweetIds;
  const posts = ids.map((id) => b.tweets[id]).filter((t): t is Tweet => !!t);
  const first = posts[0];
  const { line, incomplete } = statusLine(b, posts.length);
  const platform = b.entry.platform ?? 'x';
  const view: ExportView = {
    platform,
    title: b.entry.title,
    author: {
      handle: b.entry.authorHandle,
      ...(b.entry.authorName ? { name: b.entry.authorName } : {}),
    },
    sourceUrl: first?.url ?? b.entry.sourceUrl,
    savedAt: b.entry.savedAt,
    statusLine: opts.tweetIds?.length
      ? platform === 'reddit'
        ? `${vocab(platform).posts(posts.length)} sélectionné${posts.length > 1 ? 's' : ''}`
        : `${posts.length} publication${posts.length > 1 ? 's' : ''} sélectionnée${posts.length > 1 ? 's' : ''}`
      : line,
    incomplete: opts.tweetIds?.length ? false : incomplete,
    posts,
    context:
      opts.includeContext === false
        ? []
        : b.entry.contextTweetIds.map((id) => b.tweets[id]).filter((t): t is Tweet => !!t),
    references:
      opts.includeReferences === false
        ? []
        : b.entry.referenceTweetIds.map((id) => b.tweets[id]).filter((t): t is Tweet => !!t),
    note: b.entry.note,
    tags: b.entry.tags,
  };
  const published = first?.createdAt ?? b.entry.publishedAt;
  if (published) view.publishedAt = published;
  return view;
}

export function dayString(iso?: string | number): string {
  if (iso === undefined) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function mediaLabel(kind: string): string {
  return kind === 'video' ? 'Vidéo' : kind === 'gif' ? 'GIF' : 'Image';
}

/** « @handle » (X) or « u/name » (Reddit). */
export function who(handle: string, platform: Platform = 'x'): string {
  return platform === 'reddit' ? `u/${handle}` : `@${handle}`;
}

export function authorHref(handle: string, platform: Platform = 'x'): string {
  return platform === 'reddit' ? redditUserUrl(handle) : profileUrl(handle);
}

export function siteName(platform: Platform = 'x'): string {
  return platform === 'reddit' ? 'Reddit' : 'X';
}

/** Depth of a Reddit comment in the export (post = 0, top-level comment = 1). */
export function commentLevel(t: Tweet): number {
  return t.reddit?.kind === 'comment' ? Math.min((t.reddit.depth ?? 0) + 1, 10) : 0;
}

/** A Reddit post's body repeats the entry title: exports print it once. */
export function withoutRepeatedTitle(t: Tweet, title: string): Tweet {
  if (!t.article?.inline || t.article.title !== title) return t;
  const { title: _omit, ...article } = t.article;
  return { ...t, article };
}

/** One-line facts about a Reddit post / comment: author, OP, score, date. */
export function redditMeta(t: Tweet): string {
  const r = t.reddit;
  const parts = [`u/${t.author.handle}`];
  if (r?.isOp) parts.push('OP');
  if (r?.score !== undefined) parts.push(`▲ ${r.score}`);
  if (t.createdAt) parts.push(dayString(t.createdAt));
  return parts.join(' · ');
}
