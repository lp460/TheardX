/**
 * Strategy for X's "classic" React Native Web layout (data-testid attributes):
 * article[data-testid="tweet"], [data-testid="User-Name"], [data-testid="tweetText"], time[datetime],
 * list cells [data-testid="cellInnerDiv"] positioned with translateY.
 */
import type { LinkCard, MediaItem, QuotedRef, Tweet } from '@/types/model';
import { cleanExternalUrl, isHandle, isTweetId, parseStatusUrl } from '@/utils/url';
import { detectConnectors } from './connectors';
import { attr, intAttr, isShowMoreControl, ownAll, ownFirst, REPLYING_TO_RE, textOf } from './dom';
import { buildTweet, cleanAlt, quoteToTweet, type RawTweet } from './build';
import { extractRichText } from './rich-text';
import { extractArticle } from './article';
import type { LayoutStrategy } from './types';
import type { ArticleExtraction } from './xds';

export const classicStrategy: LayoutStrategy = {
  id: 'classic',
  detect(root) {
    return !!root.querySelector('article[data-testid="tweet"]');
  },
  listItems(root) {
    return Array.from(root.querySelectorAll('article[data-testid="tweet"]')).filter(
      (a) => !a.parentElement?.closest('article'),
    );
  },
  actionRow(article) {
    const groups = ownAll(article, 'div[role="group"]', quoteContainers(article));
    return groups[groups.length - 1] ?? null;
  },
};

/** Quoted posts are rendered inside a clickable [role=link] box containing their own User-Name. */
export function quoteContainers(article: Element): Element[] {
  const names = Array.from(article.querySelectorAll('[data-testid="User-Name"]'));
  const boxes = new Set<Element>();
  for (const name of names.slice(1)) {
    const box = name.closest('div[role="link"]');
    if (box && article.contains(box)) boxes.add(box);
  }
  for (const nested of Array.from(article.querySelectorAll('article'))) boxes.add(nested);
  return [...boxes];
}

function authorOf(scope: Element, exclude: Element[]) {
  const userName = ownFirst(scope, '[data-testid="User-Name"]', exclude);
  let handle = '';
  let name: string | undefined;
  if (userName) {
    const at = Array.from(userName.querySelectorAll('a, span')).find((el) =>
      /^@[A-Za-z0-9_]{1,15}$/.test(textOf(el)),
    );
    handle = at ? textOf(at).slice(1) : '';
    const first = userName.querySelector('a') ?? userName.querySelector('span');
    const t = textOf(first);
    if (t && !t.startsWith('@')) name = t;
    if (!handle) {
      const link = userName.querySelector('a[href^="/"]');
      handle = (link?.getAttribute('href') ?? '').slice(1);
    }
  }
  const avatarBox = ownFirst(scope, '[data-testid="Tweet-User-Avatar"]', exclude);
  const avatarImg = (avatarBox ?? scope).querySelector('img[src*="profile_images"]');
  const verified = !!userName?.querySelector(
    '[data-testid="icon-verified"], svg[aria-label*="erif"]',
  );
  return {
    handle,
    name,
    avatarUrl: avatarImg?.getAttribute('src') ?? undefined,
    verified,
    avatarEl: (avatarBox ?? avatarImg) as Element | null,
  };
}

function idOf(scope: Element, exclude: Element[], handle: string): { id?: string; iso?: string } {
  const time = ownFirst(scope, 'time[datetime]', exclude);
  const iso = time?.getAttribute('datetime') ?? undefined;
  const timeLink = time?.closest('a[href*="/status/"]');
  const fromTime = timeLink ? parseStatusUrl(timeLink.getAttribute('href') ?? '') : null;
  if (fromTime) return { id: fromTime.id, iso };
  for (const a of ownAll(scope, 'a[href*="/status/"]', exclude)) {
    const href = a.getAttribute('href') ?? '';
    const ref = parseStatusUrl(href);
    if (
      ref &&
      ref.handle?.toLowerCase() === handle.toLowerCase() &&
      !/\/(analytics|quotes|retweets|likes)$/.test(href)
    ) {
      return { id: ref.id, iso };
    }
  }
  return { iso };
}

