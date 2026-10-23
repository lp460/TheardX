import type {
  Completeness,
  CompletenessStatus,
  EntryKind,
  ExternalRef,
  IssueCode,
  Tweet,
} from '@/types/model';
import { compareIds } from '@/utils/snowflake';
import type { RedditDiscussionState } from '@/extraction/types';
import type { ThreadGraph } from './graph';
import { planRedditCapture } from './reddit';

export type CaptureMode = 'tweet' | 'thread' | 'references' | 'selection';

export interface ThreadResult {
  orderedIds: string[];
  /** Post the thread replies to (another author) — shown as context only. */
  contextIds: string[];
  completeness: Completeness;
}

const lower = (t?: Tweet) => t?.author.handle.toLowerCase();

function finish(
  issues: Set<IssueCode>,
  startVerified: boolean,
  endVerified: boolean,
  gaps: number,
  usedEvidence: boolean,
  now: number,
): Completeness {
  let status: CompletenessStatus;
  if (!usedEvidence && !startVerified && !endVerified) status = 'unreconstructable';
  else if (startVerified && endVerified && gaps === 0 && !issues.has('branching'))
    status = 'complete';
  else if (issues.has('start-not-loaded') || issues.has('end-not-loaded')) status = 'needs_more';
  else status = 'partial';
  return { status, startVerified, endVerified, gaps, issues: [...issues], checkedAt: now };
}

/**
 * Mode B — the author's thread containing `focalId`.
 * Follows verified reply relations only, through posts by the same author. Other people's posts
 * are never added to the thread: the post the thread answers to becomes `contextIds`.
 */
export function reconstructAuthorThread(
  graph: ThreadGraph,
  focalId: string,
  opts: { pageKind?: string; now?: number } = {},
): ThreadResult {
  const now = opts.now ?? Date.now();
  const focal = graph.tweets.get(focalId);
  if (!focal) {
    return {
      orderedIds: [],
      contextIds: [],
      completeness: finish(new Set(['no-structure']), false, false, 0, false, now),
    };
  }
  const author = lower(focal);
  const ordered: string[] = [focalId];
  const visited = new Set([focalId]);
  const issues = new Set<IssueCode>();
  const contextIds: string[] = [];
  let gaps = 0;
  let usedEvidence = false;
  let startVerified = false;
  let endVerified = false;

  // Walk up.
  let cur = focalId;
  for (;;) {
    const rel = graph.parent(cur);
    if (!rel) break;
    const parent = graph.tweets.get(rel.parentId);
    if (!parent || visited.has(parent.id)) break;
    usedEvidence = true;
    if (lower(parent) !== author) {
      contextIds.push(parent.id);
      startVerified = !rel.gap;
      if (rel.gap) {
        gaps += 1;
        issues.add('deleted-post');
      }
      break;
    }
    if (rel.gap) {
      gaps += 1;
      issues.add('deleted-post');
    }
    ordered.unshift(parent.id);
    visited.add(parent.id);
    cur = parent.id;
  }
  if (contextIds.length === 0) {
    const top = graph.tweets.get(ordered[0]!);
    const f = top?.facts;
    if (f?.isRoot === true) {
      startVerified = true;
      usedEvidence = true;
    } else if (f?.parentUnavailable) {
      gaps += 1;
      issues.add('deleted-post');
      usedEvidence = true;
    } else if (f?.isRoot === false) {
      issues.add('start-not-loaded');
      usedEvidence = true;
    } else {
      issues.add('start-unverified');
    }
  }

  // Walk down.
  cur = focalId;
  for (;;) {
    const kids = graph.children(cur);
    const mine = kids
      .filter((k) => lower(graph.tweets.get(k.childId)) === author && !visited.has(k.childId))
      .sort((a, b) => compareIds(a.childId, b.childId));
    if (mine.length === 0) {
      if (kids.some((k) => lower(graph.tweets.get(k.childId)) !== author))
        issues.add('conversation-continues');
      break;
    }
    if (mine.length > 1) issues.add('branching');
    const next = mine[0]!;
    usedEvidence = true;
    if (next.gap) {
      gaps += 1;
      issues.add('deleted-post');
    }
    ordered.push(next.childId);
    visited.add(next.childId);
    cur = next.childId;
  }
  const bottom = graph.tweets.get(ordered[ordered.length - 1]!);
  const cont = bottom?.facts?.continuation;
  if (cont === 'none' && !issues.has('conversation-continues')) {
    endVerified = true;
    usedEvidence = true;
  } else if (cont === 'more') {
    issues.add('end-not-loaded');
    usedEvidence = true;
  } else if (!issues.has('conversation-continues')) {
    issues.add('end-unverified');
  }

  if (opts.pageKind && opts.pageKind !== 'status') issues.add('not-status-page');
  if (ordered.some((id) => graph.tweets.get(id)?.textTruncated)) issues.add('truncated-text');
  if (!usedEvidence) issues.add('no-structure');

  return {
    orderedIds: ordered,
    contextIds,
    completeness: finish(issues, startVerified, endVerified, gaps, usedEvidence, now),
  };
}

