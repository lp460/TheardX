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

/** Site the text comes from: relative links resolve against it; X-only entities only on X. */
export type TextOrigin = 'x' | 'reddit';

function classifyAnchor(a: Element, origin: TextOrigin = 'x'): Segment | null {
  const href = a.getAttribute('href') ?? '';
  const text = (a.textContent ?? '').trim();
  if (!href) return text ? { t: 'text', v: text } : null;
  if (origin === 'reddit') {
    // Reddit: plain links (r/…, u/… and external), relative ones resolved on reddit.com.
    const url = cleanExternalUrl(href.startsWith('/') ? `https://www.reddit.com${href}` : href);
    if (!url) return text ? { t: 'text', v: text } : null;
    return { t: 'link', v: text || url, href: url };
  }

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
export function extractRichText(
  container: Element,
  opts: { marks?: boolean; origin?: TextOrigin } = {},
): Segment[] {
  const out: Segment[] = [];
  const text = (v: string, b: boolean, i: boolean): Segment => {
    const seg: Segment = { t: 'text', v };
    if (opts.marks && b) seg.b = true;
    if (opts.marks && i) seg.i = true;
    return seg;
  };
  const walk = (node: Node, b: boolean, i: boolean) => {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      out.push(text(node.nodeValue ?? '', b, i));
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
      if (alt) out.push(text(alt, b, i));
      return;
    }
    if (el.tagName === 'A') {
      const seg = classifyAnchor(el, opts.origin);
      if (seg) out.push(seg);
      return;
    }
    if (el.getAttribute('data-testid') === 'tweet-text-show-more-link') return;
    // Draft.js (signed-in X Articles) expresses bold / italic as inline styles.
    const style = (el as HTMLElement).style;
    const weight = style?.fontWeight ?? '';
    const bold =
      b ||
      el.tagName === 'B' ||
      el.tagName === 'STRONG' ||
      weight === 'bold' ||
      Number(weight) >= 600;
    const italic = i || el.tagName === 'I' || el.tagName === 'EM' || style?.fontStyle === 'italic';
    el.childNodes.forEach((n) => walk(n, bold, italic));
  };
  container.childNodes.forEach((n) => walk(n, false, false));
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
