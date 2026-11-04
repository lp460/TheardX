import type { Annotation } from '@/types/model';

export type TextAnchor = Pick<Annotation, 'exact' | 'prefix' | 'suffix' | 'start' | 'end'>;

/** Selectors use both character positions and quoted context so re-captured text can move. */
export function resolveTextAnchor(text: string, anchor: TextAnchor): { start: number; end: number } | null {
  const { exact, prefix, suffix } = anchor;
  if (!exact || exact.length > 12_000) return null;
  let at = text.indexOf(exact);
  let best: { start: number; end: number; score: number } | null = null;
  let ambiguous = false;
  while (at !== -1) {
    const before = text.slice(Math.max(0, at - prefix.length), at);
    const after = text.slice(at + exact.length, at + exact.length + suffix.length);
    let score = 0;
    for (let i = 1; i <= Math.min(before.length, prefix.length); i++) {
      if (before[before.length - i] !== prefix[prefix.length - i]) break;
      score++;
    }
    for (let i = 0; i < Math.min(after.length, suffix.length); i++) {
      if (after[i] !== suffix[i]) break;
      score++;
    }
    if (!best || score > best.score) {
      best = { start: at, end: at + exact.length, score };
      ambiguous = false;
    } else if (score === best.score) ambiguous = true;
    at = text.indexOf(exact, at + 1);
  }
  // Never guess between two identical passages. Keep the note and flag it as unattached.
  if (!best || ambiguous) return null;
  return { start: best.start, end: best.end };
}

/** A single post's DOM is the stable unit of selection, including long-form articles. */
export function anchorFromSelection(selection: Selection): { tweetId: string; anchor: TextAnchor; rect: DOMRect } | null {
  if (selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const startNode = range.startContainer.nodeType === Node.TEXT_NODE
    ? range.startContainer.parentElement : range.startContainer as Element;
  const root = startNode?.closest<HTMLElement>('[data-annotation-tweet]');
  if (!root || !root.contains(range.endContainer)) return null;
  const tweetId = root.dataset.annotationTweet;
  if (!tweetId) return null;
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.cloneContents().textContent?.length ?? 0;
  const exact = range.cloneContents().textContent ?? '';
  if (!exact.trim() || exact.length > 12_000) return null;
  const text = root.textContent ?? '';
  const end = start + exact.length;
  return {
    tweetId,
    anchor: {
      exact,
      prefix: text.slice(Math.max(0, start - 64), start),
      suffix: text.slice(end, end + 64),
      start,
      end,
    },
    rect: range.getBoundingClientRect(),
  };
}

export function rangeForAnchor(root: HTMLElement, anchor: TextAnchor): Range | null {
  const match = resolveTextAnchor(root.textContent ?? '', anchor);
  if (!match) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  let at = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;
  while ((node = walker.nextNode() as Text | null)) {
    const limit = at + node.data.length;
    if (!startNode && match.start >= at && match.start <= limit) {
      startNode = node;
      startOffset = match.start - at;
    }
    if (match.end >= at && match.end <= limit) {
      endNode = node;
      endOffset = match.end - at;
      break;
    }
    at = limit;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}