export interface CapturePlan {
  kind: EntryKind;
  tweetIds: string[];
  contextTweetIds: string[];
  referenceTweetIds: string[];
  externalRefs: ExternalRef[];
  completeness: Completeness;
}

/** Collects quoted / linked posts of the given posts. Only posts actually present in the graph are "captured". */
export function collectReferences(
  graph: ThreadGraph,
  ids: string[],
): { referenceIds: string[]; refs: ExternalRef[] } {
  const refs: ExternalRef[] = [];
  const referenceIds: string[] = [];
  const own = new Set(ids);
  const seen = new Set<string>();
  for (const id of ids) {
    const t = graph.tweets.get(id);
    if (!t) continue;
    const push = (rid: string | undefined, url: string | undefined, kind: 'quote' | 'link') => {
      const key = rid ?? url;
      if (!key || seen.has(key) || (rid && own.has(rid))) return;
      seen.add(key);
      const target = rid ? graph.tweets.get(rid) : undefined;
      const ref: ExternalRef = {
        kind,
        url: target?.url ?? url ?? `https://x.com/i/status/${rid}`,
        captured: !!target,
      };
      if (rid) ref.id = rid;
      refs.push(ref);
      if (target) referenceIds.push(target.id);
    };
    if (t.quoted) push(t.quoted.id, t.quoted.url, 'quote');
    for (const lid of t.linkedTweetIds) push(lid, undefined, 'link');
  }
  return { referenceIds, refs };
}

export function planCapture(
  graph: ThreadGraph,
  mode: CaptureMode,
  focalId: string,
  opts: {
    selection?: string[];
    pageKind?: string;
    now?: number;
    reddit?: RedditDiscussionState;
  } = {},
): CapturePlan {
  const now = opts.now ?? Date.now();
  if (graph.tweets.get(focalId)?.platform === 'reddit')
    return planRedditCapture(graph, mode, focalId, {
      selection: opts.selection,
      state: opts.reddit,
      now,
    });
  const single = (status: CompletenessStatus, issues: IssueCode[] = []): Completeness => ({
    status,
    startVerified: false,
    endVerified: false,
    gaps: 0,
    issues,
    checkedAt: now,
  });
  const truncated = (ids: string[]): IssueCode[] =>
    ids.some((id) => graph.tweets.get(id)?.textTruncated) ? ['truncated-text'] : [];

  switch (mode) {
    case 'tweet':
      return {
        kind: 'tweet',
        tweetIds: [focalId],
        contextTweetIds: [],
        referenceTweetIds: [],
        externalRefs: [],
        completeness: single('single', truncated([focalId])),
      };
    case 'references': {
      const { referenceIds, refs } = collectReferences(graph, [focalId]);
      return {
        kind: 'references',
        tweetIds: [focalId],
        contextTweetIds: [],
        referenceTweetIds: referenceIds,
        externalRefs: refs,
        completeness: single('single', truncated([focalId])),
      };
    }
    case 'selection': {
      const ids = [...new Set(opts.selection ?? [focalId])].filter((id) => graph.tweets.has(id));
      return {
        kind: 'selection',
        tweetIds: ids,
        contextTweetIds: [],
        referenceTweetIds: [],
        externalRefs: [],
        completeness: single('manual', truncated(ids)),
      };
    }
    case 'thread': {
      const r = reconstructAuthorThread(graph, focalId, { pageKind: opts.pageKind, now });
      const { refs } = collectReferences(graph, r.orderedIds);
      return {
        kind: 'thread',
        tweetIds: r.orderedIds,
        contextTweetIds: r.contextIds,
        referenceTweetIds: [],
        externalRefs: refs,
        completeness: r.completeness,
      };
    }
  }
}
