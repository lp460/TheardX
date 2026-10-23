import { describe, expect, it } from 'vitest';
import { scanPage } from '@/extraction';
import { toHtml, toMarkdown, toPlainText } from '@/export';
import { tweetSchema } from '@/storage/validation';
import type { EntryBundle, Tweet } from '@/types/model';
import { postPreviewText } from '@/utils/text';
import { parseDoc } from '../helpers/dom';
import { statusPage, type PostSpec } from '../fixtures/x-dom';
import { ARTICLE_POST, ARTICLE_POST_SIGNED_IN } from '../fixtures/article';

function scanArticle() {
  const url = `https://x.com/make_claude/status/${ARTICLE_POST.id}`;
  const html = statusPage('xds', [ARTICLE_POST], ARTICLE_POST.id);
  return scanPage(parseDoc(html, url), url).cells[0]!.tweet!;
}

describe('X Articles (long-form posts)', () => {
  const t = scanArticle();
  const a = t.article!;

  it('captures title, cover, reading time and every block in order', () => {
    expect(a.url).toBe('https://x.com/make_claude/article/2105380835675312294');
    expect(a.title).toBe('JEV ne veut pas remplacer Claude');
    expect(a.coverUrl).toMatch(/^https:\/\/pbs\.twimg\.com\/media\/Cover/);
    expect(a.readingTime).toBe('7 min de lecture');
    expect(a.partial).toBeUndefined();
    expect(a.blocks.map((b) => b.t)).toEqual([
      'paragraph',
      'paragraph',
      'divider',
      'paragraph',
      'divider',
      'image',
      'divider',
      'heading',
      'paragraph',
      'code',
      'paragraph',
      'code',
      'list',
      'quote',
    ]);
  });

  it('keeps bold / italic, links, code (with language and line breaks) and image sizes', () => {
    const p2 = a.blocks[1];
    expect(p2).toMatchObject({ t: 'paragraph' });
    if (p2?.t === 'paragraph') {
      expect(p2.text.find((s) => s.t === 'text' && s.b)).toMatchObject({
        v: 'un seul bit',
        b: true,
      });
      expect(p2.text.find((s) => s.t === 'text' && s.i)).toMatchObject({
        v: 'des milliers',
        i: true,
      });
    }
    expect(a.blocks[9]).toEqual({
      t: 'code',
      lang: 'bash',
      code: 'npm install -g @y0usaf/typesafe-cli',
    });
    expect(a.blocks[11]).toEqual({
      t: 'code',
      lang: 'bash',
      code: 'jev noul \\\n  "Does this need a refund?"',
    });
    expect(a.blocks[5]).toMatchObject({
      t: 'image',
      media: {
        kind: 'photo',
        url: 'https://pbs.twimg.com/media/HTfIevoXYAAuKZJ.jpg',
        width: 1254,
        height: 1254,
      },
    });
    expect(a.blocks[7]).toMatchObject({ t: 'heading', level: 3 });
    expect(a.blocks[12]).toMatchObject({ t: 'list', ordered: false });
  });

  it('never takes the Article title for the post text, even without the usual text container', () => {
    expect(t.text).toEqual([]);
    const url = `https://x.com/make_claude/status/${ARTICLE_POST.id}`;
    const html = statusPage('xds', [ARTICLE_POST], ARTICLE_POST.id).replace(
      /<div class="max-w-full text-lead[^"]*" dir="auto"><\/div>/,
      '',
    );
    expect(scanPage(parseDoc(html, url), url).cells[0]!.tweet!.text).toEqual([]);
  });

  it('is valid for messages and backups, and gives a meaningful preview', () => {
    expect(tweetSchema.safeParse(t).success).toBe(true);
    expect(postPreviewText(t)).toContain('JEV ne veut pas remplacer Claude');
    expect(postPreviewText(t)).toContain('npm install -g');
  });

  it('marks a timeline preview as partial', () => {
    const p: PostSpec = {
      ...ARTICLE_POST,
      id: '2105380835675312295',
      article: { title: 'Aperçu', body: '', full: false },
    };
    const url = `https://x.com/home`;
    const tw = scanPage(parseDoc(statusPage('xds', [p]), url), url).cells[0]!.tweet!;
    expect(tw.article).toMatchObject({
      url: 'https://x.com/make_claude/article/2105380835675312295',
      partial: true,
      blocks: [],
    });
  });

  it('exports the whole Article to Markdown, text and HTML', () => {
    const bundle: EntryBundle = {
      entry: {
        id: 'e1',
        kind: 'thread',
        title: a.title!,
        authorHandle: 'make_claude',
        focalTweetId: t.id,
        tweetIds: [t.id],
        contextTweetIds: [],
        referenceTweetIds: [],
        externalRefs: [],
        completeness: {
          status: 'complete',
          startVerified: true,
          endVerified: true,
          gaps: 0,
          issues: [],
          checkedAt: 1,
        },
        sourceUrl: t.url,
        savedAt: 1,
        updatedAt: 1,
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
      tweets: { [t.id]: t as Tweet },
      relations: [],
      media: {},
    };
    const md = toMarkdown(bundle);
    expect(md).toContain('### JEV ne veut pas remplacer Claude');
    expect(md).toContain('Même pour **un seul bit** d’information, et *des milliers* de tokens.');
    expect(md).toContain('##### Jev en commande shell');
    expect(md).toContain('```bash\nnpm install -g @y0usaf/typesafe-cli\n```');
    expect(md).toContain('![](https://pbs.twimg.com/media/HTfIevoXYAAuKZJ.jpg)');
    expect(md).toContain('- moins cher\n- **plus rapide**');
    expect(md).toContain('> La question est de savoir');
    const txt = toPlainText(bundle);
    expect(txt).toContain('JEV NE VEUT PAS REMPLACER CLAUDE');
    expect(txt).toContain('    npm install -g @y0usaf/typesafe-cli');
    const html = toHtml(bundle);
    expect(html).toContain(
      '<pre data-lang="bash"><code>npm install -g @y0usaf/typesafe-cli</code></pre>',
    );
    expect(html).toContain('<strong>un seul bit</strong>');
    expect(html).not.toMatch(/<script/i);
  });
});

