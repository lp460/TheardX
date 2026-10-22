/**
 * Background side of the GitHub sync: sign-in (device flow), one sync at a time, periodic alarm,
 * "sync soon" after local changes, persisted status for the settings page.
 */
import Dexie from 'dexie';
import { loadSettings, updateSettings } from '@/settings/store';
import { cacheEntryMedia } from '@/storage/media-cache';
import {
  pollDeviceToken,
  refreshUserToken,
  requestDeviceCode,
  type DeviceCode,
} from '@/sync/device-flow';
import { connectGitHub, runSync, type SyncResult } from '@/sync/engine';
import { GITHUB_OAUTH_CLIENT_ID } from '@/sync/github-app';
import { clearToken, loadSecrets, saveSecrets } from '@/sync/secrets';

/** Hosts used by the sync: sign-in (github.com) and the REST API (api.github.com). */
export const GITHUB_ORIGINS = ['https://github.com/*', 'https://api.github.com/*'];
const STATE_KEY = 'threadshelf.sync.state';
const DEVICE_KEY = 'threadshelf.sync.device';
const ALARM = 'threadshelf-sync';
const ALARM_SOON = 'threadshelf-sync-soon';

export interface SyncStatus {
  running: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  lastResult: Pick<
    SyncResult,
    'added' | 'updated' | 'deleted' | 'pushed' | 'repo' | 'branch'
  > | null;
  /** Connected GitHub account and repository. */
  account: { login: string; repo: string; repoUrl: string } | null;
}

const EMPTY: SyncStatus = {
  running: false,
  lastSyncAt: null,
  lastError: null,
  lastResult: null,
  account: null,
};

export async function loadSyncStatus(): Promise<SyncStatus> {
  const v = (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] as
    Partial<SyncStatus> | undefined;
  return { ...EMPTY, ...v, running: inFlight !== null };
}

async function saveStatus(patch: Partial<SyncStatus>): Promise<SyncStatus> {
  const next = { ...(await loadSyncStatus()), ...patch };
  await chrome.storage.local.set({ [STATE_KEY]: next });
  return next;
}

async function hasPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: GITHUB_ORIGINS });
  } catch {
    return false;
  }
}

async function clientId(): Promise<string> {
  const settings = await loadSettings();
  return settings.sync.oauthClientId.trim() || GITHUB_OAUTH_CLIENT_ID;
}

let inFlight: Promise<SyncStatus> | null = null;

/** Current credentials; an expiring token (if the GitHub app issues them) is renewed first. */
async function credentials() {
  const sec = await loadSecrets();
  if (sec.tokenExpiresAt && sec.tokenExpiresAt - 60_000 <= Date.now()) {
    if (!sec.refreshToken) {
      throw new Error(
        'La connexion GitHub a expiré. Dans l’application GitHub « ThreadShelf », décochez « Expire user access tokens », puis reconnectez-vous.',
      );
    }
    const fresh = await refreshUserToken(await clientId(), sec.refreshToken);
    const next = {
      ...sec,
      token: fresh.token,
      refreshToken: fresh.refreshToken,
      tokenExpiresAt: fresh.expiresAt,
    };
    await saveSecrets(next);
    return next;
  }
  return sec;
}

/** Runs a sync (or joins the one in progress). Never throws: errors are stored in the status. */
export function syncNow(): Promise<SyncStatus> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const settings = await loadSettings();
    if (!settings.sync.enabled)
      return saveStatus({ lastError: 'La synchronisation est désactivée.' });
    if (!(await hasPermission()))
      return saveStatus({
        lastError: 'Accès à GitHub non autorisé : reconnectez-vous dans les paramètres.',
      });
    await saveStatus({ running: true });
    try {
      const result = await runSync({
        config: {
          repo: settings.sync.repo,
          filePath: settings.sync.filePath,
          encrypt: settings.sync.encrypt,
        },
        secrets: await credentials(),
        appVersion: chrome.runtime.getManifest().version,
      });
      if (settings.cacheMedia) {
        for (const id of result.changedEntryIds.slice(0, 200)) {
          void cacheEntryMedia(id, { maxBytes: settings.maxMediaMB * 1024 * 1024 }).catch(
            () => undefined,
          );
        }
      }
      const { added, updated, deleted, pushed, repo, branch } = result;
      return await saveStatus({
        lastSyncAt: result.at,
        lastError: null,
        lastResult: { added, updated, deleted, pushed, repo, branch },
      });
    } catch (e) {
      return saveStatus({ lastError: e instanceof Error ? e.message : String(e) });
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight.then((s) => ({ ...s, running: false }));
}

