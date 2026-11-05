// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createManifest } from '../../src/manifest.mjs';
import {
  connectGoogleExtension,
  googleExtensionStore,
  hasGoogleOAuthClient,
} from '../../src/sync/google-extension';

const pkg = { version: '1.2.0' };
const DEVICE = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const REVISION = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_EXTENSION_CLIENT_ID;
});

describe('Chromium extension Google configuration', () => {
  it('does not request identity permission unless a Chrome OAuth client is configured', () => {
    const baseline = createManifest(pkg);
    expect(baseline.permissions).not.toContain('identity');
    expect(baseline).not.toHaveProperty('oauth2');
    process.env.GOOGLE_EXTENSION_CLIENT_ID = 'chrome-client-123';
    const withGoogle = createManifest(pkg);
    expect(withGoogle.permissions).toContain('identity');
    expect(withGoogle.oauth2).toMatchObject({ client_id: 'chrome-client-123' });
    expect(withGoogle.oauth2!.scopes).toContain('https://www.googleapis.com/auth/drive.file');
    expect(withGoogle.oauth2!.scopes).not.toContain('https://www.googleapis.com/auth/drive');
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
});
