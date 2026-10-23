import { ArrowBigUp, BadgeCheck, ExternalLink, Link2, MessageSquare, Quote } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { LinkCard, QuotedRef, Tweet } from '@/types/model';
import { formatDateTime, formatDate } from '@/utils/format';
import { subredditUrl } from '@/utils/reddit-url';
import { authorLabel } from '@/utils/text';
import { hostnameOf, safeHref } from '@/utils/url';
import { Avatar, MediaView, useMediaSrc } from './media';
import { ArticleView } from './ArticleView';
import { RichText } from './RichText';
import { cn } from './ui/cn';

const compactNumber = new Intl.NumberFormat('fr-FR', { notation: 'compact' });

/** Reddit facts shown next to a post or comment: subreddit, score, OP, number of comments. */
export function RedditBadges({
  tweet,
  showSubreddit = true,
  showComments = false,
  className,
}: {
  tweet: Pick<Tweet, 'reddit'>;
  showSubreddit?: boolean;
  showComments?: boolean;
  className?: string;
}) {
  const r = tweet.reddit;
  if (!r) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {showSubreddit && r.subreddit ? (
        <a
          href={subredditUrl(r.subreddit)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-fg hover:underline"
        >
          r/{r.subreddit}
        </a>
      ) : null}
      {r.isOp ? (
        <span className="rounded bg-accent-soft px-1 text-[10.5px] font-semibold text-accent">
          OP
        </span>
      ) : null}
      {r.score !== undefined ? (
        <span className="inline-flex items-center gap-0.5" title={`Score : ${r.score}`}>
          <ArrowBigUp size={13} /> {compactNumber.format(r.score)}
        </span>
      ) : null}
      {showComments && r.commentCount !== undefined ? (
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={12} /> {compactNumber.format(r.commentCount)}
        </span>
      ) : null}
      {r.flair ? (
        <span className="rounded-full bg-subtle px-2 py-px text-[11px]">{r.flair}</span>
      ) : null}
    </span>
  );
}

export function AuthorLine({
  tweet,
  size = 40,
  showDate = true,
}: {
  tweet: Pick<Tweet, 'author' | 'createdAt' | 'url' | 'createdAtSource' | 'platform' | 'reddit'>;
  size?: number;
  showDate?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar url={tweet.author.avatarUrl} handle={tweet.author.handle} size={size} />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1 truncate text-[14px] font-semibold text-fg">
          <span className="truncate">{tweet.author.name ?? tweet.author.handle}</span>
          {tweet.author.verified ? (
            <BadgeCheck size={14} className="shrink-0 text-accent" aria-label="Compte certifié" />
          ) : null}
        </div>
        <div className="truncate text-[12.5px] text-muted">
          {tweet.platform === 'reddit' && tweet.reddit?.subreddit
            ? `r/${tweet.reddit.subreddit} · `
            : ''}
          {authorLabel(tweet)}
          {showDate && tweet.createdAt ? (
            <>
              {' · '}
              <a
                href={tweet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                title={formatDateTime(tweet.createdAt)}
              >
                <time dateTime={tweet.createdAt}>{formatDate(tweet.createdAt)}</time>
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LinkCardView({ card }: { card: LinkCard }) {
  const href = safeHref(card.url);
  const { src } = useMediaSrc(card.imageUrl);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group mt-3 flex items-stretch overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:bg-subtle"
    >
      {src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="h-auto w-28 shrink-0 object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex w-14 shrink-0 items-center justify-center bg-subtle text-muted">
          <Link2 size={18} />
        </span>
      )}
      <span className="min-w-0 flex-1 px-3.5 py-2.5 font-sans">
        <span className="block truncate text-[12px] text-muted">
          {card.domain ?? hostnameOf(card.url)}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[13.5px] font-medium leading-snug text-fg">
          {card.title ?? card.url}
        </span>
      </span>
    </a>
  );
}

export function QuotedCard({ quoted, className }: { quoted: QuotedRef; className?: string }) {
  const href = safeHref(quoted.url);
  return (
    <div
      className={cn(
        'mt-3 rounded-xl border border-line bg-subtle/50 px-4 py-3 font-sans',
        className,
      )}
    >
      <div className="mb-1.5 flex items-center gap-2 text-[12.5px] text-muted">
        <Quote size={13} className="text-faint" />
        {quoted.author ? (
          <span className="truncate">
            <span className="font-semibold text-fg">
              {quoted.author.name ?? quoted.author.handle}
            </span>{' '}
            @{quoted.author.handle}
          </span>
        ) : (
          <span>Publication citée</span>
        )}
        {quoted.createdAt ? <span>· {formatDate(quoted.createdAt)}</span> : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
          >
            Source <ExternalLink size={11} />
          </a>
        ) : null}
      </div>
      {quoted.text?.length ? (
        <RichText segments={quoted.text} className="text-[14px] leading-relaxed text-fg" />
      ) : (
        <p className="text-[13px] italic text-muted">Contenu de la citation non disponible.</p>
      )}
      {quoted.media?.length ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {quoted.media.map((m) => (
            <MediaView key={m.url} item={m} postUrl={quoted.url ?? ''} compact />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MediaGrid({ tweet, compact }: { tweet: Tweet; compact?: boolean }) {
  if (!tweet.media.length) return null;
  const many = tweet.media.length > 1;
  return (
    <div className={cn('mt-3 grid gap-2', many ? 'grid-cols-2' : 'grid-cols-1')}>
      {tweet.media.map((m) => (
        <div key={m.url}>
          <MediaView item={m} postUrl={tweet.url} compact={compact || many} />
          {m.alt && !compact ? (
            <p className="mt-1.5 font-sans text-[12.5px] leading-snug text-muted">{m.alt}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** A single post with author, text, media, link card and quote. */
/** The post text is only the link to its Article (X shows the Article instead). */
function isOnlyLink(tweet: Tweet): boolean {
  return tweet.text.every((s) => s.t === 'link' || (s.t === 'text' && !s.v.trim()));
}

export function TweetCard({
  tweet,
  showAuthor = true,
  className,
  textClassName,
  textStyle,
  compact,
  hideArticleTitle,
}: {
  tweet: Tweet;
  hideArticleTitle?: boolean;
  showAuthor?: boolean;
  className?: string;
  textClassName?: string;
  textStyle?: CSSProperties;
  compact?: boolean;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {showAuthor ? (
        <div className="mb-2.5">
          <AuthorLine tweet={tweet} size={compact ? 32 : 40} />
        </div>
      ) : null}
      {tweet.text.length && !(tweet.article && isOnlyLink(tweet)) ? (
        <RichText
          segments={tweet.text}
          className={cn('text-[15px] leading-relaxed text-fg', textClassName)}
          style={textStyle}
        />
      ) : null}
      {tweet.article ? (
        <ArticleView
          article={tweet.article}
          postUrl={tweet.url}
          textStyle={textStyle}
          compact={compact}
          hideTitle={hideArticleTitle}
          className={cn(tweet.text.length && !isOnlyLink(tweet) ? 'mt-4' : '', textClassName)}
        />
      ) : null}
      {tweet.textTruncated ? (
        <p className="mt-2 font-sans text-[12px] text-warning">
          Texte tronqué lors de la capture — ouvrez la publication pour le texte complet.
        </p>
      ) : null}
      <MediaGrid tweet={tweet} compact={compact} />
      {tweet.card && (!tweet.article || tweet.article.inline) ? (
        <LinkCardView card={tweet.card} />
      ) : null}
      {tweet.quoted ? <QuotedCard quoted={tweet.quoted} /> : null}
    </div>
  );
}
