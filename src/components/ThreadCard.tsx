import {
  Bookmark,
  BookOpen,
  Check,
  CloudOff,
  Copy,
  Download,
  ExternalLink,
  FolderPlus,
  MoreHorizontal,
  Star,
  Tag,
  Trash2,
  Clock,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Category, Collection, Entry, Tweet } from '@/types/model';
import { formatDate, formatRelative } from '@/utils/format';
import { entryAuthorLabel, postPreviewText, truncate } from '@/utils/text';
import { vocab } from '@/utils/vocab';
import { CompletenessBadge } from './CompletenessBadge';
import { Avatar, useMediaSrc } from './media';
import { Button } from './ui/Button';
import { cn } from './ui/cn';
import {
  Menu,
  MenuCheckItem,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuTrigger,
} from './ui/Menu';
import { Badge } from './ui/primitives';
import { Tooltip } from './ui/Tooltip';

export interface EntryActions {
  open: (e: Entry, newTab?: boolean) => void;
  copy: (e: Entry, format: 'markdown' | 'text') => void;
  export: (e: Entry) => void;
  update: (e: Entry, patch: Partial<Entry>) => void;
  remove: (e: Entry) => void;
  toggleCollection: (e: Entry, c: Collection) => void;
  setCategory: (e: Entry, c: Category | null) => void;
  editTags: (e: Entry) => void;
}

function Thumb({ tweet }: { tweet?: Tweet }) {
  const media =
    tweet?.media[0] ??
    tweet?.quoted?.media?.[0] ??
    (tweet?.article?.coverUrl
      ? { kind: 'photo' as const, url: tweet.article.coverUrl }
      : undefined);
  const { src } = useMediaSrc(media?.url);
  if (!media || !src) return null;
  return (
    <img
      src={src}
      alt={media.alt ?? ''}
      referrerPolicy="no-referrer"
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );
}

