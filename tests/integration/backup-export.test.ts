// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThreadShelfDB, setDb } from '@/storage/db';
import { Repository } from '@/storage/repository';
import { exportLibrary, importLibrary, ImportError, parseBackup } from '@/storage/backup';
import { render, exportFileName, toMarkdown, toPlainText, toHtml, toJson } from '@/export';
import { escapeMarkdown } from '@/export/markdown';
import { captureFromFixture } from '../helpers/capture';
import { threadPosts, type PostSpec } from '../fixtures/x-dom';

let db: ThreadShelfDB;
let repo: Repository;
let n = 0;
beforeEach(async () => {
  n += 1;
  db = new ThreadShelfDB(`bk-${n}-${Date.now()}`);
  setDb(db);
  repo = new Repository(() => db);
  await db.open();
});
afterEach(async () => {
  db.close();
  await Dexie.delete(db.name);
  setDb(null);
});

async function savedThread(count = 3) {
  const t = threadPosts(count, {
    text: (i) =>
      i === 0
        ? 'How we cut build time by 80% with @vite_js — a thread 🧵\n\nFirst: measure https://example.com/blog/build-times?utm_source=x #perf'
        : `Step ${i + 1}: details *bold* [x]`,
  });
  t[1] = { ...t[1]!, photos: [{ alt: 'Flamegraph before/after' }] };
  t[2] = {
    ...t[2]!,
    quote: {
      id: '2070000000000000001',
      handle: 'quoted_one',
      name: 'Quoted',
      text: 'Original insight',
    },
  };
  const { entry } = await repo.saveCapture(captureFromFixture(t, t[0]!));
  await repo.updateEntry(entry.id, { note: 'Relire avant la réunion', tags: ['perf'] });
  return { t, bundle: (await repo.getBundle(entry.id))! };
}

