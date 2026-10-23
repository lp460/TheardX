/**
 * Core domain model. Everything stored or exported by ThreadShelf is expressed with these types,
 * independently of the X DOM they were extracted from.
 */

export type TweetId = string;

/** Site a record comes from. Absent on records created before 1.2 (= X). */
export type Platform = 'x' | 'reddit';

export interface Author {
  /** Handle without the leading "@", original casing. */
  handle: string;
  name?: string;
  avatarUrl?: string;
  verified?: boolean;
}

/** Structured text. We never store raw HTML coming from a page. */
export type Segment =
  /** `b` / `i`: bold / italic (used by long-form X Articles). */
  | { t: 'text'; v: string; b?: boolean; i?: boolean }
  | { t: 'link'; v: string; href: string }
  | { t: 'mention'; v: string; handle: string }
  | { t: 'hashtag'; v: string; tag: string }
  | { t: 'cashtag'; v: string; tag: string };

export type MediaKind = 'photo' | 'video' | 'gif';

/** One block of a long-form X Article. */
export type ArticleBlock =
  | { t: 'heading'; level: 2 | 3 | 4; text: Segment[] }
  | { t: 'paragraph'; text: Segment[] }
  | { t: 'list'; ordered: boolean; items: Segment[][] }
  | { t: 'quote'; text: Segment[] }
  | { t: 'code'; code: string; lang?: string }
  | { t: 'image'; media: MediaItem }
  | { t: 'divider' };

/** Long-form X Article attached to a post (x.com/<handle>/article/<id>). */
export interface XArticle {
  url: string;
  title?: string;
  coverUrl?: string;
  /** e.g. « 7 min de lecture », as shown by X. */
  readingTime?: string;
  blocks: ArticleBlock[];
  /** Only a preview was rendered (timeline card): open the post to capture the full Article. */
  partial?: boolean;
  /**
   * Rich body of the post itself rather than a separate Article (Reddit posts and comments): shown
   * inline, without the Article frame. For a Reddit post, `title` is the post title.
   */
  inline?: boolean;
}

/** Reddit-specific facts about a post (t3_) or comment (t1_). */
export interface RedditMeta {
  kind: 'post' | 'comment';
  subreddit?: string;
  /** t3_ ID of the post this record belongs to (itself for a post). */
  postId: string;
  /** For comments: t1_ parent comment, or the t3_ post for top-level comments. */
  parentId?: string;
  /** For comments: 0 = top-level. */
  depth?: number;
  /** For comments: rank among its siblings in the order Reddit displayed them. */
  position?: number;
  score?: number;
  /** Posts: total number of comments announced by Reddit. */
  commentCount?: number;
  flair?: string;
  /** The author is the post's author (OP). */
  isOp?: boolean;
}

export interface MediaItem {
  kind: MediaKind;
  /** Image URL (photo) or poster image URL (video / gif), on an allowed media host (twimg, redd.it). */
  url: string;
  /** Descriptive alternative text, only when the author provided one. */
  alt?: string;
  width?: number;
  height?: number;
  /** For videos and GIFs: the post URL where the media can be played. Videos are never downloaded. */
  playbackUrl?: string;
}

export interface LinkCard {
  url: string;
  title?: string;
  domain?: string;
  imageUrl?: string;
}

/** Where the record was observed. A quote card only shows a partial rendering of the quoted post. */
export type CaptureContext = 'full' | 'quote';

export type Availability = 'available' | 'deleted' | 'unavailable';

/** Thread-structure facts observed on a page for one post. `unknown` never overrides a known value. */
export interface ThreadFacts {
  /** true: observed with nothing connected above on its own status page. false: something is connected above but was not loaded. */
  isRoot?: boolean;
  /** none: nothing connected below. more: connected below but next post not loaded. */
  continuation?: 'none' | 'more' | 'unknown';
  /** The parent is a deleted / unavailable post. */
  parentUnavailable?: boolean;
  observedAt?: number;
}

/**
 * Quoted post as rendered inside the quoting post. The snapshot is kept inline because quote cards
 * do not always expose the quoted post's ID (classic layout).
 */
export interface QuotedRef {
  id?: TweetId;
  url?: string;
  author?: Author;
  text?: Segment[];
  createdAt?: string;
  media?: MediaItem[];
}

