// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loadSettings } from '@/settings/store';
import { loadSecrets } from '@/sync/secrets';
import {
  loadSyncStatus,
  syncGoogleChangeMode,
  syncGoogleConnect,
  syncGoogleInspect,
} from '@/background/sync-service';

const google = vi.hoisted(() => ({
  mode: null as 'plain' | 'encrypted' | null,
  failMigration: false,
  sync: vi.fn(),
  migrate: vi.fn(),
}));

vi.mock('@/sync/google-extension', () => ({
  hasGoogleOAuthClient: () => true,
  hasGoogleBrowserOAuthClient: () => true,
  GOOGLE_ORIGINS: ['https://www.googleapis.com/*'],
  GOOGLE_BROWSER_ORIGINS: ['https://www.googleapis.com/*', 'https://preview.example/*'],
  disconnectGoogleExtension: vi.fn(async () => undefined),
  googleExtensionStore: {},
  connectGoogleExtension: vi.fn(async () => ({
    email: 'lorry@example.com',
    subject: '12345678901234567890',
  })),
}));

vi.mock('@/web/google-sync', () => ({
  inspectGoogleDrive: vi.fn(async () => ({ mode: google.mode, hasSnapshots: !!google.mode })),
  syncGoogleDrive: google.sync,
  changeGoogleDriveMode: google.migrate,
}));

let data: Map<string, unknown>;
beforeEach(() => {
  google.mode = null;
  google.failMigration = false;
  google.sync.mockReset().mockImplementation(async (input: { mode: 'plain' | 'encrypted' }) => {
    if (google.mode && google.mode !== input.mode) throw new Error('protection incompatible');
    google.mode = input.mode;
    return {
      added: 0,
      updated: 0,
      deleted: 0,
      pushed: true,
      repo: 'Google Drive / TheardX',
      branch: input.mode,
      changedEntryIds: [],
      at: Date.now(),
    };
  });
  google.migrate.mockReset().mockImplementation(async (input: { to: 'plain' | 'encrypted' }) => {
    if (google.failMigration) throw new Error('phrase incorrecte');
    google.mode = input.to;
  });
  data = new Map();
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: '1.2.0' }) },
    permissions: { contains: vi.fn(async () => true) },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: data.get(key) }),
        set: async (entry: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(entry)) data.set(key, value);
        },
        remove: async (key: string) => data.delete(key),
      },
      session: { remove: vi.fn(async () => undefined) },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('Google Drive extension sync mode', () => {
  it('inspects existing protection without silently selecting or writing a mode', async () => {
    expect(await syncGoogleInspect()).toEqual({ email: 'lorry@example.com', mode: null });
    expect(google.sync).not.toHaveBeenCalled();
    google.mode = 'encrypted';
    expect((await syncGoogleInspect()).mode).toBe('encrypted');
    expect(google.sync).not.toHaveBeenCalled();
  });

  it('connects and syncs a new standard Drive without a passphrase', async () => {
    const status = await syncGoogleConnect({ mode: 'plain' });
    expect(status.lastError).toBeNull();
    expect((await loadSettings()).sync).toMatchObject({
      provider: 'google',
      enabled: true,
      encrypt: false,
    });
    expect((await loadSecrets()).googlePassphrase).toBe('');
    expect(google.sync).toHaveBeenCalledWith(expect.objectContaining({ mode: 'plain' }));
  });

  it('rejects an incompatible mode before modifying account settings or Drive', async () => {
    google.mode = 'encrypted';
    await expect(syncGoogleConnect({ mode: 'plain' })).rejects.toThrow('protection Google Drive');
    expect((await loadSettings()).sync.provider).toBe('github');
    expect(google.sync).not.toHaveBeenCalled();
  });

  it('requires the existing encrypted passphrase and never degrades protection', async () => {
    google.mode = 'encrypted';
    await expect(syncGoogleConnect({ mode: 'encrypted' })).rejects.toThrow('phrase secrète');
    await syncGoogleConnect({ mode: 'encrypted', passphrase: 'strong-passphrase-2026' });
    expect((await loadSettings()).sync.encrypt).toBe(true);
    expect((await loadSecrets()).googlePassphrase).toBe('strong-passphrase-2026');
    expect(google.sync).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'encrypted',
        passphrase: 'strong-passphrase-2026',
      }),
    );
  });

  it('changes mode only on explicit request, retaining settings if migration fails', async () => {
    await syncGoogleConnect({ mode: 'plain' });
    google.failMigration = true;
    await expect(
      syncGoogleChangeMode({ mode: 'encrypted', passphrase: 'strong-passphrase-2026' }),
    ).rejects.toThrow('phrase incorrecte');
    expect((await loadSettings()).sync.encrypt).toBe(false);
    expect((await loadSyncStatus()).running).toBe(false);
    google.failMigration = false;
    await syncGoogleChangeMode({ mode: 'encrypted', passphrase: 'strong-passphrase-2026' });
    expect((await loadSettings()).sync.encrypt).toBe(true);
    expect((await loadSecrets()).googlePassphrase).toBe('strong-passphrase-2026');
    expect(google.migrate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'encrypted',
        newPassphrase: 'strong-passphrase-2026',
      }),
    );
  });
});
