import { z } from 'zod';

// A deliberately small PUBLIC snapshot schema. Never serialize Entry, Tweet or Dexie records
// directly: they contain private notes, organisation metadata and diagnostic information.
const webUrl = z
  .string()
  .max(2_048)
  .refine((value) => {
    try {
      return ['https:', 'http:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Invalid public URL');

const segment = z.discriminatedUnion('t', [
  z
    .object({
      t: z.literal('text'),
      v: z.string().max(100_000),
      b: z.boolean().optional(),
      i: z.boolean().optional(),
    })
    .strict(),
  z.object({ t: z.literal('link'), v: z.string().max(4_096), href: webUrl }).strict(),
  z
    .object({ t: z.literal('mention'), v: z.string().max(512), handle: z.string().max(256) })
    .strict(),
  z.object({ t: z.literal('hashtag'), v: z.string().max(512), tag: z.string().max(256) }).strict(),
  z.object({ t: z.literal('cashtag'), v: z.string().max(512), tag: z.string().max(256) }).strict(),
]);
const segments = z.array(segment).max(2_000);
const media = z
  .object({
    kind: z.enum(['photo', 'video', 'gif']),
    url: webUrl,
    alt: z.string().max(2_000).optional(),
    playbackUrl: webUrl.optional(),
  })
  .strict();
const block = z.discriminatedUnion('t', [
  z
    .object({
      t: z.literal('heading'),
      level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
      text: segments,
    })
    .strict(),
  z.object({ t: z.literal('paragraph'), text: segments }).strict(),
  z.object({ t: z.literal('quote'), text: segments }).strict(),
  z
    .object({ t: z.literal('list'), ordered: z.boolean(), items: z.array(segments).max(500) })
    .strict(),
  z
    .object({
      t: z.literal('code'),
      code: z.string().max(100_000),
      lang: z.string().max(100).optional(),
    })
    .strict(),
  z.object({ t: z.literal('image'), media }).strict(),
  z.object({ t: z.literal('divider') }).strict(),
]);

const sharedPost = z
  .object({
    id: z.string().min(1).max(180),
    url: webUrl,
    author: z
      .object({
        handle: z.string().max(256),
        name: z.string().max(256).optional(),
        avatarUrl: webUrl.optional(),
      })
      .strict(),
    createdAt: z.string().max(100).optional(),
    text: segments,
    textTruncated: z.boolean().optional(),
    media: z.array(media).max(24),
    card: z
      .object({ url: webUrl, title: z.string().max(2_000).optional() })
      .strict()
      .optional(),
    article: z
      .object({
        title: z.string().max(1_000).optional(),
        coverUrl: webUrl.optional(),
        blocks: z.array(block).max(500),
        partial: z.boolean().optional(),
        inline: z.boolean().optional(),
      })
      .strict()
      .optional(),
    reddit: z
      .object({
        kind: z.enum(['post', 'comment']),
        subreddit: z.string().max(256).optional(),
        depth: z.number().int().min(0).max(200).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const sharedItem = z
  .object({
    title: z.string().min(1).max(400),
    sourceUrl: webUrl,
    platform: z.enum(['x', 'reddit']),
    posts: z.array(sharedPost).min(1).max(500),
  })
  .strict();

export const sharedSnapshot = z
  .object({
    version: z.literal(1),
    type: z.enum(['article', 'collection']),
    title: z.string().trim().min(1).max(400),
    description: z.string().max(2_000).optional(),
    items: z.array(sharedItem).min(1).max(50),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === 'article' && data.items.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'An article share must have one item.',
        path: ['items'],
      });
    }
  });

export type SharedSnapshot = z.infer<typeof sharedSnapshot>;
export type SharedItem = z.infer<typeof sharedItem>;
export type SharedPost = SharedItem['posts'][number];

export interface PublishedShare {
  id: string;
  createdAt: number;
  expiresAt: number | null;
  collaboration?: boolean;
  snapshot: SharedSnapshot;
}
