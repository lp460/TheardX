/**
 * Sync credentials. Stored in chrome.storage.local of this browser only — never in settings, never in
 * exported backups, never synchronised.
 */
const KEY = 'threadshelf.sync.secret';

export interface SyncSecrets {
  /** GitHub OAuth access token obtained with « Se connecter avec GitHub ». */
  token: string;
  passphrase: string;
  /** Set only when the GitHub app issues expiring tokens. */
  refreshToken?: string;
  tokenExpiresAt?: number;
}

let memory: SyncSecrets = { token: '', passphrase: '' };

function area(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
}

export async function loadSecrets(): Promise<SyncSecrets> {
  const a = area();
  if (!a) return memory;
  const v = (await a.get(KEY))[KEY] as Partial<SyncSecrets> | undefined;
  return {
    token: typeof v?.token === 'string' ? v.token : '',
    passphrase: typeof v?.passphrase === 'string' ? v.passphrase : '',
    ...(typeof v?.refreshToken === 'string' ? { refreshToken: v.refreshToken } : {}),
    ...(typeof v?.tokenExpiresAt === 'number' ? { tokenExpiresAt: v.tokenExpiresAt } : {}),
  };
}

export async function saveSecrets(patch: Partial<SyncSecrets>): Promise<void> {
  const next = { ...(await loadSecrets()), ...patch };
  const a = area();
  if (a) await a.set({ [KEY]: next });
  else memory = next;
}

/** Forgets the GitHub connection (keeps the passphrase, which is not a GitHub credential). */
export async function clearToken(): Promise<void> {
  const { passphrase } = await loadSecrets();
  const a = area();
  const next: SyncSecrets = { token: '', passphrase };
  if (a) await a.set({ [KEY]: next });
  else memory = next;
}
