/**
 * Reddit (www.reddit.com, "shreddit" web app, observed Oct. 2026).
 *
 * Posts are <shreddit-post id="t3_…"> and comments <shreddit-comment thingid="t1_…">: Reddit puts the
 * facts in attributes (author, permalink, created-timestamp / created, score, subreddit-name,
 * comment-count, depth, parentid, postid), so they are read from there rather than from visible text.
 * - post title: h1[slot="title"] (as displayed) or the post-title attribute;
 * - post body: #<id>-post-rtjson-content; comment body: #<thingid>-comment-rtjson-content
 *   (semantic HTML: p, ul/ol, blockquote, pre>code, table, figure>img);
 * - media: [slot="post-media-container"]: zoomable-img (image), gallery-carousel li (gallery),
 *   shreddit-player with a poster (video);
 * - unloaded comments: faceplate-partial[src*="/more-comments/"] (« N more replies »).
 * Everything is read from what the page renders; no Reddit API is called.
 */
import type { ArticleBlock, LinkCard, MediaItem, Tweet, XArticle } from '@/types/model';
import {
  isRedditThingId,
  isRedditUser,
  parseRedditUrl,
  redditUrl,
  SUBREDDIT_RE,
} from '@/utils/reddit-url';
import { cleanExternalUrl, isAllowedMediaUrl } from '@/utils/url';
import { extractArticleBlocks } from './article';
import { attr, textOf } from './dom';
import type { PageScan, ScannedCell } from './types';
import type { XRoute } from '@/utils/url';

export function detectReddit(root: ParentNode): boolean {
  return !!root.querySelector('shreddit-post, shreddit-comment');
}

/** Reddit timestamps look like 2026-10-20T21:46:00.732000+0000: normalised for Date.parse. */
export function redditIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.replace(/(\.\d{3})\d+/, '$1').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function intOf(el: Element, name: string): number | undefined {
  const v = Number.parseInt(el.getAttribute(name) ?? '', 10);
  return Number.isFinite(v) ? v : undefined;
}

function photo(img: Element | null | undefined): MediaItem | null {
  const src = img?.getAttribute('src') ?? '';
  if (!isAllowedMediaUrl(src)) return null;
  const item: MediaItem = { kind: 'photo', url: src };
  const alt = (img?.getAttribute('alt') ?? '').trim();
  if (alt && alt.length < 1_000 && !/^(image|r\/\w+ - )/i.test(alt)) item.alt = alt;
  return item;
}

/** Best image of a media slot: the full-size one in zoomable-img, else a non-decorative <img>. */
function bestImage(scope: Element): MediaItem | null {
  return (
    photo(scope.querySelector('zoomable-img img')) ??
    photo(
      Array.from(scope.querySelectorAll('img')).find(
        (i) => i.getAttribute('role') !== 'presentation',
      ),
    )
  );
}

