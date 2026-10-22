/**
 * Long-form X Articles (x.com/<handle>/article/<id>). On a post's page X renders the whole Article
 * with stable hooks: [data-article-part="cover" | "title" | "byline" | "body"]; the body is semantic
 * HTML (p, h2–h4, ul/ol, blockquote, pre>code with a language label, figure>img, hr).
 */
import type { ArticleBlock, MediaItem, XArticle } from '@/types/model';
import { isAllowedMediaUrl, isHandle, isTweetId } from '@/utils/url';
import { cleanAlt } from './build';
import { ownAll, ownFirst, textOf } from './dom';
import { extractRichText } from './rich-text';

const ARTICLE_LINK_RE =
  /^(?:https:\/\/(?:x|twitter)\.com)?\/([A-Za-z0-9_]{1,15})\/article\/(\d{1,25})(?:[/?#]|$)/;

export function articleUrlFromHref(href: string): string | null {
  const m = ARTICLE_LINK_RE.exec(href);
  return m && isHandle(m[1]) && isTweetId(m[2]) ? `https://x.com/${m[1]}/article/${m[2]}` : null;
}

function imageItem(img: Element): MediaItem | null {
  const src = img.getAttribute('src') ?? '';
  if (!isAllowedMediaUrl(src)) return null;
  const item: MediaItem = { kind: 'photo', url: src };
  const alt = cleanAlt(img.getAttribute('alt'));
  if (alt) item.alt = alt;
  const w = Number.parseInt(img.getAttribute('width') ?? '', 10);
  const h = Number.parseInt(img.getAttribute('height') ?? '', 10);
  if (w > 0 && h > 0) {
    item.width = w;
    item.height = h;
  }
  return item;
}

const BLOCK_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'BLOCKQUOTE',
  'PRE',
  'FIGURE',
  'HR',
  'IMG',
  'VIDEO',
]);
const MAX_BLOCKS = 2_000;

/** Converts the Article body into blocks, in document order. */
export function extractArticleBlocks(body: Element): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const visit = (el: Element) => {
    if (blocks.length >= MAX_BLOCKS) return;
    if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT' || el.tagName === 'BUTTON') return;
    if (!BLOCK_TAGS.has(el.tagName)) {
      Array.from(el.children).forEach(visit);
      return;
    }
    switch (el.tagName) {
      case 'P': {
        const text = extractRichText(el, { marks: true });
        if (text.length) blocks.push({ t: 'paragraph', text });
        break;
      }
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6': {
        const n = Number(el.tagName[1]);
        const text = extractRichText(el, { marks: true });
        if (text.length)
          blocks.push({ t: 'heading', level: (n <= 2 ? 2 : n === 3 ? 3 : 4) as 2 | 3 | 4, text });
        break;
      }
      case 'UL':
      case 'OL': {
        const items = Array.from(el.children)
          .filter((li) => li.tagName === 'LI')
          .map((li) => extractRichText(li, { marks: true }))
          .filter((t) => t.length);
        if (items.length) blocks.push({ t: 'list', ordered: el.tagName === 'OL', items });
        break;
      }
      case 'BLOCKQUOTE': {
        const text = extractRichText(el, { marks: true });
        if (text.length) blocks.push({ t: 'quote', text });
        break;
      }
      case 'PRE': {
        const code = (el.querySelector('code') ?? el).textContent ?? '';
        // Language label: a small header (« bash », « plaintext ») just before the code container.
        const header = el.parentElement?.previousElementSibling;
        const label = header ? textOf(header.querySelector('span') ?? header) : '';
        const block: ArticleBlock = { t: 'code', code: code.replace(/\n$/, '') };
        if (/^[\w#+.-]{1,30}$/.test(label)) block.lang = label.toLowerCase();
        if (block.code.trim()) blocks.push(block);
        break;
      }
      case 'FIGURE':
      case 'IMG': {
        for (const img of el.tagName === 'IMG' ? [el] : Array.from(el.querySelectorAll('img'))) {
          const media = imageItem(img);
          if (media) blocks.push({ t: 'image', media });
        }
        const video = el.querySelector('video');
        if (video) Array.from([video]).forEach(visit);
        break;
      }
      case 'VIDEO': {
        const poster = el.getAttribute('poster') ?? '';
        if (isAllowedMediaUrl(poster))
          blocks.push({ t: 'image', media: { kind: 'video', url: poster } });
        break;
      }
      case 'HR':
        if (blocks.length && blocks[blocks.length - 1]!.t !== 'divider')
          blocks.push({ t: 'divider' });
        break;
    }
  };
  Array.from(body.children).forEach(visit);
  while (blocks.length && blocks[blocks.length - 1]!.t === 'divider') blocks.pop();
  return blocks;
}

/**
 * The Article published with a post, if any: full when its body is rendered (the post's own page),
 * partial when only a link / preview card is shown (timelines).
 */
export function extractArticle(
  scope: Element,
  exclude: Element[],
  handle: string,
  postId: string,
): XArticle | undefined {
  const body = ownFirst(scope, '[data-article-part="body"]', exclude);
  const link = ownAll(scope, 'a[href*="/article/"]', exclude)
    .map((a) => articleUrlFromHref(a.getAttribute('href') ?? ''))
    .find((u): u is string => !!u);
  if (!body && !link) return undefined;
  const article: XArticle = {
    url: link ?? `https://x.com/${handle}/article/${postId}`,
    blocks: [],
  };
  const title = textOf(ownFirst(scope, '[data-article-part="title"]', exclude));
  if (title) article.title = title;
  const cover = ownFirst(scope, '[data-article-part="cover"] img', exclude);
  const coverSrc = cover?.getAttribute('src') ?? '';
  if (isAllowedMediaUrl(coverSrc)) article.coverUrl = coverSrc;
  const byline = textOf(ownFirst(scope, '[data-article-part="byline"]', exclude));
  if (byline && byline.length < 60) article.readingTime = byline;
  if (body) article.blocks = extractArticleBlocks(body);
  if (!article.blocks.length) article.partial = true;
  return article;
}
