import { scanPage } from '@/extraction';
import { observe } from '@/thread-engine';
import type { CaptureInput } from '@/storage/repository';
import type { CaptureMode } from '@/thread-engine';
import { statusPage, type CellSpec, type Layout, type PostSpec } from '../fixtures/x-dom';
import { parseDoc } from './dom';

/** Builds the payload the content script would send for a fixture page. */
export function captureFromFixture(
  cells: CellSpec[],
  focal: PostSpec,
  mode: CaptureMode = 'thread',
  layout: Layout = 'xds',
  extra: Partial<CaptureInput> = {},
): CaptureInput {
  const url = `https://x.com/${focal.handle}/status/${focal.id}`;
  const scan = scanPage(parseDoc(statusPage(layout, cells, focal.id), url), url);
  const obs = observe(scan);
  return {
    mode,
    focalId: focal.id,
    tweets: obs.tweets,
    relations: obs.relations,
    facts: obs.facts,
    pageUrl: url,
    pageKind: 'status',
    ...extra,
  };
}
