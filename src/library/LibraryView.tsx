import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookmarkPlus,
  Check,
  CheckCheck,
  Clock,
  Download,
  FolderPlus,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  X,
  Layers3,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ThreadCard, ThreadCardSkeleton, type EntryActions } from '@/components/ThreadCard';
import { toast } from '@/components/ToastNotification';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu';
import { EmptyState, Input, Kbd, Select, Textarea } from '@/components/ui/primitives';
import { MediaProvider } from '@/components/media';
import { ExportDialog } from '@/components/ExportDialog';
import { repository } from '@/storage/repository';
import { fromStoredTweet } from '@/storage/db';
import type { Category, Collection, Entry, MediaRecord, Tweet } from '@/types/model';
import type { Settings } from '@/settings/schema';
import { applyFilters } from './filters';
import { useLibrary, type View } from './store';
import { copyEntry, openReader, safely } from './actions';
import { entryAuthorLabel } from '@/utils/text';
import { useWebI18n, type WebMessageKey } from '@/web/i18n';

function viewTitle(view: View, collections: Collection[], categories: Category[], t: (key: WebMessageKey) => string): string {
  switch (view.kind) {
    case 'later':
      return t('later');
    case 'unread':
      return t('unread');
    case 'favorites':
      return t('favorites');
    case 'duplicates':
      return t('duplicates');
    case 'collection':
      return collections.find((c) => c.id === view.id)?.name ?? t('collections');
    case 'category':
      return categories.find((c) => c.id === view.id)?.name ?? t('categories');
    case 'tag':
      return `#${view.tag}`;
    default:
      return t('library');
  }
}

