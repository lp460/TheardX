import type { PageScan, ScannedCell } from '@/extraction/types';
import type { Relation, ThreadFacts, Tweet } from '@/types/model';
import { makeRelation } from './graph';

/** Evidence extracted from one page scan. Serializable: this is what the content script sends. */
export interface Observation {
  tweets: Tweet[];
  relations: Relation[];
  facts: Record<string, ThreadFacts>;
  focalId?: string;
  pageKind: PageScan['route']['kind'];
  /** Connectors were recognised on the page, so the absence of a connector is meaningful. */
  detectorValidated: boolean;
  /** Visual order of the posts in the scan (used for manual selections). */
  order: string[];
}

const sameAuthor = (a?: Tweet, b?: Tweet) =>
  !!a && !!b && a.author.handle.toLowerCase() === b.author.handle.toLowerCase();

/**
 * Turns what is rendered on the page into verifiable evidence:
 * - reply relations only where X itself shows the relation (thread connector line, or the ancestor
 *   chain rendered above the focal post on its status page);
 * - per-post facts about what is connected above / below.
 * Nothing is inferred from authorship or chronology alone.
 */
export function observe(scan: PageScan, now = Date.now()): Observation {
  if (scan.layout === 'reddit') return observeReddit(scan, now);
  const cells = scan.cells;
  const tweets: Tweet[] = [];
  const relations: Relation[] = [];
  const facts: Record<string, ThreadFacts> = {};
  const order: string[] = [];

  for (const c of cells) {
    if (!c.tweet) continue;
    tweets.push(c.tweet);
    order.push(c.tweet.id);
    for (const q of c.quoted ?? []) tweets.push(q);
    if (c.tweet.quoted?.id)
      relations.push(makeRelation('quote', c.tweet.id, c.tweet.quoted.id, 'quote-card', now));
    for (const linked of c.tweet.linkedTweetIds) {
      if (linked !== c.tweet.quoted?.id)
        relations.push(makeRelation('link', c.tweet.id, linked, 'text-link', now));
    }
  }

  const focalIndex = cells.findIndex((c) => c.isFocal);
  // On a status page the focal post may have been unmounted by X's virtualised list while scrolling:
  // continuation facts stay valid, ancestor-zone rules need the focal post (focalIndex >= 0).
  const isStatus = scan.route.kind === 'status';
  const detectorValidated = scan.connectorsSeen;
  const linked = new Set<string>(); // "a>b" pairs linked by a reply relation

  const addReply = (a: ScannedCell, b: ScannedCell, source: Relation['source'], gap = false) => {
    relations.push(makeRelation('reply', a.tweet!.id, b.tweet!.id, source, now, gap));
    linked.add(`${a.tweet!.id}>${b.tweet!.id}`);
  };

  // On its status page, X lists the focal author's own replies first, right below the focal post.
  // Signed in, it draws no thread line between them: that run is the thread's continuation.
  let runEnd = focalIndex;
  if (isStatus && focalIndex >= 0) {
    const focalTweet = cells[focalIndex]!.tweet;
    while (
      cells[runEnd + 1]?.kind === 'tweet' &&
      sameAuthor(cells[runEnd + 1]!.tweet, focalTweet) &&
      cells[runEnd + 1]!.tweet!.context === 'full'
    )
      runEnd += 1;
  }
  // The run-based reading only applies where X drew no thread line between the author's replies.
  let runUnlined = false;
  for (let i = Math.max(focalIndex, 0); i < runEnd; i++)
    if (!(cells[i]!.connectorBelow && cells[i + 1]!.connectorAbove)) runUnlined = true;

  for (let i = 0; i < cells.length - 1; i++) {
    const a = cells[i]!;
    const b = cells[i + 1]!;
    const inAncestorZone = isStatus && focalIndex >= 0 && i + 1 <= focalIndex;
    if (a.kind === 'tweet' && b.kind === 'tweet') {
      const connected = a.connectorBelow && b.connectorAbove;
      if (connected) addReply(a, b, 'connector');
      else if (inAncestorZone) addReply(a, b, 'ancestor-chain');
      else if (i >= focalIndex && i + 1 <= runEnd) addReply(a, b, 'author-reply');
      continue;
    }
    // a → [deleted post] → c : the chain passes through an unavailable post.
    const c = cells[i + 2];
    if (a.kind === 'tweet' && b.kind === 'tombstone' && c?.kind === 'tweet') {
      const bridged =
        (a.connectorBelow && c.connectorAbove) ||
        (isStatus && focalIndex >= 0 && i + 2 <= focalIndex);
      if (bridged)
        addReply(a, c, a.connectorBelow && c.connectorAbove ? 'connector' : 'ancestor-chain', true);
    }
  }

  if (isStatus) {
    cells.forEach((c, i) => {
      if (!c.tweet) return;
      const prev = cells[i - 1];
      const next = cells[i + 1];
      const f: ThreadFacts = { observedAt: now };
      const linkedAbove = !!prev?.tweet && linked.has(`${prev.tweet.id}>${c.tweet.id}`);
      const linkedAboveViaGap =
        !!cells[i - 2]?.tweet &&
        prev?.kind === 'tombstone' &&
        linked.has(`${cells[i - 2]!.tweet!.id}>${c.tweet.id}`);
      if (!linkedAbove && !linkedAboveViaGap) {
        if (prev?.kind === 'tombstone' && (c.connectorAbove || i <= focalIndex)) {
          f.parentUnavailable = true;
          f.isRoot = false;
        } else if (c.connectorAbove) {
          f.isRoot = false;
        } else if (i <= focalIndex) {
          if (c.tweet.replyingTo?.length) f.isRoot = false;
          else if (detectorValidated || (i === 0 && focalIndex === 0)) f.isRoot = true;
        }
      }
      const linkedBelow = !!next?.tweet && linked.has(`${c.tweet.id}>${next.tweet.id}`);
      const linkedBelowViaGap =
        next?.kind === 'tombstone' &&
        !!cells[i + 2]?.tweet &&
        linked.has(`${c.tweet.id}>${cells[i + 2]!.tweet!.id}`);
      if (!linkedBelow && !linkedBelowViaGap) {
        if (c.connectorBelow) {
          f.continuation = next?.kind === 'tombstone' ? 'unknown' : 'more';
        } else if (i < focalIndex) {
          // An ancestor that is not linked to the next row: the rendering is not what we expect.
          f.continuation = 'unknown';
        } else if (runUnlined && i === runEnd && next?.tweet && !sameAuthor(next.tweet, c.tweet)) {
          // The author's own replies come first: another account's reply ends the thread.
          f.continuation = 'none';
        } else if (runUnlined && i === runEnd && !next) {
          // Nothing rendered below yet: more of the author's replies may still load.
          f.continuation = 'unknown';
        } else if (detectorValidated) {
          f.continuation = 'none';
        } else if (next?.tweet && sameAuthor(next.tweet, c.tweet)) {
          // Same author directly below but no connector recognised anywhere: can't conclude.
          f.continuation = 'unknown';
        } else {
          f.continuation = 'none';
        }
      }
      facts[c.tweet.id] = f;
    });
  }

  const tweetsWithFacts = tweets.map((t) =>
    facts[t.id] && t.context === 'full' ? { ...t, facts: { ...t.facts, ...facts[t.id] } } : t,
  );
  const obs: Observation = {
    tweets: tweetsWithFacts,
    relations,
    facts,
    pageKind: scan.route.kind,
    detectorValidated,
    order,
  };
  if (scan.focalId) obs.focalId = scan.focalId;
  return obs;
}

/** Reddit: the comment tree is given by the page (parent ID of every comment). */
function observeReddit(scan: PageScan, now: number): Observation {
  const tweets: Tweet[] = [];
  const relations: Relation[] = [];
  const order: string[] = [];
  for (const c of scan.cells) {
    if (!c.tweet) continue;
    tweets.push(c.tweet);
    order.push(c.tweet.id);
    if (c.parentId)
      relations.push(makeRelation('reply', c.parentId, c.tweet.id, 'reddit-tree', now));
  }
  const obs: Observation = {
    tweets,
    relations,
    facts: {},
    pageKind: scan.route.kind,
    detectorValidated: true,
    order,
  };
  if (scan.focalId) obs.focalId = scan.focalId;
  return obs;
}
