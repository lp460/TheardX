import { commentActionRow, scanReddit, type RedditCache } from '@/extraction/reddit';
import { isRedditHost, parseRedditUrl, redditUrl } from '@/utils/reddit-url';
import type { ContentAdapter } from './content-adapter';

const cache: RedditCache = new WeakMap();

const isPost = (el: Element) => el.tagName === 'SHREDDIT-POST';

export const redditAdapter: ContentAdapter = {
  id: 'reddit',
  label: 'Reddit',
  hosts: ['www.reddit.com', 'reddit.com'],
  matches: (url) => isRedditHost(url.hostname),
  normalizePostUrl(input) {
    const r = parseRedditUrl(input);
    return r.kind === 'post' ? redditUrl(new URL(input, 'https://www.reddit.com').pathname) : null;
  },
  routeId(url) {
    const r = parseRedditUrl(url);
    return r.kind === 'post' ? (r.commentId ?? r.postId) : null;
  },
  scan: (doc, url) => scanReddit(doc, url, cache),
  findPostElement(doc, id) {
    return id.startsWith('t3_')
      ? doc.querySelector(`shreddit-post[id="${CSS.escape(id)}"]`)
      : doc.querySelector(`shreddit-comment[thingid="${CSS.escape(id)}"]`);
  },
  actionSlot(post) {
    // Posts render their action row in a shadow root: the button goes into its free slot.
    if (isPost(post)) return { container: post, slot: 'action-row-whitespace' };
    const row = commentActionRow(post);
    return row ? { container: row } : null;
  },
  // The capture bar sits under the post, above the comments.
  barAnchor: (post) => (isPost(post) ? post : null),
  tone(doc) {
    const cls = doc.documentElement.className;
    if (/\btheme-dark\b/.test(cls)) return 'dark';
    if (/\btheme-light\b/.test(cls)) return 'light';
    return null;
  },
};
