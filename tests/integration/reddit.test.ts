// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REDDIT_SCRIPT_ID, syncRedditScript } from '@/background/reddit-access';
import { scanReddit } from '@/extraction/reddit';
import { exportLibrary, importLibrary } from '@/storage/backup';
import { ThreadShelfDB, setDb } from '@/storage/db';
import { Repository, type CaptureInput } from '@/storage/repository';
import { searchEntries } from '@/storage/search';
import { observe, type CaptureMode } from '@/thread-engine';
import {
  DISCUSSION_COMMENTS,
  DISCUSSION_POST,
  redditPostPage,
  type RedditCommentSpec,
} from '../fixtures/reddit-dom';

const URL = 'https://www.reddit.com/r/AskHistorians/comments/1xb56ky/what_was_the_deal/';

function capture(
  comments: RedditCommentSpec[],
  mode: CaptureMode = 'thread',
  focalId = 't3_1xb56ky',
  extra: Partial<CaptureInput> = {},
): CaptureInput {
  const doc = new JSDOM(redditPostPage(DISCUSSION_POST, comments), { url: URL }).window.document;
  const scan = scanReddit(doc, URL);
  const obs = observe(scan);
  const input: CaptureInput = {
    mode,
    focalId,
    tweets: obs.tweets,
    relations: obs.relations,
    pageUrl: URL,
    pageKind: scan.route.kind,
    ...extra,
  };
  if (scan.reddit) input.reddit = scan.reddit;
  return input;
}

let db: ThreadShelfDB;
let repo: Repository;
let n = 0;

beforeEach(async () => {
  n += 1;
  db = new ThreadShelfDB(`reddit-${n}-${Date.now()}`);
  setDb(db);
  repo = new Repository(() => db);
  await db.open();
});
afterEach(async () => {
  db.close();
  await Dexie.delete(db.name);
  setDb(null);
});

describe('saving Reddit discussions', () => {
  it('saves the post and its comment tree as one discussion entry', async () => {
    const r = await repo.saveCapture(capture(DISCUSSION_COMMENTS));
    expect(r.created).toBe(true);
    expect(r.entry).toMatchObject({
      platform: 'reddit',
      kind: 'thread',
      title: DISCUSSION_POST.title,
      authorHandle: 'ExternalBoysenberry',
      focalTweetId: 't3_1xb56ky',
      completeness: { status: 'needs_more' },
    });
    expect(r.entry.sourceUrl).toMatch(
      /^https:\/\/www\.reddit\.com\/r\/AskHistorians\/comments\/1xb56ky\//,
    );
    expect(r.entry.tweetIds).toHaveLength(6);
    expect(r.message).toBe('6 messages enregistrés — des commentaires restent à charger');
    const bundle = await repo.getBundle(r.entry.id);
    expect(bundle!.relations.filter((x) => x.source === 'reddit-tree')).toHaveLength(5);
    expect(bundle!.tweets['t1_qq1']!.reddit).toMatchObject({ depth: 2, isOp: true });
    // Search finds it by subreddit, by Reddit username and by comment text.
    const entries = await repo.listEntries();
    for (const q of ['r/askhistorians', 'gerardmenfin', 'tétines'])
      expect(searchEntries(entries, q).map((e) => e.id)).toEqual([r.entry.id]);
  });

  it('completes the same entry when more comments are loaded (no duplicate)', async () => {
    const first = await repo.saveCapture(capture(DISCUSSION_COMMENTS.slice(0, 1)));
    const more: RedditCommentSpec[] = [
      ...DISCUSSION_COMMENTS,
      { id: 'late1', author: 'latecomer', body: '<p>Late answer.</p>' },
    ];
    const second = await repo.saveCapture(capture(more));
    expect(second.created).toBe(false);
    expect(second.entry.id).toBe(first.entry.id);
    expect(second.entry.tweetIds).toHaveLength(7);
    expect(second.entry.tweetIds.at(-1)).toBe('t1_late1');
    expect(await db.entries.count()).toBe(1);
  });

  it('saves a single comment with its context and a generic title fallback', async () => {
    const r = await repo.saveCapture(capture(DISCUSSION_COMMENTS, 'tweet', 't1_qq1'));
    expect(r.entry).toMatchObject({
      platform: 'reddit',
      kind: 'tweet',
      tweetIds: ['t1_qq1'],
      contextTweetIds: ['t3_1xb56ky', 't1_19rhkvwj72ld1', 't1_19rhkyxlp7mox'],
      title: 'Thank you, this is fascinating!',
    });
    expect(r.message).toBe('Message enregistré');
  });

  it('round-trips through backup export / import', async () => {
    const r = await repo.saveCapture(capture(DISCUSSION_COMMENTS));
    const json = JSON.stringify(await exportLibrary({ db }));
    const other = new ThreadShelfDB(`reddit-other-${Date.now()}`);
    const report = await importLibrary(json, { db: other });
    expect(report.invalid).toBe(0);
    const bundle = await new Repository(() => other).getBundle(r.entry.id);
    other.close();
    await Dexie.delete(other.name);
    expect(bundle?.entry.platform).toBe('reddit');
    expect(bundle?.entry.tweetIds).toEqual(r.entry.tweetIds);
    expect(bundle?.tweets['t3_1xb56ky']?.article?.title).toBe(DISCUSSION_POST.title);
  });
});

describe('Reddit access (optional permission)', () => {
  function fakeChrome(granted: boolean) {
    const registered: { id: string; matches: string[]; js: string[] }[] = [];
    const injected: number[] = [];
    const chrome = {
      permissions: { contains: vi.fn(async () => granted) },
      scripting: {
        getRegisteredContentScripts: vi.fn(async ({ ids }: { ids: string[] }) =>
          registered.filter((s) => ids.includes(s.id)),
        ),
        registerContentScripts: vi.fn(async (s: (typeof registered)[number][]) => {
          registered.push(...s);
        }),
        unregisterContentScripts: vi.fn(async ({ ids }: { ids: string[] }) => {
          for (const id of ids)
            registered.splice(
              registered.findIndex((s) => s.id === id),
              1,
            );
        }),
        executeScript: vi.fn(async ({ target }: { target: { tabId: number } }) => {
          injected.push(target.tabId);
        }),
      },
      tabs: { query: vi.fn(async () => [{ id: 7 }, { id: 9 }]) },
    };
    vi.stubGlobal('chrome', chrome);
    return {
      registered,
      injected,
      grant: (v: boolean) => {
        granted = v;
      },
    };
  }

  it('registers the content script once reddit.com is granted, and removes it when revoked', async () => {
    const f = fakeChrome(false);
    expect(await syncRedditScript()).toBe(false);
    expect(f.registered).toHaveLength(0);

    f.grant(true);
    expect(await syncRedditScript({ injectOpenTabs: true })).toBe(true);
    expect(f.registered).toEqual([
      expect.objectContaining({
        id: REDDIT_SCRIPT_ID,
        matches: ['https://www.reddit.com/*', 'https://reddit.com/*'],
        js: ['content.js'],
      }),
    ]);
    expect(f.injected).toEqual([7, 9]);
    await syncRedditScript();
    expect(f.registered).toHaveLength(1);

    f.grant(false);
    await syncRedditScript();
    expect(f.registered).toHaveLength(0);
  });
});
