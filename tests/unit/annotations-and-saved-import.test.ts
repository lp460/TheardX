import { describe, expect, it } from 'vitest';
import { resolveTextAnchor } from '@/annotations/anchors';
import { parseSavedItems, refFromUrl } from '@/import/saved-items';

describe('personal text anchors', () => {
  const anchor = { exact: 'une idée intéressante', prefix: 'Voici ', suffix: ' à conserver', start: 6, end: 27 };

  it('anchors to original character offsets and survives preceding edits', () => {
    expect(resolveTextAnchor('Voici une idée intéressante à conserver', anchor)).toEqual({ start: 6, end: 27 });
    expect(resolveTextAnchor('Introduction. Voici une idée intéressante à conserver', anchor))
      .toEqual({ start: 20, end: 41 });
  });

  it('uses surrounding text to disambiguate identical quotes', () => {
    const a = { exact: 'important', prefix: 'très ', suffix: ' et juste', start: 0, end: 9 };
    const text = 'important ailleurs et très important et juste';
    expect(resolveTextAnchor(text, a))
      .toEqual({ start: text.lastIndexOf('important'), end: text.lastIndexOf('important') + 9 });
  });

  it('does not attach a comment arbitrarily when the passage is gone or ambiguous', () => {
    const a = { exact: 'important', prefix: '', suffix: '', start: 50, end: 59 };
    expect(resolveTextAnchor('important et important', a)).toBeNull();
    expect(resolveTextAnchor('texte remplacé', anchor)).toBeNull();
  });
});

describe('saved favorites import formats', () => {
  it('reads X bookmark IDs from the archive JS without executing JavaScript', () => {
    const file = 'window.YTD.bookmark.part0 = [{"bookmark":{"tweetId":"1860000000000000001"}},{"bookmark":{"tweetId":"1860000000000000001"}}]';
    expect(parseSavedItems(file, 'bookmark.js')).toEqual([{
      platform: 'x', id: '1860000000000000001', url: 'https://x.com/i/status/1860000000000000001',
    }]);
  });

  it('reads Reddit saved posts and comments, including relative permalinks', () => {
    const csv = 'id,permalink\nt3_abcde,https://www.reddit.com/r/test/comments/abcde/sujet/\nt1_zz123,/r/test/comments/abcde/sujet/zz123/\n';
    const result = parseSavedItems(csv, 'saved_comments.csv');
    expect(result.map((r) => r.id)).toEqual(['t3_abcde', 't1_zz123']);
    expect(result[1]?.url).toContain('/r/test/comments/abcde/sujet/zz123/');
  });

  it('rejects unrelated links and recognizes X CSV without duplicating IDs', () => {
    expect(refFromUrl('https://example.org/path')).toBeNull();
    const refs = parseSavedItems('url\nhttps://twitter.com/test/status/1860000000000000001\nhttps://x.com/i/status/1860000000000000001', 'x.csv');
    expect(refs).toHaveLength(1);
  });
});