function postMedia(post: Element, postUrl: string): MediaItem[] {
  const box = post.querySelector('[slot="post-media-container"]');
  if (!box) return [];
  const out: MediaItem[] = [];
  const pages = Array.from(box.querySelectorAll('gallery-carousel li'));
  if (pages.length) {
    for (const li of pages) {
      const m = bestImage(li);
      if (m) out.push(m);
    }
  } else {
    for (const player of Array.from(box.querySelectorAll('shreddit-player, shreddit-player-2'))) {
      const poster =
        player.querySelector('img[slot="poster"]')?.getAttribute('src') ??
        player.getAttribute('poster') ??
        '';
      if (isAllowedMediaUrl(poster)) {
        const gif = /gif/i.test(player.getAttribute('post-type') ?? '');
        out.push({ kind: gif ? 'gif' : 'video', url: poster, playbackUrl: postUrl });
      }
    }
    if (!out.length && post.getAttribute('post-type') !== 'link') {
      const m = bestImage(box);
      if (m) out.push(m);
    }
  }
  const seen = new Set<string>();
  return out.filter((m) => {
    const k = m.url.split('?')[0]!;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function linkCard(post: Element): LinkCard | undefined {
  const href = post.getAttribute('content-href') ?? '';
  if (post.getAttribute('post-type') !== 'link' || !href) return undefined;
  const url = cleanExternalUrl(href);
  if (!url) return undefined;
  const card: LinkCard = { url };
  const domain = attr(post, 'domain');
  if (domain && !domain.startsWith('self.')) card.domain = domain.toLowerCase();
  const img = post.querySelector('[slot="post-media-container"] img:not([role="presentation"])');
  const src = img?.getAttribute('src') ?? '';
  if (isAllowedMediaUrl(src)) card.imageUrl = src;
  return card;
}

/** Body element of a post or comment, by its exact ID (never a nested comment's body). */
function bodyOf(el: Element, id: string, kind: 'post' | 'comment'): Element | null {
  return el.querySelector(`[id="${id}-${kind}-rtjson-content"]`);
}

function blocksOf(body: Element | null): ArticleBlock[] {
  return body ? extractArticleBlocks(body, { origin: 'reddit' }) : [];
}

function base(id: string, url: string, author: string, now: number): Tweet {
  return {
    id,
    platform: 'reddit',
    url,
    author: { handle: author },
    text: [],
    media: [],
    linkedTweetIds: [],
    availability: 'available',
    context: 'full',
    firstSeenAt: now,
    lastSeenAt: now,
    source: 'reddit',
  };
}

export function extractRedditPost(post: Element, now = Date.now()): Tweet | null {
  const id = post.id || post.getAttribute('id') || '';
  const author = post.getAttribute('author') ?? '';
  const permalink = post.getAttribute('permalink') ?? '';
  if (!isRedditThingId(id) || !id.startsWith('t3_') || !isRedditUser(author) || !permalink)
    return null;
  const url = redditUrl(permalink);
  const t = base(id, url, author, now);
  const created = redditIso(post.getAttribute('created-timestamp') ?? undefined);
  if (created) {
    t.createdAt = created;
    t.createdAtSource = 'page';
  }
  const onPostPage = post.getAttribute('view-context') === 'CommentsPage';
  const icon = post.getAttribute('icon') ?? '';
  if (onPostPage && isAllowedMediaUrl(icon)) t.author.avatarUrl = icon;
  const subreddit = attr(post, 'subreddit-name');
  const title =
    textOf(post.querySelector('h1[slot="title"], [slot="title"]')) ||
    (post.getAttribute('post-title') ?? '').trim();
  const article: XArticle = { url, blocks: blocksOf(bodyOf(post, id, 'post')), inline: true };
  if (title) article.title = title.slice(0, 1_000);
  // Feed cards only show an excerpt of the body: open the post to capture it in full.
  if (!onPostPage && post.getAttribute('post-type') === 'text') article.partial = true;
  t.article = article;
  t.media = postMedia(post, url);
  const card = linkCard(post);
  if (card) t.card = card;
  const lang = attr(post, 'post-language');
  if (
    lang &&
    !post.hasAttribute('is-post-translated') &&
    /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang)
  )
    t.lang = lang;
  t.reddit = { kind: 'post', postId: id };
  if (subreddit && SUBREDDIT_RE.test(subreddit)) t.reddit.subreddit = subreddit;
  const score = intOf(post, 'score');
  if (score !== undefined) t.reddit.score = score;
  const comments = intOf(post, 'comment-count');
  if (comments !== undefined && comments >= 0) t.reddit.commentCount = comments;
  const flair = textOf(post.querySelector('shreddit-post-flair'));
  if (flair && flair.length <= 200) t.reddit.flair = flair;
  return t;
}

export function extractRedditComment(
  comment: Element,
  opts: { postAuthor?: string; subreddit?: string; now?: number } = {},
): Tweet | null {
  const now = opts.now ?? Date.now();
  const id = comment.getAttribute('thingid') ?? '';
  const author = comment.getAttribute('author') ?? '';
  const postId = comment.getAttribute('postid') ?? '';
  const permalink = comment.getAttribute('permalink') ?? '';
  if (!isRedditThingId(id) || !id.startsWith('t1_') || !isRedditThingId(postId) || !permalink)
    return null;
  const url = redditUrl(permalink);
  const t = base(id, url, isRedditUser(author) ? author : '[deleted]', now);
  const created = redditIso(comment.getAttribute('created') ?? undefined);
  if (created) {
    t.createdAt = created;
    t.createdAtSource = 'page';
  }
  const avatar = comment.getAttribute('avatar') ?? '';
  if (isAllowedMediaUrl(avatar)) t.author.avatarUrl = avatar;
  t.article = { url, blocks: blocksOf(bodyOf(comment, id, 'comment')), inline: true };
  const parent = comment.getAttribute('parentid');
  const depth = intOf(comment, 'depth') ?? 0;
  t.reddit = {
    kind: 'comment',
    postId,
    parentId: parent && isRedditThingId(parent) ? parent : postId,
    depth: Math.max(0, depth),
  };
  const fromUrl = parseRedditUrl(url);
  const subreddit = opts.subreddit ?? (fromUrl.kind === 'post' ? fromUrl.subreddit : undefined);
  if (subreddit && SUBREDDIT_RE.test(subreddit)) t.reddit.subreddit = subreddit;
  const position = intOf(comment, 'comment-position');
  if (position !== undefined && position >= 0) t.reddit.position = position;
  const score = intOf(comment, 'score');
  if (score !== undefined) t.reddit.score = score;
  if (opts.postAuthor && author && author === opts.postAuthor && author !== '[deleted]')
    t.reddit.isOp = true;
  return t;
}

function routeOf(url: string): { route: XRoute; postId?: string; focalId?: string } {
  const r = parseRedditUrl(url);
  if (r.kind === 'post') {
    const focal = r.commentId ?? r.postId;
    return { route: { kind: 'status', id: focal }, postId: r.postId, focalId: focal };
  }
  if (r.kind === 'listing') return { route: { kind: 'home' } };
  return { route: { kind: 'other' } };
}

/** Elements of a comment's own action row (not a nested reply's). */
export function commentActionRow(comment: Element): Element | null {
  return (
    Array.from(comment.querySelectorAll('[slot="actionRow"]')).find(
      (row) => row.closest('shreddit-comment') === comment,
    ) ?? null
  );
}

export type RedditCache = WeakMap<Element, { sig: string; tweet: Tweet | null }>;

function sig(el: Element): string {
  const body =
    el.tagName === 'SHREDDIT-POST' ? el : el.querySelector('[id$="-comment-rtjson-content"]');
  const text = body?.textContent ?? '';
  return `${el.getAttribute('score')}:${text.length}:${el.getElementsByTagName('img').length}:${text.slice(0, 48)}`;
}

/** Read-only scan of the Reddit page: the post (or feed posts) and the rendered comment tree. */
export function scanReddit(
  doc: Document | ParentNode,
  url: string,
  cache?: RedditCache,
  now = Date.now(),
): PageScan {
  const { route, postId, focalId } = routeOf(url);
  const scan: PageScan = {
    layout: 'reddit',
    pageUrl: url,
    route,
    cells: [],
    connectorsSeen: false,
    scannedAt: now,
  };
  const read = (el: Element, fn: () => Tweet | null) => {
    if (!cache) return fn();
    const s = sig(el);
    const hit = cache.get(el);
    if (hit && hit.sig === s) return hit.tweet;
    const tweet = fn();
    cache.set(el, { sig: s, tweet });
    return tweet;
  };
  const posts = Array.from(doc.querySelectorAll('shreddit-post')).filter(
    (p) => !postId || p.id === postId,
  );
  let postAuthor: string | undefined;
  let subreddit: string | undefined;
  for (const el of posts) {
    const tweet = read(el, () => extractRedditPost(el, now));
    if (!tweet) continue;
    if (tweet.id === postId) {
      postAuthor = tweet.author.handle;
      subreddit = tweet.reddit?.subreddit;
    }
    scan.cells.push({
      kind: 'tweet',
      tweet,
      connectorAbove: false,
      connectorBelow: false,
      isFocal: tweet.id === focalId,
      element: el,
    });
  }
  if (postId) {
    // Document order of <shreddit-comment> is the display order of the tree (depth-first).
    for (const el of Array.from(doc.querySelectorAll('shreddit-comment'))) {
      if (el.getAttribute('postid') !== postId) continue;
      const tweet = read(el, () => extractRedditComment(el, { postAuthor, subreddit, now }));
      if (!tweet) continue;
      const cell: ScannedCell = {
        kind: 'tweet',
        tweet,
        connectorAbove: false,
        connectorBelow: false,
        isFocal: tweet.id === focalId,
        element: el,
      };
      if (tweet.reddit?.parentId) cell.parentId = tweet.reddit.parentId;
      scan.cells.push(cell);
    }
    const tree = doc.querySelector('shreddit-comment-tree');
    const announced =
      posts.map((p) => intOf(p, 'comment-count')).find((n) => n !== undefined) ??
      (tree ? intOf(tree, 'totalcomments') : undefined);
    scan.reddit = {
      postId,
      moreControls: doc.querySelectorAll('faceplate-partial[src*="/more-comments/"]').length,
    };
    if (announced !== undefined) scan.reddit.announced = announced;
  }
  if (focalId && scan.cells.some((c) => c.isFocal)) scan.focalId = focalId;
  return scan;
}
