import { parseXRoute } from '@/utils/url';
import { classicStrategy, extractClassicArticle } from './classic';
import { looksLikeTombstone, textOf } from './dom';
import type { LayoutStrategy, PageScan, ScannedCell, XLayout } from './types';
import { extractXdsArticle, isTopLevelArticle, xdsStrategy, type ArticleExtraction } from './xds';

export type { PageScan, ScannedCell, XLayout } from './types';
export { extractRichText } from './rich-text';

export const STRATEGIES: LayoutStrategy[] = [classicStrategy, xdsStrategy];

export function detectLayout(root: ParentNode): XLayout | 'unknown' {
  for (const s of STRATEGIES) if (s.detect(root)) return s.id;
  return 'unknown';
}

export function strategyFor(layout: XLayout): LayoutStrategy {
  return layout === 'classic' ? classicStrategy : xdsStrategy;
}

/** Cache so unchanged articles are not re-extracted on every mutation batch. */
export type ExtractionCache = WeakMap<Element, { sig: string; result: ArticleExtraction }>;

function signature(el: Element): string {
  // Cheap fingerprint: text length + number of media/links. Changes when X re-renders content.
  const text = el.textContent ?? '';
  return `${text.length}:${el.getElementsByTagName('img').length}:${el.getElementsByTagName('a').length}:${text.slice(0, 64)}`;
}

export function extractArticle(
  article: Element,
  layout: XLayout,
  cache?: ExtractionCache,
  now = Date.now(),
): ArticleExtraction {
  const sig = cache ? signature(article) : '';
  const hit = cache?.get(article);
  if (hit && hit.sig === sig) return hit.result;
  const result =
    layout === 'classic'
      ? extractClassicArticle(article, { now })
      : extractXdsArticle(article, { now });
  cache?.set(article, { sig, result });
  return result;
}

function translateY(el: Element): number | null {
  const t = (el as HTMLElement).style?.transform ?? '';
  const m = /translateY\((-?\d+(?:\.\d+)?)px\)/.exec(t);
  return m ? Number(m[1]) : null;
}

/** Ordered list rows for the classic layout (virtualised list cells). */
function classicRows(doc: ParentNode): Element[] {
  const scope = (doc as Document).querySelector?.('[data-testid="primaryColumn"]') ?? doc;
  const cells = Array.from(scope.querySelectorAll('[data-testid="cellInnerDiv"]'));
  if (cells.length === 0) return classicStrategy.listItems(doc);
  const ys = cells.map(translateY);
  if (ys.every((y) => y !== null)) {
    return cells
      .map((c, i) => ({ c, y: ys[i]! }))
      .sort((a, b) => a.y - b.y)
      .map((x) => x.c);
  }
  return cells;
}

/** Ordered list rows for the new layout: <li> of the list holding the most posts. */
function xdsRows(doc: ParentNode): { rows: Element[]; standalone: Element[] } {
  const scope = (doc as Document).querySelector?.('main') ?? doc;
  const articles = Array.from(scope.querySelectorAll('article')).filter(isTopLevelArticle);
  const lists = new Map<Element, number>();
  for (const a of articles) {
    const li = a.closest('li');
    const ul = li?.parentElement;
    if (ul) lists.set(ul, (lists.get(ul) ?? 0) + 1);
  }
  const best = [...lists.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!best) return { rows: articles, standalone: [] };
  const rows = Array.from(best.children).filter((c) => c.tagName === 'LI');
  const standalone = articles.filter((a) => !best.contains(a));
  return { rows, standalone };
}

function rowToCell(
  row: Element,
  layout: XLayout,
  cache: ExtractionCache | undefined,
  now: number,
): ScannedCell | null {
  const article =
    row.tagName === 'ARTICLE'
      ? row
      : Array.from(row.querySelectorAll('article')).find(isTopLevelArticle);
  if (article) {
    const ex = extractArticle(article, layout, cache, now);
    if (!ex.tweet) {
      return looksLikeTombstone(article)
        ? {
            kind: 'tombstone',
            connectorAbove: ex.connectors.above,
            connectorBelow: ex.connectors.below,
            isFocal: false,
            element: article,
          }
        : null;
    }
    return {
      kind: 'tweet',
      tweet: ex.tweet,
      quoted: ex.quoted,
      connectorAbove: ex.connectors.above,
      connectorBelow: ex.connectors.below,
      isFocal: false,
      element: article,
    };
  }
  if (looksLikeTombstone(row))
    return {
      kind: 'tombstone',
      connectorAbove: false,
      connectorBelow: false,
      isFocal: false,
      element: row,
    };
  // Non-empty, non-post rows ("Show more replies", headings, composer) break adjacency.
  if (textOf(row))
    return {
      kind: 'gap',
      connectorAbove: false,
      connectorBelow: false,
      isFocal: false,
      element: row,
    };
  return null;
}

/**
 * Reads the posts currently rendered in the page, in visual order, with thread connectors.
 * Pure DOM read — never clicks, scrolls or fetches anything.
 */
export function scanPage(
  doc: Document | ParentNode,
  pageUrl: string,
  cache?: ExtractionCache,
  now = Date.now(),
): PageScan {
  const route = parseXRoute(pageUrl);
  const layout = detectLayout(doc);
  const scan: PageScan = {
    layout,
    pageUrl,
    route,
    cells: [],
    connectorsSeen: false,
    scannedAt: now,
  };
  if (layout === 'unknown') return scan;

  let rows: Element[];
  let standalone: Element[] = [];
  if (layout === 'classic') rows = classicRows(doc);
  else ({ rows, standalone } = xdsRows(doc));

  const cells: ScannedCell[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const cell = rowToCell(row, layout, cache, now);
    if (!cell) continue;
    if (cell.tweet) {
      if (seen.has(cell.tweet.id)) continue;
      seen.add(cell.tweet.id);
    }
    cells.push(cell);
  }
  // Posts rendered outside the main list (e.g. a duplicated focal post) — no adjacency information.
  const extras: ScannedCell[] = [];
  for (const a of standalone) {
    const cell = rowToCell(a, layout, cache, now);
    if (cell?.tweet && !seen.has(cell.tweet.id)) {
      seen.add(cell.tweet.id);
      extras.push({ ...cell, connectorAbove: false, connectorBelow: false });
    }
  }
  if (extras.length)
    cells.unshift(...extras.map((c) => c), {
      kind: 'gap',
      connectorAbove: false,
      connectorBelow: false,
      isFocal: false,
    });

  if (route.kind === 'status') {
    for (const c of cells) {
      if (c.tweet?.id === route.id) {
        c.isFocal = true;
        scan.focalId = route.id;
      }
    }
  }
  scan.cells = cells;
  scan.connectorsSeen = cells.some((c) => c.connectorAbove || c.connectorBelow);
  return scan;
}

/** Live element of a post in the page (content script helper). */
export function findArticleById(doc: Document, id: string, layout: XLayout): Element | null {
  const strategy = strategyFor(layout);
  for (const a of strategy.listItems(doc)) {
    const ex = extractArticle(a, layout);
    if (ex.tweet?.id === id) return a;
  }
  return null;
}
