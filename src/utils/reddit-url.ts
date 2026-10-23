/** URL and identifier helpers for Reddit. Pure functions, no DOM access. */

/** Hosts where the current Reddit web app (shreddit) runs. old.reddit.com uses another markup. */
export const REDDIT_HOSTS = ['www.reddit.com', 'reddit.com'] as const;

/** Origins requested (optionally) when the user turns Reddit on: pages + images of saved posts. */
export const REDDIT_ORIGINS = [
  'https://www.reddit.com/*',
  'https://reddit.com/*',
  'https://i.redd.it/*',
  'https://preview.redd.it/*',
  'https://cf.preview.redd.it/*',
  'https://external-preview.redd.it/*',
  'https://styles.redditmedia.com/*',
  'https://www.redditstatic.com/*',
] as const;

/** Content-script match patterns for Reddit pages. */
export const REDDIT_MATCHES = ['https://www.reddit.com/*', 'https://reddit.com/*'];

/** Reddit "thing" IDs: t3_ = post, t1_ = comment. */
export const REDDIT_THING_RE = /^t[13]_[a-z0-9]{1,16}$/;
/** Usernames: 3–20 chars; "[deleted]" for removed accounts. */
export const REDDIT_USER_RE = /^(?:[A-Za-z0-9_-]{2,30}|\[deleted\])$/;
export const SUBREDDIT_RE = /^[A-Za-z0-9_]{2,30}$/;

export function isRedditHost(host: string): boolean {
  return (REDDIT_HOSTS as readonly string[]).includes(host.toLowerCase());
}

export function isRedditThingId(value: unknown): value is string {
  return typeof value === 'string' && REDDIT_THING_RE.test(value);
}

export function isRedditUser(value: unknown): value is string {
  return typeof value === 'string' && REDDIT_USER_RE.test(value);
}

export type RedditRoute =
  | { kind: 'post'; postId: string; subreddit?: string; commentId?: string }
  | { kind: 'listing'; subreddit?: string }
  | { kind: 'other' };

function toUrl(input: string | URL): URL | null {
  try {
    return input instanceof URL ? input : new URL(input, 'https://www.reddit.com');
  } catch {
    return null;
  }
}

/**
 * /r/sub/comments/ID/slug/ · /r/sub/comments/ID/comment/CID/ · /r/sub/comments/ID/slug/CID/ ·
 * /comments/ID · /user/name/comments/ID/slug/
 */
export function parseRedditUrl(input: string | URL): RedditRoute {
  const url = toUrl(input);
  if (!url || !/^https?:$/.test(url.protocol) || !isRedditHost(url.hostname))
    return { kind: 'other' };
  const parts = url.pathname.split('/').filter(Boolean);
  const ci = parts.indexOf('comments');
  if (ci >= 0) {
    const id = (parts[ci + 1] ?? '').toLowerCase();
    if (!/^[a-z0-9]{1,16}$/.test(id)) return { kind: 'other' };
    const route: RedditRoute = { kind: 'post', postId: `t3_${id}` };
    if (parts[0] === 'r' && parts[1] && SUBREDDIT_RE.test(parts[1])) route.subreddit = parts[1];
    const rest = parts.slice(ci + 2);
    const cid = rest[0] === 'comment' ? rest[1] : rest[1];
    if (cid && /^[a-z0-9]{1,16}$/i.test(cid)) route.commentId = `t1_${cid.toLowerCase()}`;
    return route;
  }
  if (parts[0] === 'r' && parts[1] && SUBREDDIT_RE.test(parts[1]))
    return { kind: 'listing', subreddit: parts[1] };
  if (parts.length === 0 || ['best', 'hot', 'new', 'top', 'rising'].includes(parts[0]!))
    return { kind: 'listing' };
  return { kind: 'other' };
}

/** https://www.reddit.com + permalink, without query string or fragment. */
export function redditUrl(permalink: string): string {
  const url = toUrl(permalink);
  if (!url || !isRedditHost(url.hostname)) return 'https://www.reddit.com/';
  return `https://www.reddit.com${url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`}`;
}

export function redditUserUrl(name: string): string {
  return `https://www.reddit.com/user/${encodeURIComponent(name)}/`;
}

export function subredditUrl(name: string): string {
  return `https://www.reddit.com/r/${encodeURIComponent(name)}/`;
}
