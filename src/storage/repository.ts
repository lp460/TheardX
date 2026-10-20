/**
 * Library repository: the only module that writes to IndexedDB.
 * Every multi-table write runs in a single Dexie transaction, so a failure leaves no partial state.
 */
import { planCapture, ThreadGraph, mergeTweet, type CaptureMode } from '@/thread-engine';
import { captureSummary } from '@/thread-engine/labels';
import type {
  Category,
  Collection,
  Entry,
  EntryBundle,
  MediaRecord,
  Relation,
  ThreadFacts,
  Tweet,
} from '@/types/model';
import { uid } from '@/utils/id';
import { deriveTitle, segmentsToPlain } from '@/utils/text';
import { canonicalTweetUrl } from '@/utils/url';
import { fromStoredTweet, getDb, toStoredTweet, type ThreadShelfDB } from './db';
import { buildSearchText } from './search';

export interface CaptureOptions {
  entryId?: string;
  collectionId?: string;
  categoryId?: string | null;
  tags?: string[];
  note?: string;
  readLater?: boolean;
}

export interface CaptureInput {
  mode: CaptureMode;
  focalId: string;
  tweets: Tweet[];
  relations: Relation[];
  facts?: Record<string, ThreadFacts>;
  selection?: string[];
  pageUrl: string;
  pageKind?: string;
  options?: CaptureOptions;
}

export interface SaveResult {
  entry: Entry;
  created: boolean;
  count: number;
  message: string;
}

const PALETTE = [
  '#7c6cf2',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#8b5cf6',
  '#64748b',
];

export function pickColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

