import type { EntryBundle, MediaItem, Segment, Tweet } from '@/types/model';
import type { SharedItem, SharedPost, SharedSnapshot } from './model';

function publicSegments(items: Segment[]): Segment[] {
  return items.map((item) => ({ ...item }));
}

function publicMedia(items: MediaItem[]): SharedPost['media'] {
  return items.map(({ kind, url, alt, playbackUrl }) => ({
    kind,
    url,
    ...(alt ? { alt } : {}),
    ...(playbackUrl ? { playbackUrl } : {}),
  }));
}

function publicPost(tweet: Tweet): SharedPost {
  const { handle, name, avatarUrl } = tweet.author;
  const { article } = tweet;
  return {
    id: tweet.id,
    url: tweet.url,
    author: { handle, ...(name ? { name } : {}), ...(avatarUrl ? { avatarUrl } : {}) },
    ...(tweet.createdAt ? { createdAt: tweet.createdAt } : {}),
    text: publicSegments(tweet.text),
    ...(tweet.textTruncated ? { textTruncated: true } : {}),
    media: publicMedia(tweet.media),
    ...(tweet.card
      ? {
          card: {
            url: tweet.card.url,
            ...(tweet.card.title ? { title: tweet.card.title } : {}),
          },
        }
      : {}),
    ...(tweet.reddit
      ? {
          reddit: {
            kind: tweet.reddit.kind,
            ...(tweet.reddit.subreddit ? { subreddit: tweet.reddit.subreddit } : {}),
            ...(tweet.reddit.depth !== undefined ? { depth: tweet.reddit.depth } : {}),
          },
        }
      : {}),
    ...(article
      ? {
          article: {
            ...(article.title ? { title: article.title } : {}),
            ...(article.coverUrl ? { coverUrl: article.coverUrl } : {}),
            blocks: article.blocks.map((block) => {
              if (block.t === 'heading' || block.t === 'paragraph' || block.t === 'quote')
                return { ...block, text: publicSegments(block.text) };
              if (block.t === 'list') return { ...block, items: block.items.map(publicSegments) };
              if (block.t === 'image')
                return { t: 'image' as const, media: publicMedia([block.media])[0]! };
              return { ...block };
            }),
            ...(article.partial ? { partial: true } : {}),
            ...(article.inline ? { inline: true } : {}),
          },
        }
      : {}),
  };
}

export function prepareSharedItem(bundle: EntryBundle): SharedItem {
  const { entry, tweets } = bundle;
  const posts = entry.tweetIds.map((id) => tweets[id]).filter((tweet): tweet is Tweet => !!tweet);
  if (!posts.length) throw new Error('Aucune publication complète à partager.');
  return {
    title: entry.title,
    sourceUrl: entry.sourceUrl,
    platform: entry.platform === 'reddit' ? 'reddit' : 'x',
    posts: posts.map(publicPost),
  };
}

export function prepareSharedSnapshot(
  bundles: EntryBundle[],
  info: { title: string; description?: string; type: 'article' | 'collection' },
): SharedSnapshot {
  return {
    version: 1,
    type: info.type,
    title: info.title,
    ...(info.description ? { description: info.description } : {}),
    items: bundles.map(prepareSharedItem),
  };
}
