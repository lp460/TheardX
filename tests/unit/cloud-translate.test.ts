import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSessionCookie } from '../../server/session';
import translateApi from '../../api/translate';
import { translateCloudBundle } from '@/translate/cloud';
import type { EntryBundle, Tweet } from '@/types/model';

const ORIGIN = 'https://theardx.example';
const cookieRequest = new Request(ORIGIN);

function request(body: unknown, cookie = '', origin = ORIGIN, method = 'POST'): Request {
  return new Request(`${ORIGIN}/api/translate`, {
    method,
    headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

function signedCookie(): string {
  return setSessionCookie(cookieRequest, {
    login: 'lp460',
    token: 'never-sent-to-AI',
    expiresAt: Date.now() + 600_000,
  }).split(';')[0]!;
}

function bundle(): EntryBundle {
  const post: Tweet = {
    id: 'post-1',
    url: 'https://x.com/post/1',
    author: { handle: 'someone' },
    lang: 'en',
    text: [{ t: 'text', v: 'Hello everyone' }],
    media: [],
    linkedTweetIds: [],
    availability: 'available',
    context: 'full',
    firstSeenAt: 1,
    lastSeenAt: 1,
    article: {
      url: 'https://x.com/article/1',
      title: 'The title',
      blocks: [
        { t: 'paragraph', text: [{ t: 'text', v: 'A new article here.' }] },
        { t: 'code', code: 'npm install code' },
      ],
    },
  };
  return {
    entry: {
      id: 'entry-1',
      kind: 'thread',
      title: 'The title',
      authorHandle: 'someone',
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
      sourceUrl: '',
      savedAt: 1,
      updatedAt: 1,
      readState: 'unread',
      readLater: false,
      favorite: false,
      readProgress: 0,
      categoryId: null,
      tags: [],
      collectionIds: [],
      note: '',
      offline: 'full',
      searchText: '',
    },
    tweets: { [post.id]: post },
    relations: [],
    media: {},
  };
}

describe('Vercel cloud translation gateway', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'long-test-secret-at-least-thirty-two-characters';
    process.env.WEB_ORIGIN = ORIGIN;
    process.env.VERCEL_OIDC_TOKEN = 'test-oidc-token';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.SESSION_SECRET;
    delete process.env.WEB_ORIGIN;
    delete process.env.VERCEL_OIDC_TOKEN;
  });

  it('rejects unauthenticated, cross-origin, oversized and malformed requests before calling AI', async () => {
    const valid = { source: 'en', target: 'fr', texts: ['Hello world'] };
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await translateApi.fetch(request(valid))).status).toBe(401);
    expect(
      (await translateApi.fetch(request(valid, signedCookie(), 'https://other.example'))).status,
    ).toBe(403);
    expect(
      (await translateApi.fetch(request({ ...valid, texts: ['a'.repeat(7000)] }, signedCookie())))
        .status,
    ).toBe(400);
    expect(
      (await translateApi.fetch(request({ ...valid, texts: [] }, signedCookie()))).status,
    ).toBe(400);
    expect(
      (await translateApi.fetch(request({ ...valid, source: 'fr' }, signedCookie()))).status,
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards only validated text to Vertex, never GitHub credentials, and checks structured output', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toEqual({
        Authorization: 'Bearer test-oidc-token',
        'Content-Type': 'application/json',
      });
      const forwarded = JSON.parse(init.body as string);
      expect(forwarded.model).toBe('google/gemini-2.5-flash-lite');
      expect(forwarded.providerOptions.gateway.only).toEqual(['vertex']);
      expect(JSON.stringify(forwarded)).not.toContain('never-sent-to-AI');
      return Response.json({ choices: [{ message: { content: '{"translations":["Bonjour"]}' } }] });
    });
    vi.stubGlobal('fetch', fetch);
    const response = await translateApi.fetch(
      request({ source: 'en', target: 'fr', texts: ['Hello'] }, signedCookie()),
    );
    expect(await response.json()).toEqual({ translations: ['Bonjour'] });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('stops when gateway credits are unavailable and hides provider errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'private provider detail' }, { status: 402 })),
    );
    const response = await translateApi.fetch(
      request({ source: 'en', target: 'fr', texts: ['Hello'] }, signedCookie()),
    );
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('private provider detail');
  });

  it('translates post and article with one request, skips code and reuses cache without network', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(init.body as string) as { texts: string[] };
      expect(sent.texts).toEqual(['Hello everyone', 'The title', 'A new article here.']);
      return Response.json({ translations: sent.texts.map((s) => `[FR] ${s}`) });
    });
    vi.stubGlobal('fetch', fetch);
    const original = bundle();
    const records = await translateCloudBundle(original, 'fr');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      provider: 'cloud',
      text: '[FR] Hello everyone',
      articleTitle: '[FR] The title',
    });
    expect(records[0]!.blocks).toEqual(['[FR] A new article here.', null]);
    expect(fetch).toHaveBeenCalledOnce();
    const cached = await translateCloudBundle(original, 'fr', {
      existing: { [records[0]!.key]: records[0]! },
    });
    expect(cached).toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
