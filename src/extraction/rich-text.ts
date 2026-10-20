import type { Segment } from '@/types/model';
import { compactSegments } from '@/utils/text';
import { cleanExternalUrl, isHandle, parseStatusUrl, safeHref } from '@/utils/url';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'BUTTON', 'svg', 'SVG']);

/** Visible text of an anchor, excluding the trailing ellipsis X adds to shortened URLs. */
function anchorText(a: Element): string {
  return (a.textContent ?? '').replace(/…$/, '').trim();
}

/** Text as displayed: hidden parts of shortened URLs removed, ellipsis kept. */
function displayText(a: Element): string {
  const hidden = Array.from(a.querySelectorAll('[aria-hidden="true"]'));
  if (!hidden.length) return (a.textContent ?? '').trim();
  const clone = a.cloneNode(true) as Element;
  let ellipsis = false;
  clone.querySelectorAll('[aria-hidden="true"]').forEach((h) => {
    if ((h.textContent ?? '').trim() === '…') ellipsis = true;
    h.remove();
  });
  return (clone.textContent ?? '').trim() + (ellipsis ? '…' : '');
}

/**
 * Expanded URL of a text link.
 * - New layout: href is already the expanded destination.
 * - Classic layout: href is a t.co redirect; the full URL is spread over hidden spans inside the anchor.
 */
function expandedLinkUrl(a: Element): string | null {
  const href = a.getAttribute('href') ?? '';
  const text = anchorText(a);
  if (/^https?:\/\/t\.co\//i.test(href) && /^https?:\/\//i.test(text) && !/\s/.test(text)) {
    return cleanExternalUrl(text) ?? safeHref(href);
  }
  return cleanExternalUrl(href) ?? safeHref(href);
}

function classifyAnchor(a: Element): Segment | null {
  const href = a.getAttribute('href') ?? '';
  const text = (a.textContent ?? '').trim();
  if (!href) return text ? { t: 'text', v: text } : null;

  if (href.startsWith('/hashtag/')) {
    const tag = decodeURIComponent(href.slice('/hashtag/'.length).split(/[?#]/)[0] ?? '');
    return { t: 'hashtag', v: text || `#${tag}`, tag: text.replace(/^[#＃]/, '') || tag };
  }
  if (/^\/search\?q=(%24|\$)/i.test(href)) {
    const tag = text.replace(/^\$/, '');
    return { t: 'cashtag', v: text, tag };
  }
  const mention = /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(href);
  if (mention && text.startsWith('@')) {
    const handle = mention[1]!;
    return isHandle(handle) ? { t: 'mention', v: text, handle } : { t: 'text', v: text };
  }
  if (/^https?:\/\//i.test(href) || href.startsWith('/')) {
    const absolute = href.startsWith('/') ? `https://x.com${href}` : href;
    const url = href.startsWith('/') ? (cleanExternalUrl(absolute) ?? null) : expandedLinkUrl(a);
    if (!url) return text ? { t: 'text', v: text } : null;
    return { t: 'link', v: displayText(a) || url, href: url };
  }
  return text ? { t: 'text', v: text } : null;
}

/**
 * Converts a post text container into structured segments: text, links, mentions, hashtags,
 * cashtags. Emoji images become their alt text. Scripts, buttons ("Show more") and SVGs are ignored.
 */
export function extractRichText(container: Element): Segment[] {
  const out: Segment[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      out.push({ t: 'text', v: node.nodeValue ?? '' });
      return;
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return;
    const el = node as Element;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.getAttribute('aria-hidden') === 'true' && el.tagName !== 'SPAN') return;
    if (el.tagName === 'BR') {
      out.push({ t: 'text', v: '\n' });
      return;
    }
    if (el.tagName === 'IMG') {
      const alt = el.getAttribute('alt');
      if (alt) out.push({ t: 'text', v: alt });
      return;
    }
    if (el.tagName === 'A') {
      const seg = classifyAnchor(el);
      if (seg) out.push(seg);
      return;
    }
    if (el.getAttribute('data-testid') === 'tweet-text-show-more-link') return;
    el.childNodes.forEach(walk);
  };
  container.childNodes.forEach(walk);
  return compactSegments(out);
}

/** Collects derived lists from segments. */
export function deriveFromSegments(segments: Segment[]) {
  const links: string[] = [];
  const mentions: string[] = [];
  const hashtags: string[] = [];
  const linkedTweetIds: string[] = [];
  for (const s of segments) {
    if (s.t === 'link') {
      links.push(s.href);
      const ref = parseStatusUrl(s.href);
      if (ref && !linkedTweetIds.includes(ref.id)) linkedTweetIds.push(ref.id);
    } else if (s.t === 'mention') {
      if (!mentions.includes(s.handle)) mentions.push(s.handle);
    } else if (s.t === 'hashtag') {
      if (!hashtags.includes(s.tag)) hashtags.push(s.tag);
    }
  }
  return { links, mentions, hashtags, linkedTweetIds };
}
