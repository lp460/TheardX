/**
 * Google Drive uses immutable, encrypted snapshots. Each writer creates a unique file,
 * instead of overwriting a shared file without compare-and-swap (lost-update risk).
 * All snapshots are merged through the same tombstone-aware local backup importer.
 */
import { canonicalData, stableStringify, type SyncResult } from '@/sync/engine';
import { decryptText, encryptText, isEncrypted } from '@/sync/crypto';
import { exportLibrary, importLibrary, parseBackup, type Backup } from '@/storage/backup';
import { getDb, type ThreadShelfDB } from '@/storage/db';
import { listGoogleSnapshots, readGoogleSnapshot, writeGoogleSnapshot } from './google-client';
import type { GoogleSnapshot } from './google-client';

export interface GoogleSnapshotStore {
  list(): Promise<GoogleSnapshot[]>;
  read(fileId: string): Promise<string>;
  write(deviceId: string, revisionId: string, text: string): Promise<void>;
}

const webStore: GoogleSnapshotStore = {
  list: listGoogleSnapshots,
  read: readGoogleSnapshot,
  write: writeGoogleSnapshot,
};

const DEVICE_KEY = 'threadshelf.google.device-id';

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function syncGoogleDrive(opts: {
  passphrase: string;
  db?: ThreadShelfDB;
  appVersion?: string;
  store?: GoogleSnapshotStore;
  deviceId?: string;
}): Promise<SyncResult> {
  if (opts.passphrase.length < 8)
    throw new Error('Saisissez une phrase secrète de 8 caractères minimum pour Google Drive.');
  const db = opts.db ?? getDb();
  const store = opts.store ?? webStore;
  const files = await store.list();
  const hashes = new Set<string>();
  const totals = { added: 0, updated: 0, deleted: 0, changed: new Set<string>() };

  for (const file of files) {
    const encrypted = await store.read(file.id);
    if (!isEncrypted(encrypted))
      throw new Error('Une sauvegarde Drive est non chiffrée ou invalide.');
    const plain = await decryptText(encrypted, opts.passphrase);
    const parsed = parseBackup(plain).backup;
    hashes.add(await hash(stableStringify(canonicalData(parsed.data as Partial<Backup['data']>))));
    const report = await importLibrary(plain, { strategy: 'sync', db });
    totals.added += report.entries.added;
    totals.updated += report.entries.updated;
    totals.deleted += report.deleted;
    report.changedEntryIds.forEach((id) => totals.changed.add(id));
  }

  const backup = await exportLibrary({ db, appVersion: opts.appVersion });
  const canonical = canonicalData(backup.data);
  const digest = await hash(stableStringify(canonical));
  const base = {
    ok: true as const,
    added: totals.added,
    updated: totals.updated,
    deleted: totals.deleted,
    repo: 'Google Drive / TheardX',
    branch: 'encrypted-snapshots',
    changedEntryIds: [...totals.changed],
    at: Date.now(),
  };
  if (hashes.has(digest)) return { ...base, pushed: false, created: false };

  const text = stableStringify({
    format: backup.format,
    version: backup.version,
    schemaVersion: backup.schemaVersion,
    appVersion: backup.appVersion,
    exportedAt: backup.exportedAt,
    data: canonical,
  });
  const encrypted = await encryptText(text, opts.passphrase);
  await store.write(opts.deviceId ?? deviceId(), crypto.randomUUID(), encrypted);
  return { ...base, pushed: true, created: files.length === 0 };
}
