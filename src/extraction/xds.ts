/**
 * Strategy for X's current web layout (observed October 2026): Tailwind-like utility classes,
 * `data-engagement-action` attributes, posts rendered as top-level <article> elements inside
 * `main ul > li`, quoted posts as a nested <article> inside `[role=link][data-href]`.
 */
import type { LinkCard, MediaItem, QuotedRef } from '@/types/model';
import { cleanExternalUrl, isHandle, isTweetId, parseStatusUrl } from '@/utils/url';
import { detectConnectors, type ConnectorState } from './connectors';
import { attr, intAttr, isShowMoreControl, ownAll, ownFirst, REPLYING_TO_RE, textOf } from './dom';
import { buildTweet, cleanAlt, type RawTweet } from './build';
import type { Tweet } from '@/types/model';
import { extractRichText } from './rich-text';
import type { LayoutStrategy } from './types';

function nestedArticles(article: Element): Element[] {
  return Array.from(article.querySelectorAll('article'));
}

export function isTopLevelArticle(el: Element): boolean {
  return !el.parentElement?.closest('article');
}

export const xdsStrategy: LayoutStrategy = {
  id: 'xds',
  detect(root) {
    return !!root.querySelector('article [data-engagement-action]');
  },
  listItems(root) {
    const scope = (root as Document).querySelector?.('main') ?? root;
    return Array.from(scope.querySelectorAll('article')).filter(isTopLevelArticle);
  },
  actionRow(article) {
    const share = ownFirst(
      article,
      '[data-engagement-action="share"], [data-engagement-action="bookmark"]',
      nestedArticles(article),
    );
    // The engagement row is the flex container holding all engagement actions.
    let row: Element | null = share;
    while (row && row !== article && row.querySelectorAll('[data-engagement-action]').length < 3) {
      row = row.parentElement;
    }
    return row && row !== article ? row : null;
  },
};

function authorOf(article: Element, exclude: Element[]) {
  const avatarImg = ownFirst<HTMLImageElement>(article, 'img[alt^="@"]', exclude);
  let handle = avatarImg?.getAttribute('alt')?.slice(1) ?? '';
  if (!isHandle(handle)) {
    const at = ownAll(article, 'a[href^="/"] span, a[href^="/"]', exclude).find((el) =>
      /^@[A-Za-z0-9_]{1,15}$/.test(textOf(el)),
    );
    handle = at ? textOf(at).slice(1) : '';
  }
  const lower = handle.toLowerCase();
  const nameLink = ownAll(article, 'a[href^="/"]', exclude).find(
    (a) =>
      a.getAttribute('href')?.slice(1).toLowerCase() === lower &&
      !a.querySelector('img') &&
      !textOf(a).startsWith('@') &&
      textOf(a),
  );
  const verified = !!ownFirst(
    article,
    'use[href^="#icon-verified"], [data-icon^="icon-verified"]',
    exclude,
  );
  const avatarLink = avatarImg?.closest('a') ?? avatarImg ?? null;
  return {
    handle,
    name: nameLink ? textOf(nameLink) : undefined,
    avatarUrl: avatarImg?.getAttribute('src') ?? undefined,
    verified,
    avatarEl: avatarLink as Element | null,
  };
}

function idOf(
  article: Element,
  exclude: Element[],
  handle: string,
  hint?: string,
): string | undefined {
  const reply = ownFirst(
    article,
    '[data-engagement-action="reply"] a[href*="in_reply_to="]',
    exclude,
  );
  const fromReply = /in_reply_to=(\d{1,25})/.exec(reply?.getAttribute('href') ?? '')?.[1];
  if (fromReply) return fromReply;
  if (hint) {
    const ref = parseStatusUrl(hint);
    if (ref) return ref.id;
  }
  const links = ownAll(article, 'a[href*="/status/"]', exclude);
  const timeLink = links.find((a) => a.hasAttribute('data-base-ui-tooltip-trigger')) ?? links[0];
  for (const a of timeLink ? [timeLink, ...links] : links) {
    const ref = parseStatusUrl(a.getAttribute('href') ?? '');
    if (
      ref &&
      (!ref.handle || ref.handle.toLowerCase() === handle.toLowerCase()) &&
      !/\/(photo|video)\//.test(a.getAttribute('href') ?? '')
    ) {
      return ref.id;
    }
  }
  return undefined;
}

