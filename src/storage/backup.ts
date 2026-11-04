/**
 * Full-library backup (JSON) and transactional import with validation and conflict handling.
 */
import { z } from 'zod';
import { mergeTweet } from '@/thread-engine';
import type { Annotation, Category, Collection, Entry, MediaRecord, Relation, Tweet } from '@/types/model';
import { parseSettings, type Settings } from '@/settings/schema';
import { fromStoredTweet, getDb, SCHEMA_VERSION, toStoredTweet, type ThreadShelfDB } from './db';
import { buildSearchText } from './search';
import { Repository } from './repository';
import {
  categorySchema,
  collectionSchema,
  entrySchema,
  relationSchema,
  tweetSchema,
} from './validation';
import { isAllowedMediaUrl } from '@/utils/url';
import {
  tombstoneKey,
  isDeleted,
  mergeTombstones,
  readTombstones,
  TOMBSTONES_KEY,
  type Tombstones,
} from './tombstones';

export const BACKUP_FORMAT = 'threadshelf.backup';
export const BACKUP_VERSION = 2;
const MAX_IMPORT_BYTES = 300 * 1024 * 1024;

export interface BackupMedia {
  url: string;
  kind: MediaRecord['kind'];
  mime: string;
  tweetIds: string[];
  data: string; // base64
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  data: {
    entries: Entry[];
    tweets: Tweet[];
    relations: Relation[];
    collections: Collection[];
    categories: Category[];
    annotations: Annotation[];
    settings?: Settings;
    media?: BackupMedia[];
    /** Deletion markers (`entry:<id>` → time), so deletions propagate between devices. */
    tombstones?: Tombstones;
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToBlob(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportLibrary(
  opts: {
    includeMedia?: boolean;
    settings?: Settings;
    appVersion?: string;
    db?: ThreadShelfDB;
    entryIds?: string[];
  } = {},
): Promise<Backup> {
  const db = opts.db ?? getDb();
  let entries = await db.entries.toArray();
  if (opts.entryIds) {
    const wanted = new Set(opts.entryIds);
    entries = entries.filter((e) => wanted.has(e.id));
  }
  const ids = new Set(
    entries.flatMap((e) => [...e.tweetIds, ...e.contextTweetIds, ...e.referenceTweetIds]),
  );
  const tweets = (await db.tweets.bulkGet([...ids]))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map(fromStoredTweet);
  const relations = (await db.relations.toArray()).filter(
    (r) => ids.has(r.parentId) && ids.has(r.childId),
  );
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: opts.appVersion ?? '0.0.0',
    exportedAt: new Date().toISOString(),
    data: {
      entries: entries.map(({ searchText: _s, ...e }) => ({ ...e, searchText: '' })),
      tweets,
      relations,
      collections: await db.collections.toArray(),
      categories: await db.categories.toArray(),
      annotations: opts.entryIds
        ? (await db.annotations.toArray()).filter((a) => opts.entryIds!.includes(a.entryId))
        : await db.annotations.toArray(),
    },
  };
  if (!opts.entryIds) {
    const tombstones = await readTombstones(db);
    if (Object.keys(tombstones).length) backup.data.tombstones = tombstones;
  }
  if (opts.settings) backup.data.settings = opts.settings;
  if (opts.includeMedia) {
    const media: BackupMedia[] = [];
    for (const m of await db.media
      .where('tweetIds')
      .anyOf([...ids])
      .toArray()) {
      if (m.status !== 'cached' || !m.blob) continue;
      media.push({
        url: m.url,
        kind: m.kind,
        mime: m.mime ?? m.blob.type,
        tweetIds: m.tweetIds,
        data: await blobToBase64(m.blob),
      });
    }
    backup.data.media = media;
  }
  return backup;
}

export interface ImportReport {
  entries: { added: number; updated: number; skipped: number };
  tweets: number;
  collections: number;
  categories: number;
  media: number;
  invalid: number;
  conflicts: number;
  /** Local items removed because another device deleted them. */
  deleted: number;
  warnings: string[];
  settings?: Settings;
  /** IDs of entries added or updated (e.g. to cache their images). */
  changedEntryIds: string[];
}

export class ImportError extends Error {}

const envelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1),
  schemaVersion: z.number().int().min(1),
  appVersion: z.string().max(40).optional(),
  exportedAt: z.string().max(40).optional(),
  data: z.object({
    entries: z.array(z.unknown()).max(100_000),
    tweets: z.array(z.unknown()).max(1_000_000),
    relations: z.array(z.unknown()).max(2_000_000).default([]),
    collections: z.array(z.unknown()).max(10_000).default([]),
    categories: z.array(z.unknown()).max(10_000).default([]),
    annotations: z.array(z.unknown()).max(200_000).default([]),
    settings: z.unknown().optional(),
    media: z.array(z.unknown()).max(200_000).optional(),
    tombstones: z
      .record(
        z.string().regex(/^(entry|collection|category|annotation):[\w-]{1,100}$/),
        z.number().nonnegative(),
      )
      .optional(),
  }),
});

