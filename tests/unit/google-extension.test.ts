// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTENSION_ID, EXTENSION_PUBLIC_KEY } from '../../src/extension-identity.mjs';
import { createManifest } from '../../src/manifest.mjs';
import {
  connectGoogleExtension,
  googleExtensionStore,
  hasGoogleOAuthClient,
} from '../../src/sync/google-extension';
import { encodeGoogleSnapshot } from '../../src/sync/google-snapshot';

const pkg = { version: '1.2.0' };
const DEVICE = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const REVISION = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Chromium extension Google configuration', () => {
  it('does not request identity permission unless a Chrome OAuth client is configured', () => {
    const baseline = createManifest(pkg);
    expect(baseline.permissions).not.toContain('identity');
    expect(baseline).not.toHaveProperty('oauth2');
    const withGoogle = createManifest(pkg, { googleClientId: 'chrome-client-123' });
    expect(withGoogle.permissions).toContain('identity');
    expect(withGoogle.oauth2).toMatchObject({ client_id: 'chrome-client-123' });
    expect(withGoogle.oauth2!.scopes).toContain('https://www.googleapis.com/auth/drive.file');
    expect(withGoogle.oauth2!.scopes).not.toContain('https://www.googleapis.com/auth/drive');
  });

  it('uses a public manifest key yielding the same permanent ID across every build', () => {
    const first = createManifest(pkg);
    const next = createManifest({ version: '1.2.1' });
    expect(first.key).toBe(EXTENSION_PUBLIC_KEY);
    expect(next.key).toBe(first.key);
    const sha = createHash('sha256')
      .update(Buffer.from(first.key, 'base64'))
      .digest('hex')
      .slice(0, 32);
    const derived = [...sha]
      .map((hex) => String.fromCharCode(97 + Number.parseInt(hex, 16)))
      .join('');
    expect(derived).toBe(EXTENSION_ID);
    expect(derived).toMatch(/^[a-p]{32}$/);
  });

  it('uses Chrome Identity and a verified email, not credentials embedded in the extension', async () => {
    const getAuthToken = vi.fn(async () => ({ token: 'chrome-managed-token' }));
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ oauth2: { client_id: 'chrome-client-123' } }) },
      identity: { getAuthToken },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        expect(url).toBe('https://openidconnect.googleapis.com/v1/userinfo');
        expect((init.headers as Record<string, string>).Authorization).toBe(
          'Bearer chrome-managed-token',
        );
        return Response.json({
          sub: '123456789012345678901',
          email: 'lorry@example.com',
          email_verified: true,
        });
      }),
    );
    expect(hasGoogleOAuthClient()).toBe(true);
    expect(await connectGoogleExtension()).toEqual({
      email: 'lorry@example.com',
      subject: '123456789012345678901',
    });
    expect(getAuthToken).toHaveBeenCalledWith({ interactive: true });
  });

  it('uploads an immutable ciphertext snapshot into the Drive folder', async () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ oauth2: { client_id: 'chrome-client-123' } }) },
      identity: { getAuthToken: vi.fn(async () => ({ token: 'google-token' })) },
    });
    const requests: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        requests.push({ url, body: typeof init.body === 'string' ? init.body : undefined });
        if (url.includes('uploadType=multipart')) return Response.json({ id: 'fileABC123' });
        if (init.method === 'POST') return Response.json({ id: 'folderABC123' });
        return Response.json({ files: [] });
      }),
    );
    const ciphertext = '{"format":"threadshelf.encrypted","v":1,"data":"CIPHER"}';
    await googleExtensionStore.write(DEVICE, REVISION, ciphertext);
    expect(requests.some(({ body }) => body?.includes('application/vnd.google-apps.folder'))).toBe(
      true,
    );
    const upload = requests.find(({ url }) => url.includes('uploadType=multipart'))!;
    expect(upload.body).toContain(ciphertext);
    expect(upload.body).toContain(`theardx-${DEVICE}-${REVISION}.json`);
    await expect(googleExtensionStore.write(DEVICE, REVISION, '{"entries":[]}')).rejects.toThrow(
      'Sauvegarde invalide',
    );
  });

  it('accepts standard unencrypted snapshots created by a website or another device', async () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ oauth2: { client_id: 'chrome-client-123' } }) },
      identity: { getAuthToken: vi.fn(async () => ({ token: 'google-token' })) },
    });
    const requests: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (typeof init.body === 'string') requests.push(init.body);
        if (url.includes('uploadType=multipart')) return Response.json({ id: 'fileABC123' });
        if (init.method === 'POST') return Response.json({ id: 'folderABC123' });
        return Response.json({ files: [] });
      }),
    );
    const plain = JSON.stringify({
      format: 'threadshelf.backup',
      version: 2,
      data: { entries: [] },
    });
    const text = encodeGoogleSnapshot({
      epoch: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
      mode: 'plain',
      root: true,
      data: plain,
    });
    await googleExtensionStore.write(DEVICE, REVISION, text);
    expect(requests.some((body) => body.includes('"mode":"plain"'))).toBe(true);
    expect(requests.some((body) => body.includes('threadshelf.backup'))).toBe(true);
  });
});
