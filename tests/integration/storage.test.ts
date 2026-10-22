// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThreadShelfDB, setDb, SCHEMA_VERSIONS } from '@/storage/db';
import { Repository } from '@/storage/repository';
import { cacheEntryMedia } from '@/storage/media-cache';
import { searchEntries } from '@/storage/search';
import { captureFromFixture } from '../helpers/capture';
import { replies, threadPosts, type PostSpec } from '../fixtures/x-dom';

let db: ThreadShelfDB;
let repo: Repository;
let n = 0;

beforeEach(async () => {
  n += 1;
  db = new ThreadShelfDB(`test-${n}-${Date.now()}`);
  setDb(db);
  repo = new Repository(() => db);
  await db.open();
});
afterEach(async () => {
  db.close();
  await Dexie.delete(db.name);
  setDb(null);
});

describe('saving captures', () => {
  it('saves a thread with its posts, relations and completeness', async () => {
    const t = threadPosts(8);
    const res = await repo.saveCapture(captureFromFixture([...t, ...replies(3, 'ada_dev')], t[0]!));
    expect(res.created).toBe(true);
    expect(res.count).toBe(8);
    expect(res.message).toBe('Thread enregistré — 8 publications');
    expect(res.entry.completeness.status).toBe('complete');
    expect(await db.tweets.count()).toBe(8); // other people's replies are not stored
    expect(await db.relations.where('type').equals('reply').count()).toBe(7);
  });

  it('reports a potentially incomplete thread', async () => {
    const t = threadPosts(8).slice(0, 5);
    const res = await repo.saveCapture(captureFromFixture(t, t[0]!));
    expect(res.message).toBe('5 publications capturées — thread potentiellement incomplet');
    expect(res.entry.completeness.status).toBe('needs_more');
  });

  it('updates an existing thread instead of duplicating it (progressive capture)', async () => {
    const t = threadPosts(12);
    const first = await repo.saveCapture(captureFromFixture(t.slice(0, 6), t[0]!));
    // Later the user scrolled: posts 5..12 are rendered (the beginning was unmounted by X).
    const later = captureFromFixture(t.slice(4), t[0]!, 'thread', 'xds');
    later.focalId = t[4]!.id;
    const second = await repo.saveCapture(later);
    expect(second.created).toBe(false);
    expect(second.entry.id).toBe(first.entry.id);
    expect(second.entry.tweetIds).toEqual(t.map((p) => p.id));
    expect(second.entry.completeness.status).toBe('complete');
    expect(await db.entries.count()).toBe(1);
    expect(await db.tweets.count()).toBe(12);
  });

  it('keeps user data (note, tags, favourite) when a thread is refreshed', async () => {
    const t = threadPosts(3);
    const { entry } = await repo.saveCapture(captureFromFixture(t, t[0]!));
    await repo.updateEntry(entry.id, {
      note: 'Ma note',
      tags: ['react', '#react', 'perf'],
      favorite: true,
    });
    const again = await repo.saveCapture(captureFromFixture(t, t[0]!));
    expect(again.entry).toMatchObject({ note: 'Ma note', tags: ['react', 'perf'], favorite: true });
  });

  it('saves a single post once, even if saved twice', async () => {
    const t = threadPosts(3);
    await repo.saveCapture(captureFromFixture(t, t[1]!, 'tweet'));
    await repo.saveCapture(captureFromFixture(t, t[1]!, 'tweet'));
    expect(await db.entries.count()).toBe(1);
    const status = await repo.savedStatus([t[1]!.id, t[0]!.id]);
    expect(Object.keys(status)).toEqual([t[1]!.id]);
  });

  it('applies collection, category, tags and note from capture options', async () => {
    const t = threadPosts(2);
    const col = await repo.createCollection('Lectures');
    const cat = await repo.createCategory('Tech');
    const { entry } = await repo.saveCapture(
      captureFromFixture(t, t[0]!, 'thread', 'xds', {
        options: {
          collectionId: col.id,
          categoryId: cat.id,
          tags: ['ts'],
          note: 'à relire',
          readLater: true,
        },
      }),
    );
    expect(entry).toMatchObject({
      collectionIds: [col.id],
      categoryId: cat.id,
      tags: ['ts'],
      note: 'à relire',
      readLater: true,
    });
  });

  it('rejects unknown collection ids atomically', async () => {
    const t = threadPosts(2);
    await expect(
      repo.saveCapture(
        captureFromFixture(t, t[0]!, 'thread', 'xds', { options: { collectionId: 'nope' } }),
      ),
    ).rejects.toThrow();
    expect(await db.entries.count()).toBe(0);
    expect(await db.tweets.count()).toBe(0);
  });

  it('saves quoted posts as references in mode C', async () => {
    const quoted: PostSpec = {
      id: '2070000000000000001',
      handle: 'quoted_one',
      text: 'Quoted insight',
    };
    const p: PostSpec = {
      id: '2079610838143623371',
      handle: 'ada_dev',
      text: 'Look',
      quote: quoted,
    };
    const { entry } = await repo.saveCapture(captureFromFixture([p], p, 'references'));
    expect(entry.kind).toBe('references');
    expect(entry.referenceTweetIds).toEqual([quoted.id]);
    expect((await db.tweets.get(quoted.id))?.context).toBe('quote');
  });

  it('saves a manual selection in page order given', async () => {
    const t = threadPosts(4);
    const sel = [t[3]!.id, t[1]!.id];
    const { entry } = await repo.saveCapture(
      captureFromFixture(t, t[3]!, 'selection', 'xds', { selection: sel }),
    );
    expect(entry.kind).toBe('selection');
    expect(entry.tweetIds).toEqual(sel);
    expect(entry.completeness.status).toBe('manual');
  });
});

