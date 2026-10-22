import type { Relation, RelationSource, RelationType, ThreadFacts, Tweet } from '@/types/model';

export function relationId(type: RelationType, parentId: string, childId: string): string {
  return `${type}:${parentId}>${childId}`;
}

export function makeRelation(
  type: RelationType,
  parentId: string,
  childId: string,
  source: RelationSource,
  observedAt: number,
  gap = false,
): Relation {
  const r: Relation = {
    id: relationId(type, parentId, childId),
    type,
    parentId,
    childId,
    source,
    observedAt,
  };
  if (gap) r.gap = true;
  return r;
}

/** Newer defined values win; `unknown` / undefined never erase a known value. */
export function mergeFacts(
  old: ThreadFacts | undefined,
  next: ThreadFacts | undefined,
): ThreadFacts | undefined {
  if (!old) return next ? { ...next } : undefined;
  if (!next) return { ...old };
  const out: ThreadFacts = { ...old };
  if (next.isRoot !== undefined) out.isRoot = next.isRoot;
  if (next.continuation && next.continuation !== 'unknown') out.continuation = next.continuation;
  else if (!out.continuation && next.continuation) out.continuation = next.continuation;
  if (next.parentUnavailable !== undefined) out.parentUnavailable = next.parentUnavailable;
  out.observedAt = Math.max(old.observedAt ?? 0, next.observedAt ?? 0) || undefined;
  if (out.observedAt === undefined) delete out.observedAt;
  return out;
}

function hasContent(t: Tweet): boolean {
  return t.text.length > 0 || t.media.length > 0;
}

/**
 * Merges two observations of the same post without losing information:
 * a full rendering wins over a quote-card rendering, the latest full rendering wins over older ones,
 * and fields missing in the newer record are kept from the older one.
 */
export function mergeTweet(old: Tweet | undefined, next: Tweet): Tweet {
  if (!old) return next;
  const rank = (t: Tweet) => (t.context === 'full' ? 2 : 1);
  const preferNext =
    rank(next) > rank(old) || (rank(next) === rank(old) && next.lastSeenAt >= old.lastSeenAt);
  const [primary, secondary] = preferNext ? [next, old] : [old, next];
  const merged: Tweet = {
    ...secondary,
    ...primary,
    author: { ...secondary.author, ...primary.author },
    text: hasContent(primary) || primary.text.length ? primary.text : secondary.text,
    media: primary.media.length ? primary.media : secondary.media,
    linkedTweetIds: [...new Set([...primary.linkedTweetIds, ...secondary.linkedTweetIds])],
    firstSeenAt: Math.min(old.firstSeenAt, next.firstSeenAt),
    lastSeenAt: Math.max(old.lastSeenAt, next.lastSeenAt),
    context: rank(old) >= rank(next) && old.context === 'full' ? 'full' : primary.context,
  };
  // A post that was fully rendered once and is now partially rendered keeps its full text.
  if (!preferNext && old.textTruncated === undefined) delete merged.textTruncated;
  if (
    primary.textTruncated &&
    secondary.context === 'full' &&
    !secondary.textTruncated &&
    secondary.text.length
  ) {
    merged.text = secondary.text;
    delete merged.textTruncated;
  }
  // Keep the most complete rendering of an attached Article (full body over a timeline preview).
  const articles = [primary.article, secondary.article].filter(
    (a): a is NonNullable<typeof a> => !!a,
  );
  if (articles.length)
    merged.article = articles.sort((a, b) => b.blocks.length - a.blocks.length)[0];
  const facts = mergeFacts(old.facts, next.facts);
  if (facts) merged.facts = facts;
  else delete merged.facts;
  if (!merged.createdAt && secondary.createdAt) {
    merged.createdAt = secondary.createdAt;
    merged.createdAtSource = secondary.createdAtSource;
  }
  if (
    primary.createdAtSource === 'snowflake' &&
    secondary.createdAtSource === 'page' &&
    secondary.createdAt
  ) {
    merged.createdAt = secondary.createdAt;
    merged.createdAtSource = 'page';
  }
  return merged;
}