/* ------------------------------------------------------------------ sign-in (device flow) ------------------------------------------------------------------ */

export interface DeviceStart {
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  interval: number;
}

/** Step 1: ask GitHub for a code to show to the user. The pending state survives worker restarts. */
export async function syncDeviceStart(): Promise<DeviceStart> {
  if (!(await hasPermission())) throw new Error('Accès à GitHub non autorisé.');
  const id = await clientId();
  if (!id)
    throw new Error(
      'L’application GitHub « ThreadShelf » n’est pas encore déclarée (voir la configuration unique).',
    );
  const code = await requestDeviceCode(id);
  await chrome.storage.session.set({ [DEVICE_KEY]: code });
  return {
    userCode: code.userCode,
    verificationUri: code.verificationUri,
    expiresAt: code.expiresAt,
    interval: code.interval,
  };
}

export type DevicePoll =
  { state: 'pending'; interval: number } | { state: 'connected'; status: SyncStatus };

/**
 * Step 2, called by the settings page every few seconds: once the user has authorised, finish the
 * setup — private repository found or created, sync enabled, first sync.
 */
export async function syncDevicePoll(
  input: { encrypt?: boolean; passphrase?: string } = {},
): Promise<DevicePoll> {
  const code = (await chrome.storage.session.get(DEVICE_KEY))[DEVICE_KEY] as DeviceCode | undefined;
  if (!code) throw new Error('Aucune connexion en cours : relancez « Se connecter avec GitHub ».');
  if (Date.now() > code.expiresAt) {
    await chrome.storage.session.remove(DEVICE_KEY);
    throw new Error('Le code a expiré : relancez la connexion.');
  }
  let result;
  try {
    result = await pollDeviceToken(await clientId(), code);
  } catch (e) {
    await chrome.storage.session.remove(DEVICE_KEY);
    throw e;
  }
  if (result.status === 'pending') {
    if (result.interval !== code.interval) {
      await chrome.storage.session.set({ [DEVICE_KEY]: { ...code, interval: result.interval } });
    }
    return { state: 'pending', interval: result.interval };
  }
  await chrome.storage.session.remove(DEVICE_KEY);
  const connected = await connectGitHub(result.token);
  await saveSecrets({
    token: result.token,
    refreshToken: result.refreshToken,
    tokenExpiresAt: result.expiresAt,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {}),
  });
  await updateSettings({
    sync: {
      enabled: true,
      repo: connected.repo,
      ...(input.encrypt !== undefined ? { encrypt: input.encrypt } : {}),
    },
  });
  await saveStatus({
    account: { login: connected.login, repo: connected.repo, repoUrl: connected.repoUrl },
    lastError: null,
  });
  await scheduleSync();
  return { state: 'connected', status: await syncNow() };
}

export async function syncDisconnect(): Promise<SyncStatus> {
  await clearToken();
  await chrome.storage.session.remove(DEVICE_KEY);
  await updateSettings({ sync: { enabled: false } });
  await scheduleSync();
  return saveStatus({ ...EMPTY });
}

/* ------------------------------------------------------------------ scheduling ------------------------------------------------------------------ */

/** Creates or clears the periodic alarm according to the settings. */
export async function scheduleSync(): Promise<void> {
  if (!chrome.alarms) return;
  const settings = await loadSettings();
  if (!settings.sync.enabled) {
    await chrome.alarms.clear(ALARM);
    await chrome.alarms.clear(ALARM_SOON);
    return;
  }
  const existing = await chrome.alarms.get(ALARM);
  if (!existing || existing.periodInMinutes !== settings.sync.intervalMin) {
    await chrome.alarms.create(ALARM, {
      delayInMinutes: 1,
      periodInMinutes: settings.sync.intervalMin,
    });
  }
}

/** Debounced sync about a minute after the library changed. */
async function syncSoon(): Promise<void> {
  if (inFlight || !chrome.alarms) return;
  const settings = await loadSettings();
  if (settings.sync.enabled) await chrome.alarms.create(ALARM_SOON, { delayInMinutes: 1 });
}

export function installSyncService(): void {
  chrome.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM || alarm.name === ALARM_SOON) void syncNow();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['threadshelf.settings']) void scheduleSync();
  });
  // Library changes from any extension context (pages, this worker) schedule a sync.
  Dexie.on('storagemutated', () => {
    void syncSoon();
  });
  chrome.runtime.onStartup?.addListener(() => {
    void scheduleSync();
    void syncNow();
  });
  chrome.runtime.onInstalled.addListener(() => void scheduleSync());
  void scheduleSync();
}