describe('X Articles, signed-in rendering (classic layout, Draft.js)', () => {
  const url = `https://x.com/make_claude/status/${ARTICLE_POST_SIGNED_IN.id}`;
  const html = statusPage('classic', [ARTICLE_POST_SIGNED_IN], ARTICLE_POST_SIGNED_IN.id);
  const t = scanPage(parseDoc(html, url), url).cells[0]!.tweet!;
  const a = t.article!;

  it('captures the title, cover and the whole body in order', () => {
    expect(a.title).toBe('JEV ne veut pas remplacer Claude');
    expect(a.url).toBe('https://x.com/make_claude/article/2105380835675312294');
    expect(a.coverUrl).toMatch(/media\/Cover2105380835675312294/);
    expect(a.partial).toBeUndefined();
    expect(a.blocks.map((b) => b.t)).toEqual([
      'paragraph',
      'paragraph',
      'divider',
      'image',
      'heading',
      'paragraph',
      'code',
      'code',
      'list',
      'quote',
      'heading',
      'paragraph',
    ]);
  });

  it('reads the body nested <article> as the post content, not as a quote', () => {
    expect(t.quoted).toBeUndefined();
    expect(a.coverUrl).toMatch(/media\/Cover2105380835675312294/);
  });

  it('keeps inline-style bold / italic, code lines, list items and heading levels', () => {
    const p2 = a.blocks[1];
    if (p2?.t !== 'paragraph') throw new Error('paragraph expected');
    expect(p2.text).toContainEqual({ t: 'text', v: 'un seul bit', b: true });
    expect(p2.text).toContainEqual({ t: 'text', v: 'des milliers', i: true });
    expect(a.blocks[4]).toMatchObject({ t: 'heading', level: 3 });
    expect(a.blocks[6]).toEqual({
      t: 'code',
      lang: 'bash',
      code: 'jev noul \\\n  "Does this need a refund?"',
    });
    expect(a.blocks[7]).toEqual({ t: 'code', code: 'npm install -g jev\njev --help' });
    const list = a.blocks[8];
    if (list?.t !== 'list') throw new Error('list expected');
    expect(list.ordered).toBe(true);
    expect(list.items).toHaveLength(2);
    expect(list.items[1]).toContainEqual({ t: 'text', v: 'plus rapide', b: true });
    expect(a.blocks[10]).toMatchObject({ t: 'heading', level: 4 });
  });

  it('does not duplicate the Article images and cover as post media', () => {
    expect(t.media).toEqual([]);
    expect(tweetSchema.safeParse(t).success).toBe(true);
    expect(postPreviewText(t)).toContain('La plupart des agents IA');
  });
});
