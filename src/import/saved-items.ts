import { getDb, toStoredTweet } from '@/storage/db';
import type { Entry, Platform, Tweet } from '@/types/model';
import { uid } from '@/utils/id';

export interface SavedItemRef {
  platform: Platform;
  id: string;
  url: string;
}

/** Public links and IDs only. Passwords, cookies and third-party tokens never enter an import. */
export function refFromUrl(raw: string): SavedItemRef | null {
  let url: URL;
  const input = raw.trim().replace(/&amp;/g, '&');
  try { url = new URL(input.startsWith('/r/') || input.startsWith('/comments/') ? `https://www.reddit.com${input}` : input); }
  catch { return null; }
  const host = url.hostname.toLowerCase();
  if (['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(host)) {
    const id = /\/status\/(\d{6,25})(?:\/|$)/.exec(url.pathname)?.[1];
    return id ? { platform: 'x', id, url: `https://x.com/i/status/${id}` } : null;
  }
  if (!['reddit.com', 'www.reddit.com', 'old.reddit.com', 'redd.it', 'www.redd.it'].includes(host)) return null;
  if (host.endsWith('redd.it')) {
    const id = /^\/([a-z0-9]{3,12})\/?$/i.exec(url.pathname)?.[1];
    return id ? { platform: 'reddit', id: `t3_${id.toLowerCase()}`, url: `https://www.reddit.com/comments/${id}/` } : null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const pos = parts.indexOf('comments');
  const postId = pos >= 0 ? parts[pos + 1] : null;
  if (!postId || !/^[a-z0-9]{3,12}$/i.test(postId)) return null;
  const commentId = parts[pos + 3];
  const isComment = !!commentId && /^[a-z0-9]{3,12}$/i.test(commentId);
  return {
    platform: 'reddit',
    id: `${isComment ? 't1' : 't3'}_${(isComment ? commentId : postId).toLowerCase()}`,
    url: `https://www.reddit.com${url.pathname.replace(/\/$/, '')}/`,
  };
}

/** RFC-4180 CSV cells, including escaped quotes and multiline fields. */
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\r' || ch === '\n') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

/** Reddit data-request CSV and X bookmark exports (JSON, JS or CSV). */
export function parseSavedItems(text: string, filename = ''): SavedItemRef[] {
  if (text.length > 60 * 1024 * 1024) throw new Error('Fichier trop volumineux (60 Mo maximum).');
  const found = new Map<string, SavedItemRef>();
  const add = (ref: SavedItemRef | null) => {
    if (ref && found.size < 100_000) found.set(`${ref.platform}:${ref.id}`, ref);
  };
  const addId = (id: string, platform: Platform) => {
    if (platform === 'x' && /^\d{6,25}$/.test(id))
      add({ platform, id, url: `https://x.com/i/status/${id}` });
    if (platform === 'reddit' && /^t[13]_[a-z0-9]{3,12}$/i.test(id))
      add({ platform, id: id.toLowerCase(), url: `https://www.reddit.com/by_id/${id.toLowerCase()}/` });
  };
  const trimmed = text.trim().replace(/^\uFEFF/, '');
  const xArchive = /^window\.YTD\.(?:bookmark|bookmarks)\.part\d+\s*=\s*/.test(trimmed);
  const jsonText = xArchive ? trimmed.replace(/^window\.YTD\.(?:bookmark|bookmarks)\.part\d+\s*=\s*/, '').replace(/;\s*$/, '') : trimmed;
  if (jsonText.startsWith('[') || jsonText.startsWith('{')) {
    let parsed: unknown;
    try { parsed = JSON.parse(jsonText); }
    catch { throw new Error('Le fichier JSON est invalide.'); }
    const walk = (value: unknown, depth: number) => {
      if (depth > 9 || found.size >= 100_000) return;
      if (typeof value === 'string') {
        add(refFromUrl(value));
        return;
      }
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1);
        return;
      }
      const row = value as Record<string, unknown>;
      for (const [key, item] of Object.entries(row)) {
        if (/^(tweetId|tweet_id)$/i.test(key) && typeof item === 'string') addId(item, 'x');
        else if (/^(id|fullname)$/i.test(key) && typeof item === 'string' && /^t[13]_/.test(item)) addId(item, 'reddit');
        else if (typeof item === 'string' && /(url|permalink|link)$/i.test(key)) add(refFromUrl(item));
        else if (typeof item === 'object') walk(item, depth + 1);
      }
    };
    walk(parsed, 0);
  } else if (xArchive) {
    throw new Error('Archive X illisible.');
  } else {
    const rows = csvRows(trimmed);
    const header = rows[0]?.map((s) => s.trim().toLowerCase()) ?? [];
    const named = header.some((c) => /^(permalink|url|link|tweet_id|tweetid|id|fullname)$/.test(c));
    const platform: Platform = /reddit|saved_(?:posts|comments)/i.test(filename) ? 'reddit' : 'x';
    for (const row of rows.slice(named ? 1 : 0)) {
      for (let i = 0; i < row.length; i++) {
        const cell = row[i]?.trim() ?? '';
        add(refFromUrl(cell));
        if (named && /^(id|fullname|tweet_id|tweetid)$/.test(header[i] ?? '')) addId(cell, platform);
      }
    }
  }
  return [...found.values()];
}