describe('reading, searching and deleting', () => {
  it('survives closing and reopening the database', async () => {
    const t = threadPosts(3);
    const { entry } = await repo.saveCapture(captureFromFixture(t, t[0]!));
    const name = db.name;
    db.close();
    const reopened = new ThreadShelfDB(name);
    const repo2 = new Repository(() => reopened);
    const bundle = await repo2.getBundle(entry.id);
    expect(bundle?.entry.tweetIds).toEqual(t.map((p) => p.id));
    expect(Object.keys(bundle!.tweets)).toHaveLength(3);
    reopened.close();
    db = new ThreadShelfDB(name);
  });

  it('finds entries by text, author, tag and accents', async () => {
    const a = threadPosts(2, { handle: 'ada_dev', text: (i) => `Café et TypeScript ${i}` });
    const b = threadPosts(2, {
      handle: 'bob_ops',
      startId: 2079610838143700000n,
      text: () => 'Kubernetes notes',
    });
    const ea = await repo.saveCapture(captureFromFixture(a, a[0]!));
    await repo.saveCapture(captureFromFixture(b, b[0]!));
    await repo.updateEntry(ea.entry.id, { tags: ['lecture'] });
    const all = await repo.listEntries();
    expect(searchEntries(all, 'cafe').map((e) => e.authorHandle)).toEqual(['ada_dev']);
    expect(searchEntries(all, '@bob_ops').map((e) => e.authorHandle)).toEqual(['bob_ops']);
    expect(searchEntries(all, '#lecture').map((e) => e.authorHandle)).toEqual(['ada_dev']);
    expect(searchEntries(all, 'kubernetes typescript')).toEqual([]);
    expect(searchEntries(all, '')).toHaveLength(2);
  });

  it('deletes entries and garbage-collects posts not used elsewhere', async () => {
    const t = threadPosts(4);
    const thread = await repo.saveCapture(captureFromFixture(t, t[0]!));
    const single = await repo.saveCapture(captureFromFixture(t, t[1]!, 'tweet'));
    await repo.deleteEntries([thread.entry.id]);
    expect(await db.tweets.count()).toBe(1); // still used by the single-post entry
    await repo.deleteEntries([single.entry.id]);
    expect(await db.tweets.count()).toBe(0);
    expect(await db.relations.count()).toBe(0);
  });

  it('detects overlapping entries as duplicates', async () => {
    const t = threadPosts(4);
    await repo.saveCapture(captureFromFixture(t, t[0]!));
    await repo.saveCapture(captureFromFixture(t, t[2]!, 'tweet'));
    const other = threadPosts(2, { handle: 'other', startId: 2079610838143800000n });
    await repo.saveCapture(captureFromFixture(other, other[0]!));
    const groups = await repo.findDuplicates();
    expect(groups).toHaveLength(1);
    expect(groups[0]!.map((e) => e.kind).sort()).toEqual(['thread', 'tweet']);
  });

  it('manages collections and categories', async () => {
    const t = threadPosts(2);
    const { entry } = await repo.saveCapture(captureFromFixture(t, t[0]!));
    const c = await repo.createCollection('Design');
    expect((await repo.createCollection('design')).id).toBe(c.id); // no duplicate names
    await repo.addToCollection([entry.id], c.id);
    expect((await repo.getEntry(entry.id))?.collectionIds).toEqual([c.id]);
    await repo.deleteCollection(c.id);
    expect((await repo.getEntry(entry.id))?.collectionIds).toEqual([]);
    const k = await repo.createCategory('Tutoriels');
    await repo.updateEntry(entry.id, { categoryId: k.id });
    await repo.deleteCategory(k.id);
    expect((await repo.getEntry(entry.id))?.categoryId).toBeNull();
  });
});

