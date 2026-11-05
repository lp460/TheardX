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
  MoreHorizontal,
  Moon,
  Plus,
  Printer,
  Share2,
  Star,
  Sun,
  Type,
  WifiOff,
  Languages,
  Highlighter,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CompletenessBadge } from '@/components/CompletenessBadge';
import { ExportDialog } from '@/components/ExportDialog';
import { useHotkeys, useSettings, useThemeClass } from '@/components/hooks';
import { MediaProvider, useOnline } from '@/components/media';
import { AuthorLine, QuotedCard, RedditBadges, TweetCard } from '@/components/TweetCard';
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
import { authorLabel, postPreviewText, truncate } from '@/utils/text';
import { vocab } from '@/utils/vocab';
import { render } from '@/export';
import {
  applyTranslations,
  googleTranslateUrl,
  sourceLanguage,
  translateBundle,
  translationSupported,
  type PostTranslation,
  type TranslateProgress,
} from '@/translate/engine';
import { translateCloudBundle } from '@/translate/cloud';
import { languageName, TARGET_LANGUAGES } from '@/translate/languages';
import { copyText } from '@/utils/clipboard';
import { toast } from '@/components/ToastNotification';
import { useWebI18n } from '@/web/i18n';
import { ShareDialog, type ShareTarget } from '@/share/ShareDialog';
import { useReaderAnnotations } from '@/annotations/ReaderAnnotations';
import { ReadingNotesDock } from './ReadingNotesDock';

const params = new URLSearchParams(location.search);
const ENTRY_ID = params.get('id') ?? '';
const PRINT = params.get('print') === '1';

function libraryUrl(): string {
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('library/index.html')
    : '/';
}

