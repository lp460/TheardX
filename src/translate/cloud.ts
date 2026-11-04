/** Optional web-only translation fallback for browsers without the on-device Translator API. */
import type { EntryBundle, Segment, Tweet } from '@/types/model';
import { segmentsToPlain } from '@/utils/text';
import { base } from './languages';
import { sourceLanguage, type PostTranslation, type TranslateProgress } from './engine';

const MAX_ENTRY_CHARACTERS = 100_000;
const MAX_CHUNK = 2_000;
const MAX_REQUEST_CHARACTERS = 6_000;
const MAX_REQUEST_ITEMS = 8;

export class CloudTranslationError extends Error {}

function readableBlock(block: NonNullable<Tweet['article']>['blocks'][number]): string | null {
  if (block.t === 'list') return block.items.map(segmentsToPlain).join('\n');
  if (block.t === 'paragraph' || block.t === 'heading' || block.t === 'quote')
    return segmentsToPlain(block.text);
  return null;
}

/** Split oversized paragraphs, keeping words intact when possible. */
function splitText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_CHUNK) {
    const boundary = remaining.lastIndexOf(' ', MAX_CHUNK);
    const end = boundary >= MAX_CHUNK / 2 ? boundary : MAX_CHUNK;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining.trim()) chunks.push(remaining);
  return chunks;
}

async function translateTexts(texts: string[], source: string, target: string): Promise<string[]> {
  if (!texts.length) return [];
  const response = await fetch('/api/translate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, target, texts }),
  });
  let payload: { translations?: unknown; error?: unknown };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new CloudTranslationError('Le service de traduction est inaccessible.');
  }
  if (!response.ok) {
    throw new CloudTranslationError(
      typeof payload.error === 'string'
        ? payload.error
        : 'Traduction indisponible. Réessayez plus tard.',
    );
  }
  if (
    !Array.isArray(payload.translations) ||
    payload.translations.length !== texts.length ||
    !payload.translations.every((value): value is string => typeof value === 'string')
  )
    throw new CloudTranslationError('Réponse de traduction invalide.');
  return payload.translations as string[];
}

/** Translate a saved bundle once, then reuse the existing Dexie translation cache. */
export async function translateCloudBundle(
  bundle: EntryBundle,
  target: string,
  opts: {
    existing?: Record<string, PostTranslation>;
    onProgress?: (p: TranslateProgress) => void;
  } = {},
): Promise<PostTranslation[]> {
  const tgt = base(target);
  const ids = [
    ...bundle.entry.tweetIds,
    ...bundle.entry.contextTweetIds,
    ...bundle.entry.referenceTweetIds,
  ];
  const work = ids
    .map((id) => bundle.tweets[id])
    .filter((t): t is Tweet => !!t)
    .filter((t) => sourceLanguage(t) !== tgt && !opts.existing?.[`${t.id}:${tgt}`]);

  const count = work.reduce(
    (sum, post) =>
      sum +
      segmentsToPlain(post.text).length +
      (post.article?.title?.length ?? 0) +
      (post.article?.blocks.reduce((n, block) => n + (readableBlock(block)?.length ?? 0), 0) ?? 0),
    0,
  );
  if (count > MAX_ENTRY_CHARACTERS)
    throw new CloudTranslationError(
      'Cet article dépasse la limite de traduction automatique (100 000 caractères).',
    );

  const total = work.reduce((sum, post) => sum + 1 + (post.article?.blocks.length ?? 0), 0);
  let done = 0;
  opts.onProgress?.({ done, total });
  const results: PostTranslation[] = [];
  for (const post of work) {
    const src = sourceLanguage(post);
    const isLinkOnly = post.text.every(
      (segment: Segment) => segment.t === 'link' || (segment.t === 'text' && !segment.v.trim()),
    );
    const text = isLinkOnly ? '' : segmentsToPlain(post.text).trim();
    const fields = [
      text,
      post.article?.title ?? '',
      ...(post.article?.blocks ?? []).map((b) => readableBlock(b) ?? ''),
    ];
    const chunks = fields.flatMap((field, index) =>
      field.trim() ? splitText(field).map((value) => ({ index, value })) : [],
    );
    const translatedChunks: string[][] = fields.map(() => []);
    for (let cursor = 0; cursor < chunks.length;) {
      const batch: typeof chunks = [];
      let chars = 0;
      while (
        cursor < chunks.length &&
        batch.length < MAX_REQUEST_ITEMS &&
        chars + chunks[cursor]!.value.length <= MAX_REQUEST_CHARACTERS
      ) {
        batch.push(chunks[cursor]!);
        chars += chunks[cursor]!.value.length;
        cursor++;
      }
      const returned = await translateTexts(
        batch.map((item) => item.value),
        src,
        tgt,
      );
      for (const [i, item] of batch.entries()) translatedChunks[item.index]!.push(returned[i]!);
    }
    const translations = translatedChunks.map((values) => values.join(''));

    const record: PostTranslation = {
      key: `${post.id}:${tgt}`,
      tweetId: post.id,
      source: src,
      target: tgt,
      text: translations[0] ?? '',
      articleTitle: translations[1] || undefined,
      blocks: (post.article?.blocks ?? []).map((block, index) =>
        readableBlock(block) ? translations[index + 2] || null : null,
      ),
      provider: 'cloud',
      createdAt: Date.now(),
    };
    results.push(record);
    done += 1 + (post.article?.blocks.length ?? 0);
    opts.onProgress?.({ done, total });
  }
  return results;
}
