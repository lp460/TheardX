import { getDb, toStoredTweet, type ThreadShelfDB } from '@/storage/db';
import { buildSearchText } from '@/storage/search';
import { entrySchema, tweetSchema } from '@/storage/validation';
import type { Collection, Entry, Segment, Tweet } from '@/types/model';
import { uid } from '@/utils/id';
import { sharedSnapshot, type PublishedShare, type SharedPost } from './model';

/** A saved copy is private and independent of the shared URL (even if later revoked). */
function localPost(post: SharedPost, platform: 'x' | 'reddit', now: number): Tweet {
  const article = post.article;
  const candidate: Tweet = {
    id: post.id,
    platform,
    url: post.url,
    author: {
      handle: post.author.handle,
      ...(post.author.name ? { name: post.author.name.slice(0, 200) } : {}),
      ...(post.author.avatarUrl ? { avatarUrl: post.author.avatarUrl } : {}),
    },
    ...(post.createdAt ? { createdAt: post.createdAt } : {}),
    text: post.text as Segment[],
    ...(post.textTruncated ? { textTruncated: true } : {}),
    media: post.media,
    ...(post.card ? { card: post.card } : {}),
    ...(article ? {
      article: {
        url: post.url,
        ...(article.title ? { title: article.title } : {}),
        ...(article.coverUrl ? { coverUrl: article.coverUrl } : {}),
        blocks: article.blocks,
        ...(article.partial ? { partial: true } : {}),
        ...(article.inline ? { inline: true } : {}),
      },
    } : {}),
    linkedTweetIds: [],
    availability: 'available',
    context: 'full',
    firstSeenAt: now,
    lastSeenAt: now,
    source: 'import',
  };
  const parsed = tweetSchema.safeParse(candidate);
  if (!parsed.success) throw new Error('Cette publication ne peut pas encore être importée dans la bibliothèque.');
  return parsed.data as Tweet;
}

export async function saveSharedCopy(
  share: PublishedShare,
  db: ThreadShelfDB = getDb(),
): Promise<{ added: number; alreadySaved: boolean }> {
  const snapshot = sharedSnapshot.parse(share.snapshot);
  if (!/^[a-f0-9]{20}\.[A-Za-z0-9_-]{24}$/.test(share.id))
    throw new Error('Identifiant de partage invalide.');
  const now = Date.now();
  const planned = snapshot.items.map((item) => ({
    item,
    tweets: item.posts.map((post) => localPost(post, item.platform, now)),
  }));
  const marker = `shared-copy:${share.id}`;
  return db.transaction('rw', [db.entries, db.tweets, db.collections, db.meta], async () => {
    const previous = await db.meta.get(marker);
    if (Array.isArray(previous?.value) && previous.value.length &&
      (await Promise.all(previous.value.map((id: string) => db.entries.get(id)))).every(Boolean)) {
      return { added: 0, alreadySaved: true };
    }

    let collection: Collection | undefined;
    if (snapshot.type === 'collection') {
      collection = {
        id: uid('shared'),
        name: snapshot.title.slice(0, 120),
        ...(snapshot.description ? { description: snapshot.description.slice(0, 1000) } : {}),
        color: '#7c6cf2',
        createdAt: now,
        updatedAt: now,
        order: now,
      };
      await db.collections.add(collection);
    }

    const ids: string[] = [];
    for (const { item, tweets } of planned) {
      for (const tweet of tweets) {
        // Do not overwrite posts already held in the recipient's own library.
        if (!(await db.tweets.get(tweet.id))) await db.tweets.add(toStoredTweet(tweet));
      }
      const first = tweets[0]!;
      const partial = item.posts.some((post) => post.textTruncated || post.article?.partial);
      const entry: Entry = {
        id: uid('shared'),
        platform: item.platform,
        kind: tweets.length === 1 ? 'tweet' : 'thread',
        title: item.title,
        authorHandle: first.author.handle,
        ...(first.author.name ? { authorName: first.author.name } : {}),
        focalTweetId: first.id,
        tweetIds: tweets.map((tweet) => tweet.id),
        contextTweetIds: [],
        referenceTweetIds: [],
        externalRefs: [],
        completeness: {
          status: partial ? 'partial' : tweets.length === 1 ? 'single' : 'complete',
          startVerified: !partial,
          endVerified: !partial,
          gaps: 0,
          issues: partial ? ['truncated-text'] : [],
          checkedAt: now,
        },
        sourceUrl: item.sourceUrl,
        savedAt: now,
        updatedAt: now,
        readState: 'unread',
        readLater: false,
        favorite: false,
        readProgress: 0,
        categoryId: null,
        tags: [],
        collectionIds: collection ? [collection.id] : [],
        note: '',
        offline: 'text-only',
        searchText: '',
      };
      const result = entrySchema.safeParse(entry);
      if (!result.success) throw new Error('Ce contenu partagé ne peut pas être enregistré.');
      entry.searchText = buildSearchText(entry, Object.fromEntries(tweets.map((tweet) => [tweet.id, tweet])));
      await db.entries.add(entry);
      ids.push(entry.id);
    }
    await db.meta.put({ key: marker, value: ids });
    return { added: ids.length, alreadySaved: false };
  });
}
