import Dexie from 'dexie';
import { runSync, type SyncResult } from '@/sync/engine';
import { isEncrypted } from '@/sync/crypto';
import { DecryptionError } from '@/sync/crypto';
import { WebGitHubClient } from './github-client';
import { changeGoogleDriveMode, inspectGoogleDrive, syncGoogleDrive } from './google-sync';
import type { GoogleEncryptionMode } from '@/sync/google-snapshot';
import type { WebIdentity } from './auth';
import { cacheEntryMedia } from '@/storage/media-cache';
import { loadSettings } from '@/settings/store';
import { repository } from '@/storage/repository';

export type WebSyncState = (
  | { phase: 'idle' | 'running'; lastSyncAt: number | null; error: string | null }
  | {
      phase: 'needs-passphrase' | 'choose-encryption' | 'error';
      lastSyncAt: number | null;
      error: string;
    }
) & { mode?: GoogleEncryptionMode | null };

let state: WebSyncState = { phase: 'idle', lastSyncAt: null, error: null };
const listeners = new Set<(state: WebSyncState) => void>();
let currentIdentity: WebIdentity | null = null;
let passphrase = '';
let googleMode: GoogleEncryptionMode | null = null;
let googleModeKnown = false;
let migrating = false;
let inFlight: Promise<void> | null = null;
let scheduled: ReturnType<typeof setTimeout> | null = null;
let stopCurrent: (() => void) | null = null;

const mediaFetcher = (url: string, init?: RequestInit) =>
  fetch(`/api/media?url=${encodeURIComponent(url)}`, {
    credentials: 'same-origin',
    signal: init?.signal,
  });

export async function downloadWebMedia(): Promise<{
  entries: number;
  cached: number;
  failed: number;
}> {
  if (!navigator.onLine) throw new Error('Connexion Internet requise pour télécharger les images.');
  const settings = await loadSettings();
  const entries = await repository.listEntries();
  const report = { entries: 0, cached: 0, failed: 0 };
  for (const entry of entries) {
    const result = await cacheEntryMedia(entry.id, {
      fetcher: mediaFetcher,
      maxBytes: Math.min(settings.maxMediaMB, 8) * 1024 * 1024,
    });
    report.entries++;
    report.cached += result.cached;
    report.failed += result.failed;
  }
  return report;
}

function emit(next: WebSyncState): void {
  state = { ...next, mode: currentIdentity?.provider === 'google' ? googleMode : null };
  listeners.forEach((fn) => fn(state));
}

