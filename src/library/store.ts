import { create } from 'zustand';

export type View =
  | { kind: 'all' }
  | { kind: 'later' }
  | { kind: 'unread' }
  | { kind: 'favorites' }
  | { kind: 'duplicates' }
  | { kind: 'settings' }
  | { kind: 'welcome' }
  | { kind: 'collection'; id: string }
  | { kind: 'category'; id: string }
  | { kind: 'tag'; tag: string };

export function parseHash(hash: string): View {
  const h = decodeURIComponent(hash.replace(/^#\/?/, ''));
  const [head, ...rest] = h.split('/');
  const arg = rest.join('/');
  switch (head) {
    case 'later':
      return { kind: 'later' };
    case 'unread':
      return { kind: 'unread' };
    case 'favorites':
      return { kind: 'favorites' };
    case 'duplicates':
      return { kind: 'duplicates' };
    case 'settings':
      return { kind: 'settings' };
    case 'welcome':
      return { kind: 'welcome' };
    case 'collection':
      return arg ? { kind: 'collection', id: arg } : { kind: 'all' };
    case 'category':
      return arg ? { kind: 'category', id: arg } : { kind: 'all' };
    case 'tag':
      return arg ? { kind: 'tag', tag: arg } : { kind: 'all' };
    default:
      return { kind: 'all' };
  }
}

export function viewToHash(v: View): string {
  switch (v.kind) {
    case 'collection':
      return `#/collection/${encodeURIComponent(v.id)}`;
    case 'category':
      return `#/category/${encodeURIComponent(v.id)}`;
    case 'tag':
      return `#/tag/${encodeURIComponent(v.tag)}`;
    case 'all':
      return '#/';
    default:
      return `#/${v.kind}`;
  }
}

export type ReadFilter = 'all' | 'unread' | 'read';

interface LibraryState {
  view: View;
  query: string;
  author: string;
  readFilter: ReadFilter;
  favoritesOnly: boolean;
  categoryFilter: string;
  selected: Set<string>;
  commandOpen: boolean;
  setView: (v: View) => void;
  setQuery: (q: string) => void;
  setAuthor: (a: string) => void;
  setReadFilter: (r: ReadFilter) => void;
  setFavoritesOnly: (v: boolean) => void;
  setCategoryFilter: (c: string) => void;
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[]) => void;
  clearSelection: () => void;
  setCommandOpen: (o: boolean) => void;
}

export const useLibrary = create<LibraryState>((set) => ({
  view: parseHash(typeof location !== 'undefined' ? location.hash : ''),
  query: '',
  author: '',
  readFilter: 'all',
  favoritesOnly: false,
  categoryFilter: '',
  selected: new Set(),
  commandOpen: false,
  setView: (view) => {
    if (typeof location !== 'undefined' && location.hash !== viewToHash(view))
      history.pushState(null, '', viewToHash(view));
    set({ view, selected: new Set() });
  },
  setQuery: (query) => set({ query }),
  setAuthor: (author) => set({ author }),
  setReadFilter: (readFilter) => set({ readFilter }),
  setFavoritesOnly: (favoritesOnly) => set({ favoritesOnly }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  toggleSelected: (id) =>
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next };
    }),
  setSelected: (ids) => set({ selected: new Set(ids) }),
  clearSelection: () => set({ selected: new Set() }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}));
