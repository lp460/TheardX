import { describe, expect, it } from 'vitest';
import { adapterFor } from '@/adapters/registry';
import { redditIso, scanReddit } from '@/extraction/reddit';
import { toHtml, toMarkdown, toPlainText } from '@/export';
import { entrySchema, tweetSchema } from '@/storage/validation';
import { observe, planCapture, ThreadGraph } from '@/thread-engine';
import type { Entry, EntryBundle, Tweet } from '@/types/model';
import { parseRedditUrl } from '@/utils/reddit-url';
import { isAllowedMediaUrl } from '@/utils/url';
import { postPreviewText } from '@/utils/text';
import { parseDoc } from '../helpers/dom';
import {
  DISCUSSION_COMMENTS,
  DISCUSSION_POST,
  IMG,
  redditFeed,
  redditPostPage,
  type RedditPostSpec,
} from '../fixtures/reddit-dom';

const POST_URL = 'https://www.reddit.com/r/AskHistorians/comments/1xb56ky/what_was_the_deal/';

function scanPage(html: string, url = POST_URL) {
  return scanReddit(parseDoc(html, url), url);
}

function graphOf(html: string, url = POST_URL) {
  const scan = scanPage(html, url);
  const obs = observe(scan);
  const g = new ThreadGraph().merge({ tweets: obs.tweets, relations: obs.relations });
  return { scan, g };
}

describe('Reddit URLs', () => {
  it('parses post, comment and listing URLs', () => {
    expect(parseRedditUrl(POST_URL)).toEqual({
      kind: 'post',
      postId: 't3_1xb56ky',
      subreddit: 'AskHistorians',
    });
    expect(
      parseRedditUrl('https://www.reddit.com/r/AskHistorians/comments/1xb56ky/comment/phy5zd7/'),
    ).toMatchObject({ kind: 'post', postId: 't3_1xb56ky', commentId: 't1_phy5zd7' });
    expect(parseRedditUrl('https://reddit.com/r/pics/')).toEqual({
      kind: 'listing',
      subreddit: 'pics',
    });
    expect(parseRedditUrl('https://old.reddit.com/r/pics/comments/abc/x/')).toEqual({
      kind: 'other',
    });
    expect(adapterFor(POST_URL)?.id).toBe('reddit');
    expect(adapterFor('https://x.com/a/status/1')?.id).toBe('x');
  });

  it('accepts Reddit image hosts only as media', () => {
    expect(isAllowedMediaUrl('https://i.redd.it/abc.jpeg')).toBe(true);
    expect(isAllowedMediaUrl('https://preview.redd.it/x.jpeg?width=640')).toBe(true);
    expect(isAllowedMediaUrl('https://evil.example/i.redd.it.png')).toBe(false);
  });

  it('normalises Reddit timestamps', () => {
    expect(redditIso('2026-10-20T21:46:00.732000+0000')).toBe('2026-10-20T21:46:00.732Z');
    expect(redditIso('nope')).toBeUndefined();
  });
});

