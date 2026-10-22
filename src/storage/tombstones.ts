/**
 * Deletion markers ("tombstones"). Needed for multi-device sync: without them an entry deleted on
 * one PC would come back from another PC's copy. Keys: `entry:<id>`, `collection:<id>`, `category:<id>`.
 */
import type { ThreadShelfDB } from './db';

export const TOMBSTONES_KEY = 'tombstones';

export type TombstoneKind = 'entry' | 'collection' | 'category';
export type Tombstones = Record<string, number>;

export function tombstoneKey(kind: TombstoneKind, id: string): string {
  return `${kind}:${id}`;
}

export async function readTombstones(db: ThreadShelfDB): Promise<Tombstones> {
  const row = await db.meta.get(TOMBSTONES_KEY);
  const value = row?.value;
  if (!value || typeof value !== 'object') return {};
  const out: Tombstones = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (
      /^(entry|collection|category):[\w-]{1,100}$/.test(k) &&
      typeof v === 'number' &&
      Number.isFinite(v)
    )
      out[k] = v;
  }
  return out;
}

/** Must be called inside a transaction that includes `db.meta`. Keeps the latest deletion time. */
export async function addTombstones(
  db: ThreadShelfDB,
  kind: TombstoneKind,
  ids: string[],
  at = Date.now(),
): Promise<void> {
  if (!ids.length) return;
  const current = await readTombstones(db);
  for (const id of ids) {
    const key = tombstoneKey(kind, id);
    current[key] = Math.max(current[key] ?? 0, at);
  }
  await db.meta.put({ key: TOMBSTONES_KEY, value: current });
}

export function mergeTombstones(a: Tombstones, b: Tombstones): Tombstones {
  const out: Tombstones = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

/** An item is deleted if a tombstone exists that is not older than its last update. */
export function isDeleted(
  t: Tombstones,
  kind: TombstoneKind,
  id: string,
  updatedAt: number,
): boolean {
  const at = t[tombstoneKey(kind, id)];
  return at !== undefined && at >= updatedAt;
}
