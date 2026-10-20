import { detectLayout, findArticleById, scanPage, strategyFor } from '@/extraction';
import { isXHost, normalizeTweetUrl } from '@/utils/url';
import type { ContentAdapter } from './content-adapter';

export const xAdapter: ContentAdapter = {
  id: 'x',
  label: 'X / Twitter',
  hosts: ['x.com', 'twitter.com', 'mobile.x.com', 'mobile.twitter.com'],
  matches: (url) => isXHost(url.hostname),
  normalizePostUrl: (input) => normalizeTweetUrl(input),
  scan: (doc, url) => scanPage(doc, url),
  findPostElement(doc, id) {
    const layout = detectLayout(doc);
    return layout === 'unknown' ? null : findArticleById(doc, id, layout);
  },
  actionAnchor(post) {
    const layout = detectLayout(post.ownerDocument ?? document);
    return layout === 'unknown' ? null : strategyFor(layout).actionRow(post);
  },
};
