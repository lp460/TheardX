import { readSession, setSessionCookie, type GoogleWebSession } from './session.js';
import { decodeGoogleSnapshot } from '../src/sync/google-snapshot.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_NAME = 'TheardX';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_PREFIX = 'theardx-';
export const MAX_SNAPSHOT_BYTES = 3 * 1024 * 1024;
const MAX_FILES = 300;

export interface DriveFile {
  id: string;
  name: string;
  createdTime?: string;
  size?: string;
}

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** An encrypted HttpOnly session holds the refresh token, never browser JS. */
export async function authorizeGoogle(request: Request): Promise<{
  session: GoogleWebSession;
  refreshedCookie?: string;
} | null> {
  const original = readSession(request);
  if (!original || original.provider !== 'google') return null;
  if (original.accessExpiresAt > Date.now()) return { session: original };
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: original.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  if (!response.ok)
    throw new DriveError('Connexion Google expirée ou révoquée : reconnectez-vous.', 401);
  const token = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!token.access_token) throw new DriveError('Renouvellement Google impossible.', 401);
  const session: GoogleWebSession = {
    ...original,
    token: token.access_token,
    refreshToken: token.refresh_token || original.refreshToken,
    accessExpiresAt: Date.now() + Math.max(60, token.expires_in ?? 3600) * 1000 - 60_000,
  };
  return { session, refreshedCookie: setSessionCookie(request, session) };
}

async function drive(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(
    path.startsWith('https://www.googleapis.com/') ? path : `${DRIVE_API}${path}`,
    {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    const message =
      response.status === 401
        ? 'Autorisation Google expirée ou révoquée.'
        : response.status === 403
          ? 'Google Drive refuse l’accès. Autorisez le périmètre drive.file.'
          : response.status === 429
            ? 'Quota Google Drive atteint : réessayez plus tard.'
            : `Google Drive indisponible (HTTP ${response.status}).`;
    throw new DriveError(
      message,
      response.status === 404 ? 404 : response.status === 429 ? 429 : 502,
    );
  }
  return response;
}

async function list(
  token: string,
  query: string,
  fields: string,
  limit = MAX_FILES,
): Promise<DriveFile[]> {
  const found: DriveFile[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: query,
      fields: `nextPageToken,files(${fields})`,
      pageSize: String(Math.min(100, limit)),
      spaces: 'drive',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await drive(token, `?${params}`);
    const page = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string };
    found.push(...(page.files ?? []));
    pageToken = page.nextPageToken ?? '';
    if (found.length > limit)
      throw new DriveError(
        'Trop de sauvegardes Drive : archivez les anciennes versions avant de continuer.',
        409,
      );
  } while (pageToken);
  return found;
}

async function folders(token: string): Promise<DriveFile[]> {
  const result = await list(
    token,
    `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    'id,name,createdTime',
    20,
  );
  return result.sort(
    (a, b) => (a.createdTime ?? '').localeCompare(b.createdTime ?? '') || a.id.localeCompare(b.id),
  );
}

async function createFolder(token: string): Promise<string> {
  const response = await drive(token, '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const file = (await response.json()) as { id: string };
  if (!file.id) throw new DriveError('Création du dossier TheardX impossible.', 502);
  return file.id;
}

export async function listSnapshots(token: string): Promise<DriveFile[]> {
  const roots = await folders(token);
  if (!roots.length) return [];
  const files: DriveFile[] = [];
  // Read all app-created TheardX folders; avoids losing files after a concurrent first connection.
  for (const folder of roots) {
    files.push(
      ...(await list(
        token,
        `'${folder.id}' in parents and name contains '${FILE_PREFIX}' and trashed = false`,
        'id,name,createdTime,size',
      )),
    );
  }
  if (files.length > MAX_FILES)
    throw new DriveError(
      'Limite de versions Drive atteinte. Contactez le support avant toute suppression.',
      409,
    );
  return files
    .filter((file) => /^theardx-[a-f0-9-]{36}-[a-f0-9-]{36}\.json$/.test(file.name))
    .sort(
      (a, b) =>
        (a.createdTime ?? '').localeCompare(b.createdTime ?? '') || a.id.localeCompare(b.id),
    );
}

export async function readSnapshot(token: string, id: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{10,150}$/.test(id))
    throw new DriveError('Identifiant de sauvegarde invalide.', 400);
  const permitted = await listSnapshots(token);
  if (!permitted.some((file) => file.id === id))
    throw new DriveError('Sauvegarde TheardX introuvable.', 404);
  const response = await drive(token, `/${encodeURIComponent(id)}?alt=media`);
  if (Number(response.headers.get('content-length') ?? 0) > MAX_SNAPSHOT_BYTES)
    throw new DriveError('Sauvegarde trop volumineuse.', 413);
  const content = await response.text();
  if (Buffer.byteLength(content, 'utf8') > MAX_SNAPSHOT_BYTES)
    throw new DriveError('Sauvegarde trop volumineuse.', 413);
  return content;
}

export async function createSnapshot(
  token: string,
  input: {
    deviceId: string;
    revisionId: string;
    text: string;
  },
): Promise<DriveFile> {
  const { deviceId, revisionId, text } = input;
  if (!/^[a-f0-9-]{36}$/.test(deviceId) || !/^[a-f0-9-]{36}$/.test(revisionId))
    throw new DriveError('Identifiant de révision invalide.', 400);
  if (Buffer.byteLength(text, 'utf8') > MAX_SNAPSHOT_BYTES)
    throw new DriveError('Sauvegarde trop volumineuse pour Vercel.', 413);
  let snapshot;
  try {
    snapshot = decodeGoogleSnapshot(text);
  } catch {
    throw new DriveError('Format de sauvegarde Google Drive invalide.', 400);
  }
  if (
    (await listSnapshots(token)).some(
      (file) => file.name === `${FILE_PREFIX}${deviceId}-${revisionId}.json`,
    )
  )
    throw new DriveError('Cette révision existe déjà.', 409);
  const roots = await folders(token);
  const folderId = roots[0]?.id ?? (await createFolder(token));
  const name = `${FILE_PREFIX}${deviceId}-${revisionId}.json`;
  const boundary = `theardx_${crypto.randomUUID().replace(/-/g, '')}`;
  const media = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({
      name,
      mimeType: 'application/json',
      parents: [folderId],
      description:
        snapshot.mode === 'encrypted'
          ? 'TheardX — sauvegarde de bibliothèque chiffrée'
          : 'TheardX — sauvegarde standard de bibliothèque',
    })}\r\n`,
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`,
  ].join('');
  const response = await drive(
    token,
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: media,
    },
  );
  const file = (await response.json()) as DriveFile;
  if (!file.id) throw new DriveError('Sauvegarde Drive non confirmée.', 502);
  return file;
}
