/**
 * Per-page capture session: accumulates everything X renders while the user browses (X unmounts
 * posts that scroll out of view), so a thread can be reconstructed across virtualised scrolling.
 */
import type { PageScan } from '@/extraction/types';
import {
  observe,
  planCapture,
  ThreadGraph,
  type CaptureMode,
  type CapturePlan,
  type Observation,
} from '@/thread-engine';
import type { Entry, EntryBundle, Relation, ThreadFacts, Tweet } from '@/types/model';
import { canonicalTweetUrl } from '@/utils/url';
import { deriveTitle, postPreviewText } from '@/utils/text';

const MAX_TWEETS = 3_000;

export class CaptureSession {
  graph = new ThreadGraph();
  facts = new Map<string, ThreadFacts>();
  lastScan: PageScan | null = null;
  lastObservation: Observation | null = null;
  /** Visual order of posts the last time they were seen, for manual selections. */
  order: string[] = [];

  ingest(scan: PageScan, now = Date.now()): { added: number; relations: number } {
    if (this.graph.tweets.size > MAX_TWEETS) this.reset();
    const obs = observe(scan, now);
    const beforeT = this.graph.tweets.size;
    const beforeR = this.graph.relations.size;
    this.graph.merge({ tweets: obs.tweets, relations: obs.relations });
    for (const [id, f] of Object.entries(obs.facts)) {
      this.graph.setFacts(id, f);
      this.facts.set(id, this.graph.tweets.get(id)?.facts ?? f);
    }
    this.lastScan = scan;
    this.lastObservation = obs;
    const seen = new Set(obs.order);
    this.order = [...this.order.filter((id) => !seen.has(id)), ...obs.order];
    return {
      added: this.graph.tweets.size - beforeT,
      relations: this.graph.relations.size - beforeR,
    };
  }

  reset(): void {
    this.graph = new ThreadGraph();
    this.facts.clear();
    this.order = [];
  }

  plan(mode: CaptureMode, focalId: string, selection?: string[]): CapturePlan {
    return planCapture(this.graph, mode, focalId, {
      selection,
      pageKind: this.lastScan?.route.kind,
    });
  }

  /** Data sent to the background for a save. Only posts relevant to the plan are included. */
  payload(
    plan: CapturePlan,
    focalId: string,
  ): { tweets: Tweet[]; relations: Relation[]; facts: Record<string, ThreadFacts> } {
    const ids = new Set([
      ...plan.tweetIds,
      ...plan.contextTweetIds,
      ...plan.referenceTweetIds,
      focalId,
    ]);
    const tweets = [...ids].map((id) => this.graph.tweets.get(id)).filter((t): t is Tweet => !!t);
    const relations = [...this.graph.relations.values()].filter(
      (r) => ids.has(r.parentId) || ids.has(r.childId),
    );
    // Relations may point to posts outside the plan (e.g. a reply by someone else): include those endpoints.
    for (const r of relations) {
      for (const id of [r.parentId, r.childId]) {
        if (!ids.has(id)) {
          const t = this.graph.tweets.get(id);
          if (t) {
            ids.add(id);
            tweets.push(t);
          }
        }
      }
    }
    const facts: Record<string, ThreadFacts> = {};
    for (const id of ids) {
      const f = this.graph.tweets.get(id)?.facts;
      if (f) facts[id] = f;
    }
    return { tweets, relations, facts };
  }

  /** In-memory bundle for copying before (or without) saving. */
  ephemeralBundle(plan: CapturePlan, focalId: string): EntryBundle | null {
    const first = this.graph.tweets.get(plan.tweetIds[0] ?? focalId);
    if (!first) return null;
    const tweets: Record<string, Tweet> = {};
    for (const id of [...plan.tweetIds, ...plan.contextTweetIds, ...plan.referenceTweetIds]) {
      const t = this.graph.tweets.get(id);
      if (t) tweets[id] = t;
    }
    const now = Date.now();
    const entry: Entry = {
      id: 'ephemeral',
      kind: plan.kind,
      title:
        first.article?.title?.trim() ||
        deriveTitle(postPreviewText(first)) ||
        `Publication de @${first.author.handle}`,
      authorHandle: first.author.handle,
      focalTweetId: focalId,
      tweetIds: plan.tweetIds,
      contextTweetIds: plan.contextTweetIds,
      referenceTweetIds: plan.referenceTweetIds,
      externalRefs: plan.externalRefs,
      completeness: plan.completeness,
      sourceUrl: canonicalTweetUrl(first.id, first.author.handle),
      savedAt: now,
      updatedAt: now,
      readState: 'unread',
      readLater: false,
      favorite: false,
      readProgress: 0,
      categoryId: null,
      tags: [],
      collectionIds: [],
      note: '',
      offline: 'text-only',
      searchText: '',
    };
    if (first.author.name) entry.authorName = first.author.name;
    if (first.createdAt) entry.publishedAt = first.createdAt;
    return { entry, tweets, relations: [], media: {} };
  }
}
