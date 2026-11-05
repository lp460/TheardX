// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import extensionToken from '../../api/auth/google/login';
import {
  EXTENSION_ID,
  GOOGLE_EXTENSION_REDIRECT_URI,
  GOOGLE_EXTENSION_TOKEN_ORIGIN,
  GOOGLE_WEB_OAUTH_CLIENT_ID,
} from '../../src/extension-identity.mjs';
import {
  connectGoogleExtension,
  disconnectGoogleExtension,
  hasGoogleBrowserOAuthClient,
} from '../../src/sync/google-extension';

const ORIGIN = `chrome-extension://${EXTENSION_ID}`;
const CODE = 'google_auth_code_12345';
const REFRESH = 'refresh_token_12345';
let data: Map<string, unknown>;

beforeEach(() => {
  data = new Map();
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ oauth2: { client_id: 'native-google-id' } }) },
    identity: {
      getRedirectURL: (path: string) => `https://${EXTENSION_ID}.chromiumapp.org/${path}`,
      getAuthToken: vi.fn(async () => ({ token: 'native-google-token' })),
      removeCachedAuthToken: vi.fn(async () => undefined),
      launchWebAuthFlow: vi.fn(async ({ url }: { url: string }) => {
        const original = new URL(url);
        const returned = new URL(GOOGLE_EXTENSION_REDIRECT_URI);
        returned.searchParams.set('code', CODE);
        returned.searchParams.set('state', original.searchParams.get('state') ?? '');
        return returned.href;
      }),
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: data.get(key) }),
        set: async (entry: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(entry)) data.set(key, value);
        },
        remove: async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
        },
      },
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Arc/Brave OAuth extension with PKCE', () => {
  it('uses a web client and strict extension redirect without embedding a secret', async () => {
    expect(hasGoogleBrowserOAuthClient()).toBe(true);
    expect(GOOGLE_WEB_OAUTH_CLIENT_ID).toMatch(/^\d+-[\w-]+\.apps\.googleusercontent\.com$/);
    expect(GOOGLE_EXTENSION_REDIRECT_URI).toBe(`https://${EXTENSION_ID}.chromiumapp.org/google`);
    const requests: Array<{ url: string; body?: Record<string, string> }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        requests.push({
          url,
          body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        });
        if (url.endsWith('/api/auth/google/login')) {
          expect(init.headers).toEqual({ 'Content-Type': 'text/plain' });
          expect(init.credentials).toBe('include');
          expect(init.cache).toBeUndefined();
        }
        if (url.endsWith('/api/auth/google/login'))
          return Response.json({
            accessToken: 'browser-access-token',
            refreshToken: REFRESH,
            expiresAt: Date.now() + 3_600_000,
          });
        return Response.json({
          sub: '123456789012345678901',
          email: 'lorry@example.com',
          email_verified: true,
        });
      }),
    );

    expect(await connectGoogleExtension(true, 'browser')).toEqual({
      email: 'lorry@example.com',
      subject: '123456789012345678901',
    });
    const flow = vi.mocked(chrome.identity.launchWebAuthFlow);
    expect(flow).toHaveBeenCalledTimes(1);
    const oauthUrl = new URL((flow.mock.calls[0]![0] as { url: string }).url);
    expect(oauthUrl.searchParams.get('client_id')).toBe(GOOGLE_WEB_OAUTH_CLIENT_ID);
    expect(oauthUrl.searchParams.get('redirect_uri')).toBe(GOOGLE_EXTENSION_REDIRECT_URI);
    expect(oauthUrl.searchParams.get('response_type')).toBe('code');
    expect(oauthUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(oauthUrl.searchParams.get('code_verifier')).toBeNull();
    expect(oauthUrl.searchParams.get('client_secret')).toBeNull();
    expect(oauthUrl.searchParams.get('state')).toMatch(/^[\w-]{32}$/);
    const exchange = requests.find((r) => r.url.endsWith('/api/auth/google/login'))!;
    expect(exchange.url).toBe(`${GOOGLE_EXTENSION_TOKEN_ORIGIN}/api/auth/google/login`);
    expect(exchange.body).toMatchObject({
      grantType: 'authorization_code',
      code: CODE,
    });
    expect(exchange.body?.codeVerifier).toMatch(/^[\w-]{64}$/);
    expect(exchange.body).not.toHaveProperty('client_secret');
    expect(chrome.identity.getAuthToken).not.toHaveBeenCalled();

    await connectGoogleExtension(false);
    expect(flow).toHaveBeenCalledTimes(1);
    await disconnectGoogleExtension();
    expect(data.has('threadshelf.google.browser-tokens')).toBe(false);
    expect(data.has('threadshelf.google.auth-mode')).toBe(false);
  });

  it('renews an expired token without interactive Google sign-in', async () => {
    data.set('threadshelf.google.auth-mode', 'browser');
    data.set('threadshelf.google.browser-tokens', {
      accessToken: 'expired-token',
      refreshToken: REFRESH,
      expiresAt: Date.now() - 1_000,
    });
    const api = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/api/auth/google/login')) {
        const body = JSON.parse(init.body as string);
        expect(body).toEqual({ grantType: 'refresh_token', refreshToken: REFRESH });
        return Response.json({
          accessToken: 'refreshed-token',
          refreshToken: REFRESH,
          expiresAt: Date.now() + 3_600_000,
        });
      }
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer refreshed-token');
      return Response.json({
        sub: '123456789012345678901',
        email: 'lorry@example.com',
        email_verified: true,
      });
    });
    vi.stubGlobal('fetch', api);
    await connectGoogleExtension(false);
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('rejects modified OAuth state before exchanging the code', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementationOnce(async () => {
      return `${GOOGLE_EXTENSION_REDIRECT_URI}?code=${CODE}&state=forged`;
    });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(connectGoogleExtension(true, 'browser')).rejects.toThrow('état ou origine');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('Google Web confidential token bridge', () => {
  const request = (origin = ORIGIN, body: Record<string, unknown> = {}) =>
    new Request('https://preview.example/api/auth/google/login', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });

  it('rejects other origins and malformed messages before reaching Google', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('GOOGLE_CLIENT_ID', GOOGLE_WEB_OAUTH_CLIENT_ID);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'server-only-secret');
    expect((await extensionToken.fetch(request('https://untrusted.example'))).status).toBe(403);
    expect(
      (await extensionToken.fetch(request(ORIGIN, { grantType: 'authorization_code' }))).status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends the secret only from the server to Google and never returns it', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', GOOGLE_WEB_OAUTH_CLIENT_ID);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'server-only-secret');
    const upstream = vi.fn(async (_url: string, init: RequestInit) => {
      const body = init.body as URLSearchParams;
      expect(body.get('client_secret')).toBe('server-only-secret');
      expect(body.get('redirect_uri')).toBe(GOOGLE_EXTENSION_REDIRECT_URI);
      expect(body.get('code_verifier')).toMatch(/^[\w-]{64}$/);
      return Response.json({
        access_token: 'google-token',
        refresh_token: REFRESH,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid email https://www.googleapis.com/auth/drive.file',
      });
    });
    vi.stubGlobal('fetch', upstream);
    const response = await extensionToken.fetch(
      request(ORIGIN, {
        grantType: 'authorization_code',
        code: CODE,
        codeVerifier: 'a'.repeat(64),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    const output = await response.json();
    expect(output.accessToken).toBe('google-token');
    expect(output.refreshToken).toBe(REFRESH);
    expect(JSON.stringify(output)).not.toContain('server-only-secret');
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('refreshes with the server secret and preserves the refresh token', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', GOOGLE_WEB_OAUTH_CLIENT_ID);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'server-only-secret');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        expect((init.body as URLSearchParams).get('refresh_token')).toBe(REFRESH);
        return Response.json({ access_token: 'new-token', expires_in: 3600, token_type: 'Bearer' });
      }),
    );
    const response = await extensionToken.fetch(
      request(ORIGIN, {
        grantType: 'refresh_token',
        refreshToken: REFRESH,
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).refreshToken).toBe(REFRESH);
  });
});