function timestampOf(article: Element, exclude: Element[]): number | undefined {
  for (const script of ownAll(article, 'script', exclude)) {
    const m = /"timestamp"\s*:\s*(\d{10,13})/.exec(script.textContent ?? '');
    if (m) {
      const n = Number(m[1]);
      return n < 1e12 ? n * 1000 : n;
    }
  }
  const time = ownFirst(article, 'time[datetime]', exclude);
  const iso = time?.getAttribute('datetime');
  if (iso && !Number.isNaN(Date.parse(iso))) return Date.parse(iso);
  return undefined;
}

function textContainerOf(article: Element, exclude: Element[]): Element | null {
  return (
    ownFirst(article, 'div[dir="auto"].whitespace-pre-wrap', exclude) ??
    ownAll(article, '[dir="auto"]', exclude).find(
      (el) => !el.closest('a') && !REPLYING_TO_RE.test(textOf(el)),
    ) ??
    null
  );
}

function replyingToOf(
  article: Element,
  exclude: Element[],
  textEl: Element | null,
): string[] | undefined {
  const candidates = ownAll(article, 'div', exclude).filter(
    (d) =>
      d !== textEl &&
      !textEl?.contains(d) &&
      REPLYING_TO_RE.test(textOf(d)) &&
      d.querySelector('a[href^="/"]'),
  );
  const deepest = candidates.find((d) => !candidates.some((o) => o !== d && d.contains(o)));
  if (!deepest) return undefined;
  const handles = Array.from(deepest.querySelectorAll('a[href^="/"]'))
    .map((a) => (a.getAttribute('href') ?? '').slice(1))
    .filter(isHandle);
  return handles.length ? handles : undefined;
}

function mediaOf(article: Element, exclude: Element[], postUrl: string | undefined): MediaItem[] {
  const media: MediaItem[] = [];
  const videos = ownAll<HTMLVideoElement>(article, 'video', exclude);
  const videoBoxes = videos.map(
    (v) => v.closest('[style*="aspect-ratio"]') ?? v.parentElement ?? v,
  );
  for (const v of videos) {
    const poster = v.getAttribute('poster') ?? '';
    const src = v.getAttribute('src') ?? '';
    const isGif = /tweet_video/.test(poster) || /\/tweet_video\//.test(src);
    if (!poster) continue;
    const item: MediaItem = { kind: isGif ? 'gif' : 'video', url: poster };
    if (postUrl) item.playbackUrl = postUrl;
    media.push(item);
  }
  for (const img of ownAll<HTMLImageElement>(
    article,
    'img[src*="pbs.twimg.com/media/"]',
    exclude,
  )) {
    if (videoBoxes.some((box) => box.contains(img))) continue;
    const item: MediaItem = { kind: 'photo', url: img.getAttribute('src') ?? '' };
    const alt = cleanAlt(img.getAttribute('alt'));
    if (alt) item.alt = alt;
    const w = intAttr(img, 'width');
    const h = intAttr(img, 'height');
    if (w && h) {
      item.width = w;
      item.height = h;
    }
    media.push(item);
  }
  return media;
}

const DOMAIN_RE = /\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i;

