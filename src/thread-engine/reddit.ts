/**
 * Capture plans for Reddit. A discussion is the post and its comment tree: the tree comes from the
 * parent IDs Reddit gives for every comment, so nothing is inferred. Comments are ordered depth-first,
 * siblings in the order Reddit displayed them.
 */
import type { RedditDiscussionState } from '@/extraction/types';
import type { Completeness, IssueCode, Tweet } from '@/types/model';
import type { ThreadGraph } from './graph';
import type { CaptureMode, CapturePlan } from './reconstruct';

const MAX_COMMENTS = 5_000;

function siblingOrder(a?: Tweet, b?: Tweet): number {
  const pa = a?.reddit?.position ?? Number.MAX_SAFE_INTEGER;
  const pb = b?.reddit?.position ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  return (a?.createdAt ?? '').localeCompare(b?.createdAt ?? '');
}

/** The post, then every known comment below it, depth-first. */
export function redditTreeOrder(graph: ThreadGraph, rootId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id) || out.length > MAX_COMMENTS) return;
    seen.add(id);
    out.push(id);
    const kids = graph
      .children(id)
      .filter((r) => r.type === 'reply' && graph.tweets.has(r.childId))
      .map((r) => r.childId)
      .sort((a, b) => siblingOrder(graph.tweets.get(a), graph.tweets.get(b)));
    for (const k of kids) visit(k);
  };
  visit(rootId);
  return out;
}

/** Post → … → parent of `id`, top-down (only the links present in the graph). */
function ancestors(graph: ThreadGraph, id: string): string[] {
  const out: string[] = [];
  const guard = new Set<string>();
  let cur = graph.parent(id)?.parentId;
  while (cur && !guard.has(cur) && graph.tweets.has(cur)) {
    guard.add(cur);
    out.unshift(cur);
    cur = graph.parent(cur)?.parentId;
  }
  return out;
}

export function planRedditCapture(
  graph: ThreadGraph,
  mode: CaptureMode,
  focalId: string,
  opts: { selection?: string[]; state?: RedditDiscussionState; now?: number } = {},
): CapturePlan {
  const now = opts.now ?? Date.now();
  const focal = graph.tweets.get(focalId);
  const postId = focal?.reddit?.postId ?? focalId;
  const single = (status: Completeness['status'], issues: IssueCode[] = []): Completeness => ({
    status,
    startVerified: false,
    endVerified: false,
    gaps: 0,
    issues,
    checkedAt: now,
  });
  const empty = { referenceTweetIds: [], externalRefs: [] };

  if (mode === 'thread') {
    const root = graph.tweets.has(postId) ? postId : focalId;
    const tweetIds = redditTreeOrder(graph, root);
    const issues: IssueCode[] = [];
    if (root !== postId) issues.push('start-not-loaded');
    const state = opts.state?.postId === postId ? opts.state : undefined;
    const more = state ? state.moreControls > 0 : true;
    if (more) issues.push(state ? 'end-not-loaded' : 'end-unverified');
    const completeness: Completeness = {
      status: issues.length ? (state ? 'needs_more' : 'partial') : 'complete',
      startVerified: root === postId,
      endVerified: !more,
      gaps: 0,
      issues,
      checkedAt: now,
    };
    return { kind: 'thread', tweetIds, contextTweetIds: [], completeness, ...empty };
  }
  if (mode === 'selection') {
    const chosen = new Set(opts.selection?.length ? opts.selection : [focalId]);
    const order = graph.tweets.has(postId) ? redditTreeOrder(graph, postId) : [];
    const tweetIds = order.filter((id) => chosen.has(id));
    for (const id of chosen) if (!tweetIds.includes(id) && graph.tweets.has(id)) tweetIds.push(id);
    // The post gives the selected comments their context.
    const contextTweetIds = graph.tweets.has(postId) && !chosen.has(postId) ? [postId] : [];
    return {
      kind: 'selection',
      tweetIds,
      contextTweetIds,
      completeness: single('manual'),
      ...empty,
    };
  }
  // A single post, or a single comment shown with the comments it answers.
  return {
    kind: mode === 'references' ? 'references' : 'tweet',
    tweetIds: [focalId],
    contextTweetIds: focal?.reddit?.kind === 'comment' ? ancestors(graph, focalId) : [],
    completeness: single('single'),
    ...empty,
  };
}
