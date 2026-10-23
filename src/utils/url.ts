/** URL helpers for X / Twitter. Pure functions, no DOM access. */

const X_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'mobile.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
]);

/** Paths that look like /:handle but are app routes. */
const RESERVED = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'search',
  'settings',
  'i',
  'compose',
  'hashtag',
  'login',
  'logout',
  'signup',
  'tos',
  'privacy',
  'about',
  'jobs',
  'communities',
  'lists',
  'bookmarks',
  'premium',
  'verified-orgs',
  'account',
  'intent',
  'share',
  'download',
  'grok',
  'jf',
  'topics',
]);

export const TWEET_ID_RE = /^\d{1,25}$/;
export const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

export function isTweetId(value: unknown): value is string {
  return typeof value === 'string' && TWEET_ID_RE.test(value);
}

export function isHandle(value: unknown): value is string {
  return typeof value === 'string' && HANDLE_RE.test(value) && !RESERVED.has(value.toLowerCase());
}

export function isXHost(host: string): boolean {
  return X_HOSTS.has(host.toLowerCase());
}

function toUrl(input: string | URL, base = 'https://x.com'): URL | null {
  try {
    return input instanceof URL ? input : new URL(input, base);
  } catch {
    return null;
  }
}

export interface StatusRef {
  id: string;
  handle?: string;
}

/**
 * Parses any x.com / twitter.com status URL, including /i/web/status/ID, /handle/statuses/ID,
 * /handle/status/ID/photo/1, relative paths and URLs with tracking parameters.
 */
export function parseStatusUrl(input: string | URL): StatusRef | null {
  const url = toUrl(input);
  if (!url || !/^https?:$/.test(url.protocol) || !isXHost(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  // /i/web/status/ID or /i/status/ID
  if (parts[0] === 'i') {
    const idx = parts.indexOf('status');
    const id = idx >= 0 ? parts[idx + 1] : undefined;
    return isTweetId(id) ? { id } : null;
  }
  const [handle, kind, id] = parts;
  if ((kind === 'status' || kind === 'statuses') && isTweetId(id) && isHandle(handle)) {
    return { id, handle };
  }
  return null;
}

/** Canonical URL without tracking parameters: https://x.com/{handle}/status/{id}. */
export function canonicalTweetUrl(id: string, handle?: string): string {
  if (!isTweetId(id)) throw new Error(`Invalid post id: ${id}`);
  return handle && isHandle(handle)
    ? `https://x.com/${handle}/status/${id}`
    : `https://x.com/i/status/${id}`;
}

/** Normalises any status URL; returns null if it is not a post URL. */
export function normalizeTweetUrl(input: string | URL): string | null {
  const ref = parseStatusUrl(input);
  return ref ? canonicalTweetUrl(ref.id, ref.handle) : null;
}

export type XRoute =
  | { kind: 'status'; id: string; handle?: string }
  | { kind: 'home' }
  | { kind: 'profile'; handle: string }
  | { kind: 'other' };

export function parseXRoute(input: string | URL): XRoute {
  const url = toUrl(input);
  if (!url || !isXHost(url.hostname)) return { kind: 'other' };
  const status = parseStatusUrl(url);
  if (status) {
    const parts = url.pathname.split('/').filter(Boolean);
    // /handle/status/ID/photo/1 is a media viewer over the status page — still a status route.
    if (parts.length <= 5) return { kind: 'status', ...status };
  }
  const parts = url.pathname.split('/').filter(Boolean);
  // /handle/article/ID: full-page view of a post's long-form Article (same ID as the post).
  if (parts[1] === 'article' && isHandle(parts[0]) && isTweetId(parts[2])) {
    return { kind: 'status', id: parts[2]!, handle: parts[0]! };
  }
  if (parts.length === 0 || parts[0] === 'home') return { kind: 'home' };
  if (parts.length >= 1 && isHandle(parts[0])) return { kind: 'profile', handle: parts[0]! };
  return { kind: 'other' };
}

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_[a-z]+$/i,
  /^ref_src$/i,
  /^ref_url$/i,
  /^igshid$/i,
  /^s$/,
  /^t$/,
];

/** Removes common tracking parameters from an external URL. Returns null for non-http(s) URLs. */
export function cleanExternalUrl(input: string): string | null {
  const url = toUrl(input);
  if (!url || !/^https?:$/.test(url.protocol)) return null;
  const isX = isXHost(url.hostname);
  for (const key of [...url.searchParams.keys()]) {
    // `s` and `t` are only tracking on x.com share links.
    const re = TRACKING_PARAMS.find((r) => r.test(key));
    if (re && (isX || (re.source !== '^s$' && re.source !== '^t$'))) url.searchParams.delete(key);
  }
  if (isX) {
    const normalized = normalizeTweetUrl(url);
    if (normalized) return normalized;
  }
  return url.toString();
}

/** Only allow http(s) URLs to be rendered as links. Everything else (javascript:, data:, …) is dropped. */
export function safeHref(input: string | undefined | null): string | null {
  if (!input) return null;
  const url = toUrl(input);
  if (!url || !/^https?:$/.test(url.protocol)) return null;
  return url.toString();
}

const MEDIA_HOSTS = new Set([
  'pbs.twimg.com',
  'video.twimg.com',
  'abs.twimg.com',
  // Reddit: post images, previews, avatars and community icons.
  'i.redd.it',
  'preview.redd.it',
  'cf.preview.redd.it',
  'external-preview.redd.it',
  'styles.redditmedia.com',
  'www.redditstatic.com',
]);

/** Media URLs we accept from pages or imports. */
export function isAllowedMediaUrl(input: string): boolean {
  const url = toUrl(input);
  return !!url && url.protocol === 'https:' && MEDIA_HOSTS.has(url.hostname);
}

/** Requests the large rendition of a pbs.twimg.com/media image (keeps the format). */
export function largeMediaUrl(input: string): string {
  const url = toUrl(input);
  if (!url || url.hostname !== 'pbs.twimg.com' || !url.pathname.startsWith('/media/')) return input;
  url.searchParams.set('name', 'large');
  return url.toString();
}

/** Higher resolution avatar (`_normal` → `_bigger`). */
export function largerAvatarUrl(input: string): string {
  return input.replace(/_(normal|mini)(\.[a-z]+)$/i, '_bigger$2');
}

export function profileUrl(handle: string): string {
  return `https://x.com/${encodeURIComponent(handle)}`;
}

export function hashtagUrl(tag: string): string {
  return `https://x.com/hashtag/${encodeURIComponent(tag)}`;
}

export function cashtagUrl(tag: string): string {
  return `https://x.com/search?q=${encodeURIComponent('$' + tag)}`;
}

export function hostnameOf(input: string): string {
  return toUrl(input)?.hostname.replace(/^www\./, '') ?? '';
}

/** Readable form of a URL for link labels: no protocol, no trailing slash. */
export function prettyUrl(input: string): string {
  return input.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

/** Label for a text link: the page shows truncated URLs ("example.com/very-lo…"), exports show them in full. */
export function linkLabel(display: string, href: string): string {
  return display.endsWith('…') || /^https?:\/\//.test(display) ? prettyUrl(href) : display;
}
