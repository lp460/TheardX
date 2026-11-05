// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThreadShelfDB, fromStoredTweet } from '@/storage/db';
import { saveSharedCopy } from '@/share/save-copy';
import type { PublishedShare } from '@/share/model';

let db: ThreadShelfDB;
let sequence = 0;
const testId = '0123456789abcdefabcd.ABCDEFGHIJKLMNOPQRSTUVWX';

function share(id = testId, type: 'article' | 'collection' = 'article'): PublishedShare {
  const item = {
    title: 'An original publication', sourceUrl: 'https://x.com/author/status/12345', platform: 'x' as const,
    posts: [{ id: '12345', url: 'https://x.com/author/status/12345',
      author: { handle: 'author', name: 'Original author' },
      text: [{ t: 'text' as const, v: 'The full unchanged article text.' }],
      media: [],
      article: { title: 'Long article', blocks: [
        { t: 'paragraph' as const, text: [{ t: 'text' as const, v: 'This paragraph is preserved.' }] },
      ] },
    }],
  };
  return { id, createdAt: 1, expiresAt: null,
    snapshot: { version: 1, type, title: 'Shared archive', items: type === 'collection' ? [item, {
      ...item, title: 'Another article', sourceUrl: 'https://x.com/author/status/12346',
      posts: [{ ...item.posts[0]!, id: '12346', url: 'https://x.com/author/status/12346' }],
    }] : [item] },
  };
}

beforeEach(() => { db = new ThreadShelfDB(`shared-copy-${++sequence}-${Date.now()}`); });
afterEach(async () => { db.close(); await Dexie.delete(db.name); });

describe('Saving a shared page into the recipient library', () => {
  it('creates an independent private copy with full text and avoids duplicate clicks', async () => {
    expect(await saveSharedCopy(share(), db)).toEqual({ added: 1, alreadySaved: false });
    const entries = await db.entries.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ note: '', favorite: false, tags: [], readState: 'unread' });
    expect(entries[0]?.searchText).toContain('full unchanged article text');
    const post = fromStoredTweet((await db.tweets.get('12345'))!);
    expect(post.article?.blocks).toHaveLength(1);
    expect(await saveSharedCopy(share(), db)).toEqual({ added: 0, alreadySaved: true });
    expect(await db.entries.count()).toBe(1);
  });

  it('copies a shared collection into its own collection without changing a preexisting post', async () => {
    const a = share();
    await saveSharedCopy(a, db);
    const previous = (await db.tweets.get('12345'))!;
    await db.tweets.put({ ...previous, text: [{ t: 'text', v: 'My private version remains intact.' }] });
    const b = share('0123456789abcdefabcd.ZBCDEFGHIJKLMNOPQRSTUVWX', 'collection');
    const result = await saveSharedCopy(b, db);
    expect(result.added).toBe(2);
    expect((await db.tweets.get('12345'))!.text[0]).toMatchObject({ v: 'My private version remains intact.' });
    const collection = (await db.collections.toArray())[0]!;
    expect(collection.name).toBe('Shared archive');
    expect((await db.entries.where('collectionIds').equals(collection.id).toArray())).toHaveLength(2);
  });

  it('rejects malformed source IDs without writing any partial item', async () => {
    const malicious = share();
    malicious.snapshot.items[0]!.posts[0]!.id = 'script-not-a-post';
    await expect(saveSharedCopy(malicious, db)).rejects.toThrow();
    expect(await db.entries.count()).toBe(0);
    expect(await db.tweets.count()).toBe(0);
  });
});
