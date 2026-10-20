import { useLiveQuery } from 'dexie-react-hooks';
import * as Popover from '@radix-ui/react-popover';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckSquare,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Keyboard,
  ListOrdered,
  Minus,
  Monitor,
  Moon,
  Plus,
  Printer,
  Star,
  Sun,
  Type,
  WifiOff,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CompletenessBadge } from '@/components/CompletenessBadge';
import { ExportDialog } from '@/components/ExportDialog';
import { useHotkeys, useSettings, useThemeClass } from '@/components/hooks';
import { MediaProvider, useOnline } from '@/components/media';
import { AuthorLine, QuotedCard, TweetCard } from '@/components/TweetCard';
import { ToastNotification } from '@/components/ToastNotification';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu';
import { EmptyState, Kbd, Skeleton, Textarea } from '@/components/ui/primitives';
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip';
import { copyEntry } from '@/library/actions';
import { repository } from '@/storage/repository';
import { issueLabel } from '@/thread-engine/labels';
import type { EntryBundle, Tweet } from '@/types/model';
import { formatDate, formatDateTime } from '@/utils/format';
import { segmentsToPlain, truncate } from '@/utils/text';

const params = new URLSearchParams(location.search);
const ENTRY_ID = params.get('id') ?? '';
const PRINT = params.get('print') === '1';

function libraryUrl(): string {
  return chrome.runtime.getURL('library/index.html');
}

