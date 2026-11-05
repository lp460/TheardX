// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import googleLogin from '../../api/auth/google/login';
import googleCallback from '../../api/auth/google/callback';
import me from '../../api/auth/me';
import googleSync from '../../api/google/sync';
import githubSync from '../../api/sync';
import { readSession, setSessionCookie } from '../../server/session';

const ORIGIN = 'https://theardx.example';
function req(path: string, cookie = '', method = 'GET', origin?: string, body?: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function cookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function signedGoogle(
  expiresAt = Date.now() + 86_400_000,
  accessExpiresAt = Date.now() + 3600_000,
): string {
  return setSessionCookie(req('/'), {
    provider: 'google',
    subject: '123456789012345678901',
    login: 'someone@example.com',
    token: 'google-access-test',
    refreshToken: 'google-refresh-test',
    accessExpiresAt,
    expiresAt,
  }).split(';')[0]!;
}

describe('Google auth + distinct provider identity', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'a-secret-used-only-in-tests-minimum-32-characters';
    process.env.WEB_ORIGIN = ORIGIN;
    process.env.GOOGLE_CLIENT_ID = 'theardx-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'theardx-google-test-secret';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SESSION_SECRET;
    delete process.env.WEB_ORIGIN;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  it('canonicalizes the host, uses limited Drive scope, opaque state and PKCE', () => {
    const alias = googleLogin.fetch(new Request('https://preview.example/api/auth/google/login'));
    expect(alias.headers.get('Location')).toBe(`${ORIGIN}/api/auth/google/login`);
    expect(alias.headers.getSetCookie()).toHaveLength(0);
    const response = googleLogin.fetch(req('/api/auth/google/login'));
    expect(response.status).toBe(302);
    const authUrl = new URL(response.headers.get('Location')!);
    expect(authUrl.host).toBe('accounts.google.com');
    expect(authUrl.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/drive.file',
    );
    expect(authUrl.searchParams.get('scope')).not.toContain('/auth/drive ');
    expect(authUrl.searchParams.get('access_type')).toBe('offline');
    expect(authUrl.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/google/callback`);
    const all = cookies(response);
    expect(all).not.toContain('google-client-secret');
    const verifier = /theardx-google-pkce=([^;]+)/.exec(all)?.[1];
    expect(verifier).toBeTruthy();
    expect(authUrl.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(verifier!).digest('base64url'),
    );
  });

  it('rejects CSRF and missing PKCE before contacting Google', async () => {
    const response = await googleCallback.fetch(req('/api/auth/google/callback?code=x&state=fake'));
    expect(response.status).toBe(400);
    const start = googleLogin.fetch(req('/api/auth/google/login'));
    const response2 = await googleCallback.fetch(
      req('/api/auth/google/callback?code=x&state=wrong', cookies(start)),
    );
    expect(response2.status).toBe(400);
  });

  it('exchanges a valid code, verifies Google subject, keeps tokens encrypted and isolates GitHub', async () => {
    const start = googleLogin.fetch(req('/api/auth/google/login'));
    const params = new URL(start.headers.get('Location')!).searchParams;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'https://oauth2.googleapis.com/token')
          return Response.json({
            access_token: 'very-private-access-token',
            refresh_token: 'very-private-refresh-token',
            scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
            expires_in: 3600,
          });
        if (url === 'https://openidconnect.googleapis.com/v1/userinfo')
          return Response.json({
            sub: '123456789012345678901',
            email: 'someone@example.com',
            email_verified: true,
          });
        throw new Error(`Unexpected request ${url}`);
      }),
    );
    const callback = await googleCallback.fetch(
      req(`/api/auth/google/callback?code=valid&state=${params.get('state')}`, cookies(start)),
    );
    expect(callback.status).toBe(302);
    const sessionCookies = cookies(callback);
    expect(sessionCookies).not.toContain('very-private-access-token');
    expect(sessionCookies).not.toContain('very-private-refresh-token');
    const session = readSession(req('/', sessionCookies));
    expect(session).toMatchObject({
      provider: 'google',
      subject: '123456789012345678901',
      login: 'someone@example.com',
    });
    expect(await me.fetch(req('/api/auth/me', sessionCookies)).json()).toEqual({
      provider: 'google',
      accountId: 'google:123456789012345678901',
      login: 'someone@example.com',
    });
    expect((await githubSync.fetch(req('/api/sync', sessionCookies))).status).toBe(403);
  });

  it('refreshes the Google token without leaking it through the API and enforces same-origin writes', async () => {
    const signed = signedGoogle(Date.now() + 86_400_000, Date.now() - 100);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'https://oauth2.googleapis.com/token')
          return Response.json({
            access_token: 'renewed-secret-token',
            expires_in: 3600,
          });
        if (url.startsWith('https://www.googleapis.com/drive/v3/files?'))
          return Response.json({ files: [] });
        throw new Error(`Unexpected request ${url}`);
      }),
    );
    const response = await googleSync.fetch(req('/api/google/sync', signed));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ files: [] });
    expect(response.headers.getSetCookie().join('')).not.toContain('renewed-secret-token');
    expect(readSession(req('/', response.headers.getSetCookie()[0]!.split(';')[0]))).toMatchObject({
      provider: 'google',
      token: 'renewed-secret-token',
    });
    expect(
      (
        await googleSync.fetch(
          req('/api/google/sync', signed, 'POST', 'https://evil.test', {
            deviceId: 'x',
            revisionId: 'y',
            text: '{}',
          }),
        )
      ).status,
    ).toBe(403);
  });

  it('requires a Google session and rejects plaintext uploads', async () => {
    expect((await googleSync.fetch(req('/api/google/sync'))).status).toBe(401);
    const response = await googleSync.fetch(
      req('/api/google/sync', signedGoogle(), 'POST', ORIGIN, {
        deviceId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        revisionId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        text: '{"entries":[]}',
      }),
    );
    expect(response.status).toBe(400);
  });
});
