/** Language helpers for translation: names, quick script-based detection. */

export const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
  it: 'italien',
  pt: 'portugais',
  nl: 'néerlandais',
  ja: 'japonais',
  zh: 'chinois',
  ko: 'coréen',
  ru: 'russe',
  ar: 'arabe',
  hi: 'hindi',
  tr: 'turc',
  pl: 'polonais',
  uk: 'ukrainien',
  vi: 'vietnamien',
  th: 'thaï',
  id: 'indonésien',
  he: 'hébreu',
  sv: 'suédois',
};

export const TARGET_LANGUAGES = [
  'fr',
  'en',
  'es',
  'de',
  'it',
  'pt',
  'nl',
  'ja',
  'zh',
  'ko',
] as const;

export function languageName(code: string): string {
  return LANGUAGE_NAMES[base(code)] ?? code;
}

/** "fr-FR" → "fr"; X uses codes like "zh", "ja", "und" (undetermined), "qme" (media only). */
export function base(code: string | undefined | null): string {
  return (code ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
}

export function isUsableCode(code: string | undefined | null): boolean {
  const c = base(code);
  return /^[a-z]{2,3}$/.test(c) && !['und', 'qme', 'qht', 'qam', 'zxx', 'art'].includes(c);
}

/**
 * Script-based guess when no language tag is available. Good for distinguishing scripts
 * (CJK, Cyrillic, Arabic…); Latin text defaults to English unless obvious French/Spanish/German markers.
 */
export function guessLanguage(text: string): string {
  const t = text.slice(0, 2_000);
  const count = (re: RegExp) => (t.match(re) ?? []).length;
  if (count(/[぀-ヿ]/g) > 3) return 'ja';
  if (count(/[가-힯]/g) > 3) return 'ko';
  if (count(/[一-鿿]/g) > 3) return 'zh';
  if (count(/[Ѐ-ӿ]/g) > 5) return 'ru';
  if (count(/[؀-ۿ]/g) > 5) return 'ar';
  if (count(/[֐-׿]/g) > 5) return 'he';
  if (count(/[ऀ-ॿ]/g) > 5) return 'hi';
  if (count(/[฀-๿]/g) > 5) return 'th';
  const words = ` ${t.toLowerCase().replace(/[^\p{L}\s']/gu, ' ')} `;
  const score = (list: string[]) =>
    list.reduce((n, w) => n + (words.split(` ${w} `).length - 1), 0);
  const scores: [string, number][] = [
    [
      'fr',
      score(['le', 'la', 'les', 'des', 'est', 'et', 'une', 'pour', 'que', 'pas', 'avec', 'dans']),
    ],
    ['es', score(['el', 'los', 'las', 'es', 'y', 'una', 'para', 'que', 'con', 'por', 'del'])],
    ['de', score(['der', 'die', 'das', 'und', 'ist', 'nicht', 'mit', 'ein', 'eine', 'für', 'auf'])],
    ['pt', score(['o', 'os', 'as', 'é', 'e', 'uma', 'para', 'não', 'com', 'em', 'do'])],
    ['en', score(['the', 'and', 'is', 'to', 'of', 'a', 'in', 'that', 'for', 'with', 'this'])],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0]![1] > 0 ? scores[0]![0] : 'en';
}

/** Default target: the browser language if supported, else French. */
export function defaultTarget(): string {
  const b = base(typeof navigator !== 'undefined' ? navigator.language : 'fr');
  return (TARGET_LANGUAGES as readonly string[]).includes(b) ? b : 'fr';
}
