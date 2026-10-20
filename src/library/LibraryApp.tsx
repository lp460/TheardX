import { useLiveQuery } from 'dexie-react-hooks';
import {
  Clock,
  Command as CommandIcon,
  Database,
  Download,
  Folder,
  Hash,
  Inbox,
  Layers3,
  Settings as SettingsIcon,
  Star,
  Tag,
  Circle,
  Keyboard,
  MousePointerClick,
  Pin,
  FolderCog,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CollectionManager } from '@/components/CollectionManager';
import { useHotkeys, useSettings, useThemeClass } from '@/components/hooks';
import { Logo } from '@/components/Logo';
import { SearchCommand, type CommandAction } from '@/components/SearchCommand';
import { SettingsPanel, StorageMeter } from '@/components/SettingsPanel';
import { ToastNotification } from '@/components/ToastNotification';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Kbd, SectionTitle } from '@/components/ui/primitives';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { repository } from '@/storage/repository';
import { exportLibrary } from '@/storage/backup';
import { downloadFile } from '@/utils/download';
import { isoDay } from '@/utils/format';
import { copyEntry, openReader } from './actions';
import { LibraryView } from './LibraryView';
import { parseHash, useLibrary, type View } from './store';

function NavItem({
  active,
  onClick,
  icon,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count?: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'ts-focus group flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition-colors',
        active
          ? 'bg-surface font-medium text-fg shadow-sm ring-1 ring-line'
          : 'text-muted hover:bg-subtle hover:text-fg',
      )}
    >
      <span
        className={cn(
          'flex w-4 justify-center',
          active ? 'text-accent' : 'text-faint group-hover:text-muted',
        )}
        style={color ? { color } : undefined}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 ? (
        <span className="text-[11.5px] tabular-nums text-faint">{count}</span>
      ) : null}
    </button>
  );
}

function same(a: View, b: View): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Welcome() {
  const steps = [
    {
      icon: <Pin size={16} />,
      title: 'Épinglez ThreadShelf',
      text: 'Dans Arc : menu Extensions (icône puzzle dans la barre latérale) → épinglez ThreadShelf pour accéder à la popup.',
    },
    {
      icon: <MousePointerClick size={16} />,
      title: 'Ouvrez une publication sur X',
      text: 'Une petite barre « ThreadShelf · Enregistrer · Copier · Lire » apparaît sous la publication ouverte.',
    },
    {
      icon: <Layers3 size={16} />,
      title: 'Enregistrez un thread',
      text: 'ThreadShelf reconstruit le thread de l’auteur et indique s’il est complet, partiel ou s’il faut faire défiler pour charger la suite.',
    },
    {
      icon: <Keyboard size={16} />,
      title: 'Raccourcis',
      text: '⌥⇧S enregistrer · ⌥⇧C copier · ⌥⇧L bibliothèque · ⌘K rechercher ici.',
    },
  ];
  return (
    <div className="mx-auto max-w-2xl px-6 py-14 animate-ts-in">
      <Logo />
      <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.02em] text-fg">
        Bienvenue dans ThreadShelf
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Vos threads X, enregistrés localement, lisibles sans distraction, copiables en un geste.
        Rien ne quitte votre navigateur.
      </p>
      <ol className="mt-8 grid gap-3 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2 text-accent">
              {s.icon}
              <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                Étape {i + 1}
              </span>
            </div>
            <h2 className="mt-2 text-[14px] font-semibold text-fg">{s.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex gap-2">
        <Button
          variant="primary"
          onClick={() => window.open('https://x.com/home', '_blank', 'noopener')}
        >
          Ouvrir X
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            location.hash = '#/';
          }}
        >
          Aller à la bibliothèque
        </Button>
      </div>
    </div>
  );
}

