import { describe, expect, it } from 'vitest';
import { adapterFor } from '@/adapters/registry';
import { getProvider, AIUnavailableError } from '@/ai/provider';
import { DEFAULT_SETTINGS } from '@/settings/schema';
import { parseDoc } from '../helpers/dom';
import { statusPage, threadPosts } from '../fixtures/x-dom';

describe('content adapters', () => {
  it('resolves the X adapter and exposes the contract', () => {
    const a = adapterFor('https://twitter.com/a/status/1?s=20');
    expect(a?.id).toBe('x');
    expect(a?.normalizePostUrl('https://twitter.com/a/status/1?s=20')).toBe(
      'https://x.com/a/status/1',
    );
    expect(adapterFor('https://example.com/')).toBeNull();
    const t = threadPosts(2);
    const doc = parseDoc(
      statusPage('xds', t, t[0]!.id),
      `https://x.com/ada_dev/status/${t[0]!.id}`,
    );
    expect(a!.scan(doc, doc.location.href).cells).toHaveLength(2);
    const el = a!.findPostElement(doc, t[1]!.id);
    expect(el?.tagName).toBe('ARTICLE');
    expect(a!.actionAnchor(el!)?.querySelector('[data-engagement-action="share"]')).not.toBeNull();
  });

  it('AI is never available without opt-in and consent', () => {
    expect(() => getProvider(DEFAULT_SETTINGS)).toThrow(AIUnavailableError);
    expect(() =>
      getProvider({ ...DEFAULT_SETTINGS, ai: { enabled: true, consentAt: null } }),
    ).toThrow(AIUnavailableError);
  });
});
