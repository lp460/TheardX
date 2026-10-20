/**
 * Runtime validation for data crossing a trust boundary: messages from content scripts and
 * imported backup files. Strings are bounded, IDs and URLs are checked, unknown keys are dropped.
 */
import { z } from 'zod';
import { HANDLE_RE, TWEET_ID_RE, isAllowedMediaUrl, safeHref } from '@/utils/url';

// Never try to compile validators with `new Function` — forbidden by the extension CSP (no eval).
z.config({ jitless: true });

const MAX_TEXT = 20_000;
const str = (max = 2_000) => z.string().max(max);
export const tweetId = z.string().regex(TWEET_ID_RE);
export const handle = z.string().regex(HANDLE_RE);
const httpUrl = z
  .string()
  .max(4_000)
  .refine((u) => safeHref(u) !== null, 'http(s) URL required');
const mediaUrl = z.string().max(2_000).refine(isAllowedMediaUrl, 'twimg URL required');
const isoDate = z
  .string()
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid date');
const ts = z.number().int().nonnegative().max(8.64e15);

export const segmentSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('text'), v: str(MAX_TEXT) }),
  z.object({ t: z.literal('link'), v: str(), href: httpUrl }),
  z.object({ t: z.literal('mention'), v: str(64), handle }),
  z.object({ t: z.literal('hashtag'), v: str(280), tag: str(280) }),
  z.object({ t: z.literal('cashtag'), v: str(32), tag: str(32) }),
]);

export const authorSchema = z.object({
  handle,
  name: str(200).optional(),
  avatarUrl: mediaUrl.optional(),
  verified: z.boolean().optional(),
});

export const mediaItemSchema = z.object({
  kind: z.enum(['photo', 'video', 'gif']),
  url: mediaUrl,
  alt: str(5_000).optional(),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
  playbackUrl: httpUrl.optional(),
});

export const linkCardSchema = z.object({
  url: httpUrl,
  title: str(1_000).optional(),
  domain: str(255).optional(),
  imageUrl: mediaUrl.optional(),
});

export const quotedSchema = z.object({
  id: tweetId.optional(),
  url: httpUrl.optional(),
  author: authorSchema.optional(),
  text: z.array(segmentSchema).max(2_000).optional(),
  createdAt: isoDate.optional(),
  media: z.array(mediaItemSchema).max(20).optional(),
});

export const factsSchema = z.object({
  isRoot: z.boolean().optional(),
  continuation: z.enum(['none', 'more', 'unknown']).optional(),
  parentUnavailable: z.boolean().optional(),
  observedAt: ts.optional(),
});

export const tweetSchema = z.object({
  id: tweetId,
  url: httpUrl,
  author: authorSchema,
  createdAt: isoDate.optional(),
  createdAtSource: z.enum(['page', 'snowflake']).optional(),
  text: z.array(segmentSchema).max(2_000),
  textTruncated: z.boolean().optional(),
  lang: str(16).optional(),
  media: z.array(mediaItemSchema).max(20),
  card: linkCardSchema.optional(),
  quoted: quotedSchema.optional(),
  replyingTo: z.array(handle).max(50).optional(),
  linkedTweetIds: z.array(tweetId).max(100),
  availability: z.enum(['available', 'deleted', 'unavailable']),
  context: z.enum(['full', 'quote']),
  facts: factsSchema.optional(),
  firstSeenAt: ts,
  lastSeenAt: ts,
  source: z.enum(['xds', 'classic', 'import']).optional(),
});

export const relationSchema = z.object({
  id: str(200),
  type: z.enum(['reply', 'quote', 'link']),
  parentId: tweetId,
  childId: tweetId,
  source: z.enum(['ancestor-chain', 'connector', 'quote-card', 'text-link', 'import']),
  gap: z.boolean().optional(),
  observedAt: ts,
});

const issueCode = z.enum([
  'start-not-loaded',
  'start-unverified',
  'end-not-loaded',
  'end-unverified',
  'deleted-post',
  'branching',
  'conversation-continues',
  'no-structure',
  'not-status-page',
  'truncated-text',
]);

export const completenessSchema = z.object({
  status: z.enum(['complete', 'partial', 'needs_more', 'unreconstructable', 'single', 'manual']),
  startVerified: z.boolean(),
  endVerified: z.boolean(),
  gaps: z.number().int().nonnegative().max(10_000),
  issues: z.array(issueCode).max(20),
  checkedAt: ts,
});

const entityId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[\w-]+$/);

export const entrySchema = z.object({
  id: entityId,
  kind: z.enum(['tweet', 'thread', 'references', 'selection']),
  title: str(500),
  authorHandle: handle,
  authorName: str(200).optional(),
  focalTweetId: tweetId,
  tweetIds: z.array(tweetId).min(1).max(5_000),
  contextTweetIds: z.array(tweetId).max(100).default([]),
  referenceTweetIds: z.array(tweetId).max(500).default([]),
  externalRefs: z
    .array(
      z.object({
        id: tweetId.optional(),
        url: httpUrl,
        kind: z.enum(['quote', 'link']),
        captured: z.boolean(),
      }),
    )
    .max(500)
    .default([]),
  completeness: completenessSchema,
  sourceUrl: httpUrl,
  savedAt: ts,
  updatedAt: ts,
  publishedAt: isoDate.optional(),
  readState: z.enum(['unread', 'read']),
  readLater: z.boolean(),
  favorite: z.boolean(),
  readProgress: z.number().min(0).max(1).default(0),
  lastReadAt: ts.optional(),
  categoryId: entityId.nullable(),
  tags: z.array(str(64)).max(100),
  collectionIds: z.array(entityId).max(200),
  note: str(MAX_TEXT),
  offline: z.enum(['full', 'partial', 'text-only']).default('text-only'),
  searchText: str(500_000).default(''),
});

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const collectionSchema = z.object({
  id: entityId,
  name: str(120).min(1),
  description: str(1_000).optional(),
  color,
  createdAt: ts,
  updatedAt: ts,
  order: z.number().int(),
});

export const categorySchema = z.object({
  id: entityId,
  name: str(80).min(1),
  color,
  createdAt: ts,
});
