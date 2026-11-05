// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThreadShelfDB } from '@/storage/db';
import { Repository } from '@/storage/repository';
import { connectGitHub, runSync, stableStringify, type SyncConfig } from '@/sync/engine';
import { pollDeviceToken, requestDeviceCode } from '@/sync/device-flow';
import { decryptText, encryptText, isEncrypted } from '@/sync/crypto';
import { captureFromFixture } from '../helpers/capture';
import { fakeGitHub, type FakeGitHub } from '../helpers/fake-github';
import { threadPosts } from '../fixtures/x-dom';

const FILE = 'threadshelf/library.json';
const config: SyncConfig = { repo: 'lorry/threadshelf-data', filePath: FILE, encrypt: false };
const secrets = { token: 'gho_test', passphrase: '' };

let gl: FakeGitHub;
let dbA: ThreadShelfDB;
let dbB: ThreadShelfDB;
let A: Repository;
let B: Repository;
let n = 0;

const sync = (db: ThreadShelfDB, over: Partial<SyncConfig> = {}, sec = secrets) =>
  runSync({ config: { ...config, ...over }, secrets: sec, db, fetcher: gl.fetcher });

beforeEach(async () => {
  n += 1;
  gl = fakeGitHub();
  dbA = new ThreadShelfDB(`pcA-${n}-${Date.now()}`);
  dbB = new ThreadShelfDB(`pcB-${n}-${Date.now()}`);
  A = new Repository(() => dbA);
  B = new Repository(() => dbB);
});
afterEach(async () => {
  dbA.close();
  dbB.close();
  await Dexie.delete(dbA.name);
  await Dexie.delete(dbB.name);
});

const sleep = (ms = 5) => new Promise((r) => setTimeout(r, ms));

