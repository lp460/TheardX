/**
 * Offline media cache. Only public images already displayed to the user while browsing X
 * (pbs.twimg.com photos, video posters, card images, avatars) are fetched, once, from the background
 * worker, after the user explicitly saved the post. Videos are never downloaded.
 */
import type { Entry, MediaRecord, OfflineState, Tweet } from '@/types/model';
import { isAllowedMediaUrl, largerAvatarUrl } from '@/utils/url';
import { fromStoredTweet, getDb, type ThreadShelfDB } from './db';

export interface MediaRef {
  url: string;
  tweetId: string;
  kind: MediaRecord['kind'];
  /** Counts toward the entry's offline completeness. */
  essential: boolean;
}

export function mediaRefsFor(tweets: Tweet[]): MediaRef[] {
  const refs: MediaRef[] = [];
  const seen = new Set<string>();
  const push = (
    url: string | undefined,
    tweetId: string,
    kind: MediaRef['kind'],
    essential: boolean,
  ) => {
    if (!url || !isAllowedMediaUrl(url) || seen.has(url)) return;
    seen.add(url);
    refs.push({ url, tweetId, kind, essential });
  };
  for (const t of tweets) {
    for (const m of t.media) push(m.url, t.id, m.kind, true);
    for (const m of t.quoted?.media ?? []) push(m.url, t.id, m.kind, true);
    push(t.card?.imageUrl, t.id, 'card', false);
    if (t.author.avatarUrl) push(largerAvatarUrl(t.author.avatarUrl), t.id, 'avatar', false);
  }
  return refs;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function fetchBlob(
  url: string,
  fetcher: Fetcher,
  maxBytes: number,
  timeoutMs: number,
): Promise<{ blob: Blob; mime: string } | { error: string; tooLarge?: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(url, {
      signal: ctrl.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const mime = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!/^image\//.test(mime)) return { error: `Unexpected type ${mime || 'unknown'}` };
    const len = Number(res.headers.get('content-length') ?? '0');
    if (len > maxBytes) return { error: 'Too large', tooLarge: true };
    const blob = await res.blob();
    if (blob.size > maxBytes) return { error: 'Too large', tooLarge: true };
    return { blob, mime };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export function offlineStateFor(
  essential: MediaRef[],
  records: Map<string, MediaRecord>,
): OfflineState {
  if (essential.length === 0) return 'full';
  const cached = essential.filter((r) => records.get(r.url)?.status === 'cached').length;
  if (cached === essential.length) return 'full';
  return cached > 0 ? 'partial' : 'text-only';
}

/** Caches every image of an entry, then updates its offline state. Safe to call repeatedly. */
export async function cacheEntryMedia(
  entryId: string,
  opts: {
    fetcher?: Fetcher;
    maxBytes?: number;
    timeoutMs?: number;
    concurrency?: number;
    db?: ThreadShelfDB;
  } = {},
): Promise<{ offline: OfflineState; cached: number; failed: number }> {
  const db = opts.db ?? getDb();
  const fetcher = opts.fetcher ?? ((u, i) => fetch(u, i));
  const maxBytes = opts.maxBytes ?? 8 * 1024 * 1024;
  const entry = await db.entries.get(entryId);
  if (!entry) return { offline: 'text-only', cached: 0, failed: 0 };
  const ids = [
    ...new Set([...entry.tweetIds, ...entry.contextTweetIds, ...entry.referenceTweetIds]),
  ];
  const tweets = (await db.tweets.bulkGet(ids))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map(fromStoredTweet);
  const refs = mediaRefsFor(tweets);
  const existing = new Map<string, MediaRecord>();
  for (const r of await db.media.bulkGet(refs.map((r) => r.url))) if (r) existing.set(r.url, r);

  let cached = 0;
  let failed = 0;
  const queue = refs.filter((r) => existing.get(r.url)?.status !== 'cached');
  // Link already-cached media to these posts.
  for (const r of refs) {
    const rec = existing.get(r.url);
    if (rec && !rec.tweetIds.includes(r.tweetId)) {
      rec.tweetIds = [...rec.tweetIds, r.tweetId];
      await db.media.put(rec);
    }
  }
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const result = await fetchBlob(r.url, fetcher, maxBytes, opts.timeoutMs ?? 15_000);
      const prev = existing.get(r.url);
      const rec: MediaRecord = {
        url: r.url,
        tweetIds: [...new Set([...(prev?.tweetIds ?? []), r.tweetId])],
        kind: r.kind,
        status: 'remote',
      };
      if ('blob' in result) {
        rec.status = 'cached';
        rec.blob = result.blob;
        rec.mime = result.mime;
        rec.bytes = result.blob.size;
        rec.fetchedAt = Date.now();
        cached += 1;
      } else {
        rec.status = result.tooLarge ? 'too-large' : 'failed';
        rec.error = result.error.slice(0, 200);
        failed += 1;
      }
      await db.media.put(rec);
      existing.set(r.url, rec);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 3) }, worker));

  const offline = offlineStateFor(
    refs.filter((r) => r.essential),
    existing,
  );
  await db.entries.update(entryId, { offline } as Partial<Entry>);
  return { offline, cached, failed };
}