/** A saved post. Historically X-only ("tweet"); also Reddit posts and comments since 1.2. */
export interface Tweet {
  /** X: numeric ID. Reddit: thing ID (t3_… post, t1_… comment). */
  id: TweetId;
  platform?: Platform;
  reddit?: RedditMeta;
  url: string;
  author: Author;
  /** ISO 8601. Only set when read from the page or decoded from the post ID (snowflake). */
  createdAt?: string;
  createdAtSource?: 'page' | 'snowflake';
  text: Segment[];
  /** The page only showed a truncated version ("Show more"). */
  textTruncated?: boolean;
  lang?: string;
  media: MediaItem[];
  card?: LinkCard;
  /** Quoted post reference. The quoted post itself is stored as its own Tweet with context 'quote'. */
  quoted?: QuotedRef;
  /** Handles from the "Replying to …" line, when shown. */
  replyingTo?: string[];
  /** Long-form X Article published with this post. */
  article?: XArticle;
  /** IDs of x.com posts linked from the text or card. */
  linkedTweetIds: TweetId[];
  availability: Availability;
  context: CaptureContext;
  facts?: ThreadFacts;
  firstSeenAt: number;
  lastSeenAt: number;
  /** DOM layout the record was extracted from (diagnostics). */
  source?: 'xds' | 'classic' | 'reddit' | 'import';
}

export type RelationType = 'reply' | 'quote' | 'link';
export type RelationSource =
  | 'ancestor-chain'
  | 'connector'
  | 'quote-card'
  | 'text-link'
  | 'import'
  /**
   * The focal post's author replying right below it on its status page, before any other account:
   * X lists the author's own replies first and, signed in, draws no thread line for them.
   */
  | 'author-reply'
  /** Parent ID given by Reddit for a comment. */
  | 'reddit-tree';

export interface Relation {
  /** `${type}:${parentId}>${childId}` */
  id: string;
  type: RelationType;
  /** For replies: the parent. For quote/link: the post that references. */
  parentId: TweetId;
  /** For replies: the reply. For quote/link: the referenced post. */
  childId: TweetId;
  source: RelationSource;
  /** Reply chain known to pass through one or more unavailable (deleted) posts between parent and child. */
  gap?: boolean;
  observedAt: number;
}

export type CompletenessStatus =
  'complete' | 'partial' | 'needs_more' | 'unreconstructable' | 'single' | 'manual';

export type IssueCode =
  | 'start-not-loaded'
  | 'start-unverified'
  | 'end-not-loaded'
  | 'end-unverified'
  | 'deleted-post'
  | 'branching'
  | 'conversation-continues'
  | 'no-structure'
  | 'not-status-page'
  | 'truncated-text';

export interface Completeness {
  status: CompletenessStatus;
  startVerified: boolean;
  endVerified: boolean;
  gaps: number;
  issues: IssueCode[];
  checkedAt: number;
}

export type EntryKind = 'tweet' | 'thread' | 'references' | 'selection';
export type OfflineState = 'full' | 'partial' | 'text-only';

export interface ExternalRef {
  id?: TweetId;
  url: string;
  kind: 'quote' | 'link';
  captured: boolean;
}

export interface Entry {
  id: string;
  /** Absent = X. For Reddit, kind "thread" is a discussion: the post and its comment tree. */
  platform?: Platform;
  kind: EntryKind;
  title: string;
  authorHandle: string;
  authorName?: string;
  focalTweetId: TweetId;
  /** Main ordered content. */
  tweetIds: TweetId[];
  /** Post(s) this thread replies to — shown as context, never mixed into the thread. */
  contextTweetIds: TweetId[];
  /** Quoted / linked posts captured with mode C. */
  referenceTweetIds: TweetId[];
  externalRefs: ExternalRef[];
  completeness: Completeness;
  sourceUrl: string;
  savedAt: number;
  updatedAt: number;
  publishedAt?: string;
  readState: 'unread' | 'read';
  readLater: boolean;
  favorite: boolean;
  readProgress: number;
  lastReadAt?: number;
  categoryId: string | null;
  tags: string[];
  collectionIds: string[];
  note: string;
  offline: OfflineState;
  /** Folded text used by the instant search. */
  searchText: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  order: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt?: number;
}

export type MediaStatus = 'cached' | 'remote' | 'failed' | 'too-large';

export interface MediaRecord {
  url: string;
  tweetIds: TweetId[];
  kind: MediaKind | 'avatar' | 'card';
  status: MediaStatus;
  blob?: Blob;
  mime?: string;
  bytes?: number;
  fetchedAt?: number;
  error?: string;
}

/** Everything needed to render an entry. */
export interface EntryBundle {
  entry: Entry;
  tweets: Record<TweetId, Tweet>;
  relations: Relation[];
  media: Record<string, MediaRecord>;
}
