/** Platform wording for the UI: X threads and posts, Reddit discussions and messages. */
import type { Platform } from '@/types/model';

export interface Vocab {
  /** « le thread » / « la discussion » */
  theThread: string;
  /** « Thread » / « Discussion » */
  Thread: string;
  /** n publications / n messages */
  posts: (n: number) => string;
  /** @handle / u/name */
  at: (handle: string) => string;
  /** Mode « une publication » */
  thisPost: string;
  /** Hint of the thread mode in the capture panel. */
  threadHint: string;
  /** Quoted / linked posts mode exists on this platform. */
  references: boolean;
  /** Shown when the thread can only be verified from the post's own page. */
  openPostHint: string;
  /** Saved and complete. */
  savedComplete: (n: number) => string;
  /** Saved but not everything is loaded. */
  savedIncomplete: (n: number) => string;
  /** Progressive capture update. */
  updated: (n: number) => string;
  /** Scroll / expand to load the rest. */
  loadMoreHint: string;
  /** Toast after a copy. */
  copied: (n: number, format: string) => string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export const VOCAB: Record<Platform, Vocab> = {
  x: {
    theThread: 'le thread',
    Thread: 'Thread',
    posts: (n) => plural(n, 'publication', 'publications'),
    at: (h) => `@${h}`,
    thisPost: 'cette publication',
    threadHint: 'Les publications reliées de l’auteur',
    references: true,
    openPostHint: 'Ouvrez la publication pour un thread vérifié',
    savedComplete: (n) => `Thread enregistré — ${plural(n, 'publication', 'publications')}`,
    savedIncomplete: (n) =>
      `${plural(n, 'publication capturée', 'publications capturées')} — thread potentiellement incomplet`,
    updated: (n) => `Thread mis à jour — ${plural(n, 'publication', 'publications')}`,
    loadMoreHint: 'Faites défiler : la suite chargée sera ajoutée automatiquement.',
    copied: (n, f) => `${plural(n, 'publication copiée', 'publications copiées')} (${f})`,
  },
  reddit: {
    theThread: 'la discussion',
    Thread: 'Discussion',
    posts: (n) => plural(n, 'message', 'messages'),
    at: (h) => `u/${h}`,
    thisPost: 'ce message',
    threadHint: 'Le post et tous ses commentaires chargés',
    references: false,
    openPostHint: 'Ouvrez le post pour enregistrer toute la discussion',
    savedComplete: (n) => `Discussion enregistrée — ${plural(n, 'message', 'messages')}`,
    savedIncomplete: (n) =>
      `${plural(n, 'message enregistré', 'messages enregistrés')} — des commentaires restent à charger`,
    updated: (n) => `Discussion mise à jour — ${plural(n, 'message', 'messages')}`,
    loadMoreHint:
      'Dépliez les « more replies » ou faites défiler : les commentaires chargés seront ajoutés automatiquement.',
    copied: (n, f) => `${plural(n, 'message copié', 'messages copiés')} (${f})`,
  },
};

export function vocab(platform: Platform | undefined): Vocab {
  return VOCAB[platform ?? 'x'];
}
