/**
 * Translation of saved posts and X Articles with the browser's built-in, on-device Translator API
 * (Chrome 138+): free, private — no text leaves the computer. Translations are cached per post.
 */
import type { EntryBundle, Segment, Tweet } from '@/types/model';
import { segmentsToPlain } from '@/utils/text';
import { base, guessLanguage, isUsableCode } from './languages';

export interface PostTranslation {
  /** `${tweetId}:${target}` */
  key: string;
  tweetId: string;
  target: string;
  source: string;
  /** Translated post text ('' when the post text is empty or already in the target language). */
  text: string;
  /** Aligned with `tweet.article.blocks`: translated text for text blocks, null for code / images / dividers. List items are joined with "\n". */
  blocks: (string | null)[];
  articleTitle?: string;
  provider: 'on-device';
  createdAt: number;
}

export class TranslationUnavailableError extends Error {}

interface TranslatorLike {
  translate(text: string): Promise<string>;
  destroy?: () => void;
}

interface TranslatorStatic {
  availability(o: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  create(o: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<TranslatorLike>;
}

function api(): TranslatorStatic | null {
  const g = globalThis as unknown as { Translator?: TranslatorStatic };
  return g.Translator ?? null;
}

export function translationSupported(): boolean {
  return !!api();
}

/** Source language of a post: X's lang attribute when usable, else a script/keyword guess. */
export function sourceLanguage(t: Tweet): string {
  if (isUsableCode(t.lang)) return base(t.lang);
  const sample = [
    segmentsToPlain(t.text),
    t.article?.title ?? '',
    ...(t.article?.blocks ?? [])
      .slice(0, 12)
      .map((b) => ('text' in b ? segmentsToPlain(b.text) : '')),
  ].join('\n');
  return guessLanguage(sample);
}

function blockText(b: NonNullable<Tweet['article']>['blocks'][number]): string | null {
  switch (b.t) {
    case 'heading':
    case 'paragraph':
    case 'quote':
      return segmentsToPlain(b.text);
    case 'list':
      return b.items.map(segmentsToPlain).join('\n');
    default:
      return null;
  }
}

/** Plain text to translate, keeping links' visible form as-is. */
function postText(t: Tweet): string {
  return segmentsToPlain(t.text).trim();
}

export interface TranslateProgress {
  done: number;
  total: number;
  /** Model download progress (0–1) the first time a language pair is used. */
  download?: number;
}

/**
 * Translates every post of the bundle that is not already in `target`. Must be started from a user
 * gesture the first time (the browser may need to download the language model).
 */
export async function translateBundle(
  bundle: EntryBundle,
  target: string,
  opts: {
    onProgress?: (p: TranslateProgress) => void;
    timeoutMs?: number;
    existing?: Record<string, PostTranslation>;
  } = {},
): Promise<PostTranslation[]> {
  const T = api();
  if (!T)
    throw new TranslationUnavailableError(
      'La traduction intégrée n’est pas disponible dans ce navigateur.',
    );
  const tgt = base(target);
  const ids = [
    ...bundle.entry.tweetIds,
    ...bundle.entry.contextTweetIds,
    ...bundle.entry.referenceTweetIds,
  ];
  const posts = ids.map((id) => bundle.tweets[id]).filter((t): t is Tweet => !!t);
  const work = posts.filter((t) => sourceLanguage(t) !== tgt && !opts.existing?.[`${t.id}:${tgt}`]);
  const units = work.reduce((n, t) => n + 1 + (t.article?.blocks.length ?? 0), 0);
  let done = 0;
  const progress = (download?: number) =>
    opts.onProgress?.({ done, total: units, ...(download !== undefined ? { download } : {}) });
  progress();

  const translators = new Map<string, TranslatorLike>();
  const getTranslator = async (src: string): Promise<TranslatorLike> => {
    const cached = translators.get(src);
    if (cached) return cached;
    const availability = await T.availability({ sourceLanguage: src, targetLanguage: tgt });
    if (availability === 'unavailable') {
      throw new TranslationUnavailableError(
        `La traduction ${src} → ${tgt} n’est pas proposée par ce navigateur.`,
      );
    }
    const create = T.create({
      sourceLanguage: src,
      targetLanguage: tgt,
      monitor: (m) =>
        m.addEventListener('downloadprogress', (e) =>
          progress((e as Event & { loaded?: number }).loaded ?? 0),
        ),
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new TranslationUnavailableError(
              'Le modèle de traduction ne s’est pas téléchargé : la traduction intégrée ne semble pas fonctionner dans ce navigateur.',
            ),
          ),
        opts.timeoutMs ?? 120_000,
      ),
    );
    const translator = await Promise.race([create, timeout]);
    translators.set(src, translator);
    return translator;
  };

  const results: PostTranslation[] = [];
  try {
    for (const t of work) {
      const src = sourceLanguage(t);
      const tr = await getTranslator(src);
      const own = postText(t);
      const isLinkOnly = t.text.every(
        (s: Segment) => s.t === 'link' || (s.t === 'text' && !s.v.trim()),
      );
      const text = own && !isLinkOnly ? await tr.translate(own) : '';
      done += 1;
      progress();
      const blocks: (string | null)[] = [];
      for (const b of t.article?.blocks ?? []) {
        const plain = blockText(b);
        blocks.push(plain && plain.trim() ? await tr.translate(plain) : null);
        done += 1;
        progress();
      }
      const rec: PostTranslation = {
        key: `${t.id}:${tgt}`,
        tweetId: t.id,
        target: tgt,
        source: src,
        text,
        blocks,
        provider: 'on-device',
        createdAt: Date.now(),
      };
      if (t.article?.title) rec.articleTitle = await tr.translate(t.article.title);
      results.push(rec);
    }
  } finally {
    translators.forEach((tr) => tr.destroy?.());
  }
  return results;
}

/** Copy of the bundle where posts show their translation (for the reader, copy and exports). */
export function applyTranslations(
  bundle: EntryBundle,
  records: Record<string, PostTranslation>,
  target: string,
): EntryBundle {
  const tgt = base(target);
  const tweets: Record<string, Tweet> = {};
  for (const [id, t] of Object.entries(bundle.tweets)) {
    const rec = records[`${id}:${tgt}`];
    if (!rec) {
      tweets[id] = t;
      continue;
    }
    const next: Tweet = { ...t, text: rec.text ? [{ t: 'text', v: rec.text }] : t.text };
    if (t.article) {
      next.article = {
        ...t.article,
        ...(rec.articleTitle ? { title: rec.articleTitle } : {}),
        blocks: t.article.blocks.map((b, i) => {
          const tr = rec.blocks[i];
          if (!tr) return b;
          if (b.t === 'list')
            return { ...b, items: tr.split('\n').map((v) => [{ t: 'text' as const, v }]) };
          if (b.t === 'heading' || b.t === 'paragraph' || b.t === 'quote')
            return { ...b, text: [{ t: 'text' as const, v: tr }] };
          return b;
        }),
      };
    }
    tweets[id] = next;
  }
  const first = tweets[bundle.entry.tweetIds[0] ?? ''];
  const title =
    first?.article?.title && records[`${bundle.entry.tweetIds[0]}:${tgt}`]?.articleTitle
      ? first.article.title
      : bundle.entry.title;
  return { ...bundle, entry: { ...bundle.entry, title }, tweets };
}

/** Google Translate web page for the given text — only opened on an explicit click (fallback). */
export function googleTranslateUrl(text: string, target: string): string {
  const q = text.length > 4_500 ? `${text.slice(0, 4_500)}…` : text;
  return `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(base(target))}&op=translate&text=${encodeURIComponent(q)}`;
}