function cardOf(
  article: Element,
  exclude: Element[],
  textEl: Element | null,
): LinkCard | undefined {
  const anchors = ownAll(article, 'a[href^="https://t.co/"]', exclude).filter(
    (a) => !textEl?.contains(a),
  );
  if (!anchors.length) return undefined;
  const href = anchors[0]!.getAttribute('href') ?? '';
  const url = cleanExternalUrl(href);
  if (!url) return undefined;
  const card: LinkCard = { url };
  const same = anchors.filter((a) => a.getAttribute('href') === href);
  const withImg = same.find((a) => a.querySelector('img'));
  const img = withImg?.querySelector('img');
  if (img?.getAttribute('src')) card.imageUrl = img.getAttribute('src')!;
  const titles = same.map((a) => textOf(a)).filter(Boolean);
  const domainText = titles.find(
    (t) => DOMAIN_RE.test(t) && t.length < 60 && (!withImg || textOf(withImg) !== t),
  );
  const domain = domainText ? DOMAIN_RE.exec(domainText)?.[1] : undefined;
  if (domain) card.domain = domain.toLowerCase();
  const title = (withImg ? textOf(withImg) : titles.find((t) => t !== domainText)) ?? '';
  if (title && title !== domainText) card.title = title;
  return card;
}

function quotedOf(
  article: Element,
  now: number,
): { ref: QuotedRef; tweet: Tweet | null } | undefined {
  const nested = nestedArticles(article).find(
    (a) => a.parentElement?.closest('article') === article,
  );
  if (!nested) return undefined;
  const wrapper = nested.closest('[data-href]');
  const hint =
    wrapper && article.contains(wrapper)
      ? (wrapper.getAttribute('data-href') ?? undefined)
      : undefined;
  const inner = extractXdsArticle(nested, { context: 'quote', now, hint });
  const ref: QuotedRef = {};
  if (inner.tweet) {
    ref.id = inner.tweet.id;
    ref.url = inner.tweet.url;
    ref.author = inner.tweet.author;
    ref.text = inner.tweet.text;
    if (inner.tweet.createdAt) ref.createdAt = inner.tweet.createdAt;
    ref.media = inner.tweet.media;
  } else if (hint) {
    const s = parseStatusUrl(hint);
    if (s) ref.id = s.id;
  }
  return { ref, tweet: inner.tweet };
}

export interface ArticleExtraction {
  tweet: Tweet | null;
  quoted: Tweet[];
  connectors: ConnectorState;
}

export function extractXdsArticle(
  article: Element,
  opts: { context?: 'full' | 'quote'; now?: number; hint?: string } = {},
): ArticleExtraction {
  const now = opts.now ?? Date.now();
  const exclude = nestedArticles(article);
  const author = authorOf(article, exclude);
  const id = idOf(article, exclude, author.handle, opts.hint);
  const connectors = detectConnectors(article, author.avatarEl, exclude);
  if (!id || !isTweetId(id) || !isHandle(author.handle))
    return { tweet: null, quoted: [], connectors };

  const textEl = textContainerOf(article, exclude);
  const postUrl = `https://x.com/${author.handle}/status/${id}`;
  const raw: RawTweet = {
    id,
    author: {
      handle: author.handle,
      name: author.name,
      avatarUrl: author.avatarUrl,
      verified: author.verified,
    },
    text: textEl ? extractRichText(textEl) : [],
    media: mediaOf(article, exclude, postUrl),
    context: opts.context ?? 'full',
    source: 'xds',
  };
  const ts = timestampOf(article, exclude);
  if (ts) raw.createdAtMs = ts;
  const lang = attr(textEl, 'lang');
  if (lang) raw.lang = lang;
  if (ownAll(article, 'button, a, span[role="button"]', exclude).some(isShowMoreControl))
    raw.textTruncated = true;
  const replyingTo = replyingToOf(article, exclude, textEl);
  if (replyingTo) raw.replyingTo = replyingTo;
  const card = cardOf(article, exclude, textEl);
  if (card) raw.card = card;

  const quoted: Tweet[] = [];
  if (opts.context !== 'quote') {
    const q = quotedOf(article, now);
    if (q) {
      raw.quoted = q.ref;
      if (q.tweet) quoted.push(q.tweet);
    }
  }
  return { tweet: buildTweet(raw, now), quoted, connectors };
}
