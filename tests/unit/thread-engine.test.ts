import { describe, expect, it } from 'vitest';
import { scanPage } from '@/extraction';
import {
  observe,
  planCapture,
  reconstructAuthorThread,
  ThreadGraph,
  mergeTweet,
  makeRelation,
} from '@/thread-engine';
import type { Tweet } from '@/types/model';
import { parseDoc } from '../helpers/dom';
import {
  replies,
  statusPage,
  threadPosts,
  type CellSpec,
  type Layout,
  type PostSpec,
} from '../fixtures/x-dom';

const urlOf = (p: PostSpec) => `https://x.com/${p.handle}/status/${p.id}`;

function graphFor(layout: Layout, cells: CellSpec[], focal: PostSpec) {
  const scan = scanPage(parseDoc(statusPage(layout, cells, focal.id), urlOf(focal)), urlOf(focal));
  const obs = observe(scan, 1000);
  return { graph: ThreadGraph.from(obs.tweets, obs.relations), obs, scan };
}

describe.each<Layout>(['xds', 'classic'])('%s — thread reconstruction', (layout) => {
  it.each([2, 10, 30])('reconstructs a complete %i-post thread opened on its first post', (n) => {
    const t = threadPosts(n);
    const { graph } = graphFor(layout, [...t, ...replies(3, 'ada_dev')], t[0]!);
    const r = reconstructAuthorThread(graph, t[0]!.id);
    expect(r.orderedIds).toEqual(t.map((p) => p.id));
    expect(r.completeness.status).toBe('complete');
    expect(r.completeness.startVerified && r.completeness.endVerified).toBe(true);
  });

  it('reconstructs from a post in the middle (ancestors above, continuation below)', () => {
    const t = threadPosts(10);
    const { graph } = graphFor(layout, t, t[5]!);
    const r = reconstructAuthorThread(graph, t[5]!.id);
    expect(r.orderedIds).toEqual(t.map((p) => p.id));
    expect(r.completeness.status).toBe('complete');
  });

  it('never mixes replies from other accounts into the thread', () => {
    const t = threadPosts(3);
    const others = replies(5, 'ada_dev');
    const { graph } = graphFor(layout, [...t, ...others], t[0]!);
    const r = reconstructAuthorThread(graph, t[0]!.id);
    expect(r.orderedIds).toHaveLength(3);
    for (const o of others) expect(r.orderedIds).not.toContain(o.id);
  });

  it('marks a thread whose continuation is not loaded as needing more loading', () => {
    const t = threadPosts(5).slice(0, 3); // third post still has a connector below
    const { graph } = graphFor(layout, t, t[0]!);
    const r = reconstructAuthorThread(graph, t[0]!.id);
    expect(r.orderedIds).toHaveLength(3);
    expect(r.completeness.status).toBe('needs_more');
    expect(r.completeness.issues).toContain('end-not-loaded');
  });

  it('marks a thread whose beginning is not loaded', () => {
    const t = threadPosts(5).slice(2); // first rendered post has a connector above
    const { graph } = graphFor(layout, t, t[0]!);
    const r = reconstructAuthorThread(graph, t[0]!.id);
    expect(r.completeness.status).toBe('needs_more');
    expect(r.completeness.issues).toContain('start-not-loaded');
  });

  it('handles a deleted post inside the ancestor chain', () => {
    const t = threadPosts(4);
    const cells: CellSpec[] = [
      t[0]!,
      { tombstone: 'This post was deleted by the post author.' },
      t[2]!,
      t[3]!,
    ];
    const { graph } = graphFor(layout, cells, t[3]!);
    const r = reconstructAuthorThread(graph, t[3]!.id);
    expect(r.orderedIds).toEqual([t[0]!.id, t[2]!.id, t[3]!.id]);
    expect(r.completeness.status).toBe('partial');
    expect(r.completeness.gaps).toBe(1);
    expect(r.completeness.issues).toContain('deleted-post');
  });

  it('keeps the post being answered as context, not as part of the thread', () => {
    const parent: PostSpec = {
      id: '2070000000000000500',
      handle: 'someone_else',
      text: 'Question?',
      below: true,
    };
    const t = threadPosts(3).map((p, i) => ({ ...p, above: true, below: i < 2 }));
    const { graph } = graphFor(layout, [parent, ...t], t[0]!);
    const r = reconstructAuthorThread(graph, t[0]!.id);
    expect(r.orderedIds).toEqual(t.map((p) => p.id));
    expect(r.contextIds).toEqual([parent.id]);
    expect(r.completeness.status).toBe('complete');
  });

  it('a standalone post is a complete one-post thread', () => {
    const p: PostSpec = { id: '2079610838143600000', handle: 'solo', text: 'Just one' };
    const { graph } = graphFor(layout, [p, ...replies(2, 'solo')], p);
    const r = reconstructAuthorThread(graph, p.id);
    expect(r.orderedIds).toEqual([p.id]);
    expect(r.completeness.status).toBe('complete');
  });
});

