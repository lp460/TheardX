import type { Segment, Tweet } from '@/types/model';

/** Lower-case, strip diacritics and collapse whitespace — used for search. */
export function fold(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function segmentsToPlain(segments: Segment[]): string {
  return segments.map((s) => s.v).join('');
}

export function tweetPlainText(tweet: Pick<Tweet, 'text'>): string {
  return segmentsToPlain(tweet.text);
}

/** Merges adjacent text segments and trims trailing whitespace at the very end. */
export function compactSegments(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    if (seg.t === 'text' && seg.v === '') continue;
    const prev = out[out.length - 1];
    if (seg.t === 'text' && prev?.t === 'text') {
      out[out.length - 1] = { t: 'text', v: prev.v + seg.v };
    } else {
      out.push(seg);
    }
  }
  // Trim leading/trailing whitespace of the whole text.
  const first = out[0];
  if (first?.t === 'text') out[0] = { t: 'text', v: first.v.replace(/^\s+/, '') };
  const last = out[out.length - 1];
  if (last?.t === 'text') out[out.length - 1] = { t: 'text', v: last.v.replace(/\s+$/, '') };
  return out.filter((s) => !(s.t === 'text' && s.v === ''));
}

/** First meaningful line of a post, for titles. */
export function deriveTitle(text: string, max = 90): string {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.replace(/[\p{P}\p{S}\s]/gu, '').length > 0);
  if (!line) return '';
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '') + '…';
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : input.slice(0, max - 1).trimEnd() + '…';
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
