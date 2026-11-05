import { useEffect, useState } from 'react';
import { ArrowLeft, BookmarkPlus, Check, Clock3, ExternalLink, Link2, Share2, ShieldCheck } from 'lucide-react';
import { RichText } from '@/components/RichText';
import { Logo } from '@/components/Logo';
import { safeHref } from '@/utils/url';
import type { ArticleBlock } from '@/types/model';
import { LanguageSelector, useWebI18n, type WebLanguage } from '@/web/i18n';
import type { PublishedShare, SharedItem, SharedPost } from './model';
import type { SharedNote, SharedNoteInput } from './notes';
import { useSharedNotes } from './SharedNotes';
import { saveSharedCopy } from './save-copy';
import { resolveWebAuth } from '@/web/auth';

const copy = {
  fr: {
    shared: 'Partagé depuis TheardX',
    loading: 'Ouverture du partage…',
    unavailable: 'Ce partage est indisponible.',
    original: 'Publication originale',
    collection: 'Collection partagée',
    posts: 'publications',
    articles: 'articles',
    expires: 'Lien valide jusqu’au',
    untimed: 'Lien sans expiration',
    copy: 'Copier le lien',
    copied: 'Lien copié',
    share: 'Partager',
    home: 'Découvrir TheardX',
    disclaimer:
      'Les contenus appartiennent à leurs auteurs. TheardX permet de les retrouver et de les lire.',
    partial: 'Ce texte était déjà tronqué au moment de son enregistrement.',
    source: 'Ouvrir la source',
    readOnly: 'Lecture seule',
    unavailableMedia: 'Média disponible sur la publication originale',
    save: 'Enregistrer dans ma bibliothèque', saving: 'Enregistrement…',
    saved: 'Copie enregistrée dans votre bibliothèque',
    saveError: 'Impossible d’enregistrer cette copie.',
    collaborate: 'Notes collaboratives',
  },
  en: {
    shared: 'Shared from TheardX',
    loading: 'Opening share…',
    unavailable: 'This share is unavailable.',
    original: 'Original post',
    collection: 'Shared collection',
    posts: 'posts',
    articles: 'articles',
    expires: 'Link available until',
    untimed: 'Link does not expire',
    copy: 'Copy link',
    copied: 'Link copied',
    share: 'Share',
    home: 'Discover TheardX',
    disclaimer: 'Content belongs to its authors. TheardX helps you save and read it.',
    partial: 'This text was already truncated when it was saved.',
    source: 'Open source',
    readOnly: 'Read only',
    unavailableMedia: 'Media available on the original post',
    save: 'Save to my library', saving: 'Saving…', saved: 'Copy saved to your library',
    saveError: 'Could not save this copy.', collaborate: 'Collaborative notes',
  },
  es: {
    shared: 'Compartido desde TheardX',
    loading: 'Abriendo enlace…',
    unavailable: 'Este contenido ya no está disponible.',
    original: 'Publicación original',
    collection: 'Colección compartida',
    posts: 'publicaciones',
    articles: 'artículos',
    expires: 'Enlace válido hasta',
    untimed: 'Enlace sin caducidad',
    copy: 'Copiar enlace',
    copied: 'Enlace copiado',
    share: 'Compartir',
    home: 'Descubrir TheardX',
    disclaimer: 'Los contenidos pertenecen a sus autores. TheardX permite guardarlos y leerlos.',
    partial: 'El texto ya estaba truncado cuando se guardó.',
    source: 'Abrir fuente',
    readOnly: 'Solo lectura',
    unavailableMedia: 'Contenido multimedia en la publicación original',
    save: 'Guardar en mi biblioteca', saving: 'Guardando…',
    saved: 'Copia guardada en tu biblioteca', saveError: 'No se pudo guardar esta copia.',
    collaborate: 'Notas colaborativas',
  },
} as const;

function MediaImage({ url, alt }: { url: string; alt?: string }) {
  if (!safeHref(url)) return null;
  return (
    <img
      src={url}
      alt={alt ?? ''}
      referrerPolicy="no-referrer"
      loading="lazy"
      className="max-h-[480px] w-full rounded-xl bg-subtle object-contain"
    />
  );
}