export function LibraryApp() {
  const [settings, updateSettings] = useSettings();
  useThemeClass(settings.theme);
  const s = useLibrary();
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    const onHash = () =>
      useLibrary.setState({ view: parseHash(location.hash), selected: new Set() });
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, []);

  const entries = useLiveQuery(() => repository.listEntries(), []);
  const collections = useLiveQuery(() => repository.listCollections(), [], []);
  const categories = useLiveQuery(() => repository.listCategories(), [], []);
  const tags = useLiveQuery(() => repository.listTags(), [], []);

  const counts = useMemo(() => {
    const e = entries ?? [];
    return {
      all: e.length,
      later: e.filter((x) => x.readLater && x.readState !== 'read').length,
      unread: e.filter((x) => x.readState === 'unread').length,
      favorites: e.filter((x) => x.favorite).length,
      collection: (id: string) => e.filter((x) => x.collectionIds.includes(id)).length,
      category: (id: string) => e.filter((x) => x.categoryId === id).length,
    };
  }, [entries]);

  useHotkeys(
    {
      'mod+k': () => s.setCommandOpen(true),
      '/': () =>
        document.querySelector<HTMLInputElement>('[data-testid="library-search"]')?.focus(),
      escape: () => s.clearSelection(),
    },
    [s],
  );

  useEffect(() => {
    document.title = 'ThreadShelf — Bibliothèque';
  }, []);

  const go = (v: View) => s.setView(v);
  const commandActions: CommandAction[] = [
    {
      id: 'all',
      label: 'Toute la bibliothèque',
      icon: <Inbox size={14} />,
      run: () => go({ kind: 'all' }),
    },
    {
      id: 'later',
      label: 'À lire plus tard',
      icon: <Clock size={14} />,
      run: () => go({ kind: 'later' }),
    },
    { id: 'fav', label: 'Favoris', icon: <Star size={14} />, run: () => go({ kind: 'favorites' }) },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: <SettingsIcon size={14} />,
      run: () => go({ kind: 'settings' }),
    },
    {
      id: 'backup',
      label: 'Exporter la bibliothèque (JSON)',
      icon: <Download size={14} />,
      run: async () =>
        downloadFile(
          JSON.stringify(
            await exportLibrary({ settings, appVersion: chrome.runtime.getManifest().version }),
            null,
            2,
          ),
          `threadshelf-sauvegarde-${isoDay()}.json`,
          'application/json',
        ),
    },
  ];

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <aside
          className="flex w-60 shrink-0 flex-col border-r border-line bg-subtle/40"
          aria-label="Navigation"
        >
          <div className="flex h-14 items-center px-4">
            <Logo />
          </div>
          <div className="px-3">
            <button
              type="button"
              onClick={() => s.setCommandOpen(true)}
              className="ts-focus flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-faint transition-colors hover:text-muted"
            >
              <CommandIcon size={13} /> Rechercher…{' '}
              <span className="ml-auto">
                <Kbd>⌘K</Kbd>
              </span>
            </button>
          </div>
          <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
            <div className="space-y-0.5">
              <NavItem
                active={same(s.view, { kind: 'all' })}
                onClick={() => go({ kind: 'all' })}
                icon={<Inbox size={15} />}
                label="Tout"
                count={counts.all}
              />
              <NavItem
                active={same(s.view, { kind: 'later' })}
                onClick={() => go({ kind: 'later' })}
                icon={<Clock size={15} />}
                label="À lire plus tard"
                count={counts.later}
              />
              <NavItem
                active={same(s.view, { kind: 'unread' })}
                onClick={() => go({ kind: 'unread' })}
                icon={<Circle size={13} />}
                label="Non lus"
                count={counts.unread}
              />
              <NavItem
                active={same(s.view, { kind: 'favorites' })}
                onClick={() => go({ kind: 'favorites' })}
                icon={<Star size={15} />}
                label="Favoris"
                count={counts.favorites}
              />
              <NavItem
                active={same(s.view, { kind: 'duplicates' })}
                onClick={() => go({ kind: 'duplicates' })}
                icon={<Layers3 size={15} />}
                label="Doublons"
              />
            </div>
            <div className="flex items-center justify-between pr-1">
              <SectionTitle>Collections</SectionTitle>
              <button
                type="button"
                aria-label="Gérer les collections et catégories"
                onClick={() => setManageOpen(true)}
                className="ts-focus mt-3 rounded p-1 text-faint hover:text-fg"
              >
                <FolderCog size={13} />
              </button>
            </div>
            <div className="space-y-0.5">
              {collections.map((c) => (
                <NavItem
                  key={c.id}
                  active={same(s.view, { kind: 'collection', id: c.id })}
                  onClick={() => go({ kind: 'collection', id: c.id })}
                  icon={<Folder size={14} />}
                  color={c.color}
                  label={c.name}
                  count={counts.collection(c.id)}
                />
              ))}
              {!collections.length ? (
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  className="px-2 py-1 text-[12.5px] text-faint hover:text-muted"
                >
                  + Nouvelle collection
                </button>
              ) : null}
            </div>
            {categories.length ? (
              <>
                <SectionTitle>Catégories</SectionTitle>
                <div className="space-y-0.5">
                  {categories.map((c) => (
                    <NavItem
                      key={c.id}
                      active={same(s.view, { kind: 'category', id: c.id })}
                      onClick={() => go({ kind: 'category', id: c.id })}
                      icon={<Tag size={14} />}
                      color={c.color}
                      label={c.name}
                      count={counts.category(c.id)}
                    />
                  ))}
                </div>
              </>
            ) : null}
            {tags.length ? (
              <>
                <SectionTitle>Tags</SectionTitle>
                <div className="space-y-0.5">
                  {tags.slice(0, 12).map((t) => (
                    <NavItem
                      key={t.tag}
                      active={same(s.view, { kind: 'tag', tag: t.tag })}
                      onClick={() => go({ kind: 'tag', tag: t.tag })}
                      icon={<Hash size={14} />}
                      label={t.tag}
                      count={t.count}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </nav>
          <div className="border-t border-line px-3 py-2">
            <div className="px-1">
              <StorageMeterCompact />
            </div>
            <NavItem
              active={same(s.view, { kind: 'settings' })}
              onClick={() => go({ kind: 'settings' })}
              icon={<SettingsIcon size={15} />}
              label="Paramètres"
            />
          </div>
        </aside>

        <main className="relative flex-1 overflow-y-auto" id="main">
          {s.view.kind === 'settings' ? (
            <div className="mx-auto max-w-3xl px-6 py-8">
              <h1 className="mb-5 text-[20px] font-semibold tracking-[-0.015em] text-fg">
                Paramètres
              </h1>
              <SettingsPanel />
            </div>
          ) : s.view.kind === 'welcome' ? (
            <Welcome />
          ) : (
            <LibraryView
              entries={entries}
              collections={collections}
              categories={categories}
              settings={settings}
              updateSettings={updateSettings}
            />
          )}
        </main>
      </div>
      <SearchCommand
        open={s.commandOpen}
        onOpenChange={s.setCommandOpen}
        entries={entries ?? []}
        categories={categories}
        collections={collections}
        onOpenEntry={(e) => openReader(e.id)}
        onCopyEntry={(e) => void copyEntry(e.id)}
        actions={commandActions}
      />
      <CollectionManager
        open={manageOpen}
        onOpenChange={setManageOpen}
        collections={collections}
        categories={categories}
      />
      <ToastNotification />
    </TooltipProvider>
  );
}

function StorageMeterCompact() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pb-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ts-focus flex w-full items-center gap-2 rounded-md px-1 py-1 text-[12px] text-faint hover:text-muted"
        aria-expanded={open}
      >
        <Database size={13} /> Stockage local
      </button>
      {open ? <StorageMeter /> : null}
    </div>
  );
}