const SOURCE_STRENGTH: Record<RelationSource, number> = {
  'ancestor-chain': 3,
  connector: 3,
  import: 2,
  'quote-card': 1,
  'text-link': 1,
};

/** In-memory evidence graph: posts, typed relations and per-post thread facts. */
export class ThreadGraph {
  readonly tweets = new Map<string, Tweet>();
  readonly relations = new Map<string, Relation>();
  private parentOf = new Map<string, Relation>();
  private childrenOf = new Map<string, Relation[]>();

  addTweet(t: Tweet): Tweet {
    const merged = mergeTweet(this.tweets.get(t.id), t);
    this.tweets.set(t.id, merged);
    return merged;
  }

  setFacts(id: string, facts: ThreadFacts): void {
    const t = this.tweets.get(id);
    if (!t) return;
    const merged = mergeFacts(t.facts, facts);
    this.tweets.set(id, merged ? { ...t, facts: merged } : t);
  }

  addRelation(r: Relation): void {
    if (r.parentId === r.childId) return;
    if (r.type !== 'reply') {
      this.relations.set(r.id, r);
      return;
    }
    const existing = this.parentOf.get(r.childId);
    if (existing && existing.parentId !== r.parentId) {
      // A post has exactly one parent. Keep the strongest, then the most recent observation.
      const keepExisting =
        SOURCE_STRENGTH[existing.source] > SOURCE_STRENGTH[r.source] ||
        (SOURCE_STRENGTH[existing.source] === SOURCE_STRENGTH[r.source] &&
          existing.observedAt > r.observedAt);
      if (keepExisting) return;
      this.removeReply(existing);
    }
    if (existing && existing.parentId === r.parentId) {
      // Same edge: a later observation without the gap marker means the gap was filled.
      const merged = { ...existing, observedAt: Math.max(existing.observedAt, r.observedAt) };
      if (existing.gap && !r.gap && r.observedAt >= existing.observedAt) delete merged.gap;
      this.removeReply(existing);
      r = merged;
    }
    // Prevent cycles: refuse an edge whose parent descends from the child.
    let cur: string | undefined = r.parentId;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      if (cur === r.childId) return;
      guard.add(cur);
      cur = this.parentOf.get(cur)?.parentId;
    }
    this.relations.set(r.id, r);
    this.parentOf.set(r.childId, r);
    const kids = this.childrenOf.get(r.parentId) ?? [];
    kids.push(r);
    this.childrenOf.set(r.parentId, kids);
  }

  private removeReply(r: Relation): void {
    this.relations.delete(r.id);
    if (this.parentOf.get(r.childId)?.id === r.id) this.parentOf.delete(r.childId);
    const kids = (this.childrenOf.get(r.parentId) ?? []).filter((k) => k.id !== r.id);
    if (kids.length) this.childrenOf.set(r.parentId, kids);
    else this.childrenOf.delete(r.parentId);
  }

  parent(id: string): Relation | undefined {
    return this.parentOf.get(id);
  }

  children(id: string): Relation[] {
    return this.childrenOf.get(id) ?? [];
  }

  static from(tweets: Tweet[], relations: Relation[]): ThreadGraph {
    const g = new ThreadGraph();
    for (const t of tweets) g.addTweet(t);
    for (const r of [...relations].sort((a, b) => a.observedAt - b.observedAt)) g.addRelation(r);
    return g;
  }

  merge(other: { tweets: Iterable<Tweet>; relations: Iterable<Relation> }): this {
    for (const t of other.tweets) this.addTweet(t);
    for (const r of [...other.relations].sort((a, b) => a.observedAt - b.observedAt))
      this.addRelation(r);
    return this;
  }
}
