/**
 * « Se connecter avec GitHub » — OAuth device flow: no token to copy, no client secret, no redirect.
 * GitHub shows an 8-character code; the user enters it on github.com/login/device and authorises.
 */
import { GitHubError, type Fetcher } from './github';

export const GITHUB_WEB = 'https://github.com';
/** `repo` is needed to create and write a private repository. */
export const DEVICE_SCOPE = 'repo';

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** Epoch ms. */
  expiresAt: number;
  /** Seconds between polls. */
  interval: number;
}

export interface UserToken {
  token: string;
  /** Only when the OAuth App has « Expire user access tokens » enabled. */
  refreshToken?: string;
  expiresAt?: number;
}

export type PollResult =
  { status: 'pending'; interval: number } | ({ status: 'authorized' } & UserToken);

function toUserToken(r: Record<string, unknown>): UserToken {
  const t: UserToken = { token: String(r.access_token) };
  if (typeof r.refresh_token === 'string') t.refreshToken = r.refresh_token;
  if (typeof r.expires_in === 'number') t.expiresAt = Date.now() + r.expires_in * 1000;
  return t;
}

async function post(
  path: string,
  params: Record<string, string>,
  fetcher: Fetcher,
  base = GITHUB_WEB,
): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetcher(`${base}${path}`, {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  } catch (e) {
    throw new GitHubError(`GitHub injoignable (${e instanceof Error ? e.message : String(e)}).`, 0);
  }
  const text = await res.text();
  if (!res.ok) throw new GitHubError(`Erreur GitHub ${res.status}`, res.status);
  return JSON.parse(text) as Record<string, unknown>;
}

export async function requestDeviceCode(
  clientId: string,
  fetcher: Fetcher = (u, i) => fetch(u, i),
): Promise<DeviceCode> {
  const r = await post('/login/device/code', { client_id: clientId, scope: DEVICE_SCOPE }, fetcher);
  if (r.error) {
    throw new GitHubError(
      r.error === 'device_flow_disabled'
        ? 'Le « Device Flow » n’est pas activé sur l’application GitHub ThreadShelf.'
        : `GitHub : ${String(r.error_description ?? r.error)}`,
      400,
    );
  }
  return {
    deviceCode: String(r.device_code),
    userCode: String(r.user_code),
    verificationUri: String(r.verification_uri ?? `${GITHUB_WEB}/login/device`),
    expiresAt: Date.now() + Number(r.expires_in ?? 900) * 1000,
    interval: Number(r.interval ?? 5),
  };
}

/** One poll of the token endpoint. Throws when the code expired or the user declined. */
export async function pollDeviceToken(
  clientId: string,
  code: Pick<DeviceCode, 'deviceCode' | 'interval'>,
  fetcher: Fetcher = (u, i) => fetch(u, i),
): Promise<PollResult> {
  const r = await post(
    '/login/oauth/access_token',
    {
      client_id: clientId,
      device_code: code.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    },
    fetcher,
  );
  if (typeof r.access_token === 'string') return { status: 'authorized', ...toUserToken(r) };
  switch (r.error) {
    case 'authorization_pending':
      return { status: 'pending', interval: code.interval };
    case 'slow_down':
      return { status: 'pending', interval: Number(r.interval ?? code.interval + 5) };
    case 'expired_token':
      throw new GitHubError('Le code a expiré : relancez la connexion.', 400);
    case 'access_denied':
      throw new GitHubError('Autorisation refusée sur GitHub.', 400);
    default:
      throw new GitHubError(
        `GitHub : ${String(r.error_description ?? r.error ?? 'réponse inattendue')}`,
        400,
      );
  }
}

/**
 * Renews an expiring user token. Works only if GitHub accepts it without a client secret (the
 * extension has none); otherwise the user is asked to turn off token expiry and reconnect.
 */
export async function refreshUserToken(
  clientId: string,
  refreshToken: string,
  fetcher: Fetcher = (u, i) => fetch(u, i),
): Promise<UserToken> {
  const r = await post(
    '/login/oauth/access_token',
    { client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken },
    fetcher,
  );
  if (typeof r.access_token !== 'string') {
    throw new GitHubError(
      'La connexion GitHub a expiré. Dans l’application GitHub « ThreadShelf », décochez « Expire user access tokens », puis reconnectez-vous.',
      401,
    );
  }
  return toUserToken(r);
}
