import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSessionCookie } from '../../server/session';
import shareApi from '../../api/share';
import shareNotesApi from '../../api/share-notes';
import { sharedSnapshot } from '@/share/model';
import { prepareSharedSnapshot } from '@/share/prepare';
import type { EntryBundle, Tweet } from '@/types/model';

const ORIGIN = 'https://theardx.example';
const blobs = vi.hoisted(() => new Map<string, string>());

vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (path: string, value: string) => {
    blobs.set(path, value);
    return { url: path };
  }),
  get: vi.fn(async (path: string) => {
    const content = blobs.get(path);
    return content === undefined ? null : { statusCode: 200, stream: new Response(content).body };
  }),
  list: vi.fn(async ({ prefix, limit }: { prefix: string; limit: number }) => ({
    blobs: [...blobs.keys()]
      .filter((path) => path.startsWith(prefix))
      .slice(0, limit)
      .map((pathname) => ({ pathname })),
    hasMore: false,
  })),
  del: vi.fn(async (paths: string | string[]) => {
    for (const path of Array.isArray(paths) ? paths : [paths]) blobs.delete(path);
  }),
}));

function bundle(): EntryBundle {
  const post: Tweet = {
    id: '123',
    url: 'https://x.com/author/status/123',
    author: { handle: 'author', name: 'Author' },
    text: [{ t: 'text', v: 'Complete body. The article text is retained.' }],
    media: [{ kind: 'photo', url: 'https://pbs.twimg.com/media/cover.jpg' }],
    article: {
      url: 'https://x.com/author/article/123',
      title: 'An article',
      blocks: [
        { t: 'heading', level: 2, text: [{ t: 'text', v: 'Introduction' }] },
        { t: 'paragraph', text: [{ t: 'text', v: 'Full article paragraph' }] },
      ],
    },
    linkedTweetIds: [],
    availability: 'available',
    context: 'full',
    firstSeenAt: 1,
    lastSeenAt: 1,
    source: 'xds',
  };
  return {
    entry: {
      id: 'private-entry-id',
      kind: 'thread',
      title: 'Shared article',
      authorHandle: 'author',
      focalTweetId: post.id,
      tweetIds: [post.id],
      contextTweetIds: [],
      referenceTweetIds: [],
      externalRefs: [],
      completeness: {
        status: 'complete',
        startVerified: true,
        endVerified: true,
        gaps: 0,
        issues: [],
        checkedAt: 1,
      },
      sourceUrl: post.url,
      savedAt: 1,
      updatedAt: 1,
      readState: 'unread',
      readLater: true,
      favorite: true,
      readProgress: 40,
      categoryId: 'private-cat',
      tags: ['private-tag'],
      collectionIds: ['private-collection'],
      note: 'My private note and password',
      offline: 'full',
      searchText: 'private indexed terms',
    },
    tweets: { [post.id]: post },
    relations: [],
    media: {},
  };
}

function signedCookie(login = 'lp460'): string {
  const request = new Request(ORIGIN);
  return setSessionCookie(request, {
    login,
    token: 'private-github-access-token',
    expiresAt: Date.now() + 60_000,
  }).split(';')[0]!;
}

function signedGoogleCookie(): string {
  const request = new Request(ORIGIN);
  return setSessionCookie(request, {
    provider: 'google',
    subject: '12345678901234567890',
    login: 'reader@example.com',
    token: 'secret-google-access',
    refreshToken: 'secret-google-refresh',
    accessExpiresAt: Date.now() + 60_000,
    expiresAt: Date.now() + 60_000,
  }).split(';')[0]!;
}

