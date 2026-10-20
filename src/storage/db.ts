import Dexie, { type Table } from 'dexie';
import type { Category, Collection, Entry, MediaRecord, Relation, Tweet } from '@/types/model';

export const DB_NAME = 'threadshelf';
/** Current schema version. Bump together with a new entry in SCHEMA_VERSIONS. */
export const SCHEMA_VERSION = 2;

export interface MetaRecord {
  key: string;
  value: unknown;
}

/** Tweet as stored: handle duplicated in lower case for indexing. */
export type StoredTweet = Tweet & { authorKey: string };

/**
 * Versioned schema. Each version lists the full store definitions and an optional upgrade function.
 * Never edit a released version — add a new one.
 */
export const SCHEMA_VERSIONS: {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: import('dexie').Transaction) => Promise<void> | void;
}[] = [
  {
    version: 1,
    stores: {
      tweets: 'id, authorKey, createdAt, lastSeenAt',
      entries:
        'id, kind, focalTweetId, *tweetIds, authorHandle, savedAt, updatedAt, publishedAt, readState, categoryId, *tags, *collectionIds',
      relations: 'id, parentId, childId, type',
      collections: 'id, name, order',
      categories: 'id, name',
      meta: 'key',
    },
  },
  {
    // v2 — offline media cache. Existing entries are marked text-only until their media is cached.
    version: 2,
    stores: {
      media: 'url, *tweetIds, status',
    },
    upgrade: async (tx) => {
      await tx
        .table('entries')
        .toCollection()
        .modify((e: Partial<Entry>) => {
          if (!e.offline) e.offline = 'text-only';
          if (!Array.isArray(e.externalRefs)) e.externalRefs = [];
          if (typeof e.readProgress !== 'number') e.readProgress = 0;
        });
    },
  },
];

export class ThreadShelfDB extends Dexie {
  tweets!: Table<StoredTweet, string>;
  entries!: Table<Entry, string>;
  relations!: Table<Relation, string>;
  collections!: Table<Collection, string>;
  categories!: Table<Category, string>;
  media!: Table<MediaRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = DB_NAME) {
    super(name);
    for (const v of SCHEMA_VERSIONS) {
      const def = this.version(v.version).stores(v.stores);
      if (v.upgrade) def.upgrade(v.upgrade);
    }
  }
}

let instance: ThreadShelfDB | null = null;

export function getDb(): ThreadShelfDB {
  if (!instance) instance = new ThreadShelfDB();
  return instance;
}

/** Test helper: use a specific database instance. */
export function setDb(db: ThreadShelfDB | null): void {
  instance = db;
}

export function toStoredTweet(t: Tweet): StoredTweet {
  return { ...t, authorKey: t.author.handle.toLowerCase() };
}

export function fromStoredTweet(t: StoredTweet): Tweet {
  const { authorKey: _ignored, ...rest } = t;
  return rest;
}