describe('uncertain structures', () => {
  it('does not claim completeness when same-author posts follow without any recognised connector', () => {
    const t = threadPosts(3).map((p) => ({ ...p, above: false, below: false }));
    const { graph } = graphFor('xds', t, t[0]!);
    const r = reconstructAuthorThread(graph, t[0]!.id);
    expect(r.orderedIds).toEqual([t[0]!.id]);
    expect(r.completeness.status).not.toBe('complete');
  });

  it('does not treat chronology or authorship alone as proof', () => {
    const g = new ThreadGraph();
    const mk = (id: string): Tweet => ({
      id,
      url: `https://x.com/a/status/${id}`,
      author: { handle: 'a' },
      text: [],
      media: [],
      linkedTweetIds: [],
      availability: 'available',
      context: 'full',
      firstSeenAt: 1,
      lastSeenAt: 1,
    });
    g.addTweet(mk('1'));
    g.addTweet(mk('2'));
    const r = reconstructAuthorThread(g, '1');
    expect(r.orderedIds).toEqual(['1']);
    expect(r.completeness.status).toBe('unreconstructable');
  });

  it('timeline pages never produce verified boundaries', () => {
    const t = threadPosts(3);
    const scan = scanPage(
      parseDoc(statusPage('xds', t), 'https://x.com/home'),
      'https://x.com/home',
    );
    const obs = observe(scan);
    const g = ThreadGraph.from(obs.tweets, obs.relations);
    const r = reconstructAuthorThread(g, t[1]!.id, { pageKind: 'home' });
    expect(r.orderedIds).toEqual(t.map((p) => p.id));
    expect(r.completeness.status).toBe('partial');
    expect(r.completeness.issues).toContain('not-status-page');
  });
});

