import type {
  Author,
  CaptureContext,
  LinkCard,
  MediaItem,
  QuotedRef,
  Segment,
  Tweet,
  XArticle,
} from '@/types/model';
import { snowflakeToDate } from '@/utils/snowflake';
import {
  canonicalTweetUrl,
  isAllowedMediaUrl,
  isHandle,
  isTweetId,
  largeMediaUrl,
} from '@/utils/url';
import { deriveFromSegments } from './rich-text';

export interface RawTweet {
  id: string;
  author: Author;
  createdAtMs?: number;
  createdAtIso?: string;
  text: Segment[];
  textTruncated?: boolean;
  lang?: string;
  media: MediaItem[];
  card?: LinkCard;
  quoted?: QuotedRef;
  replyingTo?: string[];
  article?: XArticle;
  context: CaptureContext;
  source: 'xds' | 'classic';
}

/** Generic "Image" alt placeholders X uses when the author wrote no description. */
const GENERIC_ALTS = new Set([
  'image',
  'imagen',
  'bild',
  'immagine',
  'imagem',
  'photo',
  'foto',
  '画像',
  'изображение',
  '',
]);

export function cleanAlt(alt: string | null | undefined): string | undefined {
  const v = (alt ?? '').trim();
  return GENERIC_ALTS.has(v.toLowerCase()) ? undefined : v;
}

export function dedupeMedia(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  const out: MediaItem[] = [];
  for (const m of items) {
    if (!isAllowedMediaUrl(m.url)) continue;
    const url = m.kind === 'photo' ? largeMediaUrl(m.url) : m.url;
    const key = url.split('?')[0]!;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...m, url });
  }
  return out;
}

/** Validates and normalises raw extraction output. Returns null if the post cannot be identified. */
export function buildTweet(raw: RawTweet, now = Date.now()): Tweet | null {
  if (!isTweetId(raw.id) || !isHandle(raw.author.handle)) return null;
  let createdAt: string | undefined;
  let createdAtSource: Tweet['createdAtSource'];
  if (raw.createdAtIso && !Number.isNaN(Date.parse(raw.createdAtIso))) {
    createdAt = new Date(raw.createdAtIso).toISOString();
    createdAtSource = 'page';
  } else if (raw.createdAtMs && raw.createdAtMs > Date.UTC(2006, 0, 1)) {
    createdAt = new Date(raw.createdAtMs).toISOString();
    createdAtSource = 'page';
  } else {
    const d = snowflakeToDate(raw.id);
    if (d) {
      createdAt = d.toISOString();
      createdAtSource = 'snowflake';
    }
  }
  const derived = deriveFromSegments(raw.text);
  const author: Author = { handle: raw.author.handle };
  if (raw.author.name) author.name = raw.author.name;
  if (raw.author.avatarUrl && isAllowedMediaUrl(raw.author.avatarUrl))
    author.avatarUrl = raw.author.avatarUrl;
  if (raw.author.verified) author.verified = true;

  const tweet: Tweet = {
    id: raw.id,
    url: canonicalTweetUrl(raw.id, raw.author.handle),
    author,
    text: raw.text,
    media: dedupeMedia(raw.media),
    linkedTweetIds: derived.linkedTweetIds.filter((id) => id !== raw.id),
    availability: 'available',
    context: raw.context,
    firstSeenAt: now,
    lastSeenAt: now,
    source: raw.source,
  };
  if (createdAt) {
    tweet.createdAt = createdAt;
    tweet.createdAtSource = createdAtSource;
  }
  if (raw.textTruncated) tweet.textTruncated = true;
  if (raw.lang) tweet.lang = raw.lang;
  if (raw.card) tweet.card = raw.card;
  if (raw.quoted) tweet.quoted = { ...raw.quoted, media: dedupeMedia(raw.quoted.media ?? []) };
  if (raw.replyingTo?.length) tweet.replyingTo = raw.replyingTo;
  if (raw.article) {
    tweet.article = raw.article;
    // Images that belong to the Article body are not also the post's own media.
    const key = (u: string) => (u.split('?')[0] ?? u).replace(/\.\w+$/, '');
    const inArticle = new Set(
      [
        raw.article.coverUrl,
        ...raw.article.blocks.map((b) => (b.t === 'image' ? b.media.url : undefined)),
      ]
        .filter((u): u is string => !!u)
        .map(key),
    );
    if (inArticle.size) tweet.media = tweet.media.filter((m) => !inArticle.has(key(m.url)));
  }
  return tweet;
}

/** Turns a quoted snapshot that has an ID into a stand-alone (partial) Tweet record. */
export function quoteToTweet(
  q: QuotedRef,
  now = Date.now(),
  source: 'xds' | 'classic' = 'xds',
): Tweet | null {
  if (!q.id || !q.author) return null;
  const raw: RawTweet = {
    id: q.id,
    author: q.author,
    text: q.text ?? [],
    media: q.media ?? [],
    context: 'quote',
    source,
  };
  if (q.createdAt) raw.createdAtIso = q.createdAt;
  return buildTweet(raw, now);
}