const mediaSchema = z.object({
  url: z.string().max(2_000).refine(isAllowedMediaUrl),
  kind: z.enum(['photo', 'video', 'gif', 'avatar', 'card']),
  mime: z.string().regex(/^image\/[\w.+-]+$/),
  tweetIds: z.array(z.string().regex(/^\d{1,25}$/)).max(1_000),
  data: z
    .string()
    .max(70_000_000)
    .regex(/^[A-Za-z0-9+/=]*$/),
});

const annotationSchema = z.object({
  id: z.string().regex(/^a_[\w-]{1,100}$/),
  entryId: z.string().min(1).max(120),
  tweetId: z.string().min(1).max(100),
  exact: z.string().min(1).max(12_000),
  prefix: z.string().max(150),
  suffix: z.string().max(150),
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  color: z.enum(['yellow', 'green', 'pink', 'blue']),
  comment: z.string().max(20_000),
  resolved: z.boolean(),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
}).refine((a) => a.end > a.start);

function validItems<T>(
  items: unknown[],
  schema: z.ZodType<T>,
  report: ImportReport,
  label: string,
): T[] {
  const out: T[] = [];
  let bad = 0;
  for (const item of items) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
    else bad += 1;
  }
  if (bad) {
    report.invalid += bad;
    report.warnings.push(`${bad} ${label} invalide(s) ignoré(e)s.`);
  }
  return out;
}

/** Parses and validates a backup file without writing anything. */
export function parseBackup(text: string): {
  backup: z.infer<typeof envelopeSchema>;
  size: number;
} {
  if (text.length > MAX_IMPORT_BYTES) throw new ImportError('Fichier trop volumineux.');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImportError('Le fichier n’est pas un JSON valide.');
  }
  const env = envelopeSchema.safeParse(json);
  if (!env.success)
    throw new ImportError('Ce fichier n’est pas une sauvegarde ThreadShelf reconnue.');
  if (env.data.version > BACKUP_VERSION)
    throw new ImportError('Sauvegarde créée par une version plus récente de ThreadShelf.');
  return { backup: env.data, size: text.length };
}

/**
 * Imports a backup in a single IndexedDB transaction: either everything valid is written or nothing.
 * - merge (default): keeps existing data; for the same entry, the most recently updated version wins.
 * - replace: clears the library first (inside the same transaction).
 * - sync: like merge, but the most recent version wins entirely (tags removed elsewhere stay removed),
 *   renames of collections/categories propagate, and entry IDs converge between devices.
 * Deletion markers are applied in every mode.
 */
