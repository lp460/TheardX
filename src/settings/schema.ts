import { z } from 'zod';

export const SUPPORTED_DOMAINS = ['x.com', 'twitter.com', 'reddit.com'] as const;
export type SupportedDomain = (typeof SUPPORTED_DOMAINS)[number];

export const settingsSchema = z.object({
  /** Master switch. When false the content script does nothing at all. */
  enabled: z.boolean().default(true),
  /** Watch the page for posts (MutationObserver). Off: scan only on explicit user action. */
  autoDetect: z.boolean().default(true),
  /** Any visual element injected into X pages (inline bar, per-post buttons). */
  injectUi: z.boolean().default(true),
  /** Small ThreadShelf button on every post (requires injectUi). */
  perPostButtons: z.boolean().default(true),
  /** Floating ThreadShelf button on X pages (requires injectUi). */
  floatingButton: z.boolean().default(true),
  notifications: z.boolean().default(true),
  disabledDomains: z.array(z.enum(SUPPORTED_DOMAINS)).default([]),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  reader: z
    .object({
      fontSize: z.number().min(14).max(26).default(19),
      width: z.number().min(520).max(960).default(680),
      font: z.enum(['serif', 'sans']).default('serif'),
    })
    .default({ fontSize: 19, width: 680, font: 'serif' }),
  copy: z
    .object({
      format: z.enum(['markdown', 'text']).default('markdown'),
      includeUrls: z.boolean().default(true),
    })
    .default({ format: 'markdown', includeUrls: true }),
  /** Target language of the reader's « Traduire » button. */
  translateTo: z
    .string()
    .regex(/^[a-z]{2,3}$/)
    .default('fr'),
  /** Download images of saved posts into IndexedDB for offline reading. */
  cacheMedia: z.boolean().default(true),
  maxMediaMB: z.number().min(1).max(50).default(8),
  /** Optional AI features are off and require explicit consent (no provider is bundled). */
  ai: z
    .object({ enabled: z.boolean().default(false), consentAt: z.number().nullable().default(null) })
    .default({ enabled: false, consentAt: null }),
  /** Library synchronisation through a private GitHub repository (credentials live in a separate store). */
  sync: z
    .object({
      enabled: z.boolean().default(false),
      /** owner/name of the private repository, set automatically when signing in. */
      repo: z.string().max(200).default(''),
      filePath: z.string().max(200).default('threadshelf/library.json'),
      encrypt: z.boolean().default(false),
      intervalMin: z.number().int().min(5).max(1440).default(15),
      /** Override of the built-in GitHub OAuth App client ID (public identifier, not a secret). */
      oauthClientId: z.string().max(200).default(''),
    })
    .default({
      enabled: false,
      repo: '',
      filePath: 'threadshelf/library.json',
      encrypt: false,
      intervalMin: 15,
      oauthClientId: '',
    }),
  library: z
    .object({
      view: z.enum(['cards', 'list']).default('cards'),
      sort: z
        .enum(['saved-desc', 'saved-asc', 'published-desc', 'published-asc'])
        .default('saved-desc'),
    })
    .default({ view: 'cards', sort: 'saved-desc' }),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/** Parses stored settings, falling back to defaults for anything missing or invalid. */
export function parseSettings(input: unknown): Settings {
  const result = settingsSchema.safeParse(input ?? {});
  if (result.success) return result.data;
  // Keep valid top-level keys, drop invalid ones.
  const out: Record<string, unknown> = {};
  if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      const shape = (settingsSchema.shape as Record<string, z.ZodType>)[key];
      if (shape && shape.safeParse(value).success) out[key] = value;
    }
  }
  return settingsSchema.parse(out);
}

export function domainOf(hostname: string): SupportedDomain | null {
  const h = hostname.toLowerCase().replace(/^(www|mobile)\./, '');
  return (SUPPORTED_DOMAINS as readonly string[]).includes(h) ? (h as SupportedDomain) : null;
}

/** Whether ThreadShelf should run on a page. */
export function isActiveOn(settings: Settings, hostname: string): boolean {
  const d = domainOf(hostname);
  return settings.enabled && !!d && !settings.disabledDomains.includes(d);
}
