/**
 * Library synchronisation through a file in a private GitHub repository.
 *
 *   1. read the remote file (decrypt if needed) and merge it into the local library
 *      (most recent version wins, deletions propagate, no duplicates);
 *   2. export the merged local library (deterministic JSON);
 *   3. push it only if it differs from the remote, with optimistic concurrency (blob sha) —
 *      if another PC pushed in between, start again.
 *
 * Every push is a commit, so the repository also keeps a history of the library.
 * Images and per-device settings are not synchronised: each PC caches images itself.
 */
import { exportLibrary, importLibrary, parseBackup, type Backup } from '@/storage/backup';
import { getDb, type ThreadShelfDB } from '@/storage/db';
import { decryptText, encryptText, isEncrypted } from './crypto';
import {
  DEFAULT_REPO_NAME,
  GitHubClient,
  GitHubConflictError,
  GitHubError,
  type Fetcher,
} from './github';

/** What a sync needs to authenticate and (optionally) decrypt. */
export interface SyncCredentials {
  token: string;
  passphrase: string;
}

export interface SyncConfig {
  /** owner/name */
  repo: string;
  filePath: string;
  encrypt: boolean;
}

export interface SyncResult {
  ok: true;
  added: number;
  updated: number;
  deleted: number;
  pushed: boolean;
  created: boolean;
  repo: string;
  branch: string;
  changedEntryIds: string[];
  at: number;
}

export class SyncError extends Error {}

/** Allows the web PWA to reuse this exact sync/merge engine via an authenticated server API. */
export type SyncClient = Pick<GitHubClient, 'repo' | 'readFile' | 'writeFile'>;

/** JSON with sorted object keys — identical data always gives identical text (and git diffs stay small). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
      );
    }
    return v;
  });
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The synchronised part of a backup, in canonical order. */
export function canonicalData(data: Partial<Backup['data']>): unknown {
  return {
    entries: [...(data.entries ?? [])].map((e) => ({ ...e, searchText: '' })).sort(byId),
    tweets: [...(data.tweets ?? [])].sort(byId),
    relations: [...(data.relations ?? [])].sort(byId),
    collections: [...(data.collections ?? [])].sort(byId),
    categories: [...(data.categories ?? [])].sort(byId),
    tombstones: data.tombstones ?? {},
  };
}

async function sha256(text: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  );
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

function validateConfig(config: SyncConfig, secrets: SyncCredentials, externalClient = false): void {
  if (!/^[\w.-]{1,100}\/[\w.-]{1,100}$/.test(config.repo.trim()))
    throw new SyncError('Connectez d’abord votre compte GitHub.');
  if (!externalClient && !secrets.token.trim()) throw new SyncError('Connectez d’abord votre compte GitHub.');
  if (!/^[\w.-]+(\/[\w.-]+)*\.json$/.test(config.filePath))
    throw new SyncError('Chemin de fichier invalide (doit finir par .json).');
  if (config.encrypt && secrets.passphrase.length < 8)
    throw new SyncError('La phrase secrète doit contenir au moins 8 caractères.');
}

export async function runSync(opts: {
  config: SyncConfig;
  secrets: SyncCredentials;
  db?: ThreadShelfDB;
  fetcher?: Fetcher;
  client?: SyncClient;
  appVersion?: string;
  maxAttempts?: number;
}): Promise<SyncResult> {
  const { config, secrets } = opts;
  validateConfig(config, secrets, !!opts.client);
  const db = opts.db ?? getDb();
  const client = opts.client ?? new GitHubClient(secrets.token, opts.fetcher);
  const repo = await client.repo(config.repo.trim());
  if (!repo.private && !config.encrypt) {
    throw new SyncError(
      `Le dépôt ${repo.full_name} est public : rendez-le privé ou activez le chiffrement.`,
    );
  }
  const branch = repo.default_branch || 'main';
  const total = { added: 0, updated: 0, deleted: 0, changed: new Set<string>() };
  const attempts = opts.maxAttempts ?? 3;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    // 1. Pull + merge.
    const remote = await client.readFile(repo.full_name, config.filePath, branch);
    let remoteHash: string | null = null;
    let remoteEncrypted = false;
    if (remote) {
      remoteEncrypted = isEncrypted(remote.text);
      const plain = remoteEncrypted
        ? await decryptText(remote.text, secrets.passphrase)
        : remote.text;
      const report = await importLibrary(plain, { strategy: 'sync', db });
      total.added += report.entries.added;
      total.updated += report.entries.updated;
      total.deleted += report.deleted;
      report.changedEntryIds.forEach((id) => total.changed.add(id));
      remoteHash = await sha256(
        stableStringify(canonicalData(parseBackup(plain).backup.data as Partial<Backup['data']>)),
      );
    }

    // 2. Export the merged library.
    const local = await exportLibrary({ db, appVersion: opts.appVersion });
    const data = canonicalData(local.data);
    const localHash = await sha256(stableStringify(data));
    const sameEncryption = !remote || remoteEncrypted === config.encrypt;
    const base = {
      ok: true as const,
      added: total.added,
      updated: total.updated,
      deleted: total.deleted,
      repo: repo.full_name,
      branch,
      changedEntryIds: [...total.changed],
      at: Date.now(),
    };
    if (remote && remoteHash === localHash && sameEncryption)
      return { ...base, pushed: false, created: false };

    // 3. Push.
    const doc = stableStringify({
      format: local.format,
      version: local.version,
      schemaVersion: local.schemaVersion,
      appVersion: local.appVersion,
      exportedAt: local.exportedAt,
      data,
    });
    const content = config.encrypt ? await encryptText(doc, secrets.passphrase) : doc;
    const n = local.data.entries.length;
    try {
      await client.writeFile(
        repo.full_name,
        config.filePath,
        branch,
        content,
        remote?.version ?? null,
        `ThreadShelf : ${n} entrée${n > 1 ? 's' : ''}`,
      );
      return { ...base, pushed: true, created: !remote };
    } catch (e) {
      if (e instanceof GitHubConflictError && attempt < attempts) continue;
      throw e;
    }
  }
  throw new SyncError('Synchronisation impossible : le fichier change trop souvent sur GitHub.');
}

export interface ConnectResult {
  login: string;
  repo: string;
  repoUrl: string;
  created: boolean;
}

/** After sign-in: identify the account, find or create the private repository. */
export async function connectGitHub(
  token: string,
  fetcher?: Fetcher,
  repoName = DEFAULT_REPO_NAME,
): Promise<ConnectResult> {
  const client = new GitHubClient(token, fetcher);
  const { repo, created, login } = await client.findOrCreateRepo(repoName);
  if (!repo.private) {
    throw new SyncError(
      `Le dépôt ${repo.full_name} existe mais est public : rendez-le privé sur GitHub, ou supprimez-le.`,
    );
  }
  return { login, repo: repo.full_name, repoUrl: repo.html_url, created };
}

export { GitHubError };