export async function importLibrary(
  text: string,
  opts: { strategy?: 'merge' | 'replace' | 'sync'; db?: ThreadShelfDB } = {},
): Promise<ImportReport> {
  const db = opts.db ?? getDb();
  const { backup } = parseBackup(text);
  const report: ImportReport = {
    entries: { added: 0, updated: 0, skipped: 0 },
    tweets: 0,
    collections: 0,
    categories: 0,
    media: 0,
    invalid: 0,
    conflicts: 0,
    deleted: 0,
    warnings: [],
    changedEntryIds: [],
  };

  const tweets = validItems(backup.data.tweets, tweetSchema, report, 'publication(s)') as Tweet[];
  const relations = validItems(
    backup.data.relations,
    relationSchema,
    report,
    'relation(s)',
  ) as Relation[];
  const collections = validItems(
    backup.data.collections,
    collectionSchema,
    report,
    'collection(s)',
  ) as Collection[];
  const categories = validItems(
    backup.data.categories,
    categorySchema,
    report,
    'catégorie(s)',
  ) as Category[];
  const annotations = validItems(backup.data.annotations, annotationSchema, report, 'annotation(s)') as Annotation[];
  let entries = validItems(backup.data.entries, entrySchema, report, 'entrée(s)') as Entry[];
  const media = backup.data.media
    ? (validItems(backup.data.media, mediaSchema, report, 'média(s)') as BackupMedia[])
    : [];
  if (backup.data.settings !== undefined) report.settings = parseSettings(backup.data.settings);

  const strategy = opts.strategy ?? 'merge';
  const sync = strategy === 'sync';
  await db.transaction(
    'rw',
    [db.entries, db.tweets, db.relations, db.collections, db.categories, db.media, db.meta, db.annotations],
    async () => {
      // Deletion markers.
      // - sync: union of both sides, then remove locally what another device deleted;
      // - manual import / restore: the restored items win over earlier deletions — they are revived
      //   with a fresh update time so the restore also reaches the other devices.
      const localTombstones = await readTombstones(db);
      const tombstones: Tombstones = sync
        ? mergeTombstones(localTombstones, backup.data.tombstones ?? {})
        : {};
      const revive: Tombstones | null = sync ? null : { ...localTombstones };
      let revived = false;
      const reviveTime = Date.now();
      const reviveKey = (key: string): boolean => {
        if (!revive || revive[key] === undefined) return false;
        delete revive[key];
        revived = true;
        return true;
      };
      if (sync && Object.keys(tombstones).length)
        await db.meta.put({ key: TOMBSTONES_KEY, value: tombstones });
      if (sync && backup.data.tombstones) {
        for (const e of await db.entries.toArray()) {
          if (isDeleted(tombstones, 'entry', e.id, e.updatedAt)) {
            await db.entries.delete(e.id);
            report.deleted += 1;
          }
        }
        for (const c of await db.collections.toArray()) {
          if (isDeleted(tombstones, 'collection', c.id, c.updatedAt)) {
            await db.collections.delete(c.id);
            report.deleted += 1;
          }
        }
        for (const c of await db.categories.toArray()) {
          if (isDeleted(tombstones, 'category', c.id, c.updatedAt ?? c.createdAt)) {
            await db.categories.delete(c.id);
            report.deleted += 1;
          }
        }
        for (const a of await db.annotations.toArray()) {
          if (isDeleted(tombstones, 'annotation', a.id, a.updatedAt) ||
            isDeleted(tombstones, 'entry', a.entryId, a.updatedAt)) {
            await db.annotations.delete(a.id);
          }
        }
      }
      if (strategy === 'replace') {
        await Promise.all([
          db.entries.clear(),
          db.tweets.clear(),
          db.relations.clear(),
          db.collections.clear(),
          db.categories.clear(),
          db.media.clear(),
          db.annotations.clear(),
        ]);
      }

      // Collections / categories: match by id, then by name (avoid duplicates), remap ids.
      const colMap = new Map<string, string>();
      const existingCols = await db.collections.toArray();
      for (const original of collections) {
        if (isDeleted(tombstones, 'collection', original.id, original.updatedAt)) continue;
        const c = reviveKey(tombstoneKey('collection', original.id))
          ? { ...original, updatedAt: reviveTime }
          : original;
        const same =
          existingCols.find((e) => e.id === c.id) ??
          existingCols.find((e) => e.name.toLowerCase() === c.name.toLowerCase());
        if (same) {
          colMap.set(c.id, same.id);
          if (sync && same.id === c.id && c.updatedAt > same.updatedAt) {
            await db.collections.put(c);
            Object.assign(same, c);
          }
        } else {
          await db.collections.put(c);
          existingCols.push(c);
          colMap.set(c.id, c.id);
          report.collections += 1;
        }
      }
      const catMap = new Map<string, string>();
      const existingCats = await db.categories.toArray();
      for (const original of categories) {
        if (
          isDeleted(tombstones, 'category', original.id, original.updatedAt ?? original.createdAt)
        )
          continue;
        const c = reviveKey(tombstoneKey('category', original.id))
          ? { ...original, updatedAt: reviveTime }
          : original;
        const same =
          existingCats.find((e) => e.id === c.id) ??
          existingCats.find((e) => e.name.toLowerCase() === c.name.toLowerCase());
        if (same) {
          catMap.set(c.id, same.id);
          if (
            sync &&
            same.id === c.id &&
            (c.updatedAt ?? c.createdAt) > (same.updatedAt ?? same.createdAt)
          ) {
            await db.categories.put(c);
            Object.assign(same, c);
          }
        } else {
          await db.categories.put(c);
          existingCats.push(c);
          catMap.set(c.id, c.id);
          report.categories += 1;
        }
      }

      // Posts: merged with existing records, never duplicated.
      const tweetMap = new Map<string, Tweet>();
      const stored = await db.tweets.bulkGet(tweets.map((t) => t.id));
      tweets.forEach((t, i) => {
        const prev = stored[i];
        const merged = prev ? mergeTweet(fromStoredTweet(prev), t) : t;
        tweetMap.set(t.id, merged);
      });
      await db.tweets.bulkPut([...tweetMap.values()].map(toStoredTweet));
      report.tweets = tweetMap.size;

      // Entries: referential integrity, then conflict resolution.
      const available = async (ids: string[]) => {
        const missing = ids.filter((id) => !tweetMap.has(id));
        if (!missing.length) return new Set(ids);
        const found = await db.tweets.bulkGet(missing);
        const ok = new Set(ids.filter((id) => tweetMap.has(id)));
        missing.forEach((id, i) => found[i] && ok.add(id));
        return ok;
      };
      const finalEntries: Entry[] = [];
      for (const original of entries) {
        if (isDeleted(tombstones, 'entry', original.id, original.updatedAt)) {
          report.entries.skipped += 1;
          continue;
        }
        const raw = reviveKey(tombstoneKey('entry', original.id))
          ? { ...original, updatedAt: reviveTime }
          : original;
        const ok = await available([
          ...raw.tweetIds,
          ...raw.contextTweetIds,
          ...raw.referenceTweetIds,
        ]);
        const e: Entry = {
          ...raw,
          tweetIds: raw.tweetIds.filter((id) => ok.has(id)),
          contextTweetIds: raw.contextTweetIds.filter((id) => ok.has(id)),
          referenceTweetIds: raw.referenceTweetIds.filter((id) => ok.has(id)),
          collectionIds: raw.collectionIds
            .map((id) => colMap.get(id) ?? (existingCols.some((c) => c.id === id) ? id : ''))
            .filter(Boolean),
          categoryId: raw.categoryId
            ? (catMap.get(raw.categoryId) ??
              (existingCats.some((c) => c.id === raw.categoryId) ? raw.categoryId : null))
            : null,
        };
        if (!e.tweetIds.length) {
          report.entries.skipped += 1;
          report.warnings.push(
            `Entrée « ${raw.title.slice(0, 40)} » ignorée : publications manquantes.`,
          );
          continue;
        }
        if (!e.tweetIds.includes(e.focalTweetId)) e.focalTweetId = e.tweetIds[0]!;
        finalEntries.push(e);
      }
      entries = finalEntries;
      const entryIdMap = new Map<string, string>();
      for (const e of entries) {
        const sameId = await db.entries.get(e.id);
        const sameContent =
          sameId ??
          (e.kind !== 'selection'
            ? (await db.entries.where('focalTweetId').equals(e.focalTweetId).toArray()).find(
                (x) => x.kind === e.kind,
              )
            : undefined);
        const tweetsForSearch: Record<string, Tweet> = {};
        for (const id of [...e.tweetIds, ...e.contextTweetIds, ...e.referenceTweetIds]) {
          const t =
            tweetMap.get(id) ??
            (await db.tweets.get(id).then((x) => (x ? fromStoredTweet(x) : undefined)));
          if (t) tweetsForSearch[id] = t;
        }
        if (sameContent) {
          // The same content saved on two devices under two IDs converges to the smaller ID.
          const canonicalId =
            sync && sameContent.id !== e.id && e.id < sameContent.id ? e.id : sameContent.id;
          entryIdMap.set(e.id, canonicalId);
          const remoteWins = e.updatedAt > sameContent.updatedAt;
          report.conflicts += 1;
          if (remoteWins || canonicalId !== sameContent.id) {
            const base = remoteWins ? e : sameContent;
            const merged: Entry = {
              ...base,
              id: canonicalId,
              tags:
                sync || !remoteWins ? base.tags : [...new Set([...sameContent.tags, ...e.tags])],
              collectionIds:
                sync || !remoteWins
                  ? base.collectionIds
                  : [...new Set([...sameContent.collectionIds, ...e.collectionIds])],
            };
            merged.searchText = buildSearchText(merged, tweetsForSearch);
            if (canonicalId !== sameContent.id) {
              await db.annotations.where('entryId').equals(sameContent.id).modify({ entryId: canonicalId });
              await db.entries.delete(sameContent.id);
            }
            await db.entries.put(merged);
            report.entries.updated += 1;
            report.changedEntryIds.push(merged.id);
          } else {
            report.entries.skipped += 1;
          }
          continue;
        }
        await db.entries.put({ ...e, searchText: buildSearchText(e, tweetsForSearch) });
        entryIdMap.set(e.id, e.id);
        report.entries.added += 1;
        report.changedEntryIds.push(e.id);
      }

      // Each annotation has an independent identity and update clock. Concurrent edits to
      // different highlights cannot overwrite each other when GitHub sync merges the library.
      for (const original of annotations) {
        if (isDeleted(tombstones, 'annotation', original.id, original.updatedAt)) continue;
        const remappedEntryId = entryIdMap.get(original.entryId) ?? original.entryId;
        const entry = await db.entries.get(remappedEntryId);
        if (!entry || !entry.tweetIds.includes(original.tweetId)) continue;
        const a = reviveKey(tombstoneKey('annotation', original.id))
          ? { ...original, entryId: remappedEntryId, updatedAt: reviveTime }
          : { ...original, entryId: remappedEntryId };
        const previous = await db.annotations.get(a.id);
        if (!previous || a.updatedAt > previous.updatedAt) await db.annotations.put(a);
      }

      if (revive && revived) await db.meta.put({ key: TOMBSTONES_KEY, value: revive });

      const knownTweets = new Set([...tweetMap.keys()]);
      const rels = relations.filter(
        (r) => knownTweets.has(r.parentId) && knownTweets.has(r.childId),
      );
      if (rels.length) await db.relations.bulkPut(rels);

      for (const m of media) {
        const blob = base64ToBlob(m.data, m.mime);
        const prev = await db.media.get(m.url);
        await db.media.put({
          url: m.url,
          kind: m.kind,
          mime: m.mime,
          blob,
          bytes: blob.size,
          status: 'cached',
          fetchedAt: Date.now(),
          tweetIds: [...new Set([...(prev?.tweetIds ?? []), ...m.tweetIds])],
        });
        report.media += 1;
      }
    },
  );
  if (report.deleted || report.entries.updated) await new Repository(() => db).collectOrphans();
  return report;
}

/** Single-entry export is safe to hand to another person: personal notes stay private. */
export async function exportEntries(entryIds: string[], db?: ThreadShelfDB): Promise<Backup> {
  const backup = await exportLibrary({ entryIds, db, includeMedia: false });
  backup.data.annotations = [];
  return backup;
}
