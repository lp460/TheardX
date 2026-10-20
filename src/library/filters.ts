import type { Category, Entry } from '@/types/model';
import { searchEntries } from '@/storage/search';
import type { Settings } from '@/settings/schema';
import type { ReadFilter, View } from './store';

export interface FilterState {
  view: View;
  query: string;
  author: string;
  readFilter: ReadFilter;
  favoritesOnly: boolean;
  categoryFilter: string;
  sort: Settings['library']['sort'];
}

export function applyFilters(
  entries: Entry[],
  f: FilterState,
  categories: Map<string, Category>,
): Entry[] {
  let out = entries;
  switch (f.view.kind) {
    case 'later':
      out = out.filter((e) => e.readLater && e.readState !== 'read');
      break;
    case 'unread':
      out = out.filter((e) => e.readState === 'unread');
      break;
    case 'favorites':
      out = out.filter((e) => e.favorite);
      break;
    case 'collection': {
      const id = f.view.id;
      out = out.filter((e) => e.collectionIds.includes(id));
      break;
    }
    case 'category': {
      const id = f.view.id;
      out = out.filter((e) => e.categoryId === id);
      break;
    }
    case 'tag': {
      const tag = f.view.tag;
      out = out.filter((e) => e.tags.includes(tag));
      break;
    }
    default:
      break;
  }
  if (f.author) out = out.filter((e) => e.authorHandle.toLowerCase() === f.author.toLowerCase());
  if (f.readFilter !== 'all') out = out.filter((e) => e.readState === f.readFilter);
  if (f.favoritesOnly) out = out.filter((e) => e.favorite);
  if (f.categoryFilter) out = out.filter((e) => e.categoryId === f.categoryFilter);
  if (f.query.trim()) out = searchEntries(out, f.query, categories);
  return sortEntries(out, f.sort);
}

export function sortEntries(entries: Entry[], sort: Settings['library']['sort']): Entry[] {
  const published = (e: Entry) => (e.publishedAt ? Date.parse(e.publishedAt) : e.savedAt);
  const arr = [...entries];
  switch (sort) {
    case 'saved-asc':
      return arr.sort((a, b) => a.savedAt - b.savedAt);
    case 'published-desc':
      return arr.sort((a, b) => published(b) - published(a));
    case 'published-asc':
      return arr.sort((a, b) => published(a) - published(b));
    default:
      return arr.sort((a, b) => b.savedAt - a.savedAt);
  }
}
