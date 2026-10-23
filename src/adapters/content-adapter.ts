/**
 * Contract for site extractors. ThreadShelf ships two adapters: X / Twitter and Reddit. Others
 * (Mastodon, Bluesky, Threads…) can be added by implementing this interface — the thread engine,
 * storage, reader and exports only depend on the shared model in `@/types/model`.
 */
import type { PageScan } from '@/extraction/types';
import type { Platform, Tweet } from '@/types/model';

export interface ActionSlot {
  /** Container the per-post ThreadShelf button is appended to. */
  container: Element;
  /** `slot` attribute to give the button so a web component's shadow DOM renders it. */
  slot?: string;
}

export interface ContentAdapter {
  /** Stable identifier, stored with captured records. */
  readonly id: Platform;
  readonly label: string;
  /** Hostnames this adapter handles. */
  readonly hosts: readonly string[];
  /** Whether the adapter can run on this URL. */
  matches(url: URL): boolean;
  /** Canonical URL of a post, or null if the URL is not a post. */
  normalizePostUrl(input: string): string | null;
  /** ID of the post (or comment) a URL points to, if any. */
  routeId(url: string): string | null;
  /** Read-only scan of what is rendered in the document, in visual order. */
  scan(doc: Document, url: string): PageScan;
  /** Live element of a post, for UI injection. */
  findPostElement(doc: Document, id: string): Element | null;
  /** Where a per-post action can be added without hiding native controls. */
  actionSlot(postElement: Element): ActionSlot | null;
  /** Element after which the capture bar of the focal post is inserted. */
  barAnchor(postElement: Element): Element | null;
  /** Page theme, when the site exposes it. */
  tone?(doc: Document): 'light' | 'dark' | null;
}

export type AdapterPost = Tweet;
