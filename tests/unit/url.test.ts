import { describe, expect, it } from 'vitest';
import {
  canonicalTweetUrl,
  cleanExternalUrl,
  isAllowedMediaUrl,
  largeMediaUrl,
  normalizeTweetUrl,
  parseStatusUrl,
  parseXRoute,
  safeHref,
} from '@/utils/url';
import { snowflakeToDate, compareIds } from '@/utils/snowflake';

describe('status URL normalisation', () => {
  it.each([
    [
      'https://x.com/ada_dev/status/2079610838143623371',
      'https://x.com/ada_dev/status/2079610838143623371',
    ],
    [
      'https://twitter.com/ada_dev/status/2079610838143623371?s=20&t=abc',
      'https://x.com/ada_dev/status/2079610838143623371',
    ],
    [
      'https://mobile.twitter.com/ada_dev/statuses/123456789',
      'https://x.com/ada_dev/status/123456789',
    ],
    [
      'https://www.x.com/ada_dev/status/123456789/photo/1',
      'https://x.com/ada_dev/status/123456789',
    ],
    ['https://x.com/i/web/status/123456789', 'https://x.com/i/status/123456789'],
    ['/ada_dev/status/42#reply', 'https://x.com/ada_dev/status/42'],
    ['http://x.com/ada_dev/status/42?utm_source=newsletter', 'https://x.com/ada_dev/status/42'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTweetUrl(input)).toBe(expected);
  });

  it.each([
    'https://x.com/home',
    'https://x.com/ada_dev',
    'https://example.com/ada/status/1',
    'https://x.com/search/status/1',
    'javascript:alert(1)',
    'https://x.com/ada_dev/status/notanid',
    'https://x.com/this_handle_is_too_long_/status/1',
  ])('rejects %s', (input) => {
    expect(normalizeTweetUrl(input)).toBeNull();
  });

  it('parses handle and id', () => {
    expect(parseStatusUrl('https://x.com/Ada_Dev/status/99')).toEqual({
      id: '99',
      handle: 'Ada_Dev',
    });
  });

  it('builds canonical URLs and validates ids', () => {
    expect(canonicalTweetUrl('1', 'a')).toBe('https://x.com/a/status/1');
    expect(canonicalTweetUrl('1')).toBe('https://x.com/i/status/1');
    expect(() => canonicalTweetUrl('x1')).toThrow();
  });

  it('identifies routes', () => {
    expect(parseXRoute('https://x.com/ada/status/1')).toEqual({
      kind: 'status',
      id: '1',
      handle: 'ada',
    });
    expect(parseXRoute('https://x.com/home')).toEqual({ kind: 'home' });
    // The full-page view of a post's Article uses the post's ID.
    expect(parseXRoute('https://x.com/make_claude/article/2105380835675312294')).toEqual({
      kind: 'status',
      id: '2105380835675312294',
      handle: 'make_claude',
    });
    expect(parseXRoute('https://x.com/ada')).toEqual({ kind: 'profile', handle: 'ada' });
    expect(parseXRoute('https://x.com/settings/account')).toEqual({ kind: 'other' });
    expect(parseXRoute('https://example.com/ada/status/1')).toEqual({ kind: 'other' });
  });
});

describe('external links', () => {
  it('removes tracking parameters and keeps meaningful ones', () => {
    expect(cleanExternalUrl('https://example.com/a?utm_source=x&utm_medium=y&id=3')).toBe(
      'https://example.com/a?id=3',
    );
    expect(cleanExternalUrl('https://example.com/a?s=keep')).toBe('https://example.com/a?s=keep');
    expect(cleanExternalUrl('https://x.com/ada/status/1?s=20&t=zz')).toBe(
      'https://x.com/ada/status/1',
    );
  });
  it('rejects dangerous schemes', () => {
    expect(cleanExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
    expect(safeHref('https://ok.example/')).toBe('https://ok.example/');
  });
  it('only allows twimg media hosts over https', () => {
    expect(isAllowedMediaUrl('https://pbs.twimg.com/media/A.jpg')).toBe(true);
    expect(isAllowedMediaUrl('http://pbs.twimg.com/media/A.jpg')).toBe(false);
    expect(isAllowedMediaUrl('https://evil.example/media/A.jpg')).toBe(false);
  });
  it('upgrades media to the large rendition', () => {
    expect(largeMediaUrl('https://pbs.twimg.com/media/A?format=webp&name=small')).toBe(
      'https://pbs.twimg.com/media/A?format=webp&name=large',
    );
  });
});

describe('snowflake ids', () => {
  it('decodes the creation date of a modern id', () => {
    // 1585841080431321088 → 2022-10-28T03:33:57.xxxZ
    expect(snowflakeToDate('1585841080431321088')?.toISOString().slice(0, 10)).toBe('2022-10-28');
  });
  it('returns null for pre-snowflake ids', () => {
    expect(snowflakeToDate('20')).toBeNull();
  });
  it('compares ids numerically without precision loss', () => {
    expect(compareIds('9', '10')).toBeLessThan(0);
    expect(compareIds('2079610838143623372', '2079610838143623371')).toBeGreaterThan(0);
  });
});