export function subscribeSync(fn: (state: WebSyncState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

export function getSyncState(): WebSyncState {
  return state;
}
export function getWebSyncProvider(): 'github' | 'google' | null {
  return currentIdentity?.provider ?? null;
}

export function setWebPassphrase(value: string): void {
  passphrase = value;
  if (currentIdentity) void syncWebNow();
}

/** Called only after the first-login choice has been displayed. */
export function setWebGoogleMode(mode: GoogleEncryptionMode): void {
  if (currentIdentity?.provider !== 'google' || !googleModeKnown || googleMode) return;
  googleMode = mode;
  if (mode === 'encrypted') {
    emit({
      phase: 'needs-passphrase',
      lastSyncAt: state.lastSyncAt,
      error:
        'Vous avez choisi le chiffrement renforcé : définissez une phrase secrète de 8 caractères minimum.',
    });
  } else {
    void syncWebNow();
  }
}

/** Changing modes creates a new Drive generation. Existing backups are not deleted. */
export async function changeWebGoogleMode(
  mode: GoogleEncryptionMode,
  newPassphrase = '',
  oldPassphrase = '',
): Promise<void> {
  if (currentIdentity?.provider !== 'google' || !googleMode || migrating)
    throw new Error('Connexion Google Drive non disponible.');
  if (mode === googleMode) return;
  if (inFlight) await inFlight;
  migrating = true;
  emit({ phase: 'running', lastSyncAt: state.lastSyncAt, error: null });
  try {
    await changeGoogleDriveMode({
      to: mode,
      currentPassphrase: oldPassphrase || passphrase,
      newPassphrase,
    });
    googleMode = mode;
    passphrase = mode === 'encrypted' ? newPassphrase : '';
    emit({ phase: 'idle', lastSyncAt: Date.now(), error: null });
  } catch (error) {
    emit({
      phase: 'error',
      lastSyncAt: state.lastSyncAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    migrating = false;
  }
}

export function syncWebNow(): Promise<void> {
  if (inFlight) return inFlight;
  if (migrating) return Promise.resolve();
  if (!currentIdentity || !navigator.onLine) return Promise.resolve();
  const identity = currentIdentity;
  inFlight = (async () => {
    emit({ phase: 'running', lastSyncAt: state.lastSyncAt, error: null });
    try {
      let result: SyncResult;
      if (identity.provider === 'google') {
        if (!googleModeKnown) {
          const remote = await inspectGoogleDrive();
          if (currentIdentity?.accountId !== identity.accountId) return;
          googleMode = remote.mode;
          googleModeKnown = true;
        }
        if (!googleMode) {
          emit({
            phase: 'choose-encryption',
            lastSyncAt: state.lastSyncAt,
            error: 'Choisissez comment protéger votre bibliothèque sur Google Drive.',
          });
          return;
        }
        if (googleMode === 'encrypted' && passphrase.length < 8) {
          emit({
            phase: 'needs-passphrase',
            lastSyncAt: state.lastSyncAt,
            error: 'Bibliothèque chiffrée : saisissez votre phrase secrète (8 caractères minimum).',
          });
          return;
        }
        result = await syncGoogleDrive({ mode: googleMode, passphrase });
      } else {
        const login = identity.login;
        const client = new WebGitHubClient(login);
        const remote = await client.readFile(
          `${login}/threadshelf-data`,
          'threadshelf/library.json',
          'main',
        );
        const encrypted = !!remote && isEncrypted(remote.text);
        if (encrypted && !passphrase) {
          emit({
            phase: 'needs-passphrase',
            lastSyncAt: state.lastSyncAt,
            error: 'Cette bibliothèque est chiffrée. Saisissez votre phrase secrète.',
          });
          return;
        }
        result = await runSync({
          config: {
            repo: `${login}/threadshelf-data`,
            filePath: 'threadshelf/library.json',
            encrypt: encrypted,
          },
          secrets: { token: '', passphrase },
          client,
        });
      }
      if (currentIdentity?.accountId !== identity.accountId) return;
      emit({ phase: 'idle', lastSyncAt: result.at, error: null });
      const settings = await loadSettings();
      if (settings.cacheMedia) {
        for (const id of result.changedEntryIds.slice(0, 50)) {
          void cacheEntryMedia(id, {
            fetcher: mediaFetcher,
            maxBytes: Math.min(settings.maxMediaMB, 8) * 1024 * 1024,
          }).catch(() => undefined);
        }
      }
    } catch (e) {
      if (currentIdentity?.accountId !== identity.accountId) return;
      emit({
        phase: e instanceof DecryptionError ? 'needs-passphrase' : 'error',
        lastSyncAt: state.lastSyncAt,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function startWebSync(identity: WebIdentity): () => void {
  stopCurrent?.();
  currentIdentity = identity;
  passphrase = '';
  googleMode = null;
  googleModeKnown = false;
  emit({ phase: 'idle', lastSyncAt: null, error: null });
  const soon = () => {
    if (scheduled) clearTimeout(scheduled);
    scheduled = setTimeout(() => {
      scheduled = null;
      void syncWebNow();
    }, 60_000);
  };
  const onOnline = () => void syncWebNow();
  const onVisible = () => {
    if (!document.hidden) void syncWebNow();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  Dexie.on('storagemutated', soon);
  const interval = setInterval(() => void syncWebNow(), 15 * 60_000);
  void syncWebNow();
  const stop = () => {
    if (currentIdentity?.accountId === identity.accountId) currentIdentity = null;
    if (scheduled) clearTimeout(scheduled);
    scheduled = null;
    clearInterval(interval);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', onVisible);
    document.removeEventListener('visibilitychange', onVisible);
    Dexie.on('storagemutated').unsubscribe(soon);
    passphrase = '';
    googleMode = null;
    googleModeKnown = false;
  };
  stopCurrent = stop;
  return stop;
}
