import { afterEach, describe, expect, it } from 'vitest';
import {
  applyTranslations,
  googleTranslateUrl,
  sourceLanguage,
  translateBundle,
  TranslationUnavailableError,
} from '@/translate/engine';
import { guessLanguage, isUsableCode } from '@/translate/languages';
import type { EntryBundle, Tweet } from '@/types/model';

const g = globalThis as unknown as { Translator?: unknown };
afterEach(() => {
  delete g.Translator;
});

/** Fake on-device Translator: prefixes the target language, records calls. */
function installFakeTranslator(opts: { unavailable?: string[] } = {}) {
  const calls: string[] = [];
  g.Translator = {
    availability: async ({ sourceLanguage }: { sourceLanguage: string }) =>
      opts.unavailable?.includes(sourceLanguage) ? 'unavailable' : 'downloadable',
    create: async ({
      sourceLanguage,
      targetLanguage,
      monitor,
    }: {
      sourceLanguage: string;
      targetLanguage: string;
      monitor?: (m: EventTarget) => void;
    }) => {
      const m = new EventTarget();
      monitor?.(m);
      const e = new Event('downloadprogress') as Event & { loaded: number };
      e.loaded = 1;
      m.dispatchEvent(e);
      return {
        translate: async (text: string) => {
          calls.push(`${sourceLanguage}>${targetLanguage}:${text}`);
          return `[${targetLanguage}] ${text}`;
        },
        destroy: () => {},
      };
    },
  };
  return calls;
}

const tweet = (id: string, over: Partial<Tweet>): Tweet => ({
  id,
  url: `https://x.com/a/status/${id}`,
  author: { handle: 'a' },
  text: [],
  media: [],
  linkedTweetIds: [],
  availability: 'available',
  context: 'full',
  firstSeenAt: 1,
  lastSeenAt: 1,
  ...over,
});

function bundleOf(tweets: Tweet[]): EntryBundle {
  return {
    entry: {
      id: 'e1',
      kind: 'thread',
      title: 'T',
      authorHandle: 'a',
      focalTweetId: tweets[0]!.id,
      tweetIds: tweets.map((t) => t.id),
      contextTweetIds: [],
      referenceTweetIds: [],
      externalRefs: [],
      completeness: {
        status: 'complete',
        startVerified: true,
        endVerified: true,
        gaps: 0,
        issues: [],
        checkedAt: 1,
      },
      sourceUrl: '',
      savedAt: 1,
      updatedAt: 1,
      readState: 'unread',
      readLater: false,
      favorite: false,
      readProgress: 0,
      categoryId: null,
      tags: [],
      collectionIds: [],
      note: '',
      offline: 'full',
      searchText: '',
    },
    tweets: Object.fromEntries(tweets.map((t) => [t.id, t])),
    relations: [],
    media: {},
  };
}

describe('language detection', () => {
  it('guesses scripts and common languages', () => {
    expect(guessLanguage('现在，大多数 AI Agent 都有一个很奇怪的习惯')).toBe('zh');
    expect(guessLanguage('これは日本語のテキストです。とても長い')).toBe('ja');
    expect(guessLanguage('Le modèle est rapide et la qualité est bonne pour les tests')).toBe('fr');
    expect(guessLanguage('The model is fast and the quality is good for this test')).toBe('en');
    expect(guessLanguage('Привет, как дела у тебя сегодня')).toBe('ru');
  });
  it('ignores X pseudo-codes', () => {
    expect(isUsableCode('zh')).toBe(true);
    expect(isUsableCode('und')).toBe(false);
    expect(isUsableCode('qme')).toBe(false);
  });
  it('uses the post language tag first', () => {
    expect(
      sourceLanguage(tweet('1', { lang: 'ja', text: [{ t: 'text', v: 'hello world and this' }] })),
    ).toBe('ja');
    expect(
      sourceLanguage(tweet('1', { lang: 'und', text: [{ t: 'text', v: 'hello world and this' }] })),
    ).toBe('en');
  });
});

describe('on-device translation', () => {
  const article = tweet('2', {
    text: [{ t: 'link', v: 'x.com/a/article/2', href: 'https://x.com/a/article/2' }],
    article: {
      url: 'https://x.com/a/article/2',
      title: '标题在这里',
      blocks: [
        {
          t: 'paragraph',
          text: [
            { t: 'text', v: '现在，大多数' },
            { t: 'text', v: '代理', b: true },
          ],
        },
        { t: 'code', code: 'npm install', lang: 'bash' },
        { t: 'list', ordered: false, items: [[{ t: 'text', v: '一' }], [{ t: 'text', v: '二' }]] },
        { t: 'divider' },
      ],
    },
  });
  const french = tweet('3', { lang: 'fr', text: [{ t: 'text', v: 'Déjà en français' }] });

  it('translates text blocks, keeps code, skips posts already in the target language', async () => {
    const calls = installFakeTranslator();
    const progress: number[] = [];
    const recs = await translateBundle(bundleOf([article, french]), 'fr', {
      onProgress: (p) => progress.push(p.done),
    });
    expect(recs).toHaveLength(1);
    const r = recs[0]!;
    expect(r).toMatchObject({
      tweetId: '2',
      source: 'zh',
      target: 'fr',
      text: '',
      articleTitle: '[fr] 标题在这里',
    });
    expect(r.blocks).toEqual(['[fr] 现在，大多数代理', null, '[fr] 一\n二', null]);
    expect(calls.some((c) => c.includes('npm install'))).toBe(false);
    expect(progress.at(-1)).toBe(5);

    const view = applyTranslations(bundleOf([article, french]), { [r.key]: r }, 'fr');
    const a = view.tweets['2']!.article!;
    expect(a.title).toBe('[fr] 标题在这里');
    expect(a.blocks[1]).toEqual({ t: 'code', code: 'npm install', lang: 'bash' });
    expect(a.blocks[2]).toEqual({
      t: 'list',
      ordered: false,
      items: [[{ t: 'text', v: '[fr] 一' }], [{ t: 'text', v: '二' }]],
    });
    expect(view.tweets['3']).toBe(french);
    expect(view.entry.title).toBe('[fr] 标题在这里');
  });

  it('reuses cached translations', async () => {
    const calls = installFakeTranslator();
    const first = await translateBundle(bundleOf([article]), 'fr');
    calls.length = 0;
    const again = await translateBundle(bundleOf([article]), 'fr', {
      existing: { [first[0]!.key]: first[0]! },
    });
    expect(again).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('reports when the browser has no translation or no language pair', async () => {
    await expect(translateBundle(bundleOf([article]), 'fr')).rejects.toBeInstanceOf(
      TranslationUnavailableError,
    );
    installFakeTranslator({ unavailable: ['zh'] });
    await expect(translateBundle(bundleOf([article]), 'fr')).rejects.toThrow('zh → fr');
  });

  it('builds a Google Translate fallback link (explicit click only)', () => {
    const url = new URL(googleTranslateUrl('现在 & 以后', 'fr'));
    expect(url.hostname).toBe('translate.google.com');
    expect(url.searchParams.get('tl')).toBe('fr');
    expect(url.searchParams.get('text')).toBe('现在 & 以后');
  });
});
