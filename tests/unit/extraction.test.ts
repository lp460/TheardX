import { describe, expect, it } from 'vitest';
import { detectLayout, scanPage } from '@/extraction';
import { detectConnectors, isThinLine } from '@/extraction/connectors';
import { segmentsToPlain } from '@/utils/text';
import { parseDoc } from '../helpers/dom';
import { replies, statusPage, threadPosts, type Layout, type PostSpec } from '../fixtures/x-dom';

const URL_OF = (p: PostSpec) => `https://x.com/${p.handle}/status/${p.id}`;

const rich: PostSpec = {
  id: '2079679893479018727',
  handle: 'grace_ops',
  name: 'Grace Ops',
  verified: true,
  text: 'Ship it @ada_dev!\n\nRead https://example.com/articles/very-long-path-to-something?utm_source=x and #TypeScript $TSLA',
  timestamp: 1_784_669_299_000,
  photos: [
    { alt: 'A diagram of the pipeline', key: 'HTAureBb0AA1BoW' },
    { key: 'HTAureBb0AA1BoX' },
  ],
};

describe.each<Layout>(['xds', 'classic'])('%s layout — single post', (layout) => {
  const doc = parseDoc(statusPage(layout, [rich], rich.id), URL_OF(rich));
  const scan = scanPage(doc, URL_OF(rich));
  const t = scan.cells[0]!.tweet!;

  it('detects the layout and the focal post', () => {
    expect(detectLayout(doc)).toBe(layout);
    expect(scan.focalId).toBe(rich.id);
    expect(scan.cells).toHaveLength(1);
  });

  it('extracts identity and metadata', () => {
    expect(t.id).toBe(rich.id);
    expect(t.url).toBe('https://x.com/grace_ops/status/2079679893479018727');
    expect(t.author.handle).toBe('grace_ops');
    expect(t.author.name).toBe('Grace Ops');
    expect(t.author.verified).toBe(true);
    expect(t.author.avatarUrl).toMatch(/^https:\/\/pbs\.twimg\.com\/profile_images\//);
    expect(t.createdAt).toBe(new Date(1_784_669_299_000).toISOString());
    expect(t.createdAtSource).toBe('page');
    expect(t.lang).toBe('fr');
  });

  it('keeps text structure, links, mentions, hashtags and cashtags', () => {
    const plain = segmentsToPlain(t.text);
    expect(plain.startsWith('Ship it @ada_dev!\n\nRead ')).toBe(true);
    const types = t.text.map((s) => s.t);
    expect(types).toContain('mention');
    expect(types).toContain('hashtag');
    expect(types).toContain('cashtag');
    const link = t.text.find((s) => s.t === 'link');
    expect(link && link.t === 'link' && link.href).toBe(
      'https://example.com/articles/very-long-path-to-something',
    );
    expect(t.text.find((s) => s.t === 'mention')).toMatchObject({ handle: 'ada_dev' });
    expect(t.text.find((s) => s.t === 'hashtag')).toMatchObject({ tag: 'TypeScript' });
  });

  it('extracts photos with real alt text only', () => {
    expect(t.media).toHaveLength(2);
    expect(t.media[0]).toMatchObject({ kind: 'photo', alt: 'A diagram of the pipeline' });
    expect(t.media[0]!.url).toContain('name=large');
    expect(t.media[1]!.alt).toBeUndefined();
  });

  it('does not invent missing data', () => {
    const bare: PostSpec = { id: '2079679893479018999', handle: 'bare', text: 'hello' };
    const d = parseDoc(statusPage(layout, [bare], bare.id), URL_OF(bare));
    const b = scanPage(d, URL_OF(bare)).cells[0]!.tweet!;
    expect(b.media).toEqual([]);
    expect(b.card).toBeUndefined();
    expect(b.quoted).toBeUndefined();
    expect(b.replyingTo).toBeUndefined();
    expect(b.author.verified).toBeUndefined();
  });
});

describe.each<Layout>(['xds', 'classic'])('%s layout — quotes, cards, video', (layout) => {
  const quoted: PostSpec = {
    id: '2070000000000000001',
    handle: 'quoted_one',
    name: 'Quoted One',
    text: 'Original insight that was quoted',
    timestamp: 1_784_000_000_000,
  };
  const post: PostSpec = {
    id: '2079679893479018800',
    handle: 'grace_ops',
    text: 'Worth reading',
    quote: quoted,
    card: { url: 'https://example.com', title: 'An article title', domain: 'example.com' },
    video: true,
  };
  const doc = parseDoc(statusPage(layout, [post], post.id), URL_OF(post));
  const cell = scanPage(doc, URL_OF(post)).cells[0]!;
  const t = cell.tweet!;

  it('separates the quoted post from the quoting post', () => {
    expect(segmentsToPlain(t.text)).toBe('Worth reading');
    expect(t.author.handle).toBe('grace_ops');
    expect(t.quoted?.author?.handle).toBe('quoted_one');
    expect(segmentsToPlain(t.quoted?.text ?? [])).toBe('Original insight that was quoted');
    if (layout === 'xds') {
      expect(t.quoted?.id).toBe(quoted.id);
      expect(cell.quoted?.[0]).toMatchObject({ id: quoted.id, context: 'quote' });
    }
  });

  it('captures the link card and video poster as references', () => {
    expect(t.card?.url).toMatch(/^https:\/\/t\.co\//);
    expect(t.card?.title).toBe('An article title');
    expect(t.card?.domain).toBe('example.com');
    const video = t.media.find((m) => m.kind === 'video');
    expect(video?.url).toMatch(/^https:\/\/pbs\.twimg\.com\//);
    expect(video?.playbackUrl).toBe(`https://x.com/grace_ops/status/${post.id}`);
  });
});

describe.each<Layout>(['xds', 'classic'])('%s layout — thread connectors', (layout) => {
  const thread = threadPosts(4);
  const focal = thread[1]!;
  const doc = parseDoc(
    statusPage(layout, [...thread, ...replies(2, 'ada_dev')], focal.id),
    URL_OF(focal),
  );
  const scan = scanPage(doc, URL_OF(focal));

  it('reads connectors above and below in visual order', () => {
    expect(scan.connectorsSeen).toBe(true);
    const flags = scan.cells.map((c) => [c.connectorAbove, c.connectorBelow]);
    expect(flags).toEqual([
      [false, true],
      [true, true],
      [true, true],
      [true, false],
      [false, false],
      [false, false],
    ]);
    expect(scan.cells.map((c) => c.isFocal)).toEqual([false, true, false, false, false, false]);
  });

  it('reads replying-to handles', () => {
    expect(scan.cells[4]!.tweet!.replyingTo).toEqual(['ada_dev']);
  });
});

describe('connector detection details', () => {
  it('recognises thin lines from utility classes and inline styles', () => {
    const doc = parseDoc(
      '<span id="a" class="absolute w-0.5 bg-gray"></span><div id="b" style="width:2px;background-color:red"></div><div id="c" style="width:20px;background:red"></div>',
    );
    expect(isThinLine(doc.getElementById('a')!)).toBe(true);
    expect(isThinLine(doc.getElementById('b')!)).toBe(true);
    expect(isThinLine(doc.getElementById('c')!)).toBe(false);
  });

  it('ignores lines without an avatar reference', () => {
    const doc = parseDoc(
      '<article><span class="absolute top-5 -bottom-3 w-0.5 bg-x"></span></article>',
    );
    expect(detectConnectors(doc.querySelector('article')!, null)).toMatchObject({
      above: false,
      below: false,
    });
  });
});

describe('page scanning robustness', () => {
  it('handles tombstones and gaps', () => {
    const t = threadPosts(3);
    const doc = parseDoc(
      statusPage(
        'xds',
        [
          t[0]!,
          { tombstone: 'Ce post n’est pas disponible.' },
          t[2]!,
          { gap: 'Afficher plus de réponses' },
        ],
        t[2]!.id,
      ),
      URL_OF(t[2]!),
    );
    const scan = scanPage(doc, URL_OF(t[2]!));
    expect(scan.cells.map((c) => c.kind)).toEqual(['tweet', 'tombstone', 'tweet', 'gap']);
  });

  it('orders classic cells by translateY, not DOM order', async () => {
    const { classicList } = await import('../fixtures/x-dom');
    const t = threadPosts(3);
    const html = statusPage('classic', [], undefined).replace(
      '<div id="ts-list">',
      `<div id="ts-list">${classicList(t, { shuffleDom: true })}`,
    );
    const doc = parseDoc(html, URL_OF(t[0]!));
    expect(scanPage(doc, URL_OF(t[0]!)).cells.map((c) => c.tweet!.id)).toEqual(t.map((p) => p.id));
  });

  it('returns an empty scan on unknown pages', () => {
    const doc = parseDoc('<html><body><p>Nothing here</p></body></html>');
    const scan = scanPage(doc, 'https://x.com/home');
    expect(scan.layout).toBe('unknown');
    expect(scan.cells).toEqual([]);
  });

  it('flags truncated long posts', () => {
    const p: PostSpec = {
      id: '2079679893479011111',
      handle: 'longform',
      text: 'A very long post…',
      truncated: true,
    };
    for (const layout of ['xds', 'classic'] as const) {
      const doc = parseDoc(statusPage(layout, [p], p.id), URL_OF(p));
      const t = scanPage(doc, URL_OF(p)).cells[0]!.tweet!;
      expect(t.textTruncated).toBe(true);
      expect(segmentsToPlain(t.text)).toBe('A very long post…');
    }
  });

  it('falls back to the snowflake date when the page has none', () => {
    const p: PostSpec = { id: '1585841080431321088', handle: 'old_post', text: 'hello' };
    const html = statusPage('xds', [p], p.id).replace(/<script nonce="">[\s\S]*?<\/script>/, '');
    const t = scanPage(parseDoc(html, URL_OF(p)), URL_OF(p)).cells[0]!.tweet!;
    expect(t.createdAtSource).toBe('snowflake');
    expect(t.createdAt?.slice(0, 10)).toBe('2022-10-28');
  });

  it('extracts emoji images as text', () => {
    const p: PostSpec = { id: '2079679893479012222', handle: 'emoji', text: 'Hi' };
    const html = statusPage('classic', [p], p.id).replace(
      '<span>Hi</span>',
      '<span>Hi </span><img alt="🚀" src="https://abs.twimg.com/emoji/v2/svg/1f680.svg">',
    );
    const t = scanPage(parseDoc(html, URL_OF(p)), URL_OF(p)).cells[0]!.tweet!;
    expect(segmentsToPlain(t.text)).toBe('Hi 🚀');
  });
});
