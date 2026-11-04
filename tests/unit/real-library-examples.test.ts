import { describe, expect, it } from 'vitest';
import { realExamples } from '../../src/web/realExamples';
import { realExampleContent } from '../../src/web/realExampleContent';

const counts: Record<string, number> = {
  inoino: 2, oliver: 2, 'reddit-zelda': 22, benji: 5, samuel: 4,
  'reddit-mario': 39, hasan: 2, chris: 2, tatsu: 3, joe: 2, niklas: 1,
};

describe('curated public library reading content', () => {
  it('preserves the complete saved post sequence for every public example', () => {
    expect(realExamples).toHaveLength(11);
    expect(Object.keys(realExampleContent).sort()).toEqual(Object.keys(counts).sort());
    expect(Object.values(realExampleContent).flat()).toHaveLength(84);

    for (const example of realExamples) {
      const posts = realExampleContent[example.id];
      expect(posts).toHaveLength(counts[example.id]!);
      expect(posts).toHaveLength(example.publicationCount);
      expect(posts?.[0]?.url).toBe(example.sourceUrl);
      expect(posts?.every((post) => post.text?.length || post.blocks?.length || post.card)).toBe(true);
    }
  });

  it('shows original extracted text and marks captures that were truncated', () => {
    expect(realExampleContent.inoino![0]?.text?.[0]?.v).toContain('【Main Features】');
    expect(realExampleContent['reddit-zelda']![0]?.blocks?.length).toBeGreaterThan(3);
    expect(realExampleContent['reddit-zelda']!.filter((post) => post.comment)).toHaveLength(21);
    expect(realExampleContent['reddit-mario']!.filter((post) => post.comment)).toHaveLength(38);
    expect(realExampleContent.benji!.some((post) => post.truncated)).toBe(true);
    expect(realExampleContent.samuel!.some((post) => post.truncated)).toBe(true);
  });

  it('contains no private notes, preferences, sync state, or library identifiers', () => {
    const allowed = new Set(['id', 'author', 'handle', 'url', 'text', 'blocks', 'card', 'truncated', 'comment', 'depth', 'media']);
    for (const post of Object.values(realExampleContent).flat()) {
      expect(Object.keys(post).every((key) => allowed.has(key))).toBe(true);
      expect(post.url).toMatch(/^https:\/\/(?:x\.com|www\.reddit\.com)\//);
    }
  });
});