describe('Reddit post page', () => {
  const html = redditPostPage(DISCUSSION_POST, DISCUSSION_COMMENTS);
  const scan = scanPage(html);
  const post = scan.cells[0]!.tweet!;

  it('reads the post from its attributes and rich body', () => {
    expect(scan.layout).toBe('reddit');
    expect(scan.route).toEqual({ kind: 'status', id: 't3_1xb56ky' });
    expect(scan.focalId).toBe('t3_1xb56ky');
    expect(post).toMatchObject({
      id: 't3_1xb56ky',
      platform: 'reddit',
      author: { handle: 'ExternalBoysenberry' },
      createdAt: '2026-10-20T21:46:00.732Z',
      reddit: {
        kind: 'post',
        postId: 't3_1xb56ky',
        subreddit: 'AskHistorians',
        score: 2481,
        commentCount: 7,
        flair: 'Material Culture',
      },
    });
    expect(post.url).toMatch(
      /^https:\/\/www\.reddit\.com\/r\/AskHistorians\/comments\/1xb56ky\/\w+\/$/,
    );
    const a = post.article!;
    expect(a.inline).toBe(true);
    expect(a.title).toBe(DISCUSSION_POST.title);
    expect(a.blocks.map((b) => b.t)).toEqual([
      'paragraph',
      'list',
      'quote',
      'code',
      'paragraph',
      'paragraph',
    ]);
    const p1 = a.blocks[0];
    if (p1?.t !== 'paragraph') throw new Error('paragraph expected');
    // Relative links resolve on reddit.com, never on x.com; bold / italic are kept.
    expect(p1.text).toContainEqual({
      t: 'link',
      v: 'r/AskHistorians',
      href: 'https://www.reddit.com/r/AskHistorians/',
    });
    expect(p1.text).toContainEqual({ t: 'text', v: 'eager', b: true });
    expect(a.blocks[3]).toEqual({ t: 'code', code: 'pacifier = "dummy"' });
    const row = a.blocks[5];
    if (row?.t !== 'paragraph') throw new Error('table row expected');
    expect(row.text.map((s) => s.v).join('')).toBe('1800s | Ivory');
    expect(tweetSchema.safeParse(post).success).toBe(true);
    expect(postPreviewText(post)).toContain('pacifiers');
  });

  it('reads the comment tree: parent, depth, position, OP, score', () => {
    const comments = scan.cells.slice(1).map((c) => c.tweet!);
    expect(comments.map((c) => c.id)).toEqual([
      't1_phy5zd7',
      't1_19rhkvwj72ld1',
      't1_19rhkyxlp7mox',
      't1_qq1',
      't1_zz9',
    ]);
    const nested = comments[3]!;
    expect(nested.reddit).toMatchObject({
      kind: 'comment',
      postId: 't3_1xb56ky',
      parentId: 't1_19rhkyxlp7mox',
      depth: 2,
      position: 0,
      score: 12,
      isOp: true,
      subreddit: 'AskHistorians',
    });
    expect(comments[0]!.reddit).toMatchObject({ parentId: 't3_1xb56ky', depth: 0 });
    expect(scan.cells[2]!.parentId).toBe('t3_1xb56ky');
    // A comment's body never includes its replies.
    const text = postPreviewText(comments[1]!);
    expect(text).toContain('tétines');
    expect(text).not.toContain('second part');
    expect(comments[1]!.author.avatarUrl).toMatch(/^https:\/\/styles\.redditmedia\.com\//);
    for (const c of comments) expect(tweetSchema.safeParse(c).success).toBe(true);
    expect(scan.reddit).toEqual({ postId: 't3_1xb56ky', announced: 7, moreControls: 1 });
  });

  it('plans the discussion depth-first and reports unloaded replies', () => {
    const { g } = graphOf(html);
    const plan = planCapture(g, 'thread', 't1_qq1', { reddit: scan.reddit });
    expect(plan.kind).toBe('thread');
    expect(plan.tweetIds).toEqual([
      't3_1xb56ky',
      't1_phy5zd7',
      't1_19rhkvwj72ld1',
      't1_19rhkyxlp7mox',
      't1_qq1',
      't1_zz9',
    ]);
    expect(plan.completeness).toMatchObject({
      status: 'needs_more',
      startVerified: true,
      endVerified: false,
      issues: ['end-not-loaded'],
    });
    const done = planCapture(g, 'thread', 't3_1xb56ky', {
      reddit: { postId: 't3_1xb56ky', moreControls: 0 },
    });
    expect(done.completeness.status).toBe('complete');
  });

  it('saves one comment with the comments it answers as context, or a selection with the post', () => {
    const { g } = graphOf(html);
    const one = planCapture(g, 'tweet', 't1_qq1');
    expect(one).toMatchObject({
      kind: 'tweet',
      tweetIds: ['t1_qq1'],
      contextTweetIds: ['t3_1xb56ky', 't1_19rhkvwj72ld1', 't1_19rhkyxlp7mox'],
    });
    const sel = planCapture(g, 'selection', 't1_zz9', { selection: ['t1_zz9', 't1_phy5zd7'] });
    expect(sel.tweetIds).toEqual(['t1_phy5zd7', 't1_zz9']);
    expect(sel.contextTweetIds).toEqual(['t3_1xb56ky']);
    expect(sel.completeness.status).toBe('manual');
  });

  it('focuses the comment of a comment permalink', () => {
    const url = 'https://www.reddit.com/r/AskHistorians/comments/1xb56ky/comment/19rhkyxlp7mox/';
    const s = scanPage(html, url);
    expect(s.focalId).toBe('t1_19rhkyxlp7mox');
    expect(s.cells.find((c) => c.isFocal)?.tweet?.id).toBe('t1_19rhkyxlp7mox');
  });
});

describe('Reddit media and feeds', () => {
  const base: RedditPostSpec = { id: 'm1', subreddit: 'pics', author: 'snapper', title: 'Sunset' };

  it('keeps the full-size image of an image post', () => {
    const t = scanPage(
      redditPostPage({ ...base, type: 'image', images: ['utnmnw0lrfwh1'] }),
      'https://www.reddit.com/r/pics/comments/m1/sunset/',
    ).cells[0]!.tweet!;
    expect(t.media).toEqual([{ kind: 'photo', url: IMG('utnmnw0lrfwh1') }]);
  });

  it('keeps every image of a gallery, in order', () => {
    const t = scanPage(
      redditPostPage({ ...base, type: 'gallery', images: ['a1', 'b2', 'c3'] }),
      'https://www.reddit.com/r/pics/comments/m1/sunset/',
    ).cells[0]!.tweet!;
    expect(t.media.map((m) => m.url)).toEqual([IMG('a1'), IMG('b2'), IMG('c3')]);
  });

  it('keeps the poster of a video, playable on Reddit', () => {
    const t = scanPage(
      redditPostPage({ ...base, type: 'video' }),
      'https://www.reddit.com/r/pics/comments/m1/sunset/',
    ).cells[0]!.tweet!;
    expect(t.media).toHaveLength(1);
    expect(t.media[0]).toMatchObject({ kind: 'video', playbackUrl: t.url });
    expect(t.media[0]!.url).toMatch(/^https:\/\/external-preview\.redd\.it\/poster-m1/);
  });

  it('turns a link post into a link card', () => {
    const t = scanPage(
      redditPostPage({
        ...base,
        type: 'link',
        link: {
          href: 'https://scotthelme.co.uk/eight-bits/?utm_source=reddit',
          domain: 'scotthelme.co.uk',
        },
      }),
      'https://www.reddit.com/r/pics/comments/m1/sunset/',
    ).cells[0]!.tweet!;
    expect(t.card).toMatchObject({
      url: 'https://scotthelme.co.uk/eight-bits/',
      domain: 'scotthelme.co.uk',
    });
    expect(t.card!.imageUrl).toMatch(/^https:\/\/external-preview\.redd\.it\//);
    expect(t.media).toEqual([]);
  });

  it('lists feed posts as excerpts', () => {
    const s = scanReddit(
      parseDoc(redditFeed([DISCUSSION_POST, base]), 'https://www.reddit.com/r/AskHistorians/'),
      'https://www.reddit.com/r/AskHistorians/',
    );
    expect(s.route.kind).toBe('home');
    expect(s.cells.map((c) => c.tweet!.id)).toEqual(['t3_1xb56ky', 't3_m1']);
    expect(s.cells[0]!.tweet!.article!.partial).toBe(true);
  });
});

describe('Reddit exports', () => {
  const { scan, g } = graphOf(redditPostPage(DISCUSSION_POST, DISCUSSION_COMMENTS));
  const plan = planCapture(g, 'thread', 't3_1xb56ky', { reddit: scan.reddit });
  const tweets: Record<string, Tweet> = {};
  for (const id of plan.tweetIds) tweets[id] = g.tweets.get(id)!;
  const entry: Entry = {
    id: 'e1',
    platform: 'reddit',
    kind: 'thread',
    title: DISCUSSION_POST.title,
    authorHandle: 'ExternalBoysenberry',
    focalTweetId: 't3_1xb56ky',
    tweetIds: plan.tweetIds,
    contextTweetIds: [],
    referenceTweetIds: [],
    externalRefs: [],
    completeness: plan.completeness,
    sourceUrl: tweets['t3_1xb56ky']!.url,
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
    offline: 'text-only',
    searchText: '',
  };
  const bundle: EntryBundle = { entry, tweets, relations: [], media: {} };

  it('validates as an entry', () => {
    expect(entrySchema.safeParse(entry).success).toBe(true);
  });

  it('Markdown: post, then comments nested as blockquotes', () => {
    const md = toMarkdown(bundle);
    expect(md).toContain(
      '[u/ExternalBoysenberry](https://www.reddit.com/user/ExternalBoysenberry/)',
    );
    expect(md).toContain('Subreddit : [r/AskHistorians](https://www.reddit.com/r/AskHistorians/)');
    expect(md).toContain('des commentaires n’étaient pas chargés');
    // The post title is printed once.
    expect(md.split(DISCUSSION_POST.title).length - 1).toBe(1);
    expect(md).toMatch(/^> \*\*u\/gerardmenfin · ▲ 40/m);
    expect(md).toMatch(/^>> \*\*u\/gerardmenfin · ▲ 26/m);
    expect(md).toMatch(/^>>> \*\*u\/ExternalBoysenberry · OP · ▲ 12/m);
    expect(md).toContain(
      '[Voir sur Reddit](https://www.reddit.com/r/AskHistorians/comments/1xb56ky/comment/qq1/)',
    );
    expect(md).not.toContain('x.com');
  });

  it('plain text: comments indented by depth', () => {
    const txt = toPlainText(bundle);
    expect(txt).toMatch(/^ {12}u\/ExternalBoysenberry · OP · ▲ 12/m);
    expect(txt).toMatch(/^ {4}u\/AutoModerator/m);
  });

  it('HTML: comments indented, no script', () => {
    const html = toHtml(bundle);
    expect(html).toContain('class="comment" style="margin-left:44px"');
    expect(html).toContain('r/AskHistorians');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('sur Reddit.');
  });
});
