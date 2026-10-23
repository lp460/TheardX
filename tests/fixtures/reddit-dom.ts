/**
 * Reddit (shreddit) markup builders, reproducing the structure observed on www.reddit.com
 * (October 2026): <shreddit-post> with attributes and slotted light-DOM children,
 * <shreddit-comment> nested in <shreddit-comment-tree>, bodies in #<id>-post-rtjson-content /
 * #<thingid>-comment-rtjson-content, « N more replies » as faceplate-partial[src*="/more-comments/"].
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface RedditPostSpec {
  id: string; // without t3_
  subreddit: string;
  author: string;
  title: string;
  /** Body HTML (semantic: p, ul, blockquote, pre>code, table…). */
  body?: string;
  type?: 'text' | 'image' | 'gallery' | 'video' | 'link';
  images?: string[]; // i.redd.it keys
  link?: { href: string; domain: string };
  score?: number;
  commentCount?: number;
  created?: string;
  flair?: string;
  /** Rendered as a feed card (excerpt) rather than on its own page. */
  feed?: boolean;
}

export interface RedditCommentSpec {
  id: string; // without t1_
  author: string;
  body: string;
  score?: number;
  created?: string;
  replies?: RedditCommentSpec[];
  /** « N more replies » control under this comment. */
  moreReplies?: number;
}

export const IMG = (key: string) => `https://i.redd.it/${key}.jpeg`;
const PREVIEW = (key: string) =>
  `https://preview.redd.it/x-v0-${key}.jpeg?width=640&format=pjpg&auto=webp&s=abc`;

function media(p: RedditPostSpec): string {
  const type = p.type ?? 'text';
  if (type === 'image' && p.images?.[0]) {
    const k = p.images[0];
    return `<div slot="post-media-container"><div></div><div><div><shreddit-media-lightbox-listener><div><img role="presentation" src="${PREVIEW(k)}" alt=""><img src="${PREVIEW(k)}" alt="r/${p.subreddit} - ${esc(p.title)}"><image-observer></image-observer><div><zoomable-img><img src="${IMG(k)}" alt="r/${p.subreddit} - ${esc(p.title)}"></zoomable-img></div></div></shreddit-media-lightbox-listener></div></div><div></div></div>`;
  }
  if (type === 'gallery') {
    const pages = (p.images ?? [])
      .map(
        (k, i) =>
          `<li slot="page-${i + 1}"><img src="${PREVIEW(k)}" role="presentation" alt=""><figure><img src="${PREVIEW(k)}" alt=""><image-observer></image-observer><div><zoomable-img><img src="${IMG(k)}" alt=""></zoomable-img></div></figure></li>`,
      )
      .join('');
    return `<div slot="post-media-container"><div></div><shreddit-async-loader><gallery-carousel><ul>${pages}</ul></gallery-carousel></shreddit-async-loader><shreddit-gallery-listener></shreddit-gallery-listener><div></div></div>`;
  }
  if (type === 'video') {
    return `<div slot="post-media-container"><div></div><div><div><activate-feature><shreddit-async-loader><shreddit-player src="https://v.redd.it/v${p.id}/HLSPlaylist.m3u8" post-type="video"><source src="https://v.redd.it/v${p.id}/HLSPlaylist.m3u8"><img src="https://external-preview.redd.it/poster-${p.id}.png?format=pjpg" slot="poster"><div slot="loading-spinner">Loading</div></shreddit-player></shreddit-async-loader></activate-feature></div></div><div></div></div>`;
  }
  if (type === 'link' && p.link) {
    return `<div slot="post-media-container"><div></div><div><div></div><div></div><div><div><div><a href="${esc(p.link.href)}"></a><div><a href="${esc(p.link.href)}"><img role="presentation" src="https://external-preview.redd.it/card-${p.id}.png?format=pjpg" alt=""></a><a href="${esc(p.link.href)}"><img src="https://external-preview.redd.it/card-${p.id}.png?format=pjpg" alt=""><image-observer></image-observer></a></div></div><div><div><div><div><span>${esc(p.link.domain)}</span><p>Link summary</p></div></div></div></div></div></div></div></div>`;
  }
  return '';
}

