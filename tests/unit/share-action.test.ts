import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ThreadCard, type EntryActions } from '@/components/ThreadCard';
import type { Entry } from '@/types/model';

const entry: Entry = {
  id: 'saved-article',
  kind: 'tweet',
  title: 'Une publication enregistrée',
  authorHandle: 'example',
  focalTweetId: 'tweet-1',
  tweetIds: ['tweet-1'],
  contextTweetIds: [],
  referenceTweetIds: [],
  externalRefs: [],
  completeness: {
    status: 'single',
    startVerified: true,
    endVerified: true,
    gaps: 0,
    issues: [],
    checkedAt: Date.now(),
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
};

function renderCard(layout: 'cards' | 'list', includeWebSharing: boolean) {
  const actions: EntryActions = {
    open: vi.fn(),
    copy: vi.fn(),
    export: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    toggleCollection: vi.fn(),
    setCategory: vi.fn(),
    editTags: vi.fn(),
    ...(includeWebSharing ? { share: vi.fn() } : {}),
  };
  return renderToStaticMarkup(
    createElement(ThreadCard, {
      entry,
      actions,
      collections: [],
      categories: [],
      selected: false,
      selectMode: false,
      onToggleSelect: vi.fn(),
      layout,
    }),
  );
}

describe('visible sharing controls', () => {
  it.each(['cards', 'list'] as const)('shows a direct sharing button in web %s', (layout) => {
    const markup = renderCard(layout, true);
    expect(markup).toContain('data-testid="entry-share"');
    expect(markup).toContain('aria-label="Partager cette publication"');
    expect(markup).toContain('Partager');
  });

  it.each(['cards', 'list'] as const)('does not add sharing controls to extension %s', (layout) => {
    expect(renderCard(layout, false)).not.toContain('data-testid="entry-share"');
  });
});