function req(path: string, method = 'GET', cookie = '', origin = ORIGIN, body?: unknown) {
  return new Request(ORIGIN + path, {
    method,
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const snapshot = () =>
  prepareSharedSnapshot([bundle()], { type: 'article', title: 'Shared article' });

describe('Public TheardX sharing', () => {
  beforeEach(() => {
    blobs.clear();
    process.env.SESSION_SECRET = 'a-test-secret-for-theardx-with-more-than-32-characters';
    process.env.WEB_ORIGIN = ORIGIN;
    process.env.BLOB_STORE_ID = 'test-private-store';
  });
  afterEach(() => {
    delete process.env.SESSION_SECRET;
    delete process.env.WEB_ORIGIN;
    delete process.env.BLOB_STORE_ID;
  });

  it('publishes only explicitly selected public fields, preserving complete article text', () => {
    const result = snapshot();
    expect(sharedSnapshot.safeParse(result).success).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).toContain('Full article paragraph');
    expect(serialized).toContain('Complete body.');
    for (const privateValue of [
      'My private note',
      'private-cat',
      'private-tag',
      'private-collection',
      'private indexed terms',
      'private-entry-id',
      'xds',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(result.items[0]!.posts[0]!.article?.blocks).toHaveLength(2);
  });

  it('rejects hidden private fields and dangerous links even when submitted directly', () => {
    const leaked = { ...snapshot(), note: 'private note' };
    expect(sharedSnapshot.safeParse(leaked).success).toBe(false);
    const malicious = snapshot();
    malicious.items[0]!.posts[0]!.url = 'javascript:alert(1)';
    expect(sharedSnapshot.safeParse(malicious).success).toBe(false);
  });

  it('requires authentication and same origin to create; public visitors can read', async () => {
    const data = { snapshot: snapshot(), expiresInDays: 7 };
    expect((await shareApi.fetch(req('/api/share', 'POST', '', ORIGIN, data))).status).toBe(401);
    expect(
      (
        await shareApi.fetch(
          req('/api/share', 'POST', signedCookie(), 'https://evil.example', data),
        )
      ).status,
    ).toBe(403);
    const created = await shareApi.fetch(req('/api/share', 'POST', signedCookie(), ORIGIN, data));
    expect(created.status).toBe(201);
    const share = (await created.json()) as { id: string; url: string };
    expect(share.url).toBe(`${ORIGIN}/s/${share.id}`);
    const response = await shareApi.fetch(req(`/api/share?id=${share.id}`));
    expect(response.status).toBe(200);
    const publicResponse = await response.text();
    expect(publicResponse).toContain('Full article paragraph');
    expect(publicResponse).not.toContain('private-github-access-token');
    expect(publicResponse).not.toContain('My private note');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('lists only the owner’s shares and prevents another user from revoking them', async () => {
    const created = await shareApi.fetch(
      req('/api/share', 'POST', signedCookie(), ORIGIN, {
        snapshot: snapshot(),
        expiresInDays: null,
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const mine = await shareApi.fetch(req('/api/share?mine=1', 'GET', signedCookie()));
    expect(((await mine.json()) as { shares: unknown[] }).shares).toHaveLength(1);
    const other = await shareApi.fetch(
      req('/api/share?mine=1', 'GET', signedCookie('another-user')),
    );
    expect(((await other.json()) as { shares: unknown[] }).shares).toHaveLength(0);
    expect(
      (await shareApi.fetch(req(`/api/share?id=${id}`, 'DELETE', signedCookie('another-user'))))
        .status,
    ).toBe(403);
    expect(
      (await shareApi.fetch(req(`/api/share?id=${id}`, 'DELETE', signedCookie()))).status,
    ).toBe(204);
    expect((await shareApi.fetch(req(`/api/share?id=${id}`))).status).toBe(404);
  });

  it('keeps legacy and read-only shares immutable and rejects collaborative posts', async () => {
    const created = await shareApi.fetch(req('/api/share', 'POST', signedCookie(), ORIGIN, {
      snapshot: snapshot(), expiresInDays: 7,
    }));
    const { id } = (await created.json()) as { id: string };
    const read = await shareApi.fetch(req(`/api/share?id=${id}`));
    expect(((await read.json()) as { collaboration: boolean }).collaboration).toBe(false);
    expect((await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`))).status).toBe(200);
    expect((await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`, 'POST', signedCookie(), ORIGIN, {
      kind: 'comment', itemIndex: 0, text: 'Cannot change this share',
    }))).status).toBe(403);
  });

  it('allows only authenticated same-origin contributions when collaboration is enabled', async () => {
    const before = snapshot();
    const created = await shareApi.fetch(req('/api/share', 'POST', signedCookie(), ORIGIN, {
      snapshot: before, expiresInDays: 7, collaboration: true,
    }));
    expect(created.status).toBe(201);
    const { id, collaboration } = (await created.json()) as { id: string; collaboration: boolean };
    expect(collaboration).toBe(true);
    const note = { kind: 'annotation', itemIndex: 0, postId: '123', quote: 'Complete body.', text: 'Interesting find' };
    expect((await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`, 'POST', '', ORIGIN, note))).status).toBe(401);
    expect((await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`, 'POST', signedCookie(), 'https://evil.example', note))).status).toBe(403);
    expect((await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`, 'POST', signedCookie(), ORIGIN, {
      ...note, quote: 'A forged excerpt',
    }))).status).toBe(400);
    expect((await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`, 'POST', signedCookie(), ORIGIN, {
      ...note, snapshot: { title: 'overwrite source' },
    }))).status).toBe(400);
    const sent = await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`, 'POST', signedCookie(), ORIGIN, note));
    expect(sent.status).toBe(201);
    const publicNotes = await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`));
    expect(publicNotes.status).toBe(200);
    const { notes } = (await publicNotes.json()) as { notes: Array<{ text: string; quote: string; author: string }> };
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ text: 'Interesting find', quote: 'Complete body.', author: 'lp460' });
    const shared = await shareApi.fetch(req(`/api/share?id=${id}`));
    expect((await shared.json()) as { snapshot: unknown }).toMatchObject({ snapshot: before });
    const revoked = await shareApi.fetch(req(`/api/share?id=${id}`, 'DELETE', signedCookie()));
    expect(revoked.status).toBe(204);
    expect((await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`))).status).toBe(404);
    expect([...blobs.keys()].filter((path) => path.includes(id))).toHaveLength(0);
  });

  it('does not expose a Google commenter’s email address or tokens to visitors', async () => {
    const created = await shareApi.fetch(req('/api/share', 'POST', signedCookie(), ORIGIN, {
      snapshot: snapshot(), expiresInDays: null, collaboration: true,
    }));
    const { id } = (await created.json()) as { id: string };
    const posted = await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`, 'POST', signedGoogleCookie(), ORIGIN, {
      kind: 'note', itemIndex: 0, text: 'A public contribution',
    }));
    expect(posted.status).toBe(201);
    const publicResponse = await shareNotesApi.fetch(req(`/api/share-notes?id=${id}`));
    const body = await publicResponse.text();
    expect(body).toContain('reader');
    expect(body).not.toContain('@example.com');
    expect(body).not.toContain('secret-google');
  });

  it('returns a clear setup error when private Vercel Blob is not connected', async () => {
    delete process.env.BLOB_STORE_ID;
    const response = await shareApi.fetch(
      req('/api/share', 'POST', signedCookie(), ORIGIN, { snapshot: snapshot(), expiresInDays: 7 }),
    );
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: string }).error).toMatch(/Vercel/);
  });
});
