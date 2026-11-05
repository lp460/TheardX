/** Direct Google Drive API access in the Chromium extension (no Vercel session required). */
import type { GoogleSnapshotStore } from '@/web/google-sync';
import type { GoogleSnapshot } from '@/web/google-client';
import { decodeGoogleSnapshot } from './google-snapshot';
import {
  GOOGLE_EXTENSION_REDIRECT_URI,
  GOOGLE_EXTENSION_TOKEN_ORIGIN,
  GOOGLE_WEB_OAUTH_CLIENT_ID,
} from '../extension-identity.mjs';

export const GOOGLE_ORIGINS = [
  'https://www.googleapis.com/*',
  'https://openidconnect.googleapis.com/*',
];
export const GOOGLE_BROWSER_ORIGINS = [...GOOGLE_ORIGINS, `${GOOGLE_EXTENSION_TOKEN_ORIGIN}/*`];
export type GoogleAuthMode = 'chrome' | 'browser';
const AUTH_MODE_KEY = 'threadshelf.google.auth-mode';
const BROWSER_TOKENS_KEY = 'threadshelf.google.browser-tokens';
const BASE = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_NAME = 'TheardX';
const MAX_FILES = 300;

interface BrowserTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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

export function hasGoogleBrowserOAuthClient(): boolean {
  return !!GOOGLE_WEB_OAUTH_CLIENT_ID && !!chrome.identity?.launchWebAuthFlow;
}

async function authMode(): Promise<GoogleAuthMode> {
  const stored = (await chrome.storage?.local?.get(AUTH_MODE_KEY))?.[AUTH_MODE_KEY];
  return stored === 'browser' ? 'browser' : 'chrome';
}

async function chromeToken(interactive = false): Promise<string> {
  if (!hasGoogleOAuthClient())
    throw new ExtensionGoogleError(
      'Identifiant OAuth Google Chrome absent de cette version de l’extension.',
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

function base64url(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function browserBackend(
  body:
    | { grantType: 'authorization_code'; code: string; codeVerifier: string }
    | { grantType: 'refresh_token'; refreshToken: string },
): Promise<BrowserTokens> {
  let response: Response;
  try {
    response = await fetch(`${GOOGLE_EXTENSION_TOKEN_ORIGIN}/api/auth/google/login`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ExtensionGoogleError(
      'Serveur OAuth Preview inaccessible depuis ce navigateur. Vérifiez votre accès à la Preview Vercel.',
      503,
    );
  }
  const data = (await response.json().catch(() => ({}))) as Partial<BrowserTokens> & {
    error?: string;
  };
  if (!response.ok)
    throw new ExtensionGoogleError(
      data.error || 'Échange OAuth Google refusé. Vérifiez la connexion à la Preview Vercel.',
      response.status,
    );
  if (
    typeof data.accessToken !== 'string' ||
    typeof data.refreshToken !== 'string' ||
    typeof data.expiresAt !== 'number' ||
    data.expiresAt < Date.now()
  )
    throw new ExtensionGoogleError('Réponse OAuth Google invalide.', 502);
  return data as BrowserTokens;
}

async function browserSignIn(): Promise<string> {
  if (!hasGoogleBrowserOAuthClient())
    throw new ExtensionGoogleError('Connexion Google par navigateur indisponible.', 503);
  const redirectUri = chrome.identity.getRedirectURL('google');
  if (redirectUri !== GOOGLE_EXTENSION_REDIRECT_URI)
    throw new ExtensionGoogleError('ID de l’extension différent du client Google enregistré.', 400);
  const codeVerifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))),
  );
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_WEB_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email https://www.googleapis.com/auth/drive.file');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  let result: string | undefined;
  try {
    result = await chrome.identity.launchWebAuthFlow({ url: url.href, interactive: true });
  } catch {
    throw new ExtensionGoogleError(
      'Connexion Google annulée ou URL de retour non autorisée dans le client OAuth Web.',
      401,
    );
  }
  if (!result) throw new ExtensionGoogleError('Google n’a pas renvoyé de code OAuth.', 401);
  const returned = new URL(result);
  const expected = new URL(redirectUri);
  if (
    returned.origin !== expected.origin ||
    returned.pathname !== expected.pathname ||
    returned.searchParams.get('state') !== state
  )
    throw new ExtensionGoogleError('Réponse Google refusée : état ou origine incorrect.', 401);
  if (returned.searchParams.has('error'))
    throw new ExtensionGoogleError('Google a refusé la connexion.', 401);
  const code = returned.searchParams.get('code');
  if (!code) throw new ExtensionGoogleError('Code OAuth Google manquant.', 401);
  const credentials = await browserBackend({
    grantType: 'authorization_code',
    code,
    codeVerifier,
  });
  await chrome.storage.local.set({ [BROWSER_TOKENS_KEY]: credentials });
  return credentials.accessToken;
}