export function EntryMenu({
  entry,
  actions,
  collections,
  categories,
}: {
  entry: Entry;
  actions: EntryActions;
  collections: Collection[];
  categories: Category[];
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Plus d’actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={15} />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<BookOpen size={14} />} onSelect={() => actions.open(entry)}>
          Lire
        </MenuItem>
        <MenuItem icon={<Copy size={14} />} onSelect={() => actions.copy(entry, 'markdown')}>
          Copier en Markdown
        </MenuItem>
        <MenuItem icon={<Copy size={14} />} onSelect={() => actions.copy(entry, 'text')}>
          Copier en texte brut
        </MenuItem>
        <MenuItem icon={<Download size={14} />} onSelect={() => actions.export(entry)}>
          Exporter…
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<Star size={14} />}
          onSelect={() => actions.update(entry, { favorite: !entry.favorite })}
        >
          {entry.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        </MenuItem>
        <MenuItem
          icon={<Clock size={14} />}
          onSelect={() => actions.update(entry, { readLater: !entry.readLater })}
        >
          {entry.readLater ? 'Retirer de « À lire »' : 'À lire plus tard'}
        </MenuItem>
        <MenuItem
          icon={<Check size={14} />}
          onSelect={() =>
            actions.update(entry, { readState: entry.readState === 'read' ? 'unread' : 'read' })
          }
        >
          {entry.readState === 'read' ? 'Marquer non lu' : 'Marquer lu'}
        </MenuItem>
        <MenuSub label="Collections" icon={<FolderPlus size={14} />}>
          {collections.length ? (
            collections.map((c) => (
              <MenuCheckItem
                key={c.id}
                checked={entry.collectionIds.includes(c.id)}
                onCheckedChange={() => actions.toggleCollection(entry, c)}
              >
                {c.name}
              </MenuCheckItem>
            ))
          ) : (
            <div className="px-2 py-1.5 text-[12px] text-muted">Aucune collection</div>
          )}
        </MenuSub>
        <MenuSub label="Catégorie" icon={<Bookmark size={14} />}>
          <MenuCheckItem
            checked={!entry.categoryId}
            onCheckedChange={() => actions.setCategory(entry, null)}
          >
            Aucune
          </MenuCheckItem>
          {categories.map((c) => (
            <MenuCheckItem
              key={c.id}
              checked={entry.categoryId === c.id}
              onCheckedChange={() => actions.setCategory(entry, c)}
            >
              {c.name}
            </MenuCheckItem>
          ))}
        </MenuSub>
        <MenuItem icon={<Tag size={14} />} onSelect={() => actions.editTags(entry)}>
          Tags et note…
        </MenuItem>
        <MenuItem
          icon={<ExternalLink size={14} />}
          onSelect={() => window.open(entry.sourceUrl, '_blank', 'noopener')}
        >
          Ouvrir sur {entry.platform === 'reddit' ? 'Reddit' : 'X'}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash2 size={14} />} destructive onSelect={() => actions.remove(entry)}>
          Supprimer…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function Meta({ entry, category }: { entry: Entry; category?: Category }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entry.kind !== 'tweet' ? (
        <Badge>{vocab(entry.platform).posts(entry.tweetIds.length)}</Badge>
      ) : null}
      {entry.kind === 'thread' || entry.kind === 'selection' ? (
        <CompletenessBadge completeness={entry.completeness} compact />
      ) : null}
      {category ? (
        <Badge style={{ color: category.color, backgroundColor: `${category.color}1a` }}>
          {category.name}
        </Badge>
      ) : null}
      {entry.tags.slice(0, 3).map((t) => (
        <Badge key={t} tone="neutral">
          #{t}
        </Badge>
      ))}
      {entry.offline !== 'full' ? (
        <Tooltip
          label={
            entry.offline === 'partial'
              ? 'Certaines images ne sont pas disponibles hors ligne'
              : 'Images non disponibles hors ligne'
          }
        >
          <span
            tabIndex={0}
            className="inline-flex text-faint"
            aria-label="Disponibilité hors ligne partielle"
          >
            <CloudOff size={13} />
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
}

export function ThreadCard({
  entry,
  first,
  actions,
  collections,
  categories,
  selected,
  selectMode,
  onToggleSelect,
  layout,
}: {
  entry: Entry;
  first?: Tweet;
  actions: EntryActions;
  collections: Collection[];
  categories: Category[];
  selected: boolean;
  selectMode: boolean;
  onToggleSelect: () => void;
  layout: 'cards' | 'list';
}) {
  const category = categories.find((c) => c.id === entry.categoryId);
  const preview = first ? truncate(postPreviewText(first).replace(/\s+/g, ' '), 280) : '';
  const onClick = (e: MouseEvent) => {
    if (selectMode || e.shiftKey) {
      e.preventDefault();
      onToggleSelect();
      return;
    }
    actions.open(entry, e.metaKey || e.ctrlKey);
  };
  const unreadDot =
    entry.readState === 'unread' ? (
      <span
        className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-accent"
        aria-label="Non lu"
      />
    ) : null;
  const checkbox = (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={selected ? 'Désélectionner' : 'Sélectionner'}
      onClick={(e) => {
        e.stopPropagation();
        onToggleSelect();
      }}
      className={cn(
        'ts-focus flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all',
        selected
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-line bg-surface text-transparent',
        !selectMode && !selected && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
      )}
    >
      <Check size={12} strokeWidth={3} />
    </button>
  );

  if (layout === 'list') {
    return (
      <div
        role="listitem"
        data-testid="entry-row"
        data-entry-id={entry.id}
        onClick={onClick}
        className={cn(
          'group relative flex cursor-pointer items-center gap-3 border-b border-line/70 px-4 py-2.5 transition-colors hover:bg-subtle/70',
          selected && 'bg-accent-soft/60 hover:bg-accent-soft',
        )}
      >
        {unreadDot}
        {checkbox}
        <Avatar url={first?.author.avatarUrl} handle={entry.authorHandle} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'truncate text-[13.5px] text-fg',
                entry.readState === 'unread' ? 'font-semibold' : 'font-medium',
              )}
            >
              {entry.title}
            </span>
          </div>
          <div className="truncate text-[12px] text-muted">
            {entry.authorName ?? entry.authorHandle} · {entryAuthorLabel(entry)}
            {entry.publishedAt ? ` · ${formatDate(entry.publishedAt)}` : ''}
          </div>
        </div>
        <div className="hidden shrink-0 md:block">
          <Meta entry={entry} category={category} />
        </div>
        <span
          className="w-20 shrink-0 text-right text-[11.5px] text-faint"
          title={`Enregistré ${formatDate(entry.savedAt)}`}
        >
          {formatRelative(entry.savedAt)}
        </span>
        <button
          type="button"
          aria-label={entry.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={(e) => {
            e.stopPropagation();
            actions.update(entry, { favorite: !entry.favorite });
          }}
          className={cn(
            'ts-focus rounded p-1',
            entry.favorite
              ? 'text-warning'
              : 'text-faint opacity-0 hover:text-fg group-hover:opacity-100',
          )}
        >
          <Star size={14} fill={entry.favorite ? 'currentColor' : 'none'} />
        </button>
        <div onClick={(e) => e.stopPropagation()}>
          <EntryMenu
            entry={entry}
            actions={actions}
            collections={collections}
            categories={categories}
          />
        </div>
      </div>
    );
  }

  return (
    <article
      data-testid="entry-card"
      data-entry-id={entry.id}
      onClick={onClick}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-surface transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-px hover:shadow-pop',
        selected ? 'border-accent ring-2 ring-accent/25' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <Avatar url={first?.author.avatarUrl} handle={entry.authorHandle} size={36} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13.5px] font-semibold text-fg">
            {entry.authorName ?? entry.authorHandle}
          </div>
          <div className="truncate text-[12px] text-muted">
            {first?.reddit?.subreddit ? `r/${first.reddit.subreddit} · ` : ''}
            {entryAuthorLabel(entry)}
            {entry.publishedAt ? ` · ${formatDate(entry.publishedAt)}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {checkbox}
        </div>
      </div>
      <div className="px-4 pb-3 pt-3">
        <h3
          className={cn(
            'line-clamp-2 text-[14.5px] leading-snug text-fg',
            entry.readState === 'unread' ? 'font-semibold' : 'font-medium',
          )}
        >
          {entry.readState === 'unread' ? (
            <Circle
              size={7}
              className="mr-1.5 inline -translate-y-px fill-accent text-accent"
              aria-label="Non lu"
            />
          ) : null}
          {entry.title}
        </h3>
        {preview && preview !== entry.title ? (
          <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted">{preview}</p>
        ) : null}
      </div>
      {first?.media.length || first?.quoted?.media?.length || first?.article?.coverUrl ? (
        <div className="mx-4 mb-3 h-36 overflow-hidden rounded-xl bg-subtle">
          <Thumb tweet={first} />
        </div>
      ) : null}
      <div className="mt-auto flex items-center gap-2 border-t border-line/70 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <Meta entry={entry} category={category} />
        </div>
        <span
          className="shrink-0 text-[11.5px] text-faint"
          title={`Enregistré le ${formatDate(entry.savedAt)}`}
        >
          {formatRelative(entry.savedAt)}
        </span>
        <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label={entry.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            onClick={() => actions.update(entry, { favorite: !entry.favorite })}
            className={cn(
              'ts-focus rounded-md p-1.5 transition-colors',
              entry.favorite ? 'text-warning' : 'text-faint hover:text-fg',
            )}
          >
            <Star size={14} fill={entry.favorite ? 'currentColor' : 'none'} />
          </button>
          {entry.readState === 'read' ? (
            <span className="p-1.5 text-success" aria-label="Lu">
              <CheckCircle2 size={14} />
            </span>
          ) : null}
          <EntryMenu
            entry={entry}
            actions={actions}
            collections={collections}
            categories={categories}
          />
        </div>
      </div>
    </article>
  );
}

export function ThreadCardSkeleton({ layout }: { layout: 'cards' | 'list' }) {
  if (layout === 'list')
    return (
      <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3">
        <div className="skeleton h-7 w-7 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-3.5 w-2/3" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      </div>
    );
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex gap-3">
        <div className="skeleton h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-3.5 w-1/2" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-5/6" />
        <div className="skeleton h-3.5 w-2/3" />
      </div>
    </div>
  );
}
