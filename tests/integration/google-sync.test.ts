// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreadShelfDB } from '@/storage/db';
import { Repository } from '@/storage/repository';
import { decryptText, isEncrypted } from '@/sync/crypto';
import { syncGoogleDrive } from '@/web/google-sync';
import { captureFromFixture } from '../helpers/capture';
import { threadPosts } from '../fixtures/x-dom';

const remote = vi.hoisted(() => ({
  files: [] as Array<{ id: string; name: string; text: string; createdTime: string }>,
  n: 0,
}));
vi.mock('@/web/google-client', () => ({
  listGoogleSnapshots: vi.fn(async () =>
    remote.files.map(({ id, name, createdTime }) => ({ id, name, createdTime })),
  ),
  readGoogleSnapshot: vi.fn(async (id: string) => {
    const file = remote.files.find((item) => item.id === id);
    if (!file) throw new Error('Missing snapshot');
    return file.text;
  }),
  writeGoogleSnapshot: vi.fn(async (device: string, revision: string, text: string) => {
    remote.files.push({
      id: `snapshot${remote.n}`,
      name: `theardx-${device}-${revision}.json`,
      text,
      createdTime: new Date(Date.UTC(2026, 10, 5, 12, remote.n++)).toISOString(),
    });
  }),
}));

const passphrase = 'theardx end-to-end encryption test';
let dbA: ThreadShelfDB;
let dbB: ThreadShelfDB;
let A: Repository;
let B: Repository;
let n = 0;

beforeEach(() => {
  remote.files = [];
  remote.n = 0;
  n++;
  dbA = new ThreadShelfDB(`google-A-${n}-${Date.now()}`);
  dbB = new ThreadShelfDB(`google-B-${n}-${Date.now()}`);
  A = new Repository(() => dbA);
  B = new Repository(() => dbB);
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  dbA.close();
  dbB.close();
  await Dexie.delete(dbA.name);
  await Dexie.delete(dbB.name);
});

const syncA = () => syncGoogleDrive({ db: dbA, passphrase });
const syncB = () => syncGoogleDrive({ db: dbB, passphrase });

describe('Google Drive encrypted immutable revisions', () => {
  it('creates only ciphertext, restores a second device, and avoids unnecessary uploads', async () => {
    const thread = threadPosts(3, { text: (i) => `Secret saved content ${i}` });
    await A.saveCapture(captureFromFixture(thread, thread[0]!));
    expect(await syncA()).toMatchObject({ pushed: true, created: true });
    expect(remote.files).toHaveLength(1);
    expect(isEncrypted(remote.files[0]!.text)).toBe(true);
    expect(remote.files[0]!.text).not.toContain('Secret saved content');
    const decoded = await decryptText(remote.files[0]!.text, passphrase);
    expect(decoded).toContain('Secret saved content');
    expect(await syncB()).toMatchObject({ added: 1, pushed: false });
    expect(await B.listEntries()).toHaveLength(1);
    expect((await syncA()).pushed).toBe(false);
    expect(remote.files).toHaveLength(1);
  });

  it('preserves concurrent edits from independently created snapshots', async () => {
    const one = threadPosts(2);
    const two = threadPosts(2, { handle: 'other', startId: 2079610838143800000n });
    await A.saveCapture(captureFromFixture(one, one[0]!));
    await B.saveCapture(captureFromFixture(two, two[0]!));
    await syncA();
    // B deliberately writes from an old view: emulate the other client being offline
    // by temporarily hiding A's snapshot during its write.
    const aSnapshot = remote.files.pop()!;
    await syncB();
    remote.files.unshift(aSnapshot);
    expect(remote.files).toHaveLength(2);
    expect((await syncA()).pushed).toBe(true);
    await syncB();
    expect((await A.listEntries()).map((x) => x.authorHandle).sort()).toEqual(['ada_dev', 'other']);
    expect((await B.listEntries()).map((x) => x.authorHandle).sort()).toEqual(['ada_dev', 'other']);
  });

  it('propagates tombstones and rejects an incorrect passphrase before overwriting', async () => {
    const thread = threadPosts(2);
    const { entry } = await A.saveCapture(captureFromFixture(thread, thread[0]!));
    await syncA();
    await syncB();
    await A.deleteEntries([entry.id]);
    await syncA();
    expect((await syncB()).deleted).toBe(1);
    expect(await B.listEntries()).toHaveLength(0);
    await expect(syncGoogleDrive({ db: dbB, passphrase: 'different passphrase' })).rejects.toThrow(
      'Phrase secrète incorrecte',
    );
    expect(remote.files).toHaveLength(2);
  });
});
