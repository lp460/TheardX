/**
 * Message protocol between content scripts / extension pages and the background worker.
 * Every incoming request is validated with zod before being handled.
 */
import { z } from 'zod';
import { REDDIT_THING_RE } from '@/utils/reddit-url';
import { factsSchema, relationSchema, tweetId, tweetSchema } from '@/storage/validation';
import type { Category, Collection, Entry } from '@/types/model';
import type { SaveResult } from '@/storage/repository';

const entityId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[\w-]+$/);

export const captureRequest = z.object({
  type: z.literal('capture.save'),
  payload: z.object({
    mode: z.enum(['tweet', 'thread', 'references', 'selection']),
    focalId: tweetId,
    tweets: z.array(tweetSchema).min(1).max(2_000),
    relations: z.array(relationSchema).max(10_000),
    facts: z.record(tweetId, factsSchema).optional(),
    selection: z.array(tweetId).max(2_000).optional(),
    pageUrl: z.string().url().max(2_000),
    pageKind: z.string().max(20).optional(),
    reddit: z
      .object({
        postId: z.string().regex(REDDIT_THING_RE),
        announced: z.number().int().nonnegative().max(100_000_000).optional(),
        moreControls: z.number().int().nonnegative().max(100_000),
      })
      .optional(),
    options: z
      .object({
        entryId: entityId.optional(),
        collectionId: entityId.optional(),
        categoryId: entityId.nullable().optional(),
        tags: z.array(z.string().max(64)).max(50).optional(),
        note: z.string().max(20_000).optional(),
        readLater: z.boolean().optional(),
      })
      .optional(),
  }),
});

export const requestSchema = z.discriminatedUnion('type', [
  captureRequest,
  z.object({ type: z.literal('capture.status'), tweetIds: z.array(tweetId).max(500) }),
  z.object({
    type: z.literal('entry.update'),
    id: entityId,
    patch: z
      .object({
        title: z.string().max(500).optional(),
        readState: z.enum(['unread', 'read']).optional(),
        readLater: z.boolean().optional(),
        favorite: z.boolean().optional(),
        readProgress: z.number().min(0).max(1).optional(),
        categoryId: entityId.nullable().optional(),
        tags: z.array(z.string().max(64)).max(100).optional(),
        collectionIds: z.array(entityId).max(200).optional(),
        note: z.string().max(20_000).optional(),
      })
      .strict(),
  }),
  z.object({ type: z.literal('entry.delete'), ids: z.array(entityId).min(1).max(5_000) }),
  z.object({ type: z.literal('entry.get'), id: entityId }),
  z.object({ type: z.literal('meta.lists') }),
  z.object({ type: z.literal('collection.create'), name: z.string().min(1).max(120) }),
  z.object({ type: z.literal('category.create'), name: z.string().min(1).max(80) }),
  z.object({ type: z.literal('open.reader'), entryId: entityId, print: z.boolean().optional() }),
  z.object({ type: z.literal('open.library'), view: z.string().max(100).optional() }),
  z.object({ type: z.literal('media.cache'), entryId: entityId }),
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('sync.now') }),
  z.object({ type: z.literal('sync.status') }),
  z.object({ type: z.literal('sync.googleInspect') }),
  z.object({
    type: z.literal('sync.googleConnect'),
    mode: z.enum(['plain', 'encrypted']),
    passphrase: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal('sync.googleChangeMode'),
    mode: z.enum(['plain', 'encrypted']),
    passphrase: z.string().max(500).optional(),
  }),
  z.object({ type: z.literal('sync.disconnect') }),
  z.object({ type: z.literal('sync.deviceStart') }),
  z.object({
    type: z.literal('sync.devicePoll'),
    encrypt: z.boolean().optional(),
    passphrase: z.string().max(500).optional(),
  }),
]);

export type Request = z.infer<typeof requestSchema>;
export type CaptureRequest = z.infer<typeof captureRequest>;

export interface MetaLists {
  collections: Collection[];
  categories: Category[];
  tags: { tag: string; count: number }[];
}

export type ResponseFor<T extends Request['type']> = T extends 'capture.save'
  ? SaveResult
  : T extends 'capture.status'
    ? Record<string, { entryId: string; kind: Entry['kind'] }[]>
    : T extends 'entry.update'
      ? Entry
      : T extends 'entry.delete'
        ? number
        : T extends 'entry.get'
          ? Entry | null
          : T extends 'meta.lists'
            ? MetaLists
            : T extends 'collection.create'
              ? Collection
              : T extends 'category.create'
                ? Category
                : T extends 'ping'
                  ? { ok: true; version: string }
                  : { ok: true };

export type Envelope<T> = { ok: true; data: T } | { ok: false; error: string };

/** Messages sent by the background or popup to a content script. */
export const contentMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('content.state') }),
  z.object({
    type: z.literal('content.run'),
    action: z.enum([
      'save-tweet',
      'save-thread',
      'save-references',
      'copy-thread',
      'copy-tweet',
      'open-panel',
      'open-reader',
      'rescan',
      'import-saved-visible',
    ]),
    tweetId: tweetId.optional(),
  }),
  z.object({ type: z.literal('content.save-link'), url: z.string().max(2_000) }),
]);

export type ContentMessage = z.infer<typeof contentMessageSchema>;

export interface ContentState {
  active: boolean;
  platform?: 'x' | 'reddit';
  supported: boolean;
  layout: string;
  route: string;
  focal?: {
    id: string;
    handle: string;
    name?: string;
    preview: string;
    threadCount: number;
    status: string;
    savedEntryId?: string;
  };
  detected: number;
  savedImport?: { running: boolean; seen: number; imported: number; failed: number };
  /** Diagnostics: scan counters, observer state. */
  debug?: {
    scans: number;
    mutations: number;
    tweets: number;
    relations: number;
    buttons: number;
    observing: boolean;
    layout?: string;
  };
}
