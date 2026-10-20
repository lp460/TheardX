import type { EntryBundle } from '@/types/model';

export const ENTRY_FORMAT = 'threadshelf.entry';

/** Structured JSON of one entry: metadata, ordered posts, relations, references. Media blobs are not embedded. */
export function toJson(b: EntryBundle): string {
  const { searchText: _s, ...entry } = b.entry;
  const ordered = (ids: string[]) => ids.map((id) => b.tweets[id]).filter(Boolean);
  const doc = {
    format: ENTRY_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    entry,
    posts: ordered(b.entry.tweetIds),
    context: ordered(b.entry.contextTweetIds),
    references: ordered(b.entry.referenceTweetIds),
    relations: b.relations,
    media: Object.values(b.media).map(({ blob: _blob, ...m }) => m),
  };
  return JSON.stringify(doc, null, 2) + '\n';
}
