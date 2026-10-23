/**
 * Long-form X Articles (x.com/<handle>/article/<id>). X renders them two ways:
 * - current layout (signed-out, observed Oct. 2026): [data-article-part="cover" | "title" | "byline" |
 *   "body"], the body being semantic HTML (p, h2–h4, ul/ol, blockquote, pre>code, figure>img, hr);
 * - signed-in app (Draft.js): title [data-testid="twitter-article-title"], cover
 *   [data-testid="article-cover-image"], body blocks with classes .longform-unstyled,
 *   .longform-header-one/two/three, .longform-blockquote, .longform-(un)ordered-list-item,
 *   .longform-code-block (one block per line), images in [data-testid="tweetPhoto"]; text in
 *   span[data-text="true"], bold / italic as inline styles.
 */
import type { ArticleBlock, MediaItem, XArticle } from '@/types/model';
import { isAllowedMediaUrl, isHandle, isTweetId } from '@/utils/url';
import { cleanAlt } from './build';
import { ownAll, ownFirst, textOf } from './dom';
import { extractRichText, type TextOrigin } from './rich-text';

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
  'TABLE',
]);
const MAX_BLOCKS = 2_000;

/**
 * Converts semantic HTML (X Article body, Reddit post / comment body) into blocks, in document order.
 */