export function redditPost(p: RedditPostSpec): string {
  const id = `t3_${p.id}`;
  const permalink = `/r/${p.subreddit}/comments/${p.id}/${p.title.toLowerCase().replace(/\W+/g, '_').slice(0, 40)}/`;
  const type = p.type ?? 'text';
  const contentHref =
    type === 'link' && p.link
      ? p.link.href
      : type === 'image' && p.images?.[0]
        ? IMG(p.images[0])
        : `https://www.reddit.com${permalink}`;
  const body = p.body
    ? `<shreddit-post-text-body slot="text-body"><div slot="text-body" class="text-neutral-content"><div><div id="${id}-post-rtjson-content" class="md text-14-scalable">${p.body}</div><div id="${id}-overflow-cover" class="md"></div><button id="${id}-read-more-button" class="md"><span><span>Read more</span></span><span></span></button></div></div></shreddit-post-text-body>`
    : '';
  return `<shreddit-post id="${id}" permalink="${permalink}" content-href="${esc(contentHref)}" view-context="${p.feed ? 'SubredditFeed' : 'CommentsPage'}" comment-count="${p.commentCount ?? 0}" created-timestamp="${p.created ?? '2026-10-20T21:46:00.732000+0000'}" domain="${type === 'link' && p.link ? p.link.domain : `self.${p.subreddit}`}" post-title="${esc(p.title)}" post-language="en" post-type="${type}" score="${p.score ?? 1}" subreddit-id="t5_abc" subreddit-prefixed-name="r/${p.subreddit}" author-id="t2_${p.author}" author="${p.author}" icon="https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png" subreddit-name="${p.subreddit}" item-state="UNMODERATED"><div slot="credit-bar" id="pdp-credit-bar"><span><a href="/user/${p.author}/">u/${p.author}</a></span></div><div slot="ssr-post-content-header"></div><h1 slot="title" id="post-title-${id}">${esc(p.title)}</h1>${p.flair ? `<shreddit-post-flair slot="post-flair"><span>${esc(p.flair)}</span></shreddit-post-flair>` : ''}${media(p)}${body}</shreddit-post>`;
}

function comment(
  c: RedditCommentSpec,
  postId: string,
  subreddit: string,
  depth: number,
  position: number,
  parents: number[],
  parentId?: string,
): string {
  const id = `t1_${c.id}`;
  const permalink = `/r/${subreddit}/comments/${postId}/comment/${c.id}/`;
  const kids = (c.replies ?? [])
    .map((r, i) => comment(r, postId, subreddit, depth + 1, i, [...parents, position], id))
    .join('');
  const more = c.moreReplies
    ? `<faceplate-partial class="col-start-2 relative flex items-center" loading="action" src="/svc/shreddit/more-comments/${subreddit}/t3_${postId}?sort=CONFIDENCE&top-level=0" method="post" slot="children"><div slot="loading"><button>${c.moreReplies} more replies</button></div><button>${c.moreReplies} more replies</button></faceplate-partial>`
    : '';
  return `<shreddit-comment created="${c.created ?? '2026-10-21T10:00:00.000000+0000'}" author="${c.author}" avatar="https://styles.redditmedia.com/t5_1/styles/profileIcon_${c.author}.png?width=64" thingid="${id}" depth="${depth}"${parentId ? ` parentid="${parentId}"` : ''} comment-position="${position}" comment-parent-positions="[${parents.join(',')}]" permalink="${permalink}" score="${c.score ?? 1}" postid="t3_${postId}" content-type="text" arialabel="Comment by ${c.author}"${parentId ? ` slot="children-${parentId}-${position}"` : ''}><details open><summary><div class="comment-expand-control"><div slot="commentAvatar"><div><faceplate-tracker></faceplate-tracker></div></div></div><div slot="commentMeta" class="text-body-2"><div class="comment-credit-bar-hl"></div><faceplate-loader></faceplate-loader><div><span><a href="/user/${c.author}/">${c.author}</a></span></div></div><div></div></summary><div class="comment-main-grid"><div></div><div><div class="comment-body-hl"></div></div><div><div slot="comment" id="${id}-comment-rtjson-content" class="md text-14-scalable">${c.body}</div></div><div><div class="comment-action-row-hl"></div><faceplate-loader></faceplate-loader><div slot="actionRow"></div></div><div id="comment-children">${kids}${more}</div></div></details></shreddit-comment>`;
}