function ArticleContent({ block }: { block: ArticleBlock }) {
  switch (block.t) {
    case 'heading':
      return (
        <h3 className="mt-6 text-lg font-semibold">
          <RichText segments={block.text} />
        </h3>
      );
    case 'paragraph':
      return <RichText segments={block.text} className="font-serif text-[16px] leading-[1.9]" />;
    case 'quote':
      return (
        <blockquote className="border-l-[3px] border-accent/40 pl-4 text-muted">
          <RichText segments={block.text} />
        </blockquote>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={`space-y-2 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
          {block.items.map((item, index) => (
            <li key={index}>
              <RichText segments={item} className="leading-8" />
            </li>
          ))}
        </Tag>
      );
    }
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-xl bg-[#252238] p-4 text-xs leading-6 text-white">
          <code>{block.code}</code>
        </pre>
      );
    case 'image':
      return <MediaImage url={block.media.url} alt={block.media.alt} />;
    case 'divider':
      return <hr className="border-line" />;
  }
}

function Post({
  post,
  index,
  language,
  onSelection,
}: {
  post: SharedPost;
  index: number;
  language: WebLanguage;
  onSelection: (post: SharedPost) => void;
}) {
  const t = copy[language];
  const title = post.article?.title;
  return (
    <article
      className="rounded-2xl border border-line bg-surface px-4 py-5 shadow-sm sm:px-7 sm:py-7"
      data-testid="shared-post"
      onMouseUp={() => onSelection(post)}
      onTouchEnd={() => window.setTimeout(() => onSelection(post), 150)}
    >
      <div className="mb-5 flex min-w-0 items-center gap-3">
        {post.author.avatarUrl && safeHref(post.author.avatarUrl) ? (
          <img
            src={post.author.avatarUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-10 shrink-0 rounded-full bg-subtle object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {post.author.name ?? post.author.handle}
          </div>
          <div className="truncate text-xs text-muted">
            @{post.author.handle} · {index + 1}
          </div>
        </div>
        <a
          href={safeHref(post.url) ?? '#'}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="ts-focus inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-accent hover:bg-subtle"
        >
          <ExternalLink size={14} />
          <span className="hidden sm:inline">{t.source}</span>
        </a>
      </div>
      {title ? <h3 className="mb-4 text-xl font-semibold leading-snug">{title}</h3> : null}
      <div className="space-y-5 break-words">
        {post.text.length ? (
          <RichText segments={post.text} className="font-serif text-[16px] leading-[1.9]" />
        ) : null}
        {post.article?.blocks.map((block, index) => (
          <ArticleContent key={index} block={block} />
        ))}
        {post.media.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {post.media.map((media, index) => (
              <MediaImage key={`${media.url}-${index}`} url={media.url} alt={media.alt} />
            ))}
          </div>
        ) : null}
        {post.card ? (
          <a
            href={safeHref(post.card.url) ?? '#'}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="ts-focus block break-words rounded-xl border border-line bg-subtle p-3 text-sm text-accent"
          >
            {post.card.title || post.card.url} <ExternalLink size={13} className="inline" />
          </a>
        ) : null}
      </div>
      {post.textTruncated || post.article?.partial ? (
        <p className="mt-4 rounded-lg bg-warning/10 p-3 text-xs text-muted">{t.partial}</p>
      ) : null}
    </article>
  );
}

function SharedArticle({
  item,
  index,
  language,
  collaboration,
  notes,
  canContribute,
  onSubmit,
}: {
  item: SharedItem;
  index: number;
  language: WebLanguage;
  collaboration: boolean;
  notes: SharedNote[];
  canContribute: boolean;
  onSubmit: (input: SharedNoteInput) => Promise<void>;
}) {
  const t = copy[language];
  const { selectQuote, panel } = useSharedNotes({
    language, itemIndex: index, notes, canContribute, onSubmit,
  });
  return (
    <section className="space-y-4" data-testid="shared-item">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {item.platform === 'reddit' ? 'Reddit' : 'X'} · {index + 1}
          </p>
          <h2 className="mt-1 text-xl font-semibold sm:text-2xl">{item.title}</h2>
          <p className="mt-1 text-xs text-muted">
            {item.posts.length} {t.posts}
          </p>
        </div>
        <a
          href={safeHref(item.sourceUrl) ?? '#'}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="ts-focus inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-accent hover:bg-subtle"
        >
          {t.original}
          <ExternalLink size={13} />
        </a>
      </div>
      <div className="space-y-3">
        {item.posts.map((post, index) => (
          <Post key={`${post.id}-${index}`} post={post} index={index} language={language} onSelection={selectQuote} />
        ))}
      </div>
      {collaboration ? panel : null}
    </section>
  );
}

export function SharedPage() {
  const { language } = useWebI18n();
  const t = copy[language];
  const id =
    location.pathname.split('/s/')[1]?.split('/')[0] ??
    new URLSearchParams(location.search).get('id') ??
    '';
  const [share, setShare] = useState<PublishedShare | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState<SharedNote[]>([]);

  useEffect(() => {
    let active = true;
    void resolveWebAuth().then((auth) => {
      if (active) setCanSave(auth.phase === 'online');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch(`/api/share?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as PublishedShare & { error?: string };
        if (!response.ok) throw new Error(payload.error || t.unavailable);
        if (active) setShare(payload);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : t.unavailable);
      });
    return () => {
      active = false;
    };
  }, [id, t.unavailable]);

  useEffect(() => {
    if (!share?.collaboration) return;
    let active = true;
    setNotes([]);
    const refresh = () => void fetch(`/api/share-notes?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Notes indisponibles');
        return (await response.json()) as { notes: SharedNote[] };
      })
      .then((result) => { if (active) setNotes(result.notes); })
      .catch(() => undefined);
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [id, share?.collaboration]);

  const submitNote = async (input: SharedNoteInput): Promise<void> => {
    const response = await fetch(`/api/share-notes?id=${encodeURIComponent(id)}`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = (await response.json()) as { note?: SharedNote; error?: string };
    if (!response.ok || !data.note) throw new Error(data.error || 'Contribution impossible.');
    setNotes((previous) => [...previous, data.note!].sort((a, b) => a.createdAt - b.createdAt));
  };

  const saveCopy = async () => {
    if (!share || !canSave || saveBusy) return;
    setSaveBusy(true);
    setSaveMessage('');
    try {
      // Do not mix an old tab's local library with a newly disconnected account.
      const auth = await resolveWebAuth();
      if (auth.phase !== 'online') throw new Error(t.saveError);
      await saveSharedCopy(share);
      setSaved(true);
      setSaveMessage(t.saved);
    } catch (reason) {
      setSaveMessage(reason instanceof Error ? reason.message : t.saveError);
    } finally {
      setSaveBusy(false);
    }
  };

  const shareUrl = location.href;
  const nativeShare = typeof navigator.share === 'function';
  const shareLink = async () => {
    if (nativeShare) {
      try {
        await navigator.share({ title: share?.snapshot.title, url: shareUrl });
        return;
      } catch {
        /* User cancelled or share sheet unavailable: offer copying. */
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  };

  return (
    <main className="min-h-[100dvh] bg-bg text-fg">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm sm:px-8">
        <a href="/" className="ts-focus flex items-center gap-2" aria-label={t.home}>
          <Logo name="TheardX" />
        </a>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1 text-xs text-muted sm:inline-flex">
            <ShieldCheck size={14} />
            {share?.collaboration ? t.collaborate : t.readOnly}
          </span>
          <LanguageSelector />
        </div>
      </header>
      <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6 sm:py-12">
        <a
          href="/"
          className="ts-focus mb-8 inline-flex items-center gap-2 text-xs font-medium text-accent"
        >
          <ArrowLeft size={14} />
          {t.home}
        </a>
        {error ? (
          <div role="alert" className="rounded-2xl border border-line bg-surface p-7 text-sm">
            {error}
          </div>
        ) : !share ? (
          <p role="status" className="text-sm text-muted">
            {t.loading}
          </p>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-accent">{t.shared}</p>
            <h1 className="mt-3 text-[30px] font-bold leading-tight tracking-tight sm:text-[40px]">
              {share.snapshot.title}
            </h1>
            {share.snapshot.description ? (
              <p className="mt-3 text-base leading-relaxed text-muted">
                {share.snapshot.description}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-2">
                <Clock3 size={13} />
                {share.expiresAt
                  ? `${t.expires} ${new Date(share.expiresAt).toLocaleDateString(language)}`
                  : t.untimed}
              </span>
              {share.snapshot.type === 'collection' ? (
                <span className="rounded-full border border-line bg-surface px-3 py-2">
                  {t.collection} · {share.snapshot.items.length} {t.articles}
                </span>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void shareLink()}
                className="ts-focus inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90"
              >
                {nativeShare ? <Share2 size={16} /> : <Link2 size={16} />}{' '}
                {copied ? t.copied : nativeShare ? t.share : t.copy}
              </button>
              {canSave ? (
                <button type="button" disabled={saveBusy || saved} onClick={() => void saveCopy()}
                  className="ts-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-fg hover:bg-subtle disabled:opacity-60"
                  data-testid="save-shared-copy">
                  {saved ? <Check size={16} /> : <BookmarkPlus size={16} />}
                  {saved ? t.saved : saveBusy ? t.saving : t.save}
                </button>
              ) : null}
            </div>
            {saveMessage ? <p role="status" className="mt-2 text-xs text-muted">{saveMessage}</p> : null}
            <div className="mt-10 space-y-12">
              {share.snapshot.items.map((item, index) => (
                <SharedArticle
                  key={`${item.sourceUrl}-${index}`}
                  item={item}
                  index={index}
                  language={language}
                  collaboration={share.collaboration === true}
                  notes={notes}
                  canContribute={canSave}
                  onSubmit={submitNote}
                />
              ))}
            </div>
          </>
        )}
        <footer className="mt-16 border-t border-line pt-6 text-xs leading-6 text-muted">
          {t.disclaimer}
        </footer>
      </div>
    </main>
  );
}
