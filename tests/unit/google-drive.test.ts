// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSnapshot, listSnapshots, readSnapshot, DriveError } from '../../server/google-drive';
import { encodeGoogleSnapshot } from '@/sync/google-snapshot';

const DEVICE = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const REVISION = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const FILE = `theardx-${DEVICE}-${REVISION}.json`;

afterEach(() => vi.unstubAllGlobals());

describe('Scoped Google Drive storage', () => {
  it('reads only TheardX-owned snapshots, not unrelated Drive files', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes('alt=media')) return new Response('{"format":"threadshelf.encrypted"}');
        if (url.includes('mimeType'))
          return Response.json({ files: [{ id: 'folder123456789', name: 'TheardX' }] });
        return Response.json({
          files: [
            { id: 'file123456789', name: FILE, createdTime: '2026-11-05T10:00:00.000Z' },
            { id: 'privateFile123', name: 'taxes-2026.pdf' },
          ],
        });
      }),
    );
    expect((await listSnapshots('test-token')).map((file) => file.id)).toEqual(['file123456789']);
    await expect(readSnapshot('test-token', 'privateFile123')).rejects.toMatchObject({
      status: 404,
    });
    expect(await readSnapshot('test-token', 'file123456789')).toContain('threadshelf.encrypted');
    expect(calls.every((url) => url.startsWith('https://www.googleapis.com/drive/v3/files'))).toBe(
      true,
    );
  });

  it('creates a visible folder and uploads encrypted data as a new file', async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
        if (url.includes('uploadType=multipart'))
          return Response.json({ id: 'createdFile123', name: FILE });
        if (init?.method === 'POST') return Response.json({ id: 'folder123456789' });
        return Response.json({ files: [] });
      }),
    );
    const encrypted = JSON.stringify({ format: 'threadshelf.encrypted', v: 1, data: 'CIPHER' });
    expect(
      await createSnapshot('token', { deviceId: DEVICE, revisionId: REVISION, text: encrypted }),
    ).toMatchObject({ id: 'createdFile123', name: FILE });
    expect(calls.some((call) => call.body?.includes('application/vnd.google-apps.folder'))).toBe(
      true,
    );
    const uploaded = calls.find((call) => call.url.includes('uploadType=multipart'))!;
    expect(uploaded.body).toContain('"parents":["folder123456789"]');
    expect(uploaded.body).toContain(encrypted);
    expect(uploaded.body).not.toContain('github');
  });

  it('refuses plaintext, invalid IDs and oversized uploads before writing', async () => {
    await expect(
      createSnapshot('token', { deviceId: DEVICE, revisionId: REVISION, text: '{}' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      createSnapshot('token', {
        deviceId: DEVICE,
        revisionId: REVISION,
        text: 'a'.repeat(4 * 1024 * 1024),
      }),
    ).rejects.toMatchObject({ status: 413 });
    await expect(readSnapshot('token', '../secrets')).rejects.toBeInstanceOf(DriveError);
  });

  it('accepts an explicitly chosen standard backup, but rejects an unwrapped plaintext file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('uploadType=multipart'))
          return Response.json({ id: 'createdFile123', name: FILE });
        if (init?.method === 'POST') return Response.json({ id: 'folder123456789' });
        return Response.json({ files: [] });
      }),
    );
    const plain = JSON.stringify({
      format: 'threadshelf.backup',
      version: 2,
      schemaVersion: 1,
      appVersion: '1.2',
      exportedAt: new Date().toISOString(),
      data: {
        entries: [],
        tweets: [],
        relations: [],
        collections: [],
        categories: [],
        annotations: [],
      },
    });
    const wrapped = encodeGoogleSnapshot({
      epoch: DEVICE,
      mode: 'plain',
      root: true,
      data: plain,
    });
    expect(
      await createSnapshot('token', { deviceId: DEVICE, revisionId: REVISION, text: wrapped }),
    ).toMatchObject({ id: 'createdFile123' });
    await expect(
      createSnapshot('token', { deviceId: DEVICE, revisionId: REVISION, text: plain }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