describe('GitHub library sync between two PCs', () => {
  it('first sync creates the file; the other PC receives the library; nothing ping-pongs', async () => {
    const t = threadPosts(4);
    await A.saveCapture(captureFromFixture(t, t[0]!));
    const r1 = await sync(dbA);
    expect(r1).toMatchObject({
      pushed: true,
      created: true,
      branch: 'main',
      repo: 'lorry/threadshelf-data',
    });
    expect(gl.commits).toBe(1);

    const r2 = await sync(dbB);
    expect(r2).toMatchObject({ added: 1, pushed: false });
    const [e] = await B.listEntries();
    expect(e!.tweetIds).toEqual(t.map((p) => p.id));
    expect((await B.getBundle(e!.id))!.tweets[t[2]!.id]).toBeDefined();
    expect(e!.searchText).toContain('part 3');

    expect((await sync(dbA)).pushed).toBe(false);
    expect((await sync(dbB)).pushed).toBe(false);
    expect(gl.commits).toBe(1);
  });

  it('edits made on one PC reach the other (most recent wins, removed tags stay removed)', async () => {
    const t = threadPosts(2);
    const { entry } = await A.saveCapture(captureFromFixture(t, t[0]!));
    await A.updateEntry(entry.id, { tags: ['react', 'perf'] });
    await sync(dbA);
    await sync(dbB);
    await sleep();
    await B.updateEntry(entry.id, {
      note: 'Note écrite sur le PC B',
      tags: ['react'],
      favorite: true,
    });
    await sync(dbB);
    const r = await sync(dbA);
    expect(r.updated).toBe(1);
    expect(await A.getEntry(entry.id)).toMatchObject({
      note: 'Note écrite sur le PC B',
      tags: ['react'],
      favorite: true,
    });
  });

  it('deletions propagate and never come back', async () => {
    const t = threadPosts(3);
    const u = threadPosts(2, { handle: 'other', startId: 2079610838143800000n });
    const { entry } = await A.saveCapture(captureFromFixture(t, t[0]!));
    await A.saveCapture(captureFromFixture(u, u[0]!));
    await sync(dbA);
    await sync(dbB);
    expect(await B.listEntries()).toHaveLength(2);
    await A.deleteEntries([entry.id]);
    await sync(dbA);
    const r = await sync(dbB);
    expect(r.deleted).toBe(1);
    expect((await B.listEntries()).map((e) => e.authorHandle)).toEqual(['other']);
    expect(await dbB.tweets.count()).toBe(2); // orphaned posts cleaned up
    await sync(dbB);
    await sync(dbA);
    expect(await A.listEntries()).toHaveLength(1);
    expect(await B.listEntries()).toHaveLength(1);
  });

  it('the same thread saved independently on both PCs converges to one entry with one ID', async () => {
    const t = threadPosts(3);
    await A.saveCapture(captureFromFixture(t, t[0]!));
    await B.saveCapture(captureFromFixture(t, t[0]!));
    await sync(dbA);
    await sync(dbB);
    await sync(dbA);
    const [a] = await A.listEntries();
    const [b] = await B.listEntries();
    expect(await A.listEntries()).toHaveLength(1);
    expect(await B.listEntries()).toHaveLength(1);
    expect(a!.id).toBe(b!.id);
    // A deletion on one side now reaches the other.
    await A.deleteEntries([a!.id]);
    await sync(dbA);
    await sync(dbB);
    expect(await B.listEntries()).toHaveLength(0);
  });

  it('collections: creation, rename and deletion propagate', async () => {
    const t = threadPosts(2);
    const { entry } = await A.saveCapture(captureFromFixture(t, t[0]!));
    const c = await A.createCollection('À lire');
    await A.addToCollection([entry.id], c.id);
    await sync(dbA);
    await sync(dbB);
    expect((await B.listCollections()).map((x) => x.name)).toEqual(['À lire']);
    expect((await B.getEntry(entry.id))!.collectionIds).toEqual([c.id]);
    await sleep();
    await B.renameCollection(c.id, 'Lectures');
    await sync(dbB);
    await sync(dbA);
    expect((await A.listCollections()).map((x) => x.name)).toEqual(['Lectures']);
    await sleep();
    await A.deleteCollection(c.id);
    await sync(dbA);
    await sync(dbB);
    expect(await B.listCollections()).toEqual([]);
    expect((await B.getEntry(entry.id))!.collectionIds).toEqual([]);
  });

  it('a concurrent push from another PC is detected and merged, nothing is lost', async () => {
    const t = threadPosts(2);
    const u = threadPosts(2, { handle: 'other', startId: 2079610838143800000n });
    await A.saveCapture(captureFromFixture(t, t[0]!));
    await sync(dbA);
    await B.saveCapture(captureFromFixture(u, u[0]!));
    // While B is about to push, A pushes a new entry.
    const v = threadPosts(2, { handle: 'third', startId: 2079610838143900000n });
    await A.saveCapture(captureFromFixture(v, v[0]!));
    let once = true;
    gl.beforeWrite = async () => {
      if (!once) return;
      once = false;
      gl.beforeWrite = undefined;
      await sync(dbA);
    };
    const r = await sync(dbB);
    expect(r.pushed).toBe(true);
    await sync(dbA);
    const names = async (repo: Repository) =>
      (await repo.listEntries()).map((e) => e.authorHandle).sort();
    expect(await names(A)).toEqual(['ada_dev', 'other', 'third']);
    expect(await names(B)).toEqual(['ada_dev', 'other', 'third']);
  });

  it('preserves private highlights across two devices, concurrent additions and deletion', async () => {
    const t = threadPosts(2);
    const { entry } = await A.saveCapture(captureFromFixture(t, t[0]!));
    const first = await A.saveAnnotation({
      entryId: entry.id, tweetId: entry.focalTweetId,
      exact: 'passage A', prefix: '', suffix: '', start: 0, end: 9,
      color: 'yellow', comment: 'Commentaire sur le PC A',
    });
    await sync(dbA);
    await sync(dbB);
    expect((await B.listAnnotations(entry.id)).map((a) => a.id)).toEqual([first.id]);

    // Both machines add different annotations before seeing each other's push.
    const fromA = await A.saveAnnotation({
      entryId: entry.id, tweetId: entry.focalTweetId,
      exact: 'nouvelle idée A', prefix: '', suffix: '', start: 9, end: 24,
      color: 'blue', comment: 'À partager avec Stan',
    });
    const fromB = await B.saveAnnotation({
      entryId: entry.id, tweetId: entry.focalTweetId,
      exact: 'nouvelle idée B', prefix: '', suffix: '', start: 24, end: 39,
      color: 'green', comment: 'À relire',
    });
    let once = true;
    gl.beforeWrite = async () => {
      if (!once) return;
      once = false;
      gl.beforeWrite = undefined;
      await sync(dbA);
    };
    await sync(dbB);
    await sync(dbA);
    const ids = async (repo: Repository) => (await repo.listAnnotations(entry.id)).map((a) => a.id).sort();
    const expected = [first.id, fromA.id, fromB.id].sort();
    expect(await ids(A)).toEqual(expected);
    expect(await ids(B)).toEqual(expected);
    expect((await B.listAnnotations(entry.id)).find((a) => a.id === fromA.id)?.comment)
      .toBe('À partager avec Stan');

    await A.deleteAnnotation(first.id);
    await sync(dbA);
    await sync(dbB);
    expect(await ids(B)).toEqual([fromA.id, fromB.id].sort());
    await sync(dbA);
    expect(await ids(A)).toEqual([fromA.id, fromB.id].sort());
  });

  it('end-to-end encryption: GitHub only stores ciphertext', async () => {
    const t = threadPosts(2, { text: (i) => `Secret note ${i}` });
    await A.saveCapture(captureFromFixture(t, t[0]!));
    const sec = { token: 'gho_test', passphrase: 'correct horse battery' };
    await sync(dbA, { encrypt: true }, sec);
    const raw = gl.rawText(FILE)!;
    expect(isEncrypted(raw)).toBe(true);
    expect(raw).not.toContain('Secret note');
    await expect(
      sync(dbB, { encrypt: true }, { ...sec, passphrase: 'wrong passphrase' }),
    ).rejects.toThrow('Phrase secrète incorrecte.');
    await expect(sync(dbB, {}, { ...sec, passphrase: '' })).rejects.toThrow(/chiffrée/);
    expect(await B.listEntries()).toHaveLength(0);
    const r = await sync(dbB, { encrypt: true }, sec);
    expect(r.added).toBe(1);
    expect((await sync(dbB, { encrypt: true }, sec)).pushed).toBe(false);
  });

  it('refuses a public repository unless the library is encrypted, and reports bad credentials', async () => {
    gl.repoPrivate = false;
    await expect(sync(dbA)).rejects.toThrow(/est public/);
    await expect(sync(dbA, {}, { token: 'nope', passphrase: '' })).rejects.toThrow(
      /expirée ou révoquée/,
    );
    await expect(sync(dbA, { repo: '' })).rejects.toThrow(/Connectez/);
  });

  it('reads files larger than 1 MB through the raw endpoint', async () => {
    gl.inlineLimit = 10;
    const t = threadPosts(2);
    await A.saveCapture(captureFromFixture(t, t[0]!));
    await sync(dbA);
    const r = await sync(dbB);
    expect(r.added).toBe(1);
    expect((await sync(dbB)).pushed).toBe(false);
  });
});

