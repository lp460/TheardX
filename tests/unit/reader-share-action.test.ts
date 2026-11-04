import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntryBundle } from '@/types/model';

const bundle: EntryBundle = {
  entry: {
    id: 'article-in-reader',
    kind: 'tweet',
    title: 'Article conservé',
    authorHandle: 'example',
    focalTweetId: 'post-1',
    tweetIds: ['post-1'],
    contextTweetIds: [],
    referenceTweetIds: [],
    externalRefs: [],
    completeness: {
      status: 'single', startVerified: true, endVerified: true,
      gaps: 0, issues: [], checkedAt: Date.now(),
    },
    sourceUrl: 'https://x.com/example/status/1',
    savedAt: Date.now(),
    updatedAt: Date.now(),
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
  tweets: {
    'post-1': {
      id: 'post-1',
      url: 'https://x.com/example/status/1',
      author: { handle: 'example' },
      text: [{ t: 'text', v: 'Le texte intégral de la publication.' }],
      media: [],
      linkedTweetIds: [],
      availability: 'available',
      context: 'full',
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
    },
  },
  relations: [],
  media: {},
};

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => bundle }));

import { ThreadReader } from '@/reader/ThreadReader';

afterEach(() => vi.unstubAllGlobals());

describe('share from the full article reader', () => {
  it('offers a direct share action alongside other web reader options', () => {
    const markup = renderToStaticMarkup(createElement(ThreadReader));
    expect(markup).toContain('data-testid="reader-share"');
    expect(markup).toContain('aria-label="Partager cette publication"');
  });

  it('keeps the extension reader free of web publishing actions', () => {
    vi.stubGlobal('chrome', { runtime: { id: 'extension-test' } });
    const markup = renderToStaticMarkup(createElement(ThreadReader));
    expect(markup).not.toContain('data-testid="reader-share"');
  });
});
