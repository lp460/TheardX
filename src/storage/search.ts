import type { Category, Entry, Tweet } from '@/types/model';
import { articlePlainText, fold, segmentsToPlain } from '@/utils/text';

/** Text indexed for an entry: author, title, every post text, quotes, card titles, note, tags. */
export function buildSearchText(
  entry: Pick<
    Entry,
    | 'title'
    | 'authorHandle'
    | 'authorName'
    | 'note'
    | 'tags'
    | 'tweetIds'
    | 'contextTweetIds'
    | 'referenceTweetIds'
  >,
  tweets: Map<string, Tweet> | Record<string, Tweet>,
): string {
  const get = (id: string) => (tweets instanceof Map ? tweets.get(id) : tweets[id]);
  const parts: string[] = [
    entry.title,
    `@${entry.authorHandle}`,
    entry.authorName ?? '',
    entry.note,
    ...entry.tags.map((t) => `#${t}`),
  ];
  for (const id of [...entry.tweetIds, ...entry.contextTweetIds, ...entry.referenceTweetIds]) {
    const t = get(id);
    if (!t) continue;
    parts.push(`@${t.author.handle}`, t.author.name ?? '', segmentsToPlain(t.text));
    if (t.quoted?.text)
      parts.push(
        segmentsToPlain(t.quoted.text),
        t.quoted.author ? `@${t.quoted.author.handle}` : '',
      );
    if (t.card?.title) parts.push(t.card.title, t.card.domain ?? '');
    for (const m of t.media) if (m.alt) parts.push(m.alt);
    if (t.article) parts.push(articlePlainText(t.article));
  }
  return fold(parts.filter(Boolean).join('\n'));
}

export interface SearchQuery {
  terms: string[];
  authors: string[];
  tags: string[];
}

/** Parses "react @ada #tutorial" into free terms, author and tag filters. */
export function parseQuery(input: string): SearchQuery {
  const q: SearchQuery = { terms: [], authors: [], tags: [] };
  for (const raw of input.trim().split(/\s+/).filter(Boolean)) {
    if (/^@[\w]{1,15}$/.test(raw)) q.authors.push(raw.slice(1).toLowerCase());
    else if (/^#[\p{L}\p{N}_-]+$/u.test(raw)) q.tags.push(fold(raw.slice(1)));
    else q.terms.push(fold(raw));
  }
  return q;
}

/** Instant local search. Every term must match (AND). */
export function matchesQuery(
  entry: Entry,
  q: SearchQuery,
  categories?: Map<string, Category>,
): boolean {
  if (q.authors.length && !q.authors.includes(entry.authorHandle.toLowerCase())) return false;
  if (
    q.tags.length &&
    !q.tags.every(
      (t) => entry.tags.some((et) => fold(et) === t) || entry.searchText.includes(`#${t}`),
    )
  )
    return false;
  if (!q.terms.length) return true;
  const category = entry.categoryId ? fold(categories?.get(entry.categoryId)?.name ?? '') : '';
  return q.terms.every(
    (term) => entry.searchText.includes(term) || (category && category.includes(term)),
  );
}

export function searchEntries(
  entries: Entry[],
  input: string,
  categories?: Map<string, Category>,
): Entry[] {
  const q = parseQuery(input);
  if (!q.terms.length && !q.authors.length && !q.tags.length) return entries;
  return entries.filter((e) => matchesQuery(e, q, categories));
}
