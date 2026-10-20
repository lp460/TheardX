/**
 * Optional AI features — architecture only. No provider is bundled and nothing is ever sent to an
 * AI service. A future provider must be enabled by the user AND have recorded consent
 * (settings.ai.consentAt) before any content leaves the browser.
 */
import type { EntryBundle } from '@/types/model';
import type { Settings } from '@/settings/schema';

export type AITask =
  'summary' | 'translation' | 'key-points' | 'title' | 'categorize' | 'tutorial-steps';

export interface AIResult {
  task: AITask;
  text: string;
  provider: string;
  createdAt: number;
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  /** Runs locally (on-device) or remotely — shown to the user before consent. */
  readonly location: 'local' | 'remote';
  run(task: AITask, bundle: EntryBundle, opts?: { targetLanguage?: string }): Promise<AIResult>;
}

export class AIUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AIUnavailableError';
  }
}

const providers = new Map<string, AIProvider>();

export function registerProvider(p: AIProvider): void {
  providers.set(p.id, p);
}

/** Gatekeeper: refuses to run without explicit opt-in and consent. */
export function getProvider(settings: Settings, id?: string): AIProvider {
  if (!settings.ai.enabled || !settings.ai.consentAt)
    throw new AIUnavailableError('Les fonctions IA sont désactivées (aucun consentement).');
  const p = id ? providers.get(id) : providers.values().next().value;
  if (!p) throw new AIUnavailableError('Aucun fournisseur IA n’est configuré.');
  return p;
}