describe('media cache', () => {
  it('caches images and computes the offline state', async () => {
    const p: PostSpec = {
      id: '2079610838143623371',
      handle: 'ada_dev',
      text: 'pic',
      photos: [{ alt: 'one' }, { alt: 'two' }],
    };
    const { entry } = await repo.saveCapture(captureFromFixture([p], p, 'tweet'));
    expect(entry.offline).toBe('text-only');
    let calls = 0;
    const fetcher = async (url: string) => {
      calls += 1;
      if (url.includes('x1')) return new Response('nope', { status: 404 });
      return new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), {
        headers: { 'content-type': 'image/png' },
      });
    };
    const r1 = await cacheEntryMedia(entry.id, { fetcher, db });
    expect(r1.offline).toBe('partial');
    expect((await repo.getEntry(entry.id))?.offline).toBe('partial');
    const before = calls;
    const r2 = await cacheEntryMedia(entry.id, {
      fetcher: async () =>
        new Response(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), {
          headers: { 'content-type': 'image/jpeg' },
        }),
      db,
    });
    expect(r2.offline).toBe('full');
    expect(calls).toBe(before); // cached images are not fetched again
  });

  it('refuses non-image responses and oversized files', async () => {
    const p: PostSpec = { id: '2079610838143623371', handle: 'ada_dev', text: 'pic', photos: [{}] };
    const { entry } = await repo.saveCapture(captureFromFixture([p], p, 'tweet'));
    const html = await cacheEntryMedia(entry.id, {
      db,
      fetcher: async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    });
    expect(html.offline).toBe('text-only');
    const big = await cacheEntryMedia(entry.id, {
      db,
      maxBytes: 2,
      fetcher: async () =>
        new Response(new Blob([new Uint8Array(10)]), {
          headers: { 'content-type': 'image/png', 'content-length': '10' },
        }),
    });
    expect(big.offline).toBe('text-only');
    const rec = (await db.media.toArray()).find((m) => m.kind === 'photo');
    expect(rec?.status).toBe('too-large');
  });
});

describe('schema migrations', () => {
  it('upgrades a v1 database to the current version without losing data', async () => {
    const name = `migrate-${Date.now()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_VERSIONS[0]!.stores);
    await v1.open();
    await v1.table('entries').put({
      id: 'e1',
      kind: 'tweet',
      title: 'Old',
      tweetIds: ['1'],
      authorHandle: 'a',
      savedAt: 1,
      tags: [],
      collectionIds: [],
    });
    v1.close();
    const current = new ThreadShelfDB(name);
    await current.open();
    expect(current.verno).toBe(3);
    expect(current.tables.map((t) => t.name)).toContain('translations');
    const e = await current.entries.get('e1');
    expect(e).toMatchObject({
      title: 'Old',
      offline: 'text-only',
      externalRefs: [],
      readProgress: 0,
    });
    expect(current.tables.map((t) => t.name)).toContain('media');
    current.close();
    await Dexie.delete(name);
  });
});
