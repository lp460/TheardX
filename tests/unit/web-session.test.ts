import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionCookie, matchesState, readSession, sameOrigin, setSessionCookie } from '../../server/session';
import me from '../../api/auth/me';
import logout from '../../api/auth/logout';
import sync from '../../api/sync';
import media from '../../api/media';

const ORIGIN = 'https://theardx.example';
const SESSION = { login: 'lp460', token: 'private-test-token', expiresAt: Date.now() + 600_000 };

function request(path: string, method = 'GET', cookie = '', origin?: string, body?: unknown): Request {
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

function signedCookie(): string {
  return setSessionCookie(request('/'), SESSION).split(';')[0]!;
}

describe('Web session and GitHub proxy', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'this-is-a-test-only-server-session-secret-with-32chars';
    process.env.WEB_ORIGIN = ORIGIN;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SESSION_SECRET;
    delete process.env.WEB_ORIGIN;
  });

  it('encrypts cookies and never exposes GitHub tokens to the client', async () => {
    const cookie = signedCookie();
    expect(cookie).not.toContain('private-test-token');
    expect(readSession(request('/', 'GET', cookie))).toEqual(SESSION);
    const response = me.fetch(request('/api/auth/me', 'GET', cookie));
    expect(await response.json()).toEqual({ login: 'lp460' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects changed, missing or expired session cookies', () => {
    const original = signedCookie();
    const modified = original.slice(0, -2) + 'xx';
    expect(readSession(request('/', 'GET', modified))).toBeNull();
    expect(readSession(request('/'))).toBeNull();
    const expired = setSessionCookie(request('/'), { ...SESSION, expiresAt: Date.now() - 1 });
    expect(readSession(request('/', 'GET', expired.split(';')[0]))).toBeNull();
  });

  it('uses constant-time OAuth state comparison with strict lengths', () => {
    expect(matchesState('abcdefghijkl', 'abcdefghijkl')).toBe(true);
    expect(matchesState('abcdefghijkl', 'abcdefghijkm')).toBe(false);
    expect(matchesState(undefined, 'abcdefghijkl')).toBe(false);
    expect(matchesState('abc', 'ab')).toBe(false);
  });

  it('blocks cross-origin writes and logout', async () => {
    const cookie = signedCookie();
    expect(sameOrigin(request('/api/sync', 'PUT', cookie, 'https://evil.example', { text: '{}' }))).toBe(false);
    expect((await sync.fetch(request('/api/sync', 'PUT', cookie, 'https://evil.example', { text: '{}' }))).status).toBe(403);
    expect(logout.fetch(request('/api/auth/logout', 'POST', cookie, 'https://evil.example')).status).toBe(403);
    const response = logout.fetch(request('/api/auth/logout', 'POST', cookie, ORIGIN));
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(clearSessionCookie(request('/'))).toContain('HttpOnly');
  });

  it('only reads the signed-in owner private library', async () => {
    const paths: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      paths.push(url);
      if (url.endsWith('/repos/lp460/threadshelf-data'))
        return Response.json({ full_name: 'lp460/threadshelf-data', private: true, default_branch: 'main' });
      return Response.json({ sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from('{"ok":true}').toString('base64') });
    }));
    const response = await sync.fetch(request('/api/sync', 'GET', signedCookie()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ file: { text: '{"ok":true}', version: 'a'.repeat(40) } });
    expect(paths).toEqual([
      'https://api.github.com/repos/lp460/threadshelf-data',
      'https://api.github.com/repos/lp460/threadshelf-data/contents/threadshelf/library.json?ref=main',
    ]);
  });

  it('rejects unauthenticated users and public library repositories', async () => {
    expect((await sync.fetch(request('/api/sync'))).status).toBe(401);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ private: false, default_branch: 'main' })));
    expect((await sync.fetch(request('/api/sync', 'GET', signedCookie()))).status).toBe(403);
  });

  it('rejects SSRF and non-image responses from the media proxy', async () => {
    const cookie = signedCookie();
    const bad = await media.fetch(request('/api/media?url=' + encodeURIComponent('https://127.0.0.1/admin'), 'GET', cookie));
    expect(bad.status).toBe(400);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>not an image</html>', {
      headers: { 'Content-Type': 'text/html' },
    })));
    const target = '/api/media?url=' + encodeURIComponent('https://pbs.twimg.com/media/test.jpg');
    const notImage = await media.fetch(request(target, 'GET', cookie));
    expect(notImage.status).toBe(415);
  });

  it('serves only allowlisted image bytes to authenticated clients', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { 'Content-Type': 'image/png', 'Content-Length': '4' },
    })));
    const target = '/api/media?url=' + encodeURIComponent('https://pbs.twimg.com/media/test.png');
    expect((await media.fetch(request(target))).status).toBe(401);
    const response = await media.fetch(request(target, 'GET', signedCookie()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([137, 80, 78, 71]);
  });
});
