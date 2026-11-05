/** Immutable Google Drive snapshots; a mode change starts a new generation, preserving history. */
import { canonicalData, stableStringify, type SyncResult } from '@/sync/engine';
import { decryptText, encryptText } from '@/sync/crypto';
import {
  decodeGoogleSnapshot,
  encodeGoogleSnapshot,
  type GoogleEncryptionMode,
  type GoogleSnapshotPayload,
} from '@/sync/google-snapshot';
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

interface SnapshotWithMeta extends GoogleSnapshotPayload {
  id: string;
  createdTime: string;
}

interface DriveState {
  active: SnapshotWithMeta[];
  epoch: string | null;
  mode: GoogleEncryptionMode | null;
}

async function readState(store: GoogleSnapshotStore): Promise<DriveState> {
  const files = (await store.list()).sort(
    (a, b) => (a.createdTime ?? '').localeCompare(b.createdTime ?? '') || a.id.localeCompare(b.id),
  );
  const all: SnapshotWithMeta[] = [];
  for (const file of files) {
    const decoded = decodeGoogleSnapshot(await store.read(file.id));
    all.push({ ...decoded, id: file.id, createdTime: file.createdTime ?? '' });
  }
  // The last root marks a deliberately selected encryption mode. Previous generations
  // are retained on Drive for recovery, but must not be silently merged back in.
  const rootIndex = all.findLastIndex((snapshot) => snapshot.root);
  if (rootIndex >= 0) {
    const root = all[rootIndex]!;
    const active = all.slice(rootIndex).filter((snapshot) => snapshot.epoch === root.epoch);
    return { active, epoch: root.epoch, mode: root.mode };
  }
  if (!all.length) return { active: [], epoch: null, mode: null };
  if (all.some((snapshot) => !snapshot.legacy))
    throw new Error(
      'Sauvegarde Drive sans génération initiale : vérification manuelle nécessaire.',
    );
  return { active: all, epoch: 'legacy', mode: 'encrypted' };
}

/** Detect an existing library without choosing a weaker mode on the user's behalf. */
export async function inspectGoogleDrive(store: GoogleSnapshotStore = webStore): Promise<{
  mode: GoogleEncryptionMode | null;
  hasSnapshots: boolean;
}> {
  const remote = await readState(store);
  return { mode: remote.mode, hasSnapshots: remote.active.length > 0 };
}

export async function syncGoogleDrive(opts: {
  mode?: GoogleEncryptionMode;
  passphrase?: string;
  db?: ThreadShelfDB;
  appVersion?: string;
  store?: GoogleSnapshotStore;
  deviceId?: string;
}): Promise<SyncResult> {
  const db = opts.db ?? getDb();
  const store = opts.store ?? webStore;
  const remote = await readState(store);
  const mode = opts.mode ?? remote.mode;
  if (!mode)
    throw new Error('Choisissez la protection de Google Drive avant la première synchronisation.');
  if (remote.mode && remote.mode !== mode)
    throw new Error(
      'La protection du Drive a changé. Rechargez la page pour retrouver son mode actuel.',
    );
  if (mode === 'encrypted' && (opts.passphrase?.length ?? 0) < 8)
    throw new Error('Saisissez une phrase secrète de 8 caractères minimum pour Google Drive.');

  const hashes = new Set<string>();
  const totals = { added: 0, updated: 0, deleted: 0, changed: new Set<string>() };
  for (const snapshot of remote.active) {
    if (snapshot.mode !== mode)
      throw new Error('Plusieurs modes de protection incompatibles ont été trouvés sur Drive.');
    const plain =
      mode === 'encrypted' ? await decryptText(snapshot.data, opts.passphrase) : snapshot.data;
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
    branch: mode === 'encrypted' ? 'encrypted-snapshots' : 'standard-snapshots',
    changedEntryIds: [...totals.changed],
    at: Date.now(),
  };
  if (hashes.has(digest)) return { ...base, pushed: false, created: false };

  const plain = stableStringify({ ...backup, data: canonical });
  const data = mode === 'encrypted' ? await encryptText(plain, opts.passphrase!) : plain;
  const text = encodeGoogleSnapshot({
    epoch: remote.epoch && remote.epoch !== 'legacy' ? remote.epoch : crypto.randomUUID(),
    mode,
    root: remote.active.length === 0,
    data,
  });
  // If this account has legacy ciphertext, keep writing its legacy format until
  // the user explicitly changes mode and creates a new generation.
  await store.write(
    opts.deviceId ?? deviceId(),
    crypto.randomUUID(),
    remote.epoch === 'legacy' ? data : text,
  );
  return { ...base, pushed: true, created: remote.active.length === 0 };
}

/** A deliberate mode migration. Old Drive snapshots are never deleted automatically. */
export async function changeGoogleDriveMode(opts: {
  to: GoogleEncryptionMode;
  currentPassphrase?: string;
  newPassphrase?: string;
  db?: ThreadShelfDB;
  store?: GoogleSnapshotStore;
  deviceId?: string;
}): Promise<void> {
  const db = opts.db ?? getDb();
  const store = opts.store ?? webStore;
  const remote = await readState(store);
  if (!remote.mode) throw new Error('Choisissez d’abord le mode initial de Google Drive.');
  if (remote.mode === opts.to) return;
  if (opts.to === 'encrypted' && (opts.newPassphrase?.length ?? 0) < 8)
    throw new Error('La nouvelle phrase secrète doit contenir au moins 8 caractères.');

  // Decrypt and merge the current generation before switching, otherwise a second
  // device could lose its edits during a mode change.
  await syncGoogleDrive({
    mode: remote.mode,
    passphrase: opts.currentPassphrase,
    db,
    store,
    deviceId: opts.deviceId,
  });
  const latest = await readState(store);
  if (latest.epoch !== remote.epoch)
    throw new Error('La génération Drive a changé pendant la migration. Recommencez.');
  const backup = await exportLibrary({ db });
  const plain = stableStringify({ ...backup, data: canonicalData(backup.data) });
  const data = opts.to === 'encrypted' ? await encryptText(plain, opts.newPassphrase!) : plain;
  await store.write(
    opts.deviceId ?? deviceId(),
    crypto.randomUUID(),
    encodeGoogleSnapshot({ epoch: crypto.randomUUID(), mode: opts.to, root: true, data }),
  );
}