export function TagsNoteDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  if (entry && entry.id !== lastId) {
    setLastId(entry.id);
    setTags(entry.tags.join(', '));
    setNote(entry.note);
    setTitle(entry.title);
  }
  return (
    <Dialog
      open={!!entry}
      onOpenChange={(o) => !o && onClose()}
      title="Titre, tags et note"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            data-testid="tags-save"
            onClick={async () => {
              if (!entry) return;
              await safely('Enregistrement impossible', () =>
                repository.updateEntry(entry.id, {
                  title,
                  note,
                  tags: tags.split(/[,\s]+/).filter(Boolean),
                }),
              );
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-[12.5px] font-medium text-muted">
          Titre
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-[12.5px] font-medium text-muted">
          Tags (séparés par des virgules)
          <Input
            className="mt-1"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="react, tutoriel"
            data-testid="tags-input"
          />
        </label>
        <label className="block text-[12.5px] font-medium text-muted">
          Note personnelle
          <Textarea
            className="mt-1"
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Pourquoi garder ce thread ?"
          />
        </label>
      </div>
    </Dialog>
  );
}

function BulkBar({
  ids,
  entries,
  collections,
  categories,
  onExport,
  onDelete,
  onClear,
}: {
  ids: string[];
  entries: Entry[];
  collections: Collection[];
  categories: Category[];
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const selected = entries.filter((e) => ids.includes(e.id));
  const allRead = selected.every((e) => e.readState === 'read');
  const allFav = selected.every((e) => e.favorite);
  const run = (label: string, fn: () => Promise<unknown>) =>
    safely(label, async () => {
      await fn();
      toast.success(label, `${ids.length} entrée(s)`);
    });
  return (
    <div
      role="toolbar"
      aria-label="Actions groupées"
      data-testid="bulk-bar"
      className="sticky bottom-16 z-20 mx-auto mt-4 flex w-fit max-w-[calc(100vw-1rem)] items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-elevated/95 px-2 py-1.5 shadow-float backdrop-blur animate-ts-in md:bottom-4"
    >
      <span className="px-2 text-[13px] font-medium text-fg">
        {ids.length} sélectionnée{ids.length > 1 ? 's' : ''}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          run(allRead ? 'Marquées non lues' : 'Marquées lues', () =>
            repository.bulkUpdate(ids, { readState: allRead ? 'unread' : 'read' }),
          )
        }
      >
        <CheckCheck size={14} /> {allRead ? 'Non lu' : 'Lu'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          run(allFav ? 'Retirées des favoris' : 'Ajoutées aux favoris', () =>
            repository.bulkUpdate(ids, { favorite: !allFav }),
          )
        }
      >
        <Star size={14} /> Favori
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          run('Ajoutées à « À lire »', () => repository.bulkUpdate(ids, { readLater: true }))
        }
      >
        <Clock size={14} /> À lire
      </Button>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <FolderPlus size={14} /> Collection
          </Button>
        </MenuTrigger>
        <MenuContent align="center">
          {collections.length ? (
            collections.map((c) => (
              <MenuItem
                key={c.id}
                onSelect={() =>
                  run(`Ajoutées à ${c.name}`, () => repository.addToCollection(ids, c.id))
                }
              >
                {c.name}
              </MenuItem>
            ))
          ) : (
            <div className="px-2 py-1.5 text-[12px] text-muted">Créez d’abord une collection.</div>
          )}
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <Tag size={14} /> Catégorie
          </Button>
        </MenuTrigger>
        <MenuContent align="center">
          <MenuItem
            onSelect={() =>
              run('Catégorie retirée', () => repository.bulkUpdate(ids, { categoryId: null }))
            }
          >
            Aucune
          </MenuItem>
          {categories.map((c) => (
            <MenuItem
              key={c.id}
              onSelect={() =>
                run(`Catégorie ${c.name}`, () => repository.bulkUpdate(ids, { categoryId: c.id }))
              }
            >
              {c.name}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <Button size="sm" variant="ghost" onClick={onExport}>
        <Download size={14} /> Exporter
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-danger hover:bg-danger/10 hover:text-danger"
        onClick={onDelete}
        data-testid="bulk-delete"
      >
        <Trash2 size={14} /> Supprimer
      </Button>
      <div className="mx-1 h-5 w-px bg-line" />
      <Button size="icon-sm" variant="ghost" aria-label="Annuler la sélection" onClick={onClear}>
        <X size={14} />
      </Button>
    </div>
  );
}

function DuplicatesView({
  actions,
  firstTweets,
  collections,
  categories,
}: {
  actions: EntryActions;
  firstTweets: Record<string, Tweet>;
  collections: Collection[];
  categories: Category[];
}) {
  const groups = useLiveQuery(() => repository.findDuplicates(), [], null);
  if (groups === null)
    return (
      <div className="grid gap-3 p-6 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <ThreadCardSkeleton key={i} layout="cards" />
        ))}
      </div>
    );
  if (!groups.length)
    return (
      <EmptyState icon={<Layers3 size={20} />} title="Aucun doublon">
        Les publications enregistrées plusieurs fois (par exemple seules puis dans un thread)
        apparaîtront ici.
      </EmptyState>
    );
  return (
    <div className="space-y-6 p-6" data-testid="duplicates">
      {groups.map((g) => {
        const best = [...g].sort(
          (a, b) => b.tweetIds.length - a.tweetIds.length || b.updatedAt - a.updatedAt,
        )[0]!;
        return (
          <section
            key={g.map((e) => e.id).join()}
            className="rounded-2xl border border-dashed border-line p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[13px] text-muted">
                {g.length} entrées partagent des publications. La plus complète :{' '}
                <span className="font-medium text-fg">{best.title}</span>
              </p>
              <Button
                size="sm"
                onClick={() =>
                  safely('Fusion impossible', async () => {
                    await repository.deleteEntries(
                      g.filter((e) => e.id !== best.id).map((e) => e.id),
                    );
                    toast.success('Doublons supprimés');
                  })
                }
              >
                <Check size={13} /> Garder la plus complète
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {g.map((e) => (
                <ThreadCard
                  key={e.id}
                  entry={e}
                  first={firstTweets[e.tweetIds[0]!]}
                  actions={actions}
                  collections={collections}
                  categories={categories}
                  selected={false}
                  selectMode={false}
                  onToggleSelect={() => {}}
                  layout="cards"
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function LibraryView({
  entries,
  collections,
  categories,
  settings,
  updateSettings,
  webExperience = false,
}: {
  entries: Entry[] | undefined;
  collections: Collection[];
  categories: Category[];
  settings: Settings;
  updateSettings: (p: { library: Partial<Settings['library']> }) => void;
  webExperience?: boolean;
}) {
  const { t } = useWebI18n();
  const s = useLibrary();
  const [exportIds, setExportIds] = useState<string[] | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [tagEntry, setTagEntry] = useState<Entry | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    if (!webExperience) return;
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [webExperience]);
  // Web mobile always uses readable full-width cards; desktop retains the saved preference.
  const layout = webExperience && mobile ? 'cards' : settings.library.view;
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(
    () =>
      entries
        ? applyFilters(
            entries,
            {
              view: s.view,
              query: s.query,
              author: s.author,
              readFilter: s.readFilter,
              favoritesOnly: s.favoritesOnly,
              categoryFilter: s.categoryFilter,
              platformFilter: s.platformFilter,
              sort: settings.library.sort,
            },
            catMap,
          )
        : undefined,
    [
      entries,
      s.view,
      s.query,
      s.author,
      s.readFilter,
      s.favoritesOnly,
      s.categoryFilter,
      s.platformFilter,
      settings.library.sort,
      catMap,
    ],
  );
  const authors = useMemo(() => {
    const labels = new Map<string, string>();
    for (const e of entries ?? []) labels.set(e.authorHandle, entryAuthorLabel(e));
    return [...labels.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);
  const hasReddit = useMemo(() => (entries ?? []).some((e) => e.platform === 'reddit'), [entries]);

  const firstIds = useMemo(
    () => [...new Set((entries ?? []).map((e) => e.tweetIds[0]!).filter(Boolean))],
    [entries],
  );
  const firstData = useLiveQuery(
    async () => {
      const rows = await repository.db.tweets.bulkGet(firstIds);
      const tweets: Record<string, Tweet> = {};
      for (const r of rows) if (r) tweets[r.id] = fromStoredTweet(r);
      const urls = Object.values(tweets)
        .flatMap((t) => [
          t.media[0]?.url,
          t.quoted?.media?.[0]?.url,
          t.article?.coverUrl,
          t.author.avatarUrl?.replace(/_(normal|mini)(\.[a-z]+)$/i, '_bigger$2'),
        ])
        .filter((u): u is string => !!u);
      const media: Record<string, MediaRecord> = {};
      for (const m of await repository.db.media.bulkGet(urls)) if (m) media[m.url] = m;
      return { tweets, media };
    },
    [firstIds.join(',')],
    { tweets: {} as Record<string, Tweet>, media: {} as Record<string, MediaRecord> },
  );

  const actions: EntryActions = {
    open: (e, newTab) => openReader(e.id, newTab),
    copy: (e, format) => void copyEntry(e.id, format),
    export: (e) => setExportIds([e.id]),
    update: (e, patch) =>
      void safely('Mise à jour impossible', () => repository.updateEntry(e.id, patch)),
    remove: (e) => setDeleteIds([e.id]),
    toggleCollection: (e, c) =>
      void safely('Mise à jour impossible', () =>
        repository.updateEntry(e.id, {
          collectionIds: e.collectionIds.includes(c.id)
            ? e.collectionIds.filter((x) => x !== c.id)
            : [...e.collectionIds, c.id],
        }),
      ),
    setCategory: (e, c) =>
      void safely('Mise à jour impossible', () =>
        repository.updateEntry(e.id, { categoryId: c?.id ?? null }),
      ),
    editTags: (e) => setTagEntry(e),
  };
  const selectedIds = [...s.selected].filter((id) => filtered?.some((e) => e.id === id));
  const selectMode = selectedIds.length > 0;

  const header = (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/95 px-3 pb-3 pt-3 backdrop-blur-md sm:px-6 sm:pt-5">
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <h1
          className="text-[22px] font-semibold tracking-[-0.025em] text-fg sm:text-[20px]"
          data-testid="view-title"
        >
          {viewTitle(s.view, collections, categories, t)}
        </h1>
        {filtered ? <span className="text-[13px] text-faint">{filtered.length}</span> : null}
        <div className="ml-auto flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <Input
              value={s.query}
              onChange={(e) => s.setQuery(e.target.value)}
              placeholder={t('search')}
              aria-label={t('searchLibrary')}
              className="h-11 w-full pl-9 pr-3 text-base sm:h-8 sm:w-64 sm:pl-8 sm:pr-12 sm:text-[13px]"
              data-testid="library-search"
            />
            <button
              type="button"
              onClick={() => s.setCommandOpen(true)}
              className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 sm:block"
              aria-label={t('openSearch')}
            >
              <Kbd>⌘K</Kbd>
            </button>
          </div>
          {webExperience ? (
            <button type="button" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              aria-expanded={mobileFiltersOpen} aria-controls="library-filters"
              className={cn('ts-focus inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-fg md:hidden',mobileFiltersOpen && 'border-accent text-accent')}>
              <SlidersHorizontal size={19}/><span className="hidden min-[360px]:inline">{mobileFiltersOpen ? t('hideFilters') : t('filter')}</span>
            </button>
          ) : null}
          <div
            className={cn('inline-flex rounded-lg bg-subtle p-0.5', webExperience && 'hidden md:inline-flex')}
            role="radiogroup"
            aria-label={t('display')}
          >
            <button
              type="button"
              role="radio"
              aria-checked={layout === 'cards'}
              aria-label={t('cards')}
              onClick={() => updateSettings({ library: { view: 'cards' } })}
              className={cn(
                'ts-focus rounded-md p-1.5',
                layout === 'cards' ? 'bg-surface text-fg shadow-sm' : 'text-muted',
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={layout === 'list'}
              aria-label={t('list')}
              onClick={() => updateSettings({ library: { view: 'list' } })}
              className={cn(
                'ts-focus rounded-md p-1.5',
                layout === 'list' ? 'bg-surface text-fg shadow-sm' : 'text-muted',
              )}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>
      {s.view.kind !== 'duplicates' ? (
        <div id="library-filters" className={cn('mt-3 flex flex-wrap items-center gap-2', webExperience && !mobileFiltersOpen && 'hidden md:flex',webExperience && 'max-md:rounded-2xl max-md:border max-md:border-line max-md:bg-surface max-md:p-3')}>
          <Select
            value={s.author}
            onChange={(e) => s.setAuthor(e.target.value)}
            aria-label={t('allAuthors')}
            className="h-11 w-full text-base sm:h-7 sm:w-auto sm:text-[12.5px]"
            data-testid="filter-author"
          >
            <option value="">{t('allAuthors')}</option>
            {authors.map(([a, label]) => (
              <option key={a} value={a}>
                {label}
              </option>
            ))}
          </Select>
          {hasReddit ? (
            <Select
              value={s.platformFilter}
              onChange={(e) => s.setPlatformFilter(e.target.value as '' | 'x' | 'reddit')}
              aria-label={t('allSources')}
              className="h-11 w-full text-base sm:h-7 sm:w-auto sm:text-[12.5px]"
              data-testid="filter-platform"
            >
              <option value="">{t('allSources')}</option>
              <option value="x">X</option>
              <option value="reddit">Reddit</option>
            </Select>
          ) : null}
          <Select
            value={s.categoryFilter}
            onChange={(e) => s.setCategoryFilter(e.target.value)}
            aria-label={t('allCategories')}
            className="h-11 w-full text-base sm:h-7 sm:w-auto sm:text-[12.5px]"
          >
            <option value="">{t('allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={s.readFilter}
            onChange={(e) => s.setReadFilter(e.target.value as typeof s.readFilter)}
            aria-label={t('readAndUnread')}
            className="h-11 w-full text-base sm:h-7 sm:w-auto sm:text-[12.5px]"
          >
            <option value="all">{t('readAndUnread')}</option>
            <option value="unread">{t('unread')}</option>
            <option value="read">{t('read')}</option>
          </Select>
          <button
            type="button"
            aria-pressed={s.favoritesOnly}
            onClick={() => s.setFavoritesOnly(!s.favoritesOnly)}
            className={cn(
              'ts-focus inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors sm:h-7 sm:px-2.5 sm:text-[12.5px]',
              s.favoritesOnly
                ? 'border-warning/40 bg-warning/10 text-warning'
                : 'border-line text-muted hover:text-fg',
            )}
          >
            <Star size={13} fill={s.favoritesOnly ? 'currentColor' : 'none'} /> {t('favorites')}
          </button>
          <Select
            value={settings.library.sort}
            onChange={(e) =>
              updateSettings({ library: { sort: e.target.value as Settings['library']['sort'] } })
            }
            aria-label={t('sort')}
            className="ml-auto h-11 w-full text-base sm:h-7 sm:w-auto sm:text-[12.5px]"
            data-testid="sort"
          >
            <option value="saved-desc">{t('savedNewest')}</option>
            <option value="saved-asc">{t('savedOldest')}</option>
            <option value="published-desc">{t('publishedNewest')}</option>
            <option value="published-asc">{t('publishedOldest')}</option>
          </Select>
          {filtered?.length ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                selectMode ? s.clearSelection() : s.setSelected(filtered.map((e) => e.id))
              }
            >
              <Check size={13} /> {selectMode ? t('selectNone') : t('selectAll')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </header>
  );

  let body;
  if (s.view.kind === 'duplicates') {
    body = (
      <DuplicatesView
        actions={actions}
        firstTweets={firstData.tweets}
        collections={collections}
        categories={categories}
      />
    );
  } else if (!filtered) {
    body = (
      <div
        className={
          layout === 'cards'
            ? 'grid gap-3 p-3 sm:gap-4 sm:p-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]'
            : 'py-2'
        }
      >
        {Array.from({ length: 6 }, (_, i) => (
          <ThreadCardSkeleton key={i} layout={layout} />
        ))}
      </div>
    );
  } else if (!filtered.length) {
    const searching =
      s.query ||
      s.author ||
      s.readFilter !== 'all' ||
      s.favoritesOnly ||
      s.categoryFilter ||
      s.platformFilter;
    body = searching ? (
      <EmptyState
        icon={<Search size={20} />}
        title={t('noResults')}
        action={
          <Button
            size="sm"
            onClick={() => {
              s.setQuery('');
              s.setAuthor('');
              s.setReadFilter('all');
              s.setFavoritesOnly(false);
              s.setCategoryFilter('');
              s.setPlatformFilter('');
            }}
          >
            {t('clearFilters')}
          </Button>
        }
      >
        {t('noResultsHint')}
      </EmptyState>
    ) : (
      <EmptyState
        icon={<BookmarkPlus size={20} />}
        title={entries?.length ? t('emptyView') : t('emptyLibrary')}
      >
        {entries?.length ? (
          t('emptyViewHint')
        ) : webExperience ? (
          <div className="max-w-md space-y-3">
            <p>{t('emptyWebHint')}</p>
            <a className="ts-focus inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg" href="/?home=1#extension">{t('getExtension')}</a>
          </div>
        ) : (
          <>
            Ouvrez une publication sur X (ou un post Reddit) puis cliquez sur{' '}
            <strong>Enregistrer</strong> dans la barre ThreadShelf, ou utilisez <Kbd>⌥</Kbd>{' '}
            <Kbd>⇧</Kbd> <Kbd>S</Kbd>.
          </>
        )}
      </EmptyState>
    );
  } else {
    body = (
      <div
        role="list"
        aria-label={t('entries')}
        className={
          layout === 'cards'
            ? 'grid gap-3 p-3 sm:gap-4 sm:p-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]'
            : 'py-1'
        }
      >
        {filtered.map((e) => (
          <ThreadCard
            key={e.id}
            entry={e}
            first={firstData.tweets[e.tweetIds[0]!]}
            actions={actions}
            collections={collections}
            categories={categories}
            selected={s.selected.has(e.id)}
            selectMode={selectMode}
            onToggleSelect={() => s.toggleSelected(e.id)}
            layout={layout}
          />
        ))}
      </div>
    );
  }

  return (
    <MediaProvider records={firstData.media}>
      {header}
      {body}
      {selectMode ? (
        <BulkBar
          ids={selectedIds}
          entries={filtered ?? []}
          collections={collections}
          categories={categories}
          onExport={() => setExportIds(selectedIds)}
          onDelete={() => setDeleteIds(selectedIds)}
          onClear={s.clearSelection}
        />
      ) : null}
      {exportIds ? (
        <ExportDialog entryIds={exportIds} open onOpenChange={(o) => !o && setExportIds(null)} />
      ) : null}
      <TagsNoteDialog entry={tagEntry} onClose={() => setTagEntry(null)} />
      <ConfirmDialog
        open={!!deleteIds}
        onOpenChange={(o) => !o && setDeleteIds(null)}
        title={
          deleteIds && deleteIds.length > 1
            ? `Supprimer ${deleteIds.length} entrées ?`
            : 'Supprimer cette entrée ?'
        }
        description="Les publications et images enregistrées qui ne sont utilisées par aucune autre entrée seront supprimées. Cette action est définitive."
        confirmLabel="Supprimer"
        destructive
        onConfirm={async () => {
          if (!deleteIds) return;
          const n = await safely('Suppression impossible', () =>
            repository.deleteEntries(deleteIds),
          );
          if (n !== undefined)
            toast.success(`${n} entrée${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''}`);
          s.clearSelection();
          setDeleteIds(null);
        }}
      />
    </MediaProvider>
  );
}