let refreshInFlight: Promise<string> | null = null;
async function browserToken(interactive = false): Promise<string> {
  const saved = (await chrome.storage.local.get(BROWSER_TOKENS_KEY))[BROWSER_TOKENS_KEY] as
    BrowserTokens | undefined;
  if (saved?.accessToken && saved.expiresAt > Date.now() + 30_000) return saved.accessToken;
  if (saved?.refreshToken) {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const next = await browserBackend({
          grantType: 'refresh_token',
          refreshToken: saved.refreshToken,
        });
        await chrome.storage.local.set({ [BROWSER_TOKENS_KEY]: next });
        return next.accessToken;
      })().finally(() => {
        refreshInFlight = null;
      });
    }
    try {
      return await refreshInFlight;
    } catch {
      await chrome.storage.local.remove(BROWSER_TOKENS_KEY);
      if (!interactive)
        throw new ExtensionGoogleError('Connexion Google expirée. Reconnectez-vous.', 401);
    }
  }
  if (interactive) return browserSignIn();
  throw new ExtensionGoogleError('Reconnectez votre compte Google depuis les paramètres.', 401);
}

async function token(interactive = false): Promise<string> {
  return (await authMode()) === 'browser' ? browserToken(interactive) : chromeToken(interactive);
}

async function invalidateToken(bearer: string): Promise<void> {
  if ((await authMode()) === 'browser') {
    const stored = (await chrome.storage.local.get(BROWSER_TOKENS_KEY))[BROWSER_TOKENS_KEY] as
      BrowserTokens | undefined;
    if (stored?.accessToken === bearer)
      await chrome.storage.local.set({
        [BROWSER_TOKENS_KEY]: { ...stored, accessToken: '', expiresAt: 0 },
      });
  } else {
    await chrome.identity.removeCachedAuthToken({ token: bearer });
  }
}

export async function disconnectGoogleExtension(): Promise<void> {
  const mode = await authMode();
  if (mode === 'chrome') {
    try {
      const current = await chrome.identity.getAuthToken({ interactive: false });
      if (current.token) await chrome.identity.removeCachedAuthToken({ token: current.token });
    } catch {
      // No cached Chrome token, or this browser does not implement native auth.
    }
  }
  await chrome.storage?.local?.remove([AUTH_MODE_KEY, BROWSER_TOKENS_KEY]);
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
    await invalidateToken(bearer);
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
  requestedMode?: GoogleAuthMode,
): Promise<{ email: string; subject: string }> {
  const bearer =
    requestedMode === 'browser' && interactive
      ? await browserSignIn()
      : requestedMode === 'chrome'
        ? await chromeToken(interactive)
        : await token(interactive);
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
  if (requestedMode) {
    await chrome.storage?.local?.set({ [AUTH_MODE_KEY]: requestedMode });
    if (requestedMode === 'chrome') await chrome.storage?.local?.remove(BROWSER_TOKENS_KEY);
  }
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
    try {
      decodeGoogleSnapshot(text);
    } catch {
      throw new ExtensionGoogleError('Sauvegarde invalide : format inconnu.', 400);
    }
    if (
      !/^[a-f0-9-]{36}$/.test(deviceId) ||
      !/^[a-f0-9-]{36}$/.test(revisionId) ||
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
        description: 'TheardX — sauvegarde de bibliothèque',
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