function ReaderSettings({ isWeb }: { isWeb: boolean }) {
  const { t } = useWebI18n();
  const [s, update] = useSettings();
  const btn =
    'ts-focus inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium transition-colors';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('readerOptions')}>
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
                {t('theme')}
              </div>
              <div className="flex gap-1 rounded-xl bg-subtle p-1">
                {(
                  [
                    ['light', Sun, t('light')],
                    ['dark', Moon, t('dark')],
                    ['system', Monitor, t('system')],
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
                {t('font')}
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
              <span className="text-[13px] text-fg">{t('fontSize')}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={t('readerDecrease')}
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
                  aria-label={t('readerIncrease')}
                  onClick={() =>
                    update({ reader: { fontSize: Math.min(26, s.reader.fontSize + 1) } })
                  }
                >
                  <Plus size={13} />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-fg">{t('readerWidth')}</span>
              <input
                type="range"
                min={520}
                max={960}
                step={20}
                value={s.reader.width}
                onChange={(e) => update({ reader: { width: Number(e.target.value) } })}
                aria-label={t('readerWidth')}
                className="w-36 accent-[hsl(var(--ts-accent))]"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-fg">{t('readerTranslateTo')}</span>
              <select
                value={s.translateTo}
                onChange={(e) => update({ translateTo: e.target.value })}
                aria-label={t('readerTranslationLanguage')}
                className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12.5px]"
              >
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {languageName(l)}
                  </option>
                ))}
              </select>
            </div>
            {isWeb && !translationSupported() ? (
              <label className="block rounded-xl border border-line bg-subtle/60 p-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-fg">{t('readerAutoTranslate')}</span>
                  <input type="checkbox" checked={s.webTranslation.automatic}
                    data-testid="reader-auto-translate"
                    onChange={(event) => void update({ webTranslation: {
                      automatic: event.target.checked,
                      consentAt: event.target.checked ? Date.now() : s.webTranslation.consentAt,
                    } })}
                    className="h-4 w-4 shrink-0 accent-[hsl(var(--ts-accent))]" />
                </span>
                <span className="mt-2 block text-[11px] leading-relaxed text-muted">
                  {t('readerAutoTranslateHint')}
                </span>
              </label>
            ) : null}
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
  ['l', 'Traduire / afficher l’original'],
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
  const { t } = useWebI18n();
  return (
    <nav
      aria-label={t('readerContents')}
      className="sticky top-20 hidden max-h-[calc(100vh-7rem)] w-56 shrink-0 overflow-y-auto pr-2 xl:block print:hidden"
    >
      <div className="mb-2 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
        <ListOrdered size={12} /> {t('readerContents')}
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
                {truncate((t.article?.title || postPreviewText(t)).replace(/\s+/g, ' '), 70) ||
                  'Média'}
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
  const { t } = useWebI18n();
  const isWeb = typeof chrome === 'undefined' || !chrome.runtime?.id;
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
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [scrolled, setScrolled] = useState(false);
  const [translations, setTranslations] = useState<Record<string, PostTranslation>>({});
  const [showTranslation, setShowTranslation] = useState(false);
  const [trProgress, setTrProgress] = useState<TranslateProgress | null>(null);
  const [trError, setTrError] = useState<string | null>(null);
  const [translationsReady, setTranslationsReady] = useState(false);
  const translationPending = useRef(false);
  const manuallyViewingOriginal = useRef(false);
  const currentTarget = useRef(settings.translateTo);
  const target = settings.translateTo;
  currentTarget.current = target;
  const postRefs = useRef<(HTMLElement | null)[]>([]);
  const markedRead = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const annotationTools = useReaderAnnotations(ENTRY_ID, articleRef, !showTranslation && !PRINT);

  // What is displayed: the saved posts, or their translation.
  const view = useMemo(
    () => (bundle && showTranslation ? applyTranslations(bundle, translations, target) : bundle),
    [bundle, showTranslation, translations, target],
  );
  const posts = useMemo(
    () =>
      view ? view.entry.tweetIds.map((id) => view.tweets[id]).filter((t): t is Tweet => !!t) : [],
    [view],
  );
  const context = useMemo(
    () =>
      view
        ? view.entry.contextTweetIds.map((id) => view.tweets[id]).filter((t): t is Tweet => !!t)
        : [],
    [view],
  );
  const references = useMemo(
    () =>
      view
        ? view.entry.referenceTweetIds.map((id) => view.tweets[id]).filter((t): t is Tweet => !!t)
        : [],
    [view],
  );
  const allIds = useMemo(
    () =>
      bundle
        ? [
            ...bundle.entry.tweetIds,
            ...bundle.entry.contextTweetIds,
            ...bundle.entry.referenceTweetIds,
          ]
        : [],
    [bundle],
  );
  const sourceLangs = useMemo(
    () => [
      ...new Set(
        allIds
          .map((id) => bundle?.tweets[id])
          .filter((t): t is Tweet => !!t)
          .map(sourceLanguage),
      ),
    ],
    [allIds, bundle],
  );
  const needsTranslation = sourceLangs.some((l) => l !== target);

  // Cached translations for the chosen language (available offline).
  useEffect(() => {
    if (!allIds.length) return;
    let active = true;
    setTranslationsReady(false);
    void repository.getTranslations(allIds, target).then((cached) => {
      if (!active) return;
      setTranslations(cached);
      setTranslationsReady(true);
    });
    setShowTranslation(false);
    manuallyViewingOriginal.current = false;
    setTrError(null);
    return () => { active = false; };
  }, [allIds, target]);

  const translate = useCallback(async () => {
    if (!bundle || translationPending.current) return;
    if (showTranslation) {
      manuallyViewingOriginal.current = true;
      setShowTranslation(false);
      return;
    }
    manuallyViewingOriginal.current = false;
    const cloud = isWeb && !translationSupported();
    if (cloud && !settings.webTranslation.consentAt) {
      if (!window.confirm(t('readerCloudConfirm'))) return;
      await update({ webTranslation: { consentAt: Date.now() } });
    }
    translationPending.current = true;
    setTrError(null);
    try {
      setTrProgress({ done: 0, total: 1 });
      const fresh = await (cloud ? translateCloudBundle : translateBundle)(bundle, target, {
        existing: translations,
        onProgress: setTrProgress,
      });
      await repository.saveTranslations(fresh);
      const next = { ...translations };
      for (const r of fresh) next[r.key] = r;
      if (currentTarget.current === target) {
        setTranslations(next);
        setShowTranslation(true);
      }
    } catch (e) {
      setTrError(e instanceof Error ? e.message : String(e));
    } finally {
      setTrProgress(null);
      translationPending.current = false;
    }
  }, [bundle, showTranslation, target, translations, isWeb, settings.webTranslation.consentAt, t, update]);

  // Opt-in translation starts in Safari when a missing translation is opened online. Cached
  // translations always remain readable offline, without any request to the provider.
  useEffect(() => {
    if (!isWeb || !settings.webTranslation.automatic || !settings.webTranslation.consentAt ||
      !translationsReady || !bundle ||
      !needsTranslation || translationSupported() || trProgress || trError || showTranslation ||
      manuallyViewingOriginal.current) return;
    const missing = allIds.some((id) => {
      const tweet = bundle.tweets[id];
      return tweet && sourceLanguage(tweet) !== target && !translations[`${id}:${target}`];
    });
    if (!missing) { setShowTranslation(true); return; }
    if (online) void translate();
    else if (Object.keys(translations).length) setShowTranslation(true);
  }, [allIds, bundle, isWeb, needsTranslation, online, settings.webTranslation.automatic,
    settings.webTranslation.consentAt,
    showTranslation, t, target, trError, trProgress, translate, translations, translationsReady]);

  const copyTranslation = useCallback(async () => {
    if (!view) return;
    await copyText(render('markdown', view, { includeUrls: settings.copy.includeUrls }));
    toast.success('Traduction copiée en Markdown');
  }, [view, settings.copy.includeUrls]);
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
        if (shareTarget) {
          setShareTarget(null);
          return;
        }
        if (helpOpen || exportOpen) return;
        location.href = libraryUrl();
      },
      '?': () => setHelpOpen(true),
      l: () => void translate(),
    },
    [active, settings, bundle, helpOpen, exportOpen, shareTarget, jump, toggleFavorite, dark, translate],
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
        title={t('readerMissing')}
        action={
          <Button variant="primary" onClick={() => (location.href = libraryUrl())}>
            {t('readerBack')}
          </Button>
        }
      >
        {t('readerMissingHint')}
      </EmptyState>
    );
  }

  const { entry } = bundle;
  const c = entry.completeness;
  const incomplete = entry.kind === 'thread' && c.status !== 'complete';
  const isReddit = entry.platform === 'reddit';
  const words = vocab(entry.platform);
  const siteName = isReddit ? 'Reddit' : 'X';
  const fontClass = settings.reader.font === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <TooltipProvider>
      <MediaProvider records={bundle.media}>
        <header
          className={cn(
            'sticky top-0 z-20 border-b bg-[hsl(var(--ts-reader-bg)/0.85)] backdrop-blur-md transition-colors print:hidden',
            scrolled ? 'border-line' : 'border-transparent',
            isWeb && 'max-sm:[&_button]:min-h-11 max-sm:[&_button]:min-w-11',
          )}
        >
          <div className={cn('mx-auto flex h-14 max-w-6xl items-center gap-1 px-2 sm:gap-2 sm:px-4', isWeb ? 'overflow-x-hidden sm:overflow-x-auto' : 'overflow-x-auto')}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (location.href = libraryUrl())}
              aria-label={t('readerBack')}
            >
              <ArrowLeft size={15} /> <span className="hidden sm:inline">{t('library')}</span>
            </Button>
            <div
              className={cn(
                'hidden min-w-0 flex-1 truncate text-center text-[13px] font-medium text-fg transition-opacity sm:block',
                scrolled ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden={!scrolled}
            >
              {entry.title}
            </div>
            {!online ? (
              <Tooltip label={t('offlineImagesHint')}>
                <span
                  tabIndex={0}
                  className="flex items-center gap-1 rounded-md bg-subtle px-2 py-1 text-[11.5px] text-muted"
                >
                  <WifiOff size={12} /> <span className={isWeb ? 'hidden sm:inline' : undefined}>{t('readerOffline')}</span>
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
            {!PRINT ? <Tooltip label={`Mes annotations (${annotationTools.count})`}>
              <Button variant="ghost" size="icon" data-testid="reader-annotations"
                aria-label="Mes annotations" aria-pressed={annotationTools.panelOpen}
                onClick={annotationTools.togglePanel}
                className={annotationTools.panelOpen ? 'text-accent' : undefined}>
                <span className="relative inline-flex">
                  <Highlighter size={16}/>
                  {annotationTools.count > 0 ? (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold leading-none text-white" aria-hidden="true">
                      {annotationTools.count > 9 ? '9+' : annotationTools.count}
                    </span>
                  ) : null}
                </span>
              </Button>
            </Tooltip> : null}
            {isWeb && !PRINT ? (
              <Tooltip label={t('shareEntry')}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('shareEntry')}
                  data-testid="reader-share"
                  onClick={() => setShareTarget({ type: 'article', entry })}
                  className="shrink-0 text-accent"
                >
                  <Share2 size={16} />
                  <span className="hidden lg:inline">{t('shareAction')}</span>
                </Button>
              </Tooltip>
            ) : null}
            <div className={isWeb ? 'hidden sm:block' : undefined}><Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('readerCopy')}>
                  <Copy size={16} />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem
                  icon={<Copy size={14} />}
                  shortcut="c"
                  onSelect={() => copyEntry(entry.id, 'markdown')}
                >
                  {t('readerCopyThreadMarkdown')}
                </MenuItem>
                <MenuItem icon={<Copy size={14} />} onSelect={() => copyEntry(entry.id, 'text')}>
                  {t('readerCopyThreadText')}
                </MenuItem>
                {showTranslation ? (
                  <MenuItem icon={<Languages size={14} />} onSelect={() => void copyTranslation()}>
                    {t('readerCopyTranslation')}
                  </MenuItem>
                ) : null}
                <MenuItem
                  icon={<CheckSquare size={14} />}
                  onSelect={() => {
                    setSelecting(true);
                    setSelection(new Set());
                  }}
                >
                  {t('readerCopySelection')}
                </MenuItem>
              </MenuContent>
            </Menu></div>
            <div className={isWeb ? 'hidden sm:block' : undefined}><Tooltip label={t('readerExport')}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('readerExport')}
                onClick={() => setExportOpen(true)}
              >
                <Download size={16} />
              </Button>
            </Tooltip></div>
            <div className={isWeb ? 'hidden sm:block' : undefined}><Tooltip label={`${t('readerPrint')} / PDF (p)`}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('readerPrint')}
                onClick={() => window.print()}
              >
                <Printer size={16} />
              </Button>
            </Tooltip></div>
            {needsTranslation || showTranslation ? (
              <Tooltip
                label={
                  showTranslation
                    ? `${t('readerOriginal')} (l)`
                    : `${t('readerTranslateTo')} ${languageName(target)} (l)`
                }
              >
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={showTranslation}
                  onClick={() => void translate()}
                  loading={!!trProgress}
                  data-testid="reader-translate"
                  className={showTranslation ? 'text-accent' : undefined}
                >
                  <Languages size={15} />
                  {trProgress
                    ? trProgress.download !== undefined && trProgress.download < 1
                      ? `${t('readerDownloadModel')} ${Math.round(trProgress.download * 100)} %`
                      : `${trProgress.done}/${trProgress.total}`
                    : showTranslation
                      ? t('readerOriginal')
                      : t('readerTranslate')}
                </Button>
              </Tooltip>
            ) : null}
            {isWeb ? <div className="sm:hidden"><Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('readerMore')}><MoreHorizontal size={20} /></Button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem icon={<Copy size={14} />} onSelect={() => copyEntry(entry.id, 'markdown')}>{t('readerCopyThreadMarkdown')}</MenuItem>
                <MenuItem icon={<Copy size={14} />} onSelect={() => copyEntry(entry.id, 'text')}>{t('readerCopyThreadText')}</MenuItem>
                {showTranslation ? <MenuItem icon={<Languages size={14} />} onSelect={() => void copyTranslation()}>{t('readerCopyTranslation')}</MenuItem> : null}
                <MenuItem icon={<CheckSquare size={14} />} onSelect={() => { setSelecting(true); setSelection(new Set()); }}>{t('readerCopySelection')}</MenuItem>
                <MenuItem icon={<Download size={14} />} onSelect={() => setExportOpen(true)}>{t('readerExport')}</MenuItem>
                <MenuItem icon={<Printer size={14} />} onSelect={() => window.print()}>{t('readerPrint')} / PDF</MenuItem>
                <MenuItem icon={<Keyboard size={14} />} onSelect={() => setHelpOpen(true)}>{t('readerShortcuts')}</MenuItem>
              </MenuContent>
            </Menu></div> : null}
            <ReaderSettings isWeb={isWeb} />
            <div className={isWeb ? 'hidden sm:block' : undefined}><Tooltip label={`${t('readerShortcuts')} (?)`}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('readerShortcuts')}
                onClick={() => setHelpOpen(true)}
              >
                <Keyboard size={16} />
              </Button>
            </Tooltip></div>
          </div>
        </header>

        <div className="mx-auto flex max-w-6xl justify-center gap-10 px-4 pb-32 pt-10 print:block print:p-0">
          {posts.length > 3 && !isReddit ? (
            <Toc posts={posts} active={active} onJump={jump} />
          ) : null}
          <article
            ref={articleRef}
            onMouseUp={annotationTools.onSelection}
            onTouchEnd={() => window.setTimeout(annotationTools.onSelection, 120)}
            onKeyUp={annotationTools.onSelection}
            onClick={annotationTools.onClick}
            className="relative min-w-0 flex-1 print:max-w-none"
            style={{ maxWidth: settings.reader.width }}
            data-testid="reader-article"
          >
            {annotationTools.overlay}
            <header className="mb-10 font-sans">
              {first ? <AuthorLine tweet={first} size={44} showDate={false} /> : null}
              <h1
                className={cn(
                  'mt-6 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-fg',
                  fontClass,
                )}
                data-testid="reader-title"
              >
                {view?.entry.title ?? entry.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                {entry.publishedAt ? (
                  <time dateTime={entry.publishedAt} title={formatDateTime(entry.publishedAt)}>
                    {formatDate(entry.publishedAt, { month: 'long' })}
                  </time>
                ) : null}
                <span aria-hidden>·</span>
                <span data-testid="reader-count">
                  {isReddit
                    ? words.posts(posts.length)
                    : `${posts.length} publication${posts.length > 1 ? 's' : ''} capturée${posts.length > 1 ? 's' : ''}`}
                </span>
                {isReddit && first?.reddit?.kind === 'post' ? (
                  <RedditBadges tweet={first} showComments />
                ) : null}
                {entry.kind === 'thread' || entry.kind === 'selection' ? (
                  <CompletenessBadge completeness={c} />
                ) : null}
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline print:hidden"
                >
                  Voir sur {siteName} <ExternalLink size={11} />
                </a>
              </div>
              {incomplete ? (
                <div
                  role="note"
                  className="mt-5 rounded-xl border border-warning/30 bg-warning/[0.07] px-4 py-3 text-[13px] leading-relaxed text-fg"
                  data-testid="reader-incomplete"
                >
                  <div className="flex items-center gap-2 font-medium text-warning">
                    <AlertTriangle size={14} />{' '}
                    {isReddit ? 'Discussion incomplète' : 'Thread potentiellement incomplet'}
                  </div>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {c.issues
                      .filter((i) => i !== 'truncated-text')
                      .map((i) => (
                        <li key={i}>{issueLabel(i, entry.platform)}</li>
                      ))}
                  </ul>
                  <p className="mt-1 text-muted">
                    {isReddit
                      ? 'Ouvrez le post sur Reddit, dépliez les réponses puis enregistrez à nouveau : ThreadShelf complétera cette entrée sans créer de doublon.'
                      : 'Ouvrez la publication sur X et enregistrez à nouveau : ThreadShelf complétera cette entrée sans créer de doublon.'}
                  </p>
                </div>
              ) : null}
              {entry.offline !== 'full' && !online ? (
                <p className="mt-3 text-[12.5px] text-muted">
                  Certaines images n’ont pas été enregistrées et ne sont pas visibles hors ligne.
                </p>
              ) : null}
            </header>

            {showTranslation ? (
              <div
                role="note"
                data-testid="reader-translation-note"
                className="mb-8 flex flex-wrap items-center gap-2 rounded-xl bg-accent-soft/60 px-4 py-2.5 font-sans text-[12.5px] text-fg"
              >
                <Languages size={14} className="text-accent" />
                Traduit depuis le{' '}
                {sourceLangs
                  .filter((l) => l !== target)
                  .map(languageName)
                  .join(', ')}{' '}
                en {languageName(target)} ·{' '}
                {Object.values(translations).some((record) => record.provider === 'cloud')
                  ? t('readerCloudNote') : t('readerLocalNote')}
                <button
                  type="button"
                  className="ml-auto font-medium text-accent hover:underline"
                  onClick={() => { manuallyViewingOriginal.current = true; setShowTranslation(false); }}
                >
                  Afficher l’original
                </button>
              </div>
            ) : null}
            {trError ? (
              <div
                role="alert"
                data-testid="reader-translation-error"
                className="mb-8 rounded-xl border border-warning/30 bg-warning/[0.07] px-4 py-3 font-sans text-[13px] text-fg"
              >
                <p>{trError}</p>
                <p className="mt-1 text-muted">
                  {isWeb && !translationSupported()
                    ? t('readerCloudErrorHint')
                    : translationSupported()
                      ? 'Vous pouvez réessayer, ou utiliser Google Traduction (le texte est alors envoyé à Google).'
                      : 'La traduction intégrée nécessite Google Chrome 138 ou plus récent. Vous pouvez utiliser Google Traduction (le texte est alors envoyé à Google).'}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      window.open(
                        googleTranslateUrl(
                          posts
                            .map((t) =>
                              [t.article?.title ?? '', postPreviewText(t)]
                                .filter(Boolean)
                                .join('\n\n'),
                            )
                            .join('\n\n—\n\n'),
                          target,
                        ),
                        '_blank',
                        'noopener',
                      )
                    }
                  >
                    Ouvrir dans Google Traduction
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setTrError(null)}>
                    Fermer
                  </Button>
                </div>
              </div>
            ) : null}
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
                  aria-label={
                    isReddit
                      ? `${t.reddit?.kind === 'comment' ? 'Commentaire' : 'Post'} de ${authorLabel(t)}`
                      : `Publication ${i + 1} sur ${posts.length}`
                  }
                  className={cn(
                    'group relative scroll-mt-24 print:break-inside-avoid',
                    t.reddit?.kind === 'comment'
                      ? 'border-l-2 border-line/70 py-3 pl-4'
                      : 'border-b border-line/60 py-7 first:pt-0 last:border-0',
                    selecting && selection.has(t.id) && 'rounded-xl bg-accent-soft/50',
                  )}
                  style={
                    t.reddit?.kind === 'comment'
                      ? { marginLeft: Math.min(t.reddit.depth ?? 0, 8) * 18 }
                      : undefined
                  }
                  data-depth={t.reddit?.depth}
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
                    {isReddit ? (
                      <span className="flex min-w-0 items-center gap-2 normal-case tracking-normal text-muted">
                        <span className="truncate font-semibold text-fg">{authorLabel(t)}</span>
                        <RedditBadges tweet={t} showSubreddit={false} />
                      </span>
                    ) : posts.length > 1 ? (
                      <span>
                        {i + 1} / {posts.length}
                      </span>
                    ) : null}
                    {!isReddit &&
                    t.author.handle.toLowerCase() !== entry.authorHandle.toLowerCase() ? (
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
                      {t.createdAt ? formatDateTime(t.createdAt) : `Voir sur ${siteName}`}
                    </a>
                  </div>
                  <div data-annotation-tweet={t.id}>
                    <TweetCard
                      tweet={t}
                      showAuthor={false}
                      hideArticleTitle={!!t.article?.title && t.article.title === entry.title}
                      textClassName={cn('text-fg', fontClass)}
                      textStyle={{
                        fontSize:
                          t.reddit?.kind === 'comment'
                            ? Math.round(settings.reader.fontSize * 0.88)
                            : settings.reader.fontSize,
                        lineHeight: 1.7,
                      }}
                    />
                  </div>
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
              Enregistré le {formatDateTime(entry.savedAt)} ·{' '}
              {isReddit
                ? `Discussion publiée sur Reddit${first?.reddit?.subreddit ? ` (r/${first.reddit.subreddit})` : ''}.`
                : `Contenu publié par @${entry.authorHandle} sur X.`}
            </footer>
          </article>
          {annotationTools.panel}
        </div>

        {annotationTools.toolbar}
        {!PRINT && !selecting ? (
          <ReadingNotesDock
            note={entry.note}
            annotationCount={annotationTools.count}
            annotationsOpen={annotationTools.panelOpen}
            onToggleAnnotations={annotationTools.togglePanel}
            onEditNote={() => {
              const editor = document.querySelector<HTMLTextAreaElement>('[data-testid="reader-note"]');
              editor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              editor?.focus({ preventScroll: true });
            }}
          />
        ) : null}

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
        {isWeb ? <ShareDialog target={shareTarget} onClose={() => setShareTarget(null)} /> : null}
        <Dialog open={helpOpen} onOpenChange={setHelpOpen} title={t('readerShortcuts')}>
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