function normalizeTags(tags: string[] | undefined): string[] {
  return [
    ...new Set((tags ?? []).map((t) => t.trim().replace(/^#/, '').slice(0, 64)).filter(Boolean)),
  ];
}

function hasMedia(tweets: Tweet[]): boolean {
  return tweets.some((t) => t.media.length > 0 || (t.quoted?.media?.length ?? 0) > 0);
}

export class Repository {
  constructor(private readonly dbFactory: () => ThreadShelfDB = getDb) {}

  get db(): ThreadShelfDB {
    return this.dbFactory();
  }

  /* ------------------------------------------------------------------ capture ------------------------------------------------------------------ */

  async saveCapture(input: CaptureInput, now = Date.now()): Promise<SaveResult> {
    const db = this.db;
    return db.transaction(
      'rw',
      [db.tweets, db.relations, db.entries, db.collections, db.categories],
      async () => {
        const incomingIds = input.tweets.map((t) => t.id);
        if (!incomingIds.includes(input.focalId))
          throw new Error('The focal post is missing from the capture.');

        // 1. Graph = stored evidence around these posts + incoming evidence.
        const graph = new ThreadGraph();
        let candidateEntries: Entry[] = [];
        if (input.mode === 'thread') {
          candidateEntries = (
            await db.entries.where('tweetIds').anyOf(incomingIds).toArray()
          ).filter((e) => e.kind === 'thread');
        }
        const knownIds = new Set([
          ...incomingIds,
          ...candidateEntries.flatMap((e) => [...e.tweetIds, ...e.contextTweetIds]),
        ]);
        const stored = (await db.tweets.bulkGet([...knownIds])).filter(
          (t): t is NonNullable<typeof t> => !!t,
        );
        for (const t of stored) graph.addTweet(fromStoredTweet(t));
        const storedRelations = await db.relations
          .where('childId')
          .anyOf([...knownIds])
          .toArray();
        const storedRelations2 = await db.relations
          .where('parentId')
          .anyOf([...knownIds])
          .toArray();
        graph.merge({ tweets: [], relations: [...storedRelations, ...storedRelations2] });
        graph.merge({ tweets: input.tweets, relations: input.relations });
        for (const [id, f] of Object.entries(input.facts ?? {})) graph.setFacts(id, f);

        // 2. Plan the entry content with the thread engine.
        const plan = planCapture(graph, input.mode, input.focalId, {
          selection: input.selection,
          pageKind: input.pageKind,
          now,
        });
        if (plan.tweetIds.length === 0) throw new Error('Nothing to save.');

        // 3. Find the entry to update (no duplicates for the same content).
        let target: Entry | undefined;
        if (input.options?.entryId) target = await db.entries.get(input.options.entryId);
        if (!target) {
          if (input.mode === 'thread') {
            const ids = new Set(plan.tweetIds);
            target =
              candidateEntries.find((e) => e.tweetIds.includes(input.focalId)) ??
              candidateEntries.find((e) => e.tweetIds.some((id) => ids.has(id)));
          } else if (input.mode === 'tweet' || input.mode === 'references') {
            target = (await db.entries.where('focalTweetId').equals(input.focalId).toArray()).find(
              (e) => e.kind === input.mode,
            );
          }
        }

        // 4. Persist the posts the entry needs (never other people's replies that are not part of it).
        const needed = [
          ...new Set([...plan.tweetIds, ...plan.contextTweetIds, ...plan.referenceTweetIds]),
        ];
        const tweets = new Map<string, Tweet>();
        for (const id of needed) {
          const t = graph.tweets.get(id);
          if (t) tweets.set(id, t);
        }
        const existing = await db.tweets.bulkGet(needed);
        const toWrite = needed
          .map((id, i) => {
            const t = tweets.get(id);
            if (!t) return null;
            const prev = existing[i];
            return toStoredTweet(prev ? mergeTweet(fromStoredTweet(prev), t) : t);
          })
          .filter((t): t is NonNullable<typeof t> => !!t);
        await db.tweets.bulkPut(toWrite);
        for (const t of toWrite) tweets.set(t.id, fromStoredTweet(t));
        const neededSet = new Set(needed);
        const relations = [...graph.relations.values()].filter(
          (r) => neededSet.has(r.parentId) && neededSet.has(r.childId),
        );
        if (relations.length) await db.relations.bulkPut(relations);

        // 5. Create or update the entry.
        const ordered = plan.tweetIds.map((id) => tweets.get(id)!).filter(Boolean);
        const first = ordered[0]!;
        const focal = tweets.get(input.focalId) ?? first;
        const opts = input.options ?? {};
        if (opts.categoryId) {
          const cat = await db.categories.get(opts.categoryId);
          if (!cat) throw new Error('Unknown category.');
        }
        if (opts.collectionId) {
          const col = await db.collections.get(opts.collectionId);
          if (!col) throw new Error('Unknown collection.');
        }
        const created = !target;
        const base: Entry = target ?? {
          id: uid('e'),
          kind: plan.kind,
          title: '',
          authorHandle: focal.author.handle,
          focalTweetId: input.focalId,
          tweetIds: [],
          contextTweetIds: [],
          referenceTweetIds: [],
          externalRefs: [],
          completeness: plan.completeness,
          sourceUrl: canonicalTweetUrl(input.focalId, focal.author.handle),
          savedAt: now,
          updatedAt: now,
          readState: 'unread',
          readLater: false,
          favorite: false,
          readProgress: 0,
          categoryId: null,
          tags: [],
          collectionIds: [],
          note: '',
          offline: 'text-only',
          searchText: '',
        };
        const autoTitle =
          deriveTitle(segmentsToPlain(first.text)) || `Publication de @${first.author.handle}`;
        const entry: Entry = {
          ...base,
          kind: plan.kind,
          tweetIds: plan.tweetIds,
          contextTweetIds: plan.contextTweetIds,
          referenceTweetIds: plan.referenceTweetIds,
          externalRefs: plan.externalRefs,
          completeness: plan.completeness,
          authorHandle: first.author.handle,
          updatedAt: now,
          title: base.title && !created ? base.title : autoTitle,
          tags: normalizeTags([...base.tags, ...(opts.tags ?? [])]),
          collectionIds:
            opts.collectionId && !base.collectionIds.includes(opts.collectionId)
              ? [...base.collectionIds, opts.collectionId]
              : base.collectionIds,
          categoryId: opts.categoryId !== undefined ? opts.categoryId : base.categoryId,
          note: opts.note !== undefined && opts.note.trim() ? opts.note : base.note,
          readLater: opts.readLater ?? base.readLater,
        };
        if (first.author.name) entry.authorName = first.author.name;
        if (first.createdAt) entry.publishedAt = first.createdAt;
        if (created) entry.offline = hasMedia([...tweets.values()]) ? 'text-only' : 'full';
        else if (
          hasMedia([...tweets.values()]) &&
          entry.offline === 'full' &&
          plan.tweetIds.length !== base.tweetIds.length
        )
          entry.offline = 'partial';
        entry.searchText = buildSearchText(entry, tweets);
        await db.entries.put(entry);
        return {
          entry,
          created,
          count: entry.tweetIds.length,
          message: captureSummary(entry.tweetIds.length, entry.completeness, entry.kind),
        };
      },
    );
  }

  /* ------------------------------------------------------------------ reading ------------------------------------------------------------------ */

  async listEntries(): Promise<Entry[]> {
    return this.db.entries.orderBy('savedAt').reverse().toArray();
  }

  async getEntry(id: string): Promise<Entry | undefined> {
    return this.db.entries.get(id);
  }

  async getBundle(id: string): Promise<EntryBundle | null> {
    const db = this.db;
    const entry = await db.entries.get(id);
    if (!entry) return null;
    const ids = [
      ...new Set([...entry.tweetIds, ...entry.contextTweetIds, ...entry.referenceTweetIds]),
    ];
    const rows = await db.tweets.bulkGet(ids);
    const tweets: Record<string, Tweet> = {};
    for (const r of rows) if (r) tweets[r.id] = fromStoredTweet(r);
    const relations = await db.relations.where('childId').anyOf(ids).toArray();
    const mediaRows = await db.media.where('tweetIds').anyOf(ids).toArray();
    const media: Record<string, MediaRecord> = {};
    for (const m of mediaRows) media[m.url] = m;
    return { entry, tweets, relations, media };
  }

  async getTweets(ids: string[]): Promise<Record<string, Tweet>> {
    const rows = await this.db.tweets.bulkGet(ids);
    const out: Record<string, Tweet> = {};
    for (const r of rows) if (r) out[r.id] = fromStoredTweet(r);
    return out;
  }

  /** Which of these posts are already saved, and in which entries. */
  async savedStatus(
    tweetIds: string[],
  ): Promise<Record<string, { entryId: string; kind: Entry['kind'] }[]>> {
    const entries = await this.db.entries.where('tweetIds').anyOf(tweetIds).toArray();
    const out: Record<string, { entryId: string; kind: Entry['kind'] }[]> = {};
    const wanted = new Set(tweetIds);
    for (const e of entries) {
      for (const id of e.tweetIds) {
        if (!wanted.has(id)) continue;
        (out[id] ??= []).push({ entryId: e.id, kind: e.kind });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ updates ------------------------------------------------------------------ */

  async updateEntry(
    id: string,
    patch: Partial<
      Pick<
        Entry,
        | 'title'
        | 'readState'
        | 'readLater'
        | 'favorite'
        | 'readProgress'
        | 'lastReadAt'
        | 'categoryId'
        | 'tags'
        | 'collectionIds'
        | 'note'
      >
    >,
    now = Date.now(),
  ): Promise<Entry> {
    const db = this.db;
    return db.transaction(
      'rw',
      [db.entries, db.tweets, db.categories, db.collections],
      async () => {
        const entry = await db.entries.get(id);
        if (!entry) throw new Error('Entry not found.');
        const next: Entry = { ...entry, ...patch, updatedAt: now };
        if (patch.tags) next.tags = normalizeTags(patch.tags);
        if (patch.title !== undefined) next.title = patch.title.trim().slice(0, 500) || entry.title;
        if (patch.readProgress !== undefined)
          next.readProgress = Math.min(1, Math.max(0, patch.readProgress));
        if (patch.categoryId) {
          if (!(await db.categories.get(patch.categoryId))) throw new Error('Unknown category.');
        }
        if (patch.collectionIds) {
          const found = await db.collections.bulkGet(patch.collectionIds);
          next.collectionIds = patch.collectionIds.filter((_, i) => !!found[i]);
        }
        if (patch.title !== undefined || patch.tags || patch.note !== undefined) {
          const tweets = await this.getTweets([
            ...next.tweetIds,
            ...next.contextTweetIds,
            ...next.referenceTweetIds,
          ]);
          next.searchText = buildSearchText(next, tweets);
        }
        await db.entries.put(next);
        return next;
      },
    );
  }

  async bulkUpdate(
    ids: string[],
    patch: Parameters<Repository['updateEntry']>[1],
  ): Promise<number> {
    let n = 0;
    for (const id of ids) {
      await this.updateEntry(id, patch);
      n += 1;
    }
    return n;
  }

  async addToCollection(ids: string[], collectionId: string): Promise<void> {
    const db = this.db;
    await db.transaction('rw', [db.entries, db.collections], async () => {
      if (!(await db.collections.get(collectionId))) throw new Error('Unknown collection.');
      const entries = (await db.entries.bulkGet(ids)).filter((e): e is Entry => !!e);
      await db.entries.bulkPut(
        entries.map((e) =>
          e.collectionIds.includes(collectionId)
            ? e
            : { ...e, collectionIds: [...e.collectionIds, collectionId], updatedAt: Date.now() },
        ),
      );
    });
  }

  /** Deletes entries and garbage-collects posts, relations and media no longer referenced. */
  async deleteEntries(ids: string[]): Promise<number> {
    const db = this.db;
    return db.transaction('rw', [db.entries, db.tweets, db.relations, db.media], async () => {
      const removed = (await db.entries.bulkGet(ids)).filter((e): e is Entry => !!e);
      if (!removed.length) return 0;
      await db.entries.bulkDelete(removed.map((e) => e.id));
      const candidates = new Set(
        removed.flatMap((e) => [...e.tweetIds, ...e.contextTweetIds, ...e.referenceTweetIds]),
      );
      const stillUsed = new Set<string>();
      await db.entries.each((e) => {
        for (const id of [...e.tweetIds, ...e.contextTweetIds, ...e.referenceTweetIds])
          if (candidates.has(id)) stillUsed.add(id);
      });
      const orphan = [...candidates].filter((id) => !stillUsed.has(id));
      if (orphan.length) {
        await db.tweets.bulkDelete(orphan);
        await db.relations.where('childId').anyOf(orphan).delete();
        await db.relations.where('parentId').anyOf(orphan).delete();
        const orphanSet = new Set(orphan);
        const media = await db.media.where('tweetIds').anyOf(orphan).toArray();
        for (const m of media) {
          const rest = m.tweetIds.filter((t) => !orphanSet.has(t));
          if (rest.length) await db.media.put({ ...m, tweetIds: rest });
          else await db.media.delete(m.url);
        }
      }
      return removed.length;
    });
  }

  /* ------------------------------------------------------------------ collections & categories ------------------------------------------------------------------ */

  async listCollections(): Promise<Collection[]> {
    return this.db.collections.orderBy('order').toArray();
  }

  async createCollection(name: string, color?: string): Promise<Collection> {
    const clean = name.trim().slice(0, 120);
    if (!clean) throw new Error('Name required.');
    const db = this.db;
    const existing = (await db.collections.toArray()).find(
      (c) => c.name.toLowerCase() === clean.toLowerCase(),
    );
    if (existing) return existing;
    const now = Date.now();
    const order = (await db.collections.count()) + 1;
    const c: Collection = {
      id: uid('c'),
      name: clean,
      color: color ?? pickColor(clean),
      createdAt: now,
      updatedAt: now,
      order,
    };
    await db.collections.add(c);
    return c;
  }

  async renameCollection(id: string, name: string): Promise<void> {
    const clean = name.trim().slice(0, 120);
    if (!clean) throw new Error('Name required.');
    await this.db.collections.update(id, { name: clean, updatedAt: Date.now() });
  }

  async deleteCollection(id: string): Promise<void> {
    const db = this.db;
    await db.transaction('rw', [db.collections, db.entries], async () => {
      await db.collections.delete(id);
      const affected = await db.entries.where('collectionIds').equals(id).toArray();
      await db.entries.bulkPut(
        affected.map((e) => ({ ...e, collectionIds: e.collectionIds.filter((c) => c !== id) })),
      );
    });
  }

  async listCategories(): Promise<Category[]> {
    return this.db.categories.orderBy('name').toArray();
  }

  async createCategory(name: string, color?: string): Promise<Category> {
    const clean = name.trim().slice(0, 80);
    if (!clean) throw new Error('Name required.');
    const existing = (await this.db.categories.toArray()).find(
      (c) => c.name.toLowerCase() === clean.toLowerCase(),
    );
    if (existing) return existing;
    const c: Category = {
      id: uid('k'),
      name: clean,
      color: color ?? pickColor(clean),
      createdAt: Date.now(),
    };
    await this.db.categories.add(c);
    return c;
  }

  async deleteCategory(id: string): Promise<void> {
    const db = this.db;
    await db.transaction('rw', [db.categories, db.entries], async () => {
      await db.categories.delete(id);
      const affected = await db.entries.where('categoryId').equals(id).toArray();
      await db.entries.bulkPut(affected.map((e) => ({ ...e, categoryId: null })));
    });
  }

  async listTags(): Promise<{ tag: string; count: number }[]> {
    const counts = new Map<string, number>();
    await this.db.entries.each((e) =>
      e.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)),
    );
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  /* ------------------------------------------------------------------ duplicates ------------------------------------------------------------------ */

  /**
   * Groups of entries that overlap: same post saved in several entries (e.g. a single-post save that is
   * also part of a saved thread). Manual selections are intentional and only grouped when identical.
   */
  async findDuplicates(): Promise<Entry[][]> {
    const entries = await this.listEntries();
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      while (parent.get(x) !== x) x = parent.get(x)!;
      return x;
    };
    const union = (a: string, b: string) => parent.set(find(a), find(b));
    entries.forEach((e) => parent.set(e.id, e.id));
    const owner = new Map<string, string>();
    for (const e of entries) {
      const ids = e.kind === 'selection' ? [e.tweetIds.join(',')] : e.tweetIds;
      for (const id of ids) {
        const o = owner.get(id);
        if (o) union(e.id, o);
        else owner.set(id, e.id);
      }
    }
    const groups = new Map<string, Entry[]>();
    for (const e of entries) {
      const root = find(e.id);
      groups.set(root, [...(groups.get(root) ?? []), e]);
    }
    return [...groups.values()].filter((g) => g.length > 1);
  }

  /* ------------------------------------------------------------------ media ------------------------------------------------------------------ */

  async storageUsage(): Promise<{
    usage: number;
    quota: number;
    entries: number;
    tweets: number;
    mediaBytes: number;
  }> {
    const db = this.db;
    let usage = 0;
    let quota = 0;
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usage = est.usage ?? 0;
      quota = est.quota ?? 0;
    }
    let mediaBytes = 0;
    await db.media.each((m) => {
      mediaBytes += m.bytes ?? 0;
    });
    return {
      usage,
      quota,
      entries: await db.entries.count(),
      tweets: await db.tweets.count(),
      mediaBytes,
    };
  }

  async clearAll(): Promise<void> {
    const db = this.db;
    await db.transaction(
      'rw',
      [db.entries, db.tweets, db.relations, db.media, db.collections, db.categories],
      async () => {
        await Promise.all([
          db.entries.clear(),
          db.tweets.clear(),
          db.relations.clear(),
          db.media.clear(),
          db.collections.clear(),
          db.categories.clear(),
        ]);
      },
    );
  }
}

export const repository = new Repository();