describe('progressive capture and deduplication', () => {
  it('merges successive observations of a virtualised list without duplicates', () => {
    const t = threadPosts(30);
    const g = new ThreadGraph();
    // Three windows of the list, overlapping, as X renders them while scrolling.
    const windows = [t.slice(0, 12), t.slice(8, 22), t.slice(18, 30)];
    windows.forEach((w, i) => {
      const focal = t[0]!;
      const html = statusPage('xds', w, i === 0 ? focal.id : undefined);
      const scan = scanPage(parseDoc(html, urlOf(focal)), urlOf(focal));
      // Windows after the first don't contain the focal post: they are observed as list fragments.
      const obs = observe(
        { ...scan, route: { kind: 'status', id: focal.id, handle: focal.handle } },
        1000 + i,
      );
      g.merge({ tweets: obs.tweets, relations: obs.relations });
      for (const [id, f] of Object.entries(obs.facts)) g.setFacts(id, f);
    });
    expect(g.tweets.size).toBe(30);
    const r = reconstructAuthorThread(g, t[0]!.id);
    expect(r.orderedIds).toEqual(t.map((p) => p.id));
    expect(new Set(r.orderedIds).size).toBe(30);
    expect(r.completeness.status).toBe('complete');
  });

  it('a later full rendering replaces a quote-card rendering, but not the reverse', () => {
    const base: Tweet = {
      id: '5',
      url: 'https://x.com/a/status/5',
      author: { handle: 'a', name: 'A' },
      text: [{ t: 'text', v: 'full text' }],
      media: [],
      linkedTweetIds: [],
      availability: 'available',
      context: 'full',
      firstSeenAt: 1,
      lastSeenAt: 1,
    };
    const quote: Tweet = {
      ...base,
      text: [{ t: 'text', v: 'short' }],
      context: 'quote',
      lastSeenAt: 5,
      firstSeenAt: 5,
    };
    expect(mergeTweet(base, quote).text).toEqual(base.text);
    expect(mergeTweet(quote, base).text).toEqual(base.text);
    expect(mergeTweet(base, quote).context).toBe('full');
  });

  it('keeps the full text when a later rendering is truncated', () => {
    const full: Tweet = {
      id: '6',
      url: 'https://x.com/a/status/6',
      author: { handle: 'a' },
      text: [{ t: 'text', v: 'long complete text' }],
      media: [],
      linkedTweetIds: [],
      availability: 'available',
      context: 'full',
      firstSeenAt: 1,
      lastSeenAt: 1,
    };
    const trunc: Tweet = {
      ...full,
      text: [{ t: 'text', v: 'long…' }],
      textTruncated: true,
      lastSeenAt: 9,
    };
    const m = mergeTweet(full, trunc);
    expect(m.text).toEqual(full.text);
    expect(m.textTruncated).toBeUndefined();
  });

  it('rejects cyclic relations', () => {
    const g = new ThreadGraph();
    g.addRelation(makeRelation('reply', '1', '2', 'connector', 1));
    g.addRelation(makeRelation('reply', '2', '1', 'connector', 2));
    expect(g.parent('1')).toBeUndefined();
    expect(g.parent('2')?.parentId).toBe('1');
  });
});

describe('capture modes', () => {
  const quoted: PostSpec = {
    id: '2070000000000000001',
    handle: 'quoted_one',
    text: 'Quoted insight',
  };
  const t = threadPosts(3);
  t[0] = {
    ...t[0]!,
    quote: quoted,
    text: 'See also https://x.com/other/status/2060000000000000000 for context',
  };
  const { graph } = graphFor('xds', t, t[0]!);

  it('A — tweet only', () => {
    const plan = planCapture(graph, 'tweet', t[0]!.id);
    expect(plan.kind).toBe('tweet');
    expect(plan.tweetIds).toEqual([t[0]!.id]);
    expect(plan.completeness.status).toBe('single');
  });

  it('B — author thread', () => {
    const plan = planCapture(graph, 'thread', t[0]!.id);
    expect(plan.tweetIds).toEqual(t.map((p) => p.id));
    expect(plan.referenceTweetIds).toEqual([]);
  });

  it('C — tweet and references (captured vs referenced only)', () => {
    const plan = planCapture(graph, 'references', t[0]!.id);
    expect(plan.referenceTweetIds).toEqual([quoted.id]);
    expect(plan.externalRefs).toEqual([
      {
        kind: 'quote',
        id: quoted.id,
        url: `https://x.com/quoted_one/status/${quoted.id}`,
        captured: true,
      },
      {
        kind: 'link',
        id: '2060000000000000000',
        url: 'https://x.com/i/status/2060000000000000000',
        captured: false,
      },
    ]);
  });

  it('D — manual selection keeps the given order and drops unknown ids', () => {
    const plan = planCapture(graph, 'selection', t[2]!.id, {
      selection: [t[2]!.id, t[0]!.id, '999', t[2]!.id],
    });
    expect(plan.tweetIds).toEqual([t[2]!.id, t[0]!.id]);
    expect(plan.completeness.status).toBe('manual');
  });
});
