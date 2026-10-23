import {
  detectLayout,
  findArticleById,
  scanPage,
  strategyFor,
  type ExtractionCache,
} from '@/extraction';
import { isXHost, normalizeTweetUrl, parseStatusUrl } from '@/utils/url';
import type { ContentAdapter } from './content-adapter';

const cache: ExtractionCache = new WeakMap();

function actionRow(post: Element): Element | null {
  const layout = detectLayout(post.ownerDocument ?? document);
  return layout === 'unknown' ? null : strategyFor(layout).actionRow(post);
}

export const xAdapter: ContentAdapter = {
  id: 'x',
  label: 'X / Twitter',
  hosts: ['x.com', 'twitter.com', 'mobile.x.com', 'mobile.twitter.com'],
  matches: (url) => isXHost(url.hostname),
  normalizePostUrl: (input) => normalizeTweetUrl(input),
  routeId: (url) => parseStatusUrl(url)?.id ?? null,
  scan: (doc, url) => scanPage(doc, url, cache),
  findPostElement(doc, id) {
    const layout = detectLayout(doc);
    return layout === 'unknown' ? null : findArticleById(doc, id, layout);
  },
  actionSlot(post) {
    const row = actionRow(post);
    return row ? { container: row } : null;
  },
  barAnchor: (post) => actionRow(post) ?? post.lastElementChild,
  tone(doc) {
    const theme = doc.documentElement.getAttribute('data-theme');
    return theme ? (/dark|dim|lights-out/i.test(theme) ? 'dark' : 'light') : null;
  },
};
