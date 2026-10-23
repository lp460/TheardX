import type { Tweet } from '@/types/model';
import type { XRoute } from '@/utils/url';

export type XLayout = 'xds' | 'classic';

/** One row of the page's post list, in visual order. */
export interface ScannedCell {
  kind: 'tweet' | 'tombstone' | 'gap';
  tweet?: Tweet;
  /** Posts quoted inside this cell (partial renderings). */
  quoted?: Tweet[];
  /** A thread line connects this cell to the one above. */
  connectorAbove: boolean;
  /** A thread line connects this cell to the one below. */
  connectorBelow: boolean;
  isFocal: boolean;
  /** Parent post / comment given by the site itself (Reddit comment trees). */
  parentId?: string;
  /** Live element (content script only, never serialised). */
  element?: Element;
}

/** What the page says about a Reddit discussion, to judge whether it is fully loaded. */
export interface RedditDiscussionState {
  postId: string;
  /** Number of comments announced by Reddit. */
  announced?: number;
  /** "N more replies" / "More comments" controls currently rendered. */
  moreControls: number;
}

export interface PageScan {
  layout: XLayout | 'reddit' | 'unknown';
  pageUrl: string;
  route: XRoute;
  focalId?: string;
  cells: ScannedCell[];
  /** At least one thread connector was recognised on the page — the connector detector works here. */
  connectorsSeen: boolean;
  scannedAt: number;
  reddit?: RedditDiscussionState;
}

/** Layout-specific DOM strategy. */
export interface LayoutStrategy {
  id: XLayout;
  /** Cheap check: does this document use this layout? */
  detect(root: ParentNode): boolean;
  /** Top-level post elements in visual order, excluding quoted posts. */
  listItems(root: ParentNode): Element[];
  /** Element where ThreadShelf can append its small per-post action (the engagement row). */
  actionRow(article: Element): Element | null;
}