describe('exports', () => {
  it('Markdown follows the documented format', async () => {
    const { bundle, t } = await savedThread();
    const md = toMarkdown(bundle);
    expect(md).toMatch(/^# How we cut build time by 80% with @vite\\_js — a thread 🧵\n/);
    expect(md).toContain('Auteur : Ada Example [@ada_dev](https://x.com/ada_dev)');
    expect(md).toContain(`Source : https://x.com/ada_dev/status/${t[0]!.id}`);
    expect(md).toContain('## 1 / 3');
    expect(md).toContain('## 3 / 3');
    expect(md).toContain('[@vite_js](https://x.com/vite_js)');
    expect(md).toContain('[example.com/blog/build-times](https://example.com/blog/build-times)');
    expect(md).toContain('[#perf](https://x.com/hashtag/perf)');
    expect(md).toContain('![Flamegraph before/after](https://pbs.twimg.com/media/');
    expect(md).toContain('> **Citation — @quoted\\_one**');
    expect(md).toContain('Step 2: details \\*bold\\* \\[x\\]');
    expect(md).toContain(`[Voir la publication](https://x.com/ada_dev/status/${t[1]!.id})`);
    expect(md).toContain('## Note personnelle');
    expect(md).toContain('Capture : 3 publications — thread complet vérifié');
  });

  it('Markdown without URLs and for a selection', async () => {
    const { bundle, t } = await savedThread();
    const md = toMarkdown(bundle, { includeUrls: false, tweetIds: [t[1]!.id] });
    expect(md).not.toContain('[Voir la publication]');
    expect(md).toContain('## Publication');
    expect(md).not.toContain('## 1 /');
    expect(md).toContain('1 publication sélectionnée');
  });

  it('plain text keeps structure and full URLs', async () => {
    const { bundle, t } = await savedThread();
    const txt = toPlainText(bundle);
    expect(txt.split('\n')[0]).toBe('How we cut build time by 80% with @vite_js — a thread 🧵');
    expect(txt).toContain('1/3\nHow we cut');
    expect(txt).toContain('https://example.com/blog/build-times');
    expect(txt).toContain('[Image : Flamegraph before/after]');
    expect(txt).toContain('« Citation de @quoted_one : Original insight »');
    expect(txt).toContain(`https://x.com/ada_dev/status/${t[2]!.id}`);
    expect(txt).not.toMatch(/[*#]\[/);
  });

  it('HTML is standalone, script-free and escaped', async () => {
    const { bundle } = await savedThread();
    bundle.tweets[bundle.entry.tweetIds[0]!]!.text.push({
      t: 'text',
      v: '<script>alert(1)</script>',
    });
    bundle.tweets[bundle.entry.tweetIds[0]!]!.text.push({
      t: 'link',
      v: 'bad',
      href: 'javascript:alert(1)',
    });
    const html = toHtml(bundle, { embedImages: true, dataUris: {} });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('javascript:');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('<div class="num">1 / 3</div>');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it('HTML embeds cached images as data URIs when asked', async () => {
    const { bundle } = await savedThread();
    const url = bundle.tweets[bundle.entry.tweetIds[1]!]!.media[0]!.url;
    const html = toHtml(bundle, {
      embedImages: true,
      dataUris: { [url]: 'data:image/png;base64,AAAA' },
    });
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it('JSON is structured and parseable', async () => {
    const { bundle, t } = await savedThread();
    const doc = JSON.parse(toJson(bundle));
    expect(doc.format).toBe('threadshelf.entry');
    expect(doc.posts.map((p: { id: string }) => p.id)).toEqual(t.map((p) => p.id));
    expect(doc.entry.searchText).toBeUndefined();
    expect(doc.relations.length).toBeGreaterThan(0);
  });

  it('file names are safe', async () => {
    const { bundle } = await savedThread();
    expect(exportFileName(bundle, 'markdown')).toMatch(
      /^threadshelf-ada_dev-\d{4}-\d{2}-\d{2}-how-we-cut-build-time[a-z0-9-]*\.md$/,
    );
    expect(render('text', bundle).length).toBeGreaterThan(10);
  });

  it('escapes Markdown control characters at line start', () => {
    expect(escapeMarkdown('# not a title\n- not a list\n1. not a list')).toBe(
      '\\# not a title\n\\- not a list\n1\\. not a list',
    );
  });
});

describe('library backup', () => {
  it('round-trips the whole library into an empty database', async () => {
    const { bundle } = await savedThread();
    const col = await repo.createCollection('Perf');
    await repo.addToCollection([bundle.entry.id], col.id);
    const backup = await exportLibrary({ db });
    const text = JSON.stringify(backup);

    const other = new ThreadShelfDB(`bk-other-${Date.now()}`);
    const report = await importLibrary(text, { db: other });
    expect(report.entries.added).toBe(1);
    expect(report.collections).toBe(1);
    expect(report.invalid).toBe(0);
    const repo2 = new Repository(() => other);
    const b2 = await repo2.getBundle(bundle.entry.id);
    expect(b2?.entry.tweetIds).toEqual(bundle.entry.tweetIds);
    expect(b2?.entry.searchText).toContain('flamegraph');
    expect(toMarkdown(b2!)).toBe(toMarkdown(bundle));
    other.close();
    await Dexie.delete(other.name);
  });

  it('merges without duplicating and resolves conflicts by most recent update', async () => {
    const { bundle } = await savedThread();
    const backup = await exportLibrary({ db });
    // Import into the same DB: same entries → conflicts, nothing duplicated.
    const report = await importLibrary(JSON.stringify(backup), { db });
    expect(report.conflicts).toBe(1);
    expect(report.entries.added).toBe(0);
    expect(await db.entries.count()).toBe(1);
    // A newer version in the backup wins.
    backup.data.entries[0] = {
      ...backup.data.entries[0]!,
      note: 'Nouvelle note',
      updatedAt: Date.now() + 10_000,
    };
    const r2 = await importLibrary(JSON.stringify(backup), { db });
    expect(r2.entries.updated).toBe(1);
    expect((await repo.getEntry(bundle.entry.id))?.note).toBe('Nouvelle note');
  });

  it('rejects malformed files without touching the library', async () => {
    await savedThread();
    const before = await db.entries.count();
    await expect(importLibrary('not json', { db })).rejects.toBeInstanceOf(ImportError);
    await expect(importLibrary(JSON.stringify({ format: 'other' }), { db })).rejects.toBeInstanceOf(
      ImportError,
    );
    await expect(
      importLibrary(
        JSON.stringify({
          format: 'threadshelf.backup',
          version: 99,
          schemaVersion: 9,
          data: { entries: [], tweets: [] },
        }),
        { db },
      ),
    ).rejects.toThrow(/plus récente/);
    expect(await db.entries.count()).toBe(before);
  });

  it('drops invalid or dangerous records and reports them', async () => {
    const { bundle } = await savedThread();
    const backup = await exportLibrary({ db });
    backup.data.tweets.push({
      ...backup.data.tweets[0]!,
      id: 'DROP TABLE',
      url: 'javascript:alert(1)',
    } as never);
    backup.data.tweets[0] = {
      ...backup.data.tweets[0]!,
      author: { ...backup.data.tweets[0]!.author, avatarUrl: 'https://evil.example/a.png' },
    };
    backup.data.entries.push({
      ...backup.data.entries[0]!,
      id: 'e_orphan',
      focalTweetId: '1',
      tweetIds: ['1'],
      kind: 'tweet',
    });
    const other = new ThreadShelfDB(`bk-bad-${Date.now()}`);
    const report = await importLibrary(JSON.stringify(backup), { db: other });
    expect(report.invalid).toBe(2);
    expect(report.entries.added).toBe(1);
    expect(report.entries.skipped).toBe(1);
    expect(await other.tweets.get(bundle.entry.tweetIds[0]!)).toBeUndefined();
    other.close();
    await Dexie.delete(other.name);
  });

  it('is transactional: a failure mid-import leaves no partial data', async () => {
    const { bundle } = await savedThread();
    const backup = await exportLibrary({ db });
    const other = new ThreadShelfDB(`bk-tx-${Date.now()}`);
    await other.open();
    const original = other.entries.put.bind(other.entries);
    let calls = 0;
    other.entries.put = ((...args: Parameters<typeof original>) => {
      calls += 1;
      if (calls === 1) throw new Error('disk full');
      return original(...args);
    }) as typeof other.entries.put;
    await expect(importLibrary(JSON.stringify(backup), { db: other })).rejects.toThrow('disk full');
    expect(await other.tweets.count()).toBe(0);
    expect(await other.collections.count()).toBe(0);
    void bundle;
    other.close();
    await Dexie.delete(other.name);
  });

  it('includes cached media when requested', async () => {
    const p: PostSpec = {
      id: '2079610838143623371',
      handle: 'ada_dev',
      text: 'pic',
      photos: [{ alt: 'x' }],
    };
    const { entry } = await repo.saveCapture(captureFromFixture([p], p, 'tweet'));
    const bundle = (await repo.getBundle(entry.id))!;
    const url = bundle.tweets[p.id]!.media[0]!.url;
    await db.media.put({
      url,
      tweetIds: [p.id],
      kind: 'photo',
      status: 'cached',
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
      mime: 'image/png',
      bytes: 3,
    });
    const backup = await exportLibrary({ db, includeMedia: true });
    expect(backup.data.media).toHaveLength(1);
    const other = new ThreadShelfDB(`bk-media-${Date.now()}`);
    const report = await importLibrary(JSON.stringify(backup), { db: other });
    expect(report.media).toBe(1);
    const m = await other.media.get(url);
    expect(m?.status).toBe('cached');
    expect(new Uint8Array(await m!.blob!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    other.close();
    await Dexie.delete(other.name);
  });

  it('parseBackup validates the envelope', () => {
    expect(() => parseBackup('{}')).toThrow(ImportError);
  });
});