/** A post page with its comment tree. */
export function redditPostPage(
  p: RedditPostSpec,
  comments: RedditCommentSpec[] = [],
  opts: { moreTopLevel?: boolean } = {},
): string {
  const tree = comments.map((c, i) => comment(c, p.id, p.subreddit, 0, i, [])).join('');
  const more = opts.moreTopLevel
    ? `<faceplate-partial loading="action" src="/svc/shreddit/more-comments/${p.subreddit}/t3_${p.id}?sort=CONFIDENCE&top-level=1" method="post"><button>View more comments</button></faceplate-partial>`
    : '';
  return `<!doctype html><html lang="en" class="theme-beta"><head><title>${esc(p.title)} : r/${p.subreddit}</title></head><body><shreddit-app><div id="main-content"><main>${redditPost(p)}<shreddit-comment-tree id="comment-tree" post-id="t3_${p.id}" totalcomments="${p.commentCount ?? comments.length}" permalink="/r/${p.subreddit}/comments/${p.id}/">${tree}${more}</shreddit-comment-tree></main></div></shreddit-app></body></html>`;
}

/** A subreddit feed of post cards. */
export function redditFeed(posts: RedditPostSpec[]): string {
  return `<!doctype html><html lang="en"><body><shreddit-app><main><shreddit-feed>${posts.map((p) => `<article>${redditPost({ ...p, feed: true })}</article>`).join('')}</shreddit-feed></main></shreddit-app></body></html>`;
}

/** One comment's markup, to append to a live page (simulates « more replies » loading). */
export function redditCommentHtml(
  c: RedditCommentSpec,
  post: { id: string; subreddit: string },
  depth: number,
  position: number,
  parentId?: string,
): string {
  return comment(c, post.id, post.subreddit, depth, position, [], parentId);
}

/** A realistic discussion: text post with rich body, OP replies, nested comments. */
export const DISCUSSION_POST: RedditPostSpec = {
  id: '1xb56ky',
  subreddit: 'AskHistorians',
  author: 'ExternalBoysenberry',
  title: 'What was the deal with pacifiers in the time and place you study?',
  score: 2481,
  commentCount: 7,
  flair: 'Material Culture',
  body: [
    '<p>My toddler recently discovered <a href="/r/AskHistorians/">r/AskHistorians</a> and is <strong>eager</strong> to learn about <em>life’s biggest questions</em>.</p>',
    '<ul><li><p>When were they invented?</p></li><li><p>What were they made of?</p></li></ul>',
    '<blockquote><p>Every parent asks this eventually.</p></blockquote>',
    '<pre><code>pacifier = "dummy"\n</code></pre>',
    '<table><thead><tr><th>Era</th><th>Material</th></tr></thead><tbody><tr><td>1800s</td><td>Ivory</td></tr></tbody></table>',
  ].join(''),
};

export const DISCUSSION_COMMENTS: RedditCommentSpec[] = [
  {
    id: 'phy5zd7',
    author: 'AutoModerator',
    body: '<p>Welcome to <a href="https://www.reddit.com/r/AskHistorians/">r/AskHistorians</a>. Please read our rules.</p>',
  },
  {
    id: '19rhkvwj72ld1',
    author: 'gerardmenfin',
    score: 40,
    body: '<p>In 19th-century France, <strong>pacifiers</strong> were called « tétines ».</p><p>See <a href="https://example.com/source">this source</a>.</p>',
    replies: [
      {
        id: '19rhkyxlp7mox',
        author: 'gerardmenfin',
        score: 26,
        body: '<p>Adding a second part to my answer.</p>',
        replies: [
          {
            id: 'qq1',
            author: 'ExternalBoysenberry',
            score: 12,
            body: '<p>Thank you, this is fascinating!</p>',
          },
        ],
        moreReplies: 3,
      },
    ],
  },
  {
    id: 'zz9',
    author: 'curious_reader',
    score: 5,
    body: '<p>Following.</p>',
  },
];
