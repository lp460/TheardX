import { Command } from 'cmdk';
import * as RD from '@radix-ui/react-dialog';
import {
  BookOpen,
  Clock,
  Copy,
  FileJson,
  Folder,
  Search,
  Settings,
  Star,
  Inbox,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Category, Collection, Entry } from '@/types/model';
import { searchEntries } from '@/storage/search';
import { formatDate } from '@/utils/format';
import { Kbd } from './ui/primitives';

export interface CommandAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
  shortcut?: string;
}

const itemCls =
  'flex h-10 cursor-default items-center gap-3 rounded-lg px-3 text-[13px] text-fg aria-selected:bg-subtle data-[selected=true]:bg-subtle';

/** ⌘K palette: instant search across saved entries plus navigation commands. */
export function SearchCommand({
  open,
  onOpenChange,
  entries,
  categories,
  collections,
  onOpenEntry,
  onCopyEntry,
  actions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entries: Entry[];
  categories: Category[];
  collections: Collection[];
  onOpenEntry: (e: Entry) => void;
  onCopyEntry: (e: Entry) => void;
  actions: CommandAction[];
}) {
  const [q, setQ] = useState('');
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const results = useMemo(
    () => searchEntries(entries, q, catMap).slice(0, 30),
    [entries, q, catMap],
  );
  const filteredActions = actions.filter(
    (a) => !q || a.label.toLowerCase().includes(q.toLowerCase()),
  );
  const filteredCollections = collections.filter(
    (c) => q && c.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <RD.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQ('');
      }}
    >
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] animate-ts-fade" />
        <RD.Content
          className="fixed left-1/2 top-[14vh] z-50 w-[min(92vw,640px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-elevated shadow-float animate-ts-in"
          aria-describedby={undefined}
        >
          <RD.Title className="sr-only">Rechercher</RD.Title>
          <Command shouldFilter={false} label="Recherche ThreadShelf" loop>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={16} className="text-faint" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder="Rechercher… (texte, @auteur, #tag)"
                className="h-12 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
                data-testid="command-input"
              />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="max-h-[52vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted">
                Aucun résultat pour « {q} ».
              </Command.Empty>
              {results.length ? (
                <Command.Group
                  heading={q ? 'Entrées' : 'Récentes'}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-faint"
                >
                  {results.map((e) => (
                    <Command.Item
                      key={e.id}
                      value={`entry-${e.id}`}
                      onSelect={() => {
                        onOpenEntry(e);
                        onOpenChange(false);
                      }}
                      className={itemCls}
                    >
                      <BookOpen size={14} className="shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{e.title}</span>
                      <span className="shrink-0 text-[11.5px] text-faint">
                        @{e.authorHandle}
                        {e.publishedAt ? ` · ${formatDate(e.publishedAt)}` : ''}
                      </span>
                      <button
                        type="button"
                        aria-label="Copier"
                        className="shrink-0 rounded p-1 text-faint hover:text-fg"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onCopyEntry(e);
                        }}
                      >
                        <Copy size={13} />
                      </button>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {filteredCollections.length ? (
                <Command.Group
                  heading="Collections"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-faint"
                >
                  {filteredCollections.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`col-${c.id}`}
                      onSelect={() => {
                        location.hash = `#/collection/${c.id}`;
                        onOpenChange(false);
                      }}
                      className={itemCls}
                    >
                      <Folder size={14} style={{ color: c.color }} /> {c.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {filteredActions.length ? (
                <Command.Group
                  heading="Actions"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-faint"
                >
                  {filteredActions.map((a) => (
                    <Command.Item
                      key={a.id}
                      value={`act-${a.id}`}
                      onSelect={() => {
                        a.run();
                        onOpenChange(false);
                      }}
                      className={itemCls}
                    >
                      <span className="text-muted">{a.icon}</span>
                      <span className="flex-1">{a.label}</span>
                      {a.shortcut ? <Kbd>{a.shortcut}</Kbd> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

export const COMMAND_ICONS = { Inbox, Clock, Star, Settings, FileJson };