describe('sync building blocks', () => {
  it('stable JSON does not depend on key order', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe(
      stableStringify({ a: { c: [3, { e: 2, f: 1 }], d: 2 }, b: 1 }),
    );
  });

  it('encryption round-trips and uses a fresh salt/IV each time', async () => {
    const a = await encryptText('bonjour 🧵', 'passphrase-123');
    const b = await encryptText('bonjour 🧵', 'passphrase-123');
    expect(a).not.toBe(b);
    expect(await decryptText(a, 'passphrase-123')).toBe('bonjour 🧵');
    await expect(decryptText(a, 'other-passphrase')).rejects.toThrow('Phrase secrète incorrecte.');
  });
});

describe('restore after deletion', () => {
  it('a manual restore wins over an earlier deletion, on every PC', async () => {
    const { exportLibrary, importLibrary } = await import('@/storage/backup');
    const t = threadPosts(2);
    await A.saveCapture(captureFromFixture(t, t[0]!));
    await sync(dbA);
    await sync(dbB);
    const backup = JSON.stringify(await exportLibrary({ db: dbA }));
    await sleep();
    await A.clearAll();
    await sync(dbA);
    await sync(dbB);
    expect(await B.listEntries()).toHaveLength(0);
    await sleep();
    // Restore the backup on A: the entry comes back here and on B.
    const report = await importLibrary(backup, { db: dbA });
    expect(report.entries.added).toBe(1);
    await sync(dbA);
    await sync(dbB);
    expect(await A.listEntries()).toHaveLength(1);
    expect(await B.listEntries()).toHaveLength(1);
  });
});