function mediaOf(scope: Element, exclude: Element[], postUrl: string): MediaItem[] {
  const media: MediaItem[] = [];
  for (const img of ownAll<HTMLImageElement>(
    scope,
    '[data-testid="tweetPhoto"] img[src*="pbs.twimg.com/media/"]',
    exclude,
  )) {
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
  for (const v of ownAll(
    scope,
    '[data-testid="videoPlayer"] video, [data-testid="videoComponent"] video',
    exclude,
  )) {
    const poster = v.getAttribute('poster') ?? '';
    if (!poster) continue;
    const isGif = /tweet_video/.test(poster) || /\/tweet_video\//.test(v.getAttribute('src') ?? '');
    media.push({ kind: isGif ? 'gif' : 'video', url: poster, playbackUrl: postUrl });
  }
  return media;
}

function cardOf(scope: Element, exclude: Element[]): LinkCard | undefined {
  const wrapper = ownFirst(scope, '[data-testid="card.wrapper"]', exclude);
  if (!wrapper) return undefined;
  const a = wrapper.querySelector('a[href]');
  const url = cleanExternalUrl(a?.getAttribute('href') ?? '');
  if (!url) return undefined;
  const card: LinkCard = { url };
  const detail = wrapper.querySelector(
    '[data-testid="card.layoutLarge.detail"], [data-testid="card.layoutSmall.detail"]',
  );
  const spans = detail
    ? Array.from(detail.querySelectorAll('span'))
        .map((s) => textOf(s))
        .filter(Boolean)
    : [];
  const domain = spans.find((s) => /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(s));
  if (domain) card.domain = domain.toLowerCase();
  const title = spans.find((s) => s !== domain);
  if (title) card.title = title;
  else {
    const label = a?.getAttribute('aria-label');
    if (label) card.title = label;
  }
  const img = wrapper.querySelector('img[src*="pbs.twimg.com"]');
  if (img) card.imageUrl = img.getAttribute('src')!;
  return card;
}

function replyingToOf(
  scope: Element,
  exclude: Element[],
  textEl: Element | null,
): string[] | undefined {
  const divs = ownAll(scope, 'div', exclude).filter(
    (d) =>
      d !== textEl &&
      !textEl?.contains(d) &&
      REPLYING_TO_RE.test(textOf(d)) &&
      d.querySelector('a[href^="/"]'),
  );
  const deepest = divs.find((d) => !divs.some((o) => o !== d && d.contains(o)));
  if (!deepest) return undefined;
  const handles = Array.from(deepest.querySelectorAll('a[href^="/"]'))
    .map((a) => (a.getAttribute('href') ?? '').slice(1))
    .filter(isHandle);
  return handles.length ? handles : undefined;
}

function extractQuote(box: Element, now: number): QuotedRef {
  const author = authorOf(box, []);
  const textEl = box.querySelector('[data-testid="tweetText"]');
  const ref: QuotedRef = {};
  const { id, iso } = idOf(box, [], author.handle);
  if (id) {
    ref.id = id;
    if (isHandle(author.handle)) ref.url = `https://x.com/${author.handle}/status/${id}`;
  }
  if (isHandle(author.handle))
    ref.author = { handle: author.handle, ...(author.name ? { name: author.name } : {}) };
  if (textEl) ref.text = extractRichText(textEl);
  if (iso) ref.createdAt = iso;
  ref.media = mediaOf(box, [], ref.url ?? '');
  void now;
  return ref;
}

export function extractClassicArticle(
  article: Element,
  opts: { now?: number } = {},
): ArticleExtraction {
  const now = opts.now ?? Date.now();
  const exclude = quoteContainers(article);
  const author = authorOf(article, exclude);
  const { id, iso } = idOf(article, exclude, author.handle);
  const connectors = detectConnectors(article, author.avatarEl, exclude);
  if (!id || !isTweetId(id) || !isHandle(author.handle))
    return { tweet: null, quoted: [], connectors };

  const textEl = ownFirst(article, '[data-testid="tweetText"]', exclude);
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
    context: 'full',
    source: 'classic',
  };
  if (iso) raw.createdAtIso = iso;
  const lang = attr(textEl, 'lang');
  if (lang) raw.lang = lang;
  if (
    ownFirst(article, '[data-testid="tweet-text-show-more-link"]', exclude) ||
    ownAll(article, 'button, [role="button"]', exclude).some(isShowMoreControl)
  ) {
    raw.textTruncated = true;
  }
  const replyingTo = replyingToOf(article, exclude, textEl);
  if (replyingTo) raw.replyingTo = replyingTo;
  const card = cardOf(article, exclude);
  if (card) raw.card = card;
  const xArticle = extractArticle(article, exclude, author.handle, id);
  if (xArticle) raw.article = xArticle;

  const quoted: Tweet[] = [];
  const box = exclude.find((b) => b.tagName !== 'ARTICLE') ?? exclude[0];
  if (box) {
    const ref = extractQuote(box, now);
    raw.quoted = ref;
    const qt = quoteToTweet(ref, now, 'classic');
    if (qt) quoted.push(qt);
  }
  return { tweet: buildTweet(raw, now), quoted, connectors };
}
