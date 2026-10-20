/**
 * Thread connector detection.
 *
 * X draws a thin vertical line in the avatar column between posts of the same conversation chain.
 * We detect these lines structurally (not with class-name hashes):
 *   1. a thin element (≤ 3px wide) with a background, living next to the avatar;
 *   2. its direction is read from positioning tokens / inline style (new layout), from geometry when
 *      layout information is available, and finally from DOM order (classic layout).
 */

export interface ConnectorState {
  above: boolean;
  below: boolean;
  /** Number of thin line elements recognised (diagnostics). */
  lines: number;
}

const THIN_CLASS_RE = /(^|\s)w-(px|0\.5|\[[1-3](\.\d+)?px\])(\s|$)/;
const BG_CLASS_RE = /(^|\s)(bg-|before:bg-)/;

function inlinePx(el: Element, prop: string): number | null {
  const style = (el as HTMLElement).style;
  if (!style) return null;
  const v = style.getPropertyValue(prop);
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && v.trim().endsWith('px') ? n : null;
}

function hasBackground(el: Element): boolean {
  const cls = el.getAttribute('class') ?? '';
  if (BG_CLASS_RE.test(cls)) return true;
  const style = (el as HTMLElement).style;
  if (style && (style.backgroundColor || style.background)) return true;
  const view = el.ownerDocument?.defaultView;
  if (view) {
    const bg = view.getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(bg)) return true;
  }
  return false;
}

export function isThinLine(el: Element): boolean {
  if (el.children.length > 0) return false;
  if ((el.textContent ?? '').trim()) return false;
  const cls = el.getAttribute('class') ?? '';
  let thin = THIN_CLASS_RE.test(cls);
  if (!thin) {
    const w = inlinePx(el, 'width');
    if (w !== null) thin = w > 0 && w <= 3;
  }
  if (!thin) {
    // Real browsers: computed width (classic layout uses atomic CSS classes).
    const rect = (el as HTMLElement).getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.width <= 3 && rect.height >= 4) thin = true;
  }
  return thin && hasBackground(el);
}

type Direction = 'above' | 'below' | 'both' | null;

function directionFromTokens(el: Element): Direction {
  const cls = ` ${el.getAttribute('class') ?? ''} `;
  const style = (el as HTMLElement).style;
  const topNeg = /\s-top-/.test(cls) || (style?.top ?? '').trim().startsWith('-');
  const topPos = /\s(top-(?!0\s)[\w.[\]-]+)\s/.test(cls) || /^\d/.test(style?.top ?? '');
  const hasBottom = /\s-?bottom-/.test(cls) || !!style?.bottom;
  const hasHeight = /\sh-/.test(cls) || !!style?.height;
  if (topNeg && hasBottom) return 'both';
  if (topNeg && !hasBottom) return 'above';
  if ((topPos || /\stop-0\s/.test(cls)) && hasBottom && !topNeg) {
    // top-0 + bottom-*: spans the whole column; top-N (N>0): starts under the avatar.
    return /\stop-0\s/.test(cls) ? 'both' : 'below';
  }
  if (hasBottom && hasHeight && !topPos) return 'below';
  return null;
}

function directionFromGeometry(el: Element, avatar: Element): Direction {
  const r = (el as HTMLElement).getBoundingClientRect?.();
  const a = (avatar as HTMLElement).getBoundingClientRect?.();
  if (!r || !a || r.height <= 0 || a.height <= 0) return null;
  const above = r.top < a.top - 1;
  const below = r.bottom > a.bottom + 1;
  if (above && below) return 'both';
  if (above) return 'above';
  if (below) return 'below';
  return null;
}

function directionFromOrder(el: Element, avatar: Element): Direction {
  const pos = avatar.compareDocumentPosition(el);
  if (pos & 2 /* PRECEDING */) return 'above';
  if (pos & 4 /* FOLLOWING */) return 'below';
  return null;
}

/**
 * Finds connector lines for one post.
 * @param scope the element holding avatar + its column (usually the article)
 * @param avatar the avatar link / image of the post's author
 * @param exclude nested quoted-post containers to ignore
 */
export function detectConnectors(
  scope: Element,
  avatar: Element | null,
  exclude: Element[] = [],
): ConnectorState {
  const state: ConnectorState = { above: false, below: false, lines: 0 };
  if (!avatar) return state;
  const candidates = Array.from(scope.querySelectorAll('div, span')).filter(
    (el) => !exclude.some((q) => q.contains(el)) && isThinLine(el),
  );
  for (const el of candidates) {
    // Must belong to the avatar column: not inside the text/content column.
    if (el.closest('[dir="auto"], [data-testid="tweetText"], [data-testid="User-Name"]')) continue;
    const isAbsolute =
      /(^|\s)absolute(\s|$)/.test(el.getAttribute('class') ?? '') ||
      (el as HTMLElement).style?.position === 'absolute';
    const dir =
      directionFromTokens(el) ??
      directionFromGeometry(el, avatar) ??
      (isAbsolute ? null : directionFromOrder(el, avatar));
    if (!dir) continue;
    state.lines += 1;
    if (dir === 'above' || dir === 'both') state.above = true;
    if (dir === 'below' || dir === 'both') state.below = true;
  }
  return state;
}