export function extractArticleBlocks(
  body: Element,
  opts: { origin?: TextOrigin } = {},
): ArticleBlock[] {
  const rich = (el: Element) => extractRichText(el, { marks: true, origin: opts.origin });
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
        const text = rich(el);
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
        const text = rich(el);
        if (text.length)
          blocks.push({ t: 'heading', level: (n <= 2 ? 2 : n === 3 ? 3 : 4) as 2 | 3 | 4, text });
        break;
      }
      case 'UL':
      case 'OL': {
        const items = Array.from(el.children)
          .filter((li) => li.tagName === 'LI')
          .map((li) => rich(li))
          .filter((t) => t.length);
        if (items.length) blocks.push({ t: 'list', ordered: el.tagName === 'OL', items });
        break;
      }
      case 'BLOCKQUOTE': {
        const text = rich(el);
        if (text.length) blocks.push({ t: 'quote', text });
        break;
      }
      case 'PRE': {
        const code = (el.querySelector('code') ?? el).textContent ?? '';
        // Language label: a small header (« bash », « plaintext ») just before the code container.
        const header = opts.origin === 'reddit' ? null : el.parentElement?.previousElementSibling;
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
      case 'TABLE': {
        // Tables are kept as one line per row, cells separated by « | ».
        for (const tr of Array.from(el.querySelectorAll('tr'))) {
          const cells = Array.from(tr.children).map((c) => rich(c));
          const text = cells.flatMap((c, k) => (k ? [{ t: 'text' as const, v: ' | ' }, ...c] : c));
          if (cells.some((c) => c.length)) blocks.push({ t: 'paragraph', text });
        }
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

// Most specific first: the read view also holds the cover, which is not part of the body.
const DRAFT_ROOT_SELS = [
  '[data-testid="longformRichTextComponent"]',
  '[data-testid="twitterArticleRichTextView"]',
  '[data-testid="twitterArticleReadView"]',
];
const DRAFT_BLOCK_SEL = [
  '.longform-unstyled',
  '.longform-header-one',
  '.longform-header-two',
  '.longform-header-three',
  '.longform-blockquote',
  '.longform-ordered-list-item',
  '.longform-unordered-list-item',
  '.longform-code-block',
  // Atomic blocks (<section data-block>): code with a language header, images, separators.
  '[data-testid="markdown-code-block"]',
  '[data-testid="tweetPhoto"]',
  '[role="separator"]',
  'hr',
].join(', ');

function longformType(el: Element): string {
  if (el.tagName === 'HR' || el.getAttribute('role') === 'separator') return 'hr';
  const testid = el.getAttribute('data-testid');
  if (testid === 'tweetPhoto') return 'photo';
  if (testid === 'markdown-code-block') return 'markdown-code';
  const cls = (el.getAttribute('class') ?? '').split(/\s+/).find((c) => c.startsWith('longform-'));
  return cls ? cls.slice('longform-'.length) : 'unstyled';
}

/** Draft.js Article body (signed-in X) → blocks, in document order. */
export function extractDraftBlocks(root: Element): ArticleBlock[] {
  const nodes = Array.from(root.querySelectorAll(DRAFT_BLOCK_SEL));
  const top = nodes.filter((n) => !nodes.some((o) => o !== n && o.contains(n)));
  const blocks: ArticleBlock[] = [];
  let prevType = '';
  for (const el of top.slice(0, MAX_BLOCKS * 2)) {
    const type = longformType(el);
    const sameAsPrev = type === prevType;
    prevType = type;
    const prev = blocks[blocks.length - 1];
    if (type === 'hr') {
      if (prev && prev.t !== 'divider') blocks.push({ t: 'divider' });
      continue;
    }
    if (type === 'photo') {
      for (const img of Array.from(el.querySelectorAll('img'))) {
        const media = imageItem(img);
        if (media) blocks.push({ t: 'image', media });
      }
      continue;
    }
    if (type === 'markdown-code') {
      const codeEl = el.querySelector('pre code') ?? el.querySelector('pre');
      const code = (codeEl?.textContent ?? '').replace(/\u200b/g, '').replace(/\n+$/, '');
      const block: ArticleBlock = { t: 'code', code };
      const lang = /(?:^|\s)language-([\w#+.-]{1,30})(?:\s|$)/.exec(
        codeEl?.getAttribute('class') ?? '',
      )?.[1];
      if (lang) block.lang = lang.toLowerCase();
      blocks.push(block);
      continue;
    }
    if (type === 'code-block') {
      // Draft.js renders one block per code line: consecutive lines form one code block.
      const line = (el.textContent ?? '').replace(/\u200b/g, '');
      if (sameAsPrev && prev?.t === 'code') {
        prev.code += `\n${line}`;
      } else {
        blocks.push({ t: 'code', code: line });
      }
      continue;
    }
    const text = extractRichText(el, { marks: true });
    if (!text.length) continue;
    if (type === 'ordered-list-item' || type === 'unordered-list-item') {
      const ordered = type === 'ordered-list-item';
      if (sameAsPrev && prev?.t === 'list' && prev.ordered === ordered) {
        prev.items.push(text);
      } else {
        blocks.push({ t: 'list', ordered, items: [text] });
      }
    } else if (type === 'header-one' || type === 'header-two' || type === 'header-three') {
      blocks.push({
        t: 'heading',
        level: type === 'header-one' ? 2 : type === 'header-two' ? 3 : 4,
        text,
      });
    } else if (type === 'blockquote') {
      blocks.push({ t: 'quote', text });
    } else {
      blocks.push({ t: 'paragraph', text });
    }
    if (blocks.length >= MAX_BLOCKS) break;
  }
  for (const b of blocks) if (b.t === 'code') b.code = b.code.replace(/\n+$/, '');
  while (blocks.length && blocks[blocks.length - 1]!.t === 'divider') blocks.pop();
  return blocks.filter((b) => b.t !== 'code' || b.code.trim());
}

/** Signed-in view: the cover is the first photo of the read view, above the title and the body. */
function draftCover(
  scope: Element,
  exclude: Element[],
  title: Element | null,
  root: Element | null,
): Element | null {
  if (!title) return null;
  return (
    ownAll(
      scope,
      '[data-testid="twitterArticleReadView"] [data-testid="tweetPhoto"] img',
      exclude,
    ).find(
      (img) =>
        !root?.contains(img) &&
        !!(img.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING),
    ) ?? null
  );
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
  const draftTitle = ownFirst(scope, '[data-testid="twitter-article-title"]', exclude);
  const draftRoot =
    DRAFT_ROOT_SELS.map((sel) => ownFirst(scope, sel, exclude)).find((el) => !!el) ??
    (ownFirst(scope, '.longform-unstyled, .longform-header-one, .longform-header-two', exclude)
      ? scope
      : null);
  const link = ownAll(scope, 'a[href*="/article/"]', exclude)
    .map((a) => articleUrlFromHref(a.getAttribute('href') ?? ''))
    .find((u): u is string => !!u);
  if (!body && !draftRoot && !draftTitle && !link) return undefined;
  const article: XArticle = {
    url: link ?? `https://x.com/${handle}/article/${postId}`,
    blocks: [],
  };
  const title = textOf(ownFirst(scope, '[data-article-part="title"]', exclude) ?? draftTitle);
  if (title) article.title = title;
  const cover =
    ownFirst(
      scope,
      '[data-article-part="cover"] img, [data-testid="article-cover-image"] img',
      exclude,
    ) ?? draftCover(scope, exclude, draftTitle, draftRoot);
  const coverSrc = cover?.getAttribute('src') ?? '';
  if (isAllowedMediaUrl(coverSrc)) article.coverUrl = coverSrc;
  const byline = textOf(ownFirst(scope, '[data-article-part="byline"]', exclude));
  if (byline && byline.length < 60) article.readingTime = byline;
  if (body) article.blocks = extractArticleBlocks(body);
  else if (draftRoot) article.blocks = extractDraftBlocks(draftRoot);
  if (!article.blocks.length) article.partial = true;
  return article;
}
