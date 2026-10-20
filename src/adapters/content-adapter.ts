/**
 * Contract for site extractors. ThreadShelf ships one adapter (X / Twitter); others (Mastodon,
 * Bluesky, Threads, LinkedIn…) can be added later by implementing this interface — the thread
 * engine, storage, reader and exports only depend on the shared model in `@/types/model`.
 */
import type { PageScan } from '@/extraction/types';
import type { Tweet } from '@/types/model';

export interface ContentAdapter {
  /** Stable identifier, stored with captured records. */
  readonly id: string;
  readonly label: string;
  /** Hostnames (without www.) this adapter handles. */
  readonly hosts: readonly string[];
  /** Whether the adapter can run on this URL. */
  matches(url: URL): boolean;
  /** Canonical URL of a post, or null if the URL is not a post. */
  normalizePostUrl(input: string): string | null;
  /** Read-only scan of what is rendered in the document, in visual order. */
  scan(doc: Document, url: string): PageScan;
  /** Live element of a post, for UI injection. */
  findPostElement(doc: Document, id: string): Element | null;
  /** Element after which a per-post action can be appended without hiding native controls. */
  actionAnchor(postElement: Element): Element | null;
}

export type AdapterPost = Tweet;
