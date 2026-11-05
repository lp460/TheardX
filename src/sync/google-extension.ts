/** Direct Google Drive API access in the Chromium extension (no Vercel session required). */
import type { GoogleSnapshotStore } from '@/web/google-sync';
import type { GoogleSnapshot } from '@/web/google-client';
import { isEncrypted } from './crypto';

export const GOOGLE_ORIGINS = [
  'https://www.googleapis.com/*',
  'https://openidconnect.googleapis.com/*',
];
const BASE = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_NAME = 'TheardX';
const MAX_FILES = 300;

export class ExtensionGoogleError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function hasGoogleOAuthClient(): boolean {
  return !!chrome.runtime.getManifest().oauth2?.client_id;
}

async function token(interactive = false): Promise<string> {
  if (!hasGoogleOAuthClient())
    throw new ExtensionGoogleError(
      'Identifiant Google Extension absent du build (GOOGLE_EXTENSION_CLIENT_ID).',
      503,
    );
  let result: chrome.identity.GetAuthTokenResult;
  try {
    result = await chrome.identity.getAuthToken({ interactive });
  } catch {
    throw new ExtensionGoogleError(
      'Google n’a pas autorisé l’extension. Vérifiez le compte et le client OAuth de cette extension.',
      401,
    );
  }
  if (!result.token) throw new ExtensionGoogleError('Google n’a pas fourni de jeton.', 401);
  return result.token;
}

async function google(path: string, init: RequestInit = {}): Promise<Response> {
  const url =
    path.startsWith('https://www.googleapis.com/') ||
    path.startsWith('https://openidconnect.googleapis.com/')
      ? path
      : `${BASE}${path}`;
  let bearer = await token();
  const call = (access: string) =>
    fetch(url, {
      ...init,
      cache: 'no-store',
      credentials: 'omit',
      headers: { Authorization: `Bearer ${access}`, ...(init.headers ?? {}) },
    });
  let response = await call(bearer);
  if (response.status === 401) {
    await chrome.identity.removeCachedAuthToken({ token: bearer });
    bearer = await token();
    response = await call(bearer);
  }
  if (!response.ok)
    throw new ExtensionGoogleError(
      response.status === 403
        ? 'Google Drive refuse l’accès à l’extension (autorisation drive.file requise).'
        : `Erreur Google Drive HTTP ${response.status}.`,
      response.status,
    );
  return response;
}

async function list(query: string, fields: string, limit = MAX_FILES): Promise<GoogleSnapshot[]> {
  let pageToken = '';
  const result: GoogleSnapshot[] = [];
  do {
    const search = new URLSearchParams({
      q: query,
      fields: `nextPageToken,files(${fields})`,
      pageSize: String(Math.min(limit, 100)),
      spaces: 'drive',
    });
    if (pageToken) search.set('pageToken', pageToken);
    const response = await google(`?${search}`);
    const page = (await response.json()) as { files?: GoogleSnapshot[]; nextPageToken?: string };
    result.push(...(page.files ?? []));
    pageToken = page.nextPageToken ?? '';
    if (result.length > limit)
      throw new ExtensionGoogleError(
        'Trop de versions Drive : contactez le support avant toute suppression.',
        409,
      );
  } while (pageToken);
  return result;
}

async function folders(): Promise<GoogleSnapshot[]> {
  return (
    await list(
      `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      'id,name,createdTime',
      20,
    )
  ).sort(
    (a, b) => (a.createdTime ?? '').localeCompare(b.createdTime ?? '') || a.id.localeCompare(b.id),
  );
}

async function snapshots(): Promise<GoogleSnapshot[]> {
  const result: GoogleSnapshot[] = [];
  for (const folder of await folders()) {
    result.push(
      ...(await list(
        `'${folder.id}' in parents and name contains 'theardx-' and trashed = false`,
        'id,name,createdTime,size',
      )),
    );
  }
  if (result.length > MAX_FILES)
    throw new ExtensionGoogleError('Limite de versions atteinte.', 409);
  return result
    .filter((f) => /^theardx-[a-f0-9-]{36}-[a-f0-9-]{36}\.json$/.test(f.name))
    .sort(
      (a, b) =>
        (a.createdTime ?? '').localeCompare(b.createdTime ?? '') || a.id.localeCompare(b.id),
    );
}

async function ensureFolder(): Promise<string> {
  const existing = await folders();
  if (existing[0]) return existing[0].id;
  const response = await google('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new ExtensionGoogleError('Création du dossier TheardX impossible.', 502);
  return data.id;
}

export async function connectGoogleExtension(
  interactive = true,
): Promise<{ email: string; subject: string }> {
  const bearer = await token(interactive);
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: 'no-store',
  });
  if (!response.ok)
    throw new ExtensionGoogleError('Impossible de vérifier le compte Google.', response.status);
  const user = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  if (!user.email || !user.email_verified || !user.sub || !/^\d{5,40}$/.test(user.sub))
    throw new ExtensionGoogleError('Compte Google non vérifié.', 401);
  return { email: user.email, subject: user.sub };
}

export const googleExtensionStore: GoogleSnapshotStore = {
  list: snapshots,
  async read(id) {
    if (!/^[A-Za-z0-9_-]{10,150}$/.test(id) || !(await snapshots()).some((f) => f.id === id))
      throw new ExtensionGoogleError('Sauvegarde TheardX introuvable.', 404);
    const response = await google(`/${encodeURIComponent(id)}?alt=media`);
    const text = await response.text();
    if (new TextEncoder().encode(text).length > 3 * 1024 * 1024)
      throw new ExtensionGoogleError('Sauvegarde trop volumineuse.', 413);
    return text;
  },
  async write(deviceId, revisionId, text) {
    if (
      !/^[a-f0-9-]{36}$/.test(deviceId) ||
      !/^[a-f0-9-]{36}$/.test(revisionId) ||
      !isEncrypted(text) ||
      new TextEncoder().encode(text).length > 3 * 1024 * 1024
    )
      throw new ExtensionGoogleError('Sauvegarde invalide ou trop volumineuse.', 400);
    const folderId = await ensureFolder();
    const boundary = `theardx_${crypto.randomUUID().replace(/-/g, '')}`;
    const name = `theardx-${deviceId}-${revisionId}.json`;
    const body = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({
        name,
        mimeType: 'application/json',
        parents: [folderId],
        description: 'TheardX — sauvegarde chiffrée de bibliothèque',
      })}\r\n`,
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`,
    ].join('');
    await google(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );
  },
};