export interface SavedImportProgress {
  processed: number;
  total: number;
  added: number;
  skipped: number;
}

/** Import link-only placeholders. Normal capture later enriches the same focal post, without duplicates. */
export async function importSavedItems(
  refs: SavedItemRef[],
  onProgress?: (progress: SavedImportProgress) => void,
  signal?: AbortSignal,
): Promise<SavedImportProgress> {
  const db = getDb();
  const progress = { processed: 0, total: refs.length, added: 0, skipped: 0 };
  for (let i = 0; i < refs.length; i += 50) {
    if (signal?.aborted) throw new Error('Import interrompu. Les éléments déjà ajoutés sont conservés.');
    const batch = refs.slice(i, i + 50);
    await db.transaction('rw', [db.entries, db.tweets], async () => {
      for (const ref of batch) {
        if ((await db.entries.where('focalTweetId').equals(ref.id).first())) {
          progress.skipped++;
          continue;
        }
        const now = Date.now();
        const existing = await db.tweets.get(ref.id);
        if (!existing) {
          const tweet: Tweet = {
            id: ref.id, platform: ref.platform, url: ref.url,
            author: { handle: 'inconnu' }, text: [], textTruncated: true,
            media: [], linkedTweetIds: [], availability: 'available', context: 'full',
            firstSeenAt: now, lastSeenAt: now, source: 'import',
          };
          await db.tweets.put(toStoredTweet(tweet));
        }
        const entry: Entry = {
          id: uid('e'), platform: ref.platform, kind: 'tweet',
          title: ref.platform === 'x' ? 'Publication de @inconnu' : 'Post de u/inconnu',
          authorHandle: 'inconnu', focalTweetId: ref.id, tweetIds: [ref.id],
          contextTweetIds: [], referenceTweetIds: [], externalRefs: [],
          completeness: { status: 'manual', startVerified: false, endVerified: false,
            gaps: 0, issues: ['start-unverified'], checkedAt: now },
          sourceUrl: ref.url, savedAt: now, updatedAt: now,
          readState: 'unread', readLater: true, favorite: false, readProgress: 0,
          categoryId: null, tags: [`import-${ref.platform}`], collectionIds: [], note: '',
          offline: 'text-only', searchText: ref.url,
        };
        await db.entries.add(entry);
        progress.added++;
      }
    });
    progress.processed += batch.length;
    onProgress?.({ ...progress });
    // Yield to the UI and checkpoint each batch: interruption can resume by ID without duplicates.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return progress;
}
