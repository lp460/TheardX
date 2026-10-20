import type { EntryBundle, Tweet } from '@/types/model';

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
  const view: ExportView = {
    title: b.entry.title,
    author: {
      handle: b.entry.authorHandle,
      ...(b.entry.authorName ? { name: b.entry.authorName } : {}),
    },
    sourceUrl: first?.url ?? b.entry.sourceUrl,
    savedAt: b.entry.savedAt,
    statusLine: opts.tweetIds?.length
      ? `${posts.length} publication${posts.length > 1 ? 's' : ''} sélectionnée${posts.length > 1 ? 's' : ''}`
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