function ReaderSettings() {
  const [s, update] = useSettings();
  const btn =
    'ts-focus inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium transition-colors';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Réglages de lecture">
          <Type size={16} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-72 rounded-2xl border border-line bg-elevated p-3 shadow-float animate-ts-in"
        >
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Thème
              </div>
              <div className="flex gap-1 rounded-xl bg-subtle p-1">
                {(
                  [
                    ['light', Sun, 'Clair'],
                    ['dark', Moon, 'Sombre'],
                    ['system', Monitor, 'Système'],
                  ] as const
                ).map(([v, Icon, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={s.theme === v}
                    onClick={() => update({ theme: v })}
                    className={cn(
                      btn,
                      s.theme === v ? 'bg-surface text-fg shadow-sm' : 'text-muted',
                    )}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Police
              </div>
              <div className="flex gap-1 rounded-xl bg-subtle p-1">
                <button
                  type="button"
                  aria-pressed={s.reader.font === 'serif'}
                  onClick={() => update({ reader: { font: 'serif' } })}
                  className={cn(
                    btn,
                    'font-serif',
                    s.reader.font === 'serif' ? 'bg-surface text-fg shadow-sm' : 'text-muted',
                  )}
                >
                  Serif
                </button>
                <button
                  type="button"
                  aria-pressed={s.reader.font === 'sans'}
                  onClick={() => update({ reader: { font: 'sans' } })}
                  className={cn(
                    btn,
                    s.reader.font === 'sans' ? 'bg-surface text-fg shadow-sm' : 'text-muted',
                  )}
                >
                  Sans-serif
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-fg">Taille</span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Réduire le texte"
                  onClick={() =>
                    update({ reader: { fontSize: Math.max(14, s.reader.fontSize - 1) } })
                  }
                >
                  <Minus size={13} />
                </Button>
                <span className="w-10 text-center text-[12.5px] tabular-nums text-muted">
                  {s.reader.fontSize}px
                </span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Agrandir le texte"
                  onClick={() =>
                    update({ reader: { fontSize: Math.min(26, s.reader.fontSize + 1) } })
                  }
                >
                  <Plus size={13} />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-fg">Largeur</span>
              <input
                type="range"
                min={520}
                max={960}
                step={20}
                value={s.reader.width}
                onChange={(e) => update({ reader: { width: Number(e.target.value) } })}
                aria-label="Largeur de lecture"
                className="w-36 accent-[hsl(var(--ts-accent))]"
              />
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const SHORTCUTS: [string, string][] = [
  ['j / k', 'Publication suivante / précédente'],
  ['+ / −', 'Taille du texte'],
  ['[ / ]', 'Largeur de lecture'],
  ['t', 'Basculer clair / sombre'],
  ['s', 'Serif / sans-serif'],
  ['c', 'Copier en Markdown'],
  ['f', 'Favori'],
  ['p', 'Imprimer / PDF'],
  ['Échap', 'Retour à la bibliothèque'],
  ['?', 'Afficher cette aide'],
];

function Toc({
  posts,
  active,
  onJump,
}: {
  posts: Tweet[];
  active: number;
  onJump: (i: number) => void;
}) {
  return (
    <nav
      aria-label="Table des matières"
      className="sticky top-20 hidden max-h-[calc(100vh-7rem)] w-56 shrink-0 overflow-y-auto pr-2 xl:block print:hidden"
    >
      <div className="mb-2 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
        <ListOrdered size={12} /> Sommaire
      </div>
      <ol className="space-y-px">
        {posts.map((t, i) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-current={active === i ? 'true' : undefined}
              className={cn(
                'ts-focus flex w-full gap-2 rounded-md px-2 py-1 text-left text-[12px] leading-snug transition-colors',
                active === i ? 'bg-subtle text-fg' : 'text-muted hover:text-fg',
              )}
            >
              <span className="w-5 shrink-0 tabular-nums text-faint">{i + 1}</span>
              <span className="line-clamp-2">
                {truncate(segmentsToPlain(t.text).replace(/\s+/g, ' '), 70) || 'Média'}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function NoteEditor({ bundle }: { bundle: EntryBundle }) {
  const [note, setNote] = useState(bundle.entry.note);
  const [saved, setSaved] = useState(true);
  useEffect(() => setNote(bundle.entry.note), [bundle.entry.note]);
  useEffect(() => {
    if (saved) return;
    const t = setTimeout(async () => {
      await repository.updateEntry(bundle.entry.id, { note });
      setSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [note, saved, bundle.entry.id]);
  return (
    <section className="mt-14 font-sans print:hidden" aria-labelledby="note-h">
      <div className="flex items-center justify-between">
        <h2 id="note-h" className="text-[12px] font-semibold uppercase tracking-wide text-faint">
          Note personnelle
        </h2>
        <span className="text-[11.5px] text-faint" aria-live="polite">
          {saved ? 'Enregistrée' : 'Modification…'}
        </span>
      </div>
      <Textarea
        rows={4}
        className="mt-2 bg-transparent"
        value={note}
        placeholder="Ce que je retiens de ce thread…"
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        data-testid="reader-note"
      />
    </section>
  );
}

export function ThreadReader() {
  const [settings, update] = useSettings();
  const dark = useThemeClass(PRINT ? 'light' : settings.theme);
  const online = useOnline();
  const bundle = useLiveQuery(
    () => (ENTRY_ID ? repository.getBundle(ENTRY_ID) : Promise.resolve(null)),
    [],
    undefined,
  );
  const [active, setActive] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [scrolled, setScrolled] = useState(false);
  const postRefs = useRef<(HTMLElement | null)[]>([]);
  const markedRead = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const posts = useMemo(
    () =>
      bundle
        ? bundle.entry.tweetIds.map((id) => bundle.tweets[id]).filter((t): t is Tweet => !!t)
        : [],
    [bundle],
  );
  const context = useMemo(
    () =>
      bundle
        ? bundle.entry.contextTweetIds.map((id) => bundle.tweets[id]).filter((t): t is Tweet => !!t)
        : [],
    [bundle],
  );
  const references = useMemo(
    () =>
      bundle
        ? bundle.entry.referenceTweetIds
            .map((id) => bundle.tweets[id])
            .filter((t): t is Tweet => !!t)
        : [],
    [bundle],
  );
  const first = posts[0];

  useEffect(() => {
    if (bundle) document.title = `${bundle.entry.title} — ThreadShelf`;
  }, [bundle]);

  // Active post (table of contents highlight).
  useEffect(() => {
    if (!posts.length || PRINT) return;
    const io = new IntersectionObserver(
      (items) => {
        for (const it of items)
          if (it.isIntersecting) setActive(Number((it.target as HTMLElement).dataset.index));
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    postRefs.current.forEach((el) => el && io.observe(el));
    const onScroll = () => setScrolled(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [posts]);

  // Read state: the end of the thread stayed visible for a moment.
  useEffect(() => {
    const el = endRef.current;
    if (!el || !bundle || PRINT || bundle.entry.readState === 'read' || markedRead.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(([it]) => {
      if (timer) clearTimeout(timer);
      if (it?.isIntersecting) {
        timer = setTimeout(() => {
          markedRead.current = true;
          void repository.updateEntry(bundle.entry.id, {
            readState: 'read',
            readProgress: 1,
            lastReadAt: Date.now(),
          });
        }, 1200);
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [bundle]);

  // Print / PDF mode.
  useEffect(() => {
    if (!PRINT || !bundle) return;
    const imgs = Array.from(document.images);
    Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((r) => {
              img.onload = img.onerror = () => r(null);
            }),
      ),
    )
      .then(() => new Promise((r) => setTimeout(r, 250)))
      .then(() => window.print());
  }, [bundle]);

  const jump = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(posts.length - 1, i));
      postRefs.current[idx]?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
      setActive(idx);
    },
    [posts.length],
  );

  const toggleFavorite = useCallback(async () => {
    if (!bundle) return;
    await repository.updateEntry(bundle.entry.id, { favorite: !bundle.entry.favorite });
  }, [bundle]);

  useHotkeys(
    {
      j: () => jump(active + 1),
      k: () => jump(active - 1),
      '+': () => update({ reader: { fontSize: Math.min(26, settings.reader.fontSize + 1) } }),
      '=': () => update({ reader: { fontSize: Math.min(26, settings.reader.fontSize + 1) } }),
      '-': () => update({ reader: { fontSize: Math.max(14, settings.reader.fontSize - 1) } }),
      '[': () => update({ reader: { width: Math.max(520, settings.reader.width - 40) } }),
      ']': () => update({ reader: { width: Math.min(960, settings.reader.width + 40) } }),
      t: () => update({ theme: dark ? 'light' : 'dark' }),
      s: () => update({ reader: { font: settings.reader.font === 'serif' ? 'sans' : 'serif' } }),
      c: () => bundle && void copyEntry(bundle.entry.id, 'markdown'),
      f: () => void toggleFavorite(),
      p: () => window.print(),
      escape: () => {
        if (helpOpen || exportOpen) return;
        location.href = libraryUrl();
      },
      '?': () => setHelpOpen(true),
    },
    [active, settings, bundle, helpOpen, exportOpen, jump, toggleFavorite, dark],
  );

  if (bundle === undefined) {
    return (
      <div className="mx-auto max-w-[680px] px-6 py-20" aria-busy="true">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="mt-10 space-y-3">
          {[100, 96, 90, 98, 70].map((w) => (
            <div key={w} style={{ width: `${w}%` }}>
              <Skeleton className="h-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!bundle) {
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="Entrée introuvable"
        action={
          <Button variant="primary" onClick={() => (location.href = libraryUrl())}>
            Retour à la bibliothèque
          </Button>
        }
      >
        Cette entrée a peut-être été supprimée.
      </EmptyState>
    );
  }

  const { entry } = bundle;
  const c = entry.completeness;
  const incomplete = entry.kind === 'thread' && c.status !== 'complete';
  const fontClass = settings.reader.font === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <TooltipProvider>
      <MediaProvider records={bundle.media}>
        <header
          className={cn(
            'sticky top-0 z-20 border-b bg-[hsl(var(--ts-reader-bg)/0.85)] backdrop-blur-md transition-colors print:hidden',
            scrolled ? 'border-line' : 'border-transparent',
          )}
        >
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (location.href = libraryUrl())}
              aria-label="Retour à la bibliothèque"
            >
              <ArrowLeft size={15} /> Bibliothèque
            </Button>
            <div
              className={cn(
                'min-w-0 flex-1 truncate text-center text-[13px] font-medium text-fg transition-opacity',
                scrolled ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden={!scrolled}
            >
              {entry.title}
            </div>
            {!online ? (
              <Tooltip label="Hors ligne — les images enregistrées restent disponibles">
                <span
                  tabIndex={0}
                  className="flex items-center gap-1 rounded-md bg-subtle px-2 py-1 text-[11.5px] text-muted"
                >
                  <WifiOff size={12} /> Hors ligne
                </span>
              </Tooltip>
            ) : null}
            <Tooltip label={entry.favorite ? 'Retirer des favoris (f)' : 'Favori (f)'}>
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={entry.favorite}
                aria-label="Favori"
                onClick={toggleFavorite}
                className={entry.favorite ? 'text-warning' : undefined}
              >
                <Star size={16} fill={entry.favorite ? 'currentColor' : 'none'} />
              </Button>
            </Tooltip>
            <Tooltip label={entry.readLater ? 'Retirer de « À lire »' : 'À lire plus tard'}>
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={entry.readLater}
                aria-label="À lire plus tard"
                onClick={() => repository.updateEntry(entry.id, { readLater: !entry.readLater })}
                className={entry.readLater ? 'text-accent' : undefined}
              >
                <Clock size={16} />
              </Button>
            </Tooltip>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Copier">
                  <Copy size={16} />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem
                  icon={<Copy size={14} />}
                  shortcut="c"
                  onSelect={() => copyEntry(entry.id, 'markdown')}
                >
                  Copier le thread (Markdown)
                </MenuItem>
                <MenuItem icon={<Copy size={14} />} onSelect={() => copyEntry(entry.id, 'text')}>
                  Copier le thread (texte brut)
                </MenuItem>
                <MenuItem
                  icon={<CheckSquare size={14} />}
                  onSelect={() => {
                    setSelecting(true);
                    setSelection(new Set());
                  }}
                >
                  Copier une sélection…
                </MenuItem>
              </MenuContent>
            </Menu>
            <Tooltip label="Exporter">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Exporter"
                onClick={() => setExportOpen(true)}
              >
                <Download size={16} />
              </Button>
            </Tooltip>
            <Tooltip label="Imprimer / PDF (p)">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Imprimer"
                onClick={() => window.print()}
              >
                <Printer size={16} />
              </Button>
            </Tooltip>
            <ReaderSettings />
            <Tooltip label="Raccourcis (?)">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Raccourcis clavier"
                onClick={() => setHelpOpen(true)}
              >
                <Keyboard size={16} />
              </Button>
            </Tooltip>
          </div>
        </header>

        <div className="mx-auto flex max-w-6xl justify-center gap-10 px-4 pb-32 pt-10 print:block print:p-0">
          {posts.length > 3 ? <Toc posts={posts} active={active} onJump={jump} /> : null}
          <article
            className="min-w-0 flex-1 print:max-w-none"
            style={{ maxWidth: settings.reader.width }}
            data-testid="reader-article"
          >
            <header className="mb-10 font-sans">
              {first ? <AuthorLine tweet={first} size={44} showDate={false} /> : null}
              <h1
                className={cn(
                  'mt-6 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-fg',
                  fontClass,
                )}
                data-testid="reader-title"
              >
                {entry.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                {entry.publishedAt ? (
                  <time dateTime={entry.publishedAt} title={formatDateTime(entry.publishedAt)}>
                    {formatDate(entry.publishedAt, { month: 'long' })}
                  </time>
                ) : null}
                <span aria-hidden>·</span>
                <span data-testid="reader-count">
                  {posts.length} publication{posts.length > 1 ? 's' : ''} capturée
                  {posts.length > 1 ? 's' : ''}
                </span>
                {entry.kind === 'thread' || entry.kind === 'selection' ? (
                  <CompletenessBadge completeness={c} />
                ) : null}
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline print:hidden"
                >
                  Voir sur X <ExternalLink size={11} />
                </a>
              </div>
              {incomplete ? (
                <div
                  role="note"
                  className="mt-5 rounded-xl border border-warning/30 bg-warning/[0.07] px-4 py-3 text-[13px] leading-relaxed text-fg"
                  data-testid="reader-incomplete"
                >
                  <div className="flex items-center gap-2 font-medium text-warning">
                    <AlertTriangle size={14} /> Thread potentiellement incomplet
                  </div>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {c.issues
                      .filter((i) => i !== 'truncated-text')
                      .map((i) => (
                        <li key={i}>{issueLabel(i)}</li>
                      ))}
                  </ul>
                  <p className="mt-1 text-muted">
                    Ouvrez la publication sur X et enregistrez à nouveau : ThreadShelf complétera
                    cette entrée sans créer de doublon.
                  </p>
                </div>
              ) : null}
              {entry.offline !== 'full' && !online ? (
                <p className="mt-3 text-[12.5px] text-muted">
                  Certaines images n’ont pas été enregistrées et ne sont pas visibles hors ligne.
                </p>
              ) : null}
            </header>

            {context.length ? (
              <aside className="mb-10 font-sans" aria-label="Contexte">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  En réponse à
                </div>
                {context.map((t) => (
                  <QuotedCard
                    key={t.id}
                    quoted={{
                      id: t.id,
                      url: t.url,
                      author: t.author,
                      text: t.text,
                      createdAt: t.createdAt,
                      media: t.media,
                    }}
                    className="mt-0"
                  />
                ))}
              </aside>
            ) : null}

            <div className={cn('prose-reader', fontClass)}>
              {posts.map((t, i) => (
                <section
                  key={t.id}
                  ref={(el) => {
                    postRefs.current[i] = el;
                  }}
                  data-index={i}
                  id={`post-${i + 1}`}
                  aria-label={`Publication ${i + 1} sur ${posts.length}`}
                  className={cn(
                    'group relative scroll-mt-24 border-b border-line/60 py-7 first:pt-0 last:border-0 print:break-inside-avoid',
                    selecting && selection.has(t.id) && 'rounded-xl bg-accent-soft/50',
                  )}
                  data-testid="reader-post"
                >
                  <div className="mb-3 flex items-center gap-3 font-sans text-[11.5px] font-semibold tracking-[0.06em] text-faint">
                    {selecting ? (
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner la publication ${i + 1}`}
                        checked={selection.has(t.id)}
                        onChange={() =>
                          setSelection((s) => {
                            const n = new Set(s);
                            if (n.has(t.id)) n.delete(t.id);
                            else n.add(t.id);
                            return n;
                          })
                        }
                        className="h-4 w-4 accent-[hsl(var(--ts-accent))]"
                      />
                    ) : null}
                    {posts.length > 1 ? (
                      <span>
                        {i + 1} / {posts.length}
                      </span>
                    ) : null}
                    {t.author.handle.toLowerCase() !== entry.authorHandle.toLowerCase() ? (
                      <span className="normal-case tracking-normal text-muted">
                        @{t.author.handle}
                      </span>
                    ) : null}
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto font-normal tracking-normal text-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 focus:opacity-100 print:hidden"
                    >
                      {t.createdAt ? formatDateTime(t.createdAt) : 'Voir sur X'}
                    </a>
                  </div>
                  <TweetCard
                    tweet={t}
                    showAuthor={false}
                    textClassName={cn('text-fg', fontClass)}
                    textStyle={{ fontSize: settings.reader.fontSize, lineHeight: 1.7 }}
                  />
                </section>
              ))}
            </div>

            <div ref={endRef} aria-hidden className="h-px" data-testid="reader-end" />
            {references.length ? (
              <section className="mt-14 font-sans" aria-labelledby="refs-h">
                <h2
                  id="refs-h"
                  className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-faint"
                >
                  Références
                </h2>
                <div className="space-y-4">
                  {references.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-line bg-surface p-5">
                      <TweetCard tweet={r} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {entry.externalRefs.filter((r) => !r.captured).length ? (
              <section className="mt-8 font-sans text-[13px] text-muted">
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-faint">
                  Liens vers d’autres publications (non capturées)
                </h2>
                <ul className="space-y-1">
                  {entry.externalRefs
                    .filter((r) => !r.captured)
                    .map((r) => (
                      <li key={r.url}>
                        <a
                          className="text-accent hover:underline"
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {r.url}
                        </a>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}
            <NoteEditor bundle={bundle} />
            <footer className="mt-10 font-sans text-[12px] text-faint">
              Enregistré le {formatDateTime(entry.savedAt)} · Contenu publié par @
              {entry.authorHandle} sur X.
            </footer>
          </article>
        </div>

        {selecting ? (
          <div
            className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-line bg-elevated px-3 py-2 shadow-float animate-ts-in print:hidden"
            role="toolbar"
            aria-label="Copie d’une sélection"
          >
            <span className="text-[13px] text-fg">
              {selection.size} sélectionnée{selection.size > 1 ? 's' : ''}
            </span>
            <Button
              size="sm"
              variant="primary"
              disabled={!selection.size}
              onClick={async () => {
                await copyEntry(entry.id, 'markdown', [...selection]);
                setSelecting(false);
              }}
            >
              <Check size={13} /> Copier
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelecting(false)}>
              Annuler
            </Button>
          </div>
        ) : null}

        <ExportDialog entryIds={[entry.id]} open={exportOpen} onOpenChange={setExportOpen} />
        <Dialog open={helpOpen} onOpenChange={setHelpOpen} title="Raccourcis clavier">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13px]">
            {SHORTCUTS.map(([k, v]) => (
              <Fragment key={k}>
                <dt>
                  <Kbd>{k}</Kbd>
                </dt>
                <dd className="text-muted">{v}</dd>
              </Fragment>
            ))}
          </dl>
        </Dialog>
        <ToastNotification />
      </MediaProvider>
    </TooltipProvider>
  );
}
