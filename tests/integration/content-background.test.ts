// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://x.com/ada_dev/status/2079610838143623371"}
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleMessage, isTrustedSender, type BackgroundDeps } from '@/background/handlers';
import { ContentController } from '@/content/controller';
import { useContent } from '@/content/store';
import { ThreadShelfDB, setDb } from '@/storage/db';
import { Repository } from '@/storage/repository';
import { updateSettings } from '@/settings/store';
import { EXT_ID, installChromeMock } from '../helpers/chrome-mock';
import { statusPage, threadPosts, replies } from '../fixtures/x-dom';

let db: ThreadShelfDB;
let repo: Repository;
let mock: ReturnType<typeof installChromeMock>;
let deps: BackgroundDeps;
let controller: ContentController;
const thread = threadPosts(4);

function loadFixture(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  db = new ThreadShelfDB(`cb-${Date.now()}-${Math.random()}`);
  setDb(db);
  repo = new Repository(() => db);
  deps = {
    repo,
    openTab: async (url) => {
      mock.opened.push(url);
    },
    extensionUrl: (p) => `chrome-extension://${EXT_ID}/${p}`,
    extensionId: EXT_ID,
    version: '1.0.0',
    cacheMedia: async () => undefined,
  };
  mock = installChromeMock({ background: (msg, sender) => handleMessage(msg, sender, deps) });
  history.replaceState({}, '', `/ada_dev/status/${thread[0]!.id}`);
  loadFixture(statusPage('xds', [...thread, ...replies(2, 'ada_dev')], thread[0]!.id));
  useContent.setState({
    toasts: [],
    panelOpen: false,
    selection: [],
    live: null,
    mode: 'thread',
    busy: false,
  });
  controller = new ContentController({ ensure: () => {}, destroy: () => {} });
  await controller.start();
  await flush();
});

afterEach(async () => {
  controller.stop();
  db.close();
  await Dexie.delete(db.name);
  setDb(null);
  mock.uninstall();
});

describe('content script ↔ background worker', () => {
  it('detects the thread and injects one bar and one button per post', () => {
    controller.scan();
    expect(document.querySelectorAll('threadshelf-bar')).toHaveLength(1);
    expect(document.querySelectorAll('threadshelf-action')).toHaveLength(6);
    expect(controller.state().focal).toMatchObject({
      id: thread[0]!.id,
      threadCount: 4,
      status: 'complete',
    });
  });

  it('saves through validated messages and persists to IndexedDB', async () => {
    const r = await controller.save('thread');
    expect(r).toMatchObject({ ok: true, message: 'Thread enregistré — 4 publications' });
    const entries = await repo.listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.tweetIds).toEqual(thread.map((t) => t.id));
    expect(useContent.getState().toasts.at(-1)?.title).toBe('Thread enregistré — 4 publications');
  });

  it('answers popup/background messages (state, run) and ignores foreign senders', async () => {
    const state = (await mock.toContent({ type: 'content.state' })) as {
      focal: { threadCount: number };
    };
    expect(state.focal.threadCount).toBe(4);
    const run = await mock.toContent({ type: 'content.run', action: 'save-tweet' });
    expect(run).toMatchObject({ ok: true });
    expect((await repo.listEntries())[0]!.kind).toBe('tweet');
    const foreign = await mock.toContent({ type: 'content.state' }, { id: 'another-extension' });
    expect(foreign).toBeUndefined();
    const malformed = await mock.toContent({ type: 'content.run', action: 'rm -rf' });
    expect(malformed).toBeUndefined();
  });

  it('opens the reader after saving', async () => {
    const r = await controller.read('thread');
    expect(r.ok).toBe(true);
    expect(mock.opened[0]).toMatch(/reader\/index\.html\?id=e_/);
  });

  it('turning ThreadShelf off removes every injected element; turning it on restores them', async () => {
    controller.scan();
    expect(document.querySelectorAll('threadshelf-bar, threadshelf-action').length).toBeGreaterThan(
      0,
    );
    await updateSettings({ enabled: false });
    await flush();
    expect(document.querySelectorAll('threadshelf-bar, threadshelf-action')).toHaveLength(0);
    expect(controller.state().active).toBe(false);
    await updateSettings({ enabled: true });
    await flush(300);
    controller.scan();
    expect(document.querySelectorAll('threadshelf-bar')).toHaveLength(1);
  });

  it('visual injection can be disabled while capture keeps working', async () => {
    await updateSettings({ injectUi: false });
    await flush();
    expect(document.querySelectorAll('threadshelf-bar, threadshelf-action')).toHaveLength(0);
    const r = await controller.save('thread');
    expect(r.ok).toBe(true);
  });

  it('auto-detection off: no observer, scans only on demand', async () => {
    await updateSettings({ autoDetect: false });
    await flush();
    expect(controller.debugInfo().observing).toBe(false);
    const r = await controller.save('thread');
    expect(r.ok).toBe(true);
  });

  it('surfaces background errors to the user', async () => {
    deps.repo = {
      ...repo,
      saveCapture: async () => {
        throw new Error('QuotaExceededError: disk full');
      },
    } as unknown as Repository;
    const r = await controller.save('thread');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Espace de stockage insuffisant.');
    expect(useContent.getState().toasts.at(-1)).toMatchObject({ tone: 'error' });
  });

  it('handles a page with no post gracefully', async () => {
    history.replaceState({}, '', '/home');
    loadFixture('<html><body><main><p>Rien</p></main></body></html>');
    const r = await controller.save('thread');
    expect(r).toMatchObject({ ok: false });
  });
});

describe('background message validation', () => {
  it('rejects untrusted senders', async () => {
    const res = await handleMessage({ type: 'ping' }, { id: 'evil', url: 'https://x.com/' }, deps);
    expect(res).toEqual({ ok: false, error: 'Untrusted sender.' });
    expect(isTrustedSender({ id: EXT_ID, url: 'https://evil.example/' }, deps)).toBe(false);
    expect(
      isTrustedSender({ id: EXT_ID, url: `chrome-extension://${EXT_ID}/library/index.html` }, deps),
    ).toBe(true);
    expect(
      isTrustedSender({ id: EXT_ID, tab: { url: 'https://twitter.com/a/status/1' } }, deps),
    ).toBe(true);
  });

  it('rejects malformed or dangerous payloads before touching storage', async () => {
    const sender = { id: EXT_ID, url: 'https://x.com/' };
    const bad = await handleMessage(
      {
        type: 'capture.save',
        payload: {
          mode: 'thread',
          focalId: '1',
          tweets: [{ id: '1', url: 'javascript:alert(1)' }],
          relations: [],
          pageUrl: 'https://x.com/',
        },
      },
      sender,
      deps,
    );
    expect(bad.ok).toBe(false);
    const unknown = await handleMessage({ type: 'db.drop' }, sender, deps);
    expect(unknown.ok).toBe(false);
    const extra = await handleMessage(
      { type: 'entry.update', id: 'e1', patch: { searchText: 'x' } },
      sender,
      deps,
    );
    expect(extra.ok).toBe(false);
    expect(await repo.listEntries()).toHaveLength(0);
  });

  it('ping returns the version', async () => {
    expect(
      await handleMessage(
        { type: 'ping' },
        { id: EXT_ID, url: `chrome-extension://${EXT_ID}/popup/index.html` },
        deps,
      ),
    ).toEqual({ ok: true, data: { ok: true, version: '1.0.0' } });
  });
});