describe('« Se connecter avec GitHub » (device flow)', () => {
  it('code → authorisation → private repository created once, found from the second PC', async () => {
    gl.repoExists = false;
    // PC A
    const codeA = await requestDeviceCode('Ov23liTEST', gl.fetcher);
    expect(codeA).toMatchObject({
      userCode: 'WDJB-MJHT',
      verificationUri: 'https://github.com/login/device',
    });
    expect(await pollDeviceToken('Ov23liTEST', codeA, gl.fetcher)).toMatchObject({
      status: 'pending',
    });
    gl.approveAll();
    const okA = await pollDeviceToken('Ov23liTEST', codeA, gl.fetcher);
    if (okA.status !== 'authorized') throw new Error('expected token');
    const a = await connectGitHub(okA.token, gl.fetcher);
    expect(a).toMatchObject({ login: 'lorry', repo: 'lorry/threadshelf-data', created: true });
    expect(gl.repoPrivate).toBe(true);
    // PC B
    const codeB = await requestDeviceCode('Ov23liTEST', gl.fetcher);
    gl.approveAll();
    const okB = await pollDeviceToken('Ov23liTEST', codeB, gl.fetcher);
    if (okB.status !== 'authorized') throw new Error('expected token');
    const b = await connectGitHub(okB.token, gl.fetcher);
    expect(b.created).toBe(false);
    expect(gl.reposCreated).toBe(1);
    // Both PCs sync with their own token.
    const t = threadPosts(2);
    await A.saveCapture(captureFromFixture(t, t[0]!));
    await runSync({
      config,
      secrets: { token: okA.token, passphrase: '' },
      db: dbA,
      fetcher: gl.fetcher,
    });
    const r = await runSync({
      config,
      secrets: { token: okB.token, passphrase: '' },
      db: dbB,
      fetcher: gl.fetcher,
    });
    expect(r.added).toBe(1);
  });

  it('reports refusal, expiry and a missing Device Flow setting', async () => {
    const code = await requestDeviceCode('Ov23liTEST', gl.fetcher);
    gl.devices.set(code.deviceCode, 'denied');
    await expect(pollDeviceToken('Ov23liTEST', code, gl.fetcher)).rejects.toThrow(
      'Autorisation refusée sur GitHub.',
    );
    await expect(
      pollDeviceToken('Ov23liTEST', { deviceCode: 'unknown', interval: 5 }, gl.fetcher),
    ).rejects.toThrow(/expiré/);
    gl.deviceFlowEnabled = false;
    await expect(requestDeviceCode('Ov23liTEST', gl.fetcher)).rejects.toThrow(/Device Flow/);
  });

  it('refuses an existing public repository', async () => {
    gl.repoPrivate = false;
    await expect(connectGitHub('gho_test', gl.fetcher)).rejects.toThrow(/public/);
  });
});

describe('expiring GitHub tokens', () => {
  it('keeps refresh data from the device flow and explains how to avoid expiry', async () => {
    const { refreshUserToken } = await import('@/sync/device-flow');
    const expiring = async (url: string, init?: RequestInit) => {
      if (url.endsWith('/login/oauth/access_token')) {
        const form = new URLSearchParams(String(init?.body));
        if (form.get('grant_type') === 'refresh_token')
          return Response.json({ error: 'incorrect_client_credentials' });
        return Response.json({ access_token: 'ghu_1', refresh_token: 'ghr_1', expires_in: 28800 });
      }
      return gl.fetcher(url, init);
    };
    const code = await requestDeviceCode('Ov23liTEST', gl.fetcher);
    gl.approveAll();
    const r = await pollDeviceToken('Ov23liTEST', code, expiring);
    expect(r).toMatchObject({ status: 'authorized', token: 'ghu_1', refreshToken: 'ghr_1' });
    if (r.status === 'authorized') expect(r.expiresAt).toBeGreaterThan(Date.now() + 28_000_000);
    await expect(refreshUserToken('Ov23liTEST', 'ghr_1', expiring)).rejects.toThrow(
      /décochez « Expire user access tokens »/,
    );
  });
});
