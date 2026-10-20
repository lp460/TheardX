import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  Copy,
  ExternalLink,
  Layers3,
  Library,
  Loader2,
  MessageSquareQuote,
  Power,
  Save,
  Search,
  Settings,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CompletenessBadge } from '@/components/CompletenessBadge';
import { useSettings, useThemeClass } from '@/components/hooks';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Input, Kbd } from '@/components/ui/primitives';
import { copyEntry } from '@/library/actions';
import type { ContentMessage, ContentState } from '@/messaging/protocol';
import { repository } from '@/storage/repository';
import { searchEntries } from '@/storage/search';
import { domainOf } from '@/settings/schema';
import { formatRelative } from '@/utils/format';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'done'; label: string }
  | { kind: 'error'; label: string };

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function askContent<T>(tabId: number, msg: ContentMessage): Promise<T | null> {
  try {
    return (await chrome.tabs.sendMessage(tabId, msg)) as T;
  } catch {
    return null;
  }
}

function open(path: string) {
  void chrome.tabs.create({ url: chrome.runtime.getURL(path) });
  window.close();
}

export function Popup() {
  const [settings, update] = useSettings();
  useThemeClass(settings.theme);
  const [tab, setTab] = useState<chrome.tabs.Tab>();
  const [state, setState] = useState<ContentState | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [q, setQ] = useState('');
  const entries = useLiveQuery(() => repository.listEntries(), []);
  const results = useMemo(
    () => (entries ? searchEntries(entries, q).slice(0, 6) : undefined),
    [entries, q],
  );

  const domain = tab?.url
    ? (() => {
        try {
          return domainOf(new URL(tab.url).hostname);
        } catch {
          return null;
        }
      })()
    : null;

  const refresh = async () => {
    const t = await activeTab();
    setTab(t);
    if (!t?.id) return setState(null);
    setState(await askContent<ContentState>(t.id, { type: 'content.state' }));
  };
  const disabledKey = settings.disabledDomains.join();
  useEffect(() => {
    void refresh();
  }, [settings.enabled, disabledKey]);

  const run = async (
    action: Extract<ContentMessage, { type: 'content.run' }>['action'],
    label: string,
  ) => {
    if (!tab?.id) return;
    setStatus({ kind: 'busy', label });
    const res = await askContent<{ ok: boolean; message?: string; error?: string }>(tab.id, {
      type: 'content.run',
      action,
    });
    if (res?.ok) setStatus({ kind: 'done', label: res.message ?? 'Terminé' });
    else setStatus({ kind: 'error', label: res?.error ?? 'Action impossible sur cette page.' });
    void refresh();
  };

  const focal = state?.focal;
  const siteOff = domain && (!settings.enabled || settings.disabledDomains.includes(domain));

  return (
    <div className="w-[360px] bg-bg">
      <header className="flex h-12 items-center justify-between border-b border-line px-3.5">
        <Logo />
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Bibliothèque"
            title="Bibliothèque (⌥⇧L)"
            onClick={() => open('library/index.html')}
          >
            <Library size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Paramètres"
            onClick={() => open('library/index.html#/settings')}
          >
            <Settings size={15} />
          </Button>
        </div>
      </header>

      <section className="border-b border-line p-3.5" aria-label="Page actuelle">
        {state === undefined ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-8 w-full" />
          </div>
        ) : !domain ? (
          <p className="text-[13px] leading-relaxed text-muted">
            Ouvrez une publication sur <span className="font-medium text-fg">x.com</span> pour
            l’enregistrer, la copier ou la lire.
          </p>
        ) : siteOff ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted">ThreadShelf est désactivé sur {domain}.</p>
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                update({
                  enabled: true,
                  disabledDomains: settings.disabledDomains.filter((d) => d !== domain),
                })
              }
            >
              <Power size={13} /> Activer
            </Button>
          </div>
        ) : !state ? (
          <p className="text-[13px] leading-relaxed text-muted">
            Rechargez l’onglet X pour activer ThreadShelf sur cette page.
          </p>
        ) : focal ? (
          <div data-testid="popup-focal">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-fg">
                {focal.name ?? focal.handle}
              </span>
              <span className="truncate text-[12px] text-muted">@{focal.handle}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted">
              {focal.preview}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
              <Layers3 size={13} /> {focal.threadCount} publication
              {focal.threadCount > 1 ? 's' : ''} dans le thread détecté
              {focal.savedEntryId ? (
                <span className="ml-auto rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success">
                  Enregistré
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="primary"
                onClick={() => run('save-thread', 'Enregistrement…')}
                data-testid="popup-save-thread"
              >
                <Save size={14} /> Thread
              </Button>
              <Button variant="outline" onClick={() => run('save-tweet', 'Enregistrement…')}>
                <Save size={14} /> Publication
              </Button>
              <Button variant="outline" onClick={() => run('copy-thread', 'Copie…')}>
                <Copy size={14} /> Copier
              </Button>
              <Button variant="outline" onClick={() => run('open-reader', 'Ouverture…')}>
                <BookOpen size={14} /> Lire
              </Button>
              <Button
                variant="ghost"
                className="col-span-2"
                onClick={() => run('save-references', 'Enregistrement…')}
              >
                <MessageSquareQuote size={14} /> Publication + citations et liens
              </Button>
            </div>
            <div
              className={cn(
                'mt-2 min-h-[18px] text-[12px]',
                status.kind === 'error'
                  ? 'text-danger'
                  : status.kind === 'done'
                    ? 'text-success'
                    : 'text-muted',
              )}
              aria-live="polite"
              data-testid="popup-status"
            >
              {status.kind === 'busy' ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> {status.label}
                </span>
              ) : status.kind !== 'idle' ? (
                status.label
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-[13px] leading-relaxed text-muted">
            {state.detected
              ? `${state.detected} publication(s) détectée(s). Ouvrez-en une pour capturer son thread.`
              : 'Aucune publication détectée sur cette page.'}
          </p>
        )}
      </section>

      <section className="p-3.5" aria-label="Récents">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher dans la bibliothèque"
            className="pl-7"
            aria-label="Rechercher"
          />
        </div>
        <ul className="mt-2 space-y-px" data-testid="popup-recent">
          {results === undefined ? (
            [0, 1, 2].map((i) => <li key={i} className="skeleton my-1 h-9" />)
          ) : results.length ? (
            results.map((e) => (
              <li
                key={e.id}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-subtle"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => open(`reader/index.html?id=${encodeURIComponent(e.id)}`)}
                >
                  <span className="block truncate text-[13px] text-fg">{e.title}</span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
                    @{e.authorHandle} · {formatRelative(e.savedAt)}{' '}
                    {e.kind === 'thread' ? (
                      <CompletenessBadge completeness={e.completeness} compact />
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Copier"
                  onClick={() => copyEntry(e.id)}
                  className="rounded p-1 text-faint opacity-0 hover:text-fg group-hover:opacity-100 focus:opacity-100"
                >
                  <Copy size={13} />
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-3 text-center text-[12.5px] text-muted">
              {q ? 'Aucun résultat.' : 'Aucune sauvegarde pour l’instant.'}
            </li>
          )}
        </ul>
      </section>

      <footer className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[12px] text-muted">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="accent-[hsl(var(--ts-accent))]"
            data-testid="popup-enabled"
          />
          Activé sur X
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-fg"
          onClick={() => open('library/index.html')}
        >
          Bibliothèque <ExternalLink size={11} />
        </button>
      </footer>
      <div className="sr-only">
        <Kbd>⌥⇧T</Kbd>
      </div>
    </div>
  );
}
