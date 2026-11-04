// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThreadShelfDB, setDb } from '@/storage/db';
import { Repository } from '@/storage/repository';
import { exportEntries, exportLibrary, importLibrary } from '@/storage/backup';
import { importSavedItems, parseSavedItems } from '@/import/saved-items';
import { captureFromFixture } from '../helpers/capture';
import { threadPosts } from '../fixtures/x-dom';

let db: ThreadShelfDB;
let repo: Repository;
beforeEach(async () => {
  db = new ThreadShelfDB(`notes-${crypto.randomUUID()}`);
  await db.open();
  setDb(db);
  repo = new Repository(() => db);
});
afterEach(async () => {
  db.close();
  await Dexie.delete(db.name);
  setDb(null);
});

describe('annotations sync and privacy', () => {
  it('stores, updates, exports, restores and deletes a private highlight', async () => {
    const tweets = threadPosts(1);
    const { entry } = await repo.saveCapture(captureFromFixture(tweets, tweets[0]!));
    const a = await repo.saveAnnotation({
      entryId: entry.id, tweetId: entry.focalTweetId,
      exact: 'passage', prefix: 'un ', suffix: ' utile', start: 3, end: 10,
      color: 'yellow', comment: 'Idée pour Hermes',
    });
    await repo.updateAnnotation(a.id, { comment: 'Important', resolved: true, color: 'blue' });
    expect((await repo.listAnnotations(entry.id))[0]).toMatchObject({
      comment: 'Important', resolved: true, color: 'blue',
    });
    expect((await repo.listAnnotations(entry.id))[0]!.updatedAt).toBeGreaterThan(a.updatedAt);
    const backup = await exportLibrary({ db });
    expect(backup.data.annotations).toHaveLength(1);
    // Public/single-entry exports never include the owner's passage comments.
    expect((await exportEntries([entry.id], db)).data.annotations).toEqual([]);
    const copy = new ThreadShelfDB(`notes-copy-${crypto.randomUUID()}`);
    await copy.open();
    try {
      await importLibrary(JSON.stringify(backup), { db: copy, strategy: 'sync' });
      expect(await copy.annotations.get(a.id)).toMatchObject({ exact: 'passage', comment: 'Important' });
      await repo.deleteAnnotation(a.id);
      const afterDelete = await exportLibrary({ db });
      expect(Object.keys(afterDelete.data.tombstones ?? {})).toContain(`annotation:${a.id}`);
      expect(afterDelete.data.tombstones?.[`annotation:${a.id}`]).toBeGreaterThan(a.updatedAt);
      await importLibrary(JSON.stringify(afterDelete), { db: copy, strategy: 'sync' });
      expect(await copy.annotations.get(a.id)).toBeUndefined();
    } finally {
      copy.close();
      await Dexie.delete(copy.name);
    }
  });
});

describe('favoris import', () => {
  it('imports link-only records once and enriches them with a subsequent real capture', async () => {
    const tweets = threadPosts(1);
    const link = `https://x.com/i/status/${tweets[0]!.id}`;
    const refs = parseSavedItems(`url\n${link}\n${link}`, 'x-bookmarks.csv');
    const first = await importSavedItems(refs);
    const second = await importSavedItems(refs);
    expect(first).toMatchObject({ added: 1, skipped: 0 });
    expect(second).toMatchObject({ added: 0, skipped: 1 });
    const placeholder = await db.entries.where('focalTweetId').equals(tweets[0]!.id).first();
    expect(placeholder?.readLater).toBe(true);
    expect(placeholder?.tags).toContain('import-x');
    const capture = await repo.saveCapture(captureFromFixture(tweets, tweets[0]!));
    expect(capture.created).toBe(false);
    expect(capture.entry.id).toBe(placeholder?.id);
    expect(capture.entry.title).not.toContain('inconnu');
    expect((await db.tweets.get(tweets[0]!.id))?.textTruncated).not.toBe(true);
  });
});
