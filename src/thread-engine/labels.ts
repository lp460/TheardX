import type { Completeness, CompletenessStatus, IssueCode, Platform } from '@/types/model';
import { vocab } from '@/utils/vocab';

export function completenessLabel(status: CompletenessStatus): string {
  switch (status) {
    case 'complete':
      return 'Complet et vérifié';
    case 'partial':
      return 'Partiel';
    case 'needs_more':
      return 'Chargement supplémentaire nécessaire';
    case 'unreconstructable':
      return 'Reconstruction automatique impossible';
    case 'single':
      return 'Publication seule';
    case 'manual':
      return 'Sélection manuelle';
  }
}

export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

export function completenessTone(status: CompletenessStatus): Tone {
  switch (status) {
    case 'complete':
      return 'success';
    case 'partial':
    case 'needs_more':
      return 'warning';
    case 'unreconstructable':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function issueLabel(code: IssueCode, platform?: Platform): string {
  if (platform === 'reddit') {
    if (code === 'end-not-loaded')
      return 'Des commentaires ne sont pas encore chargés — dépliez les « more replies » ou faites défiler.';
    if (code === 'end-unverified')
      return 'Impossible de vérifier que tous les commentaires sont chargés.';
    if (code === 'start-not-loaded') return 'Le post lui-même n’est pas chargé — ouvrez le post.';
  }
  switch (code) {
    case 'start-not-loaded':
      return 'Le début du thread n’est pas chargé — remontez dans la page.';
    case 'start-unverified':
      return 'Le début du thread n’a pas pu être vérifié.';
    case 'end-not-loaded':
      return 'La suite du thread n’est pas encore chargée — faites défiler vers le bas.';
    case 'end-unverified':
      return 'La fin du thread n’a pas pu être vérifiée.';
    case 'deleted-post':
      return 'Une publication du fil est supprimée ou indisponible.';
    case 'branching':
      return 'L’auteur a répondu plusieurs fois au même message : une seule branche est suivie.';
    case 'conversation-continues':
      return 'La conversation continue avec d’autres comptes.';
    case 'no-structure':
      return 'Aucune structure de thread n’a été reconnue sur cette page.';
    case 'not-status-page':
      return 'Ouvrez la publication elle-même pour une reconstruction vérifiée.';
    case 'truncated-text':
      return 'Au moins un texte est tronqué (« Afficher plus ») — ouvrez la publication pour le texte complet.';
  }
}

/** Toast / summary message after a capture. */
export function captureSummary(
  count: number,
  c: Completeness,
  kind: string,
  platform?: Platform,
): string {
  const v = vocab(platform);
  if (kind === 'thread')
    return c.status === 'complete' ? v.savedComplete(count) : v.savedIncomplete(count);
  if (kind === 'selection') return `Sélection enregistrée — ${v.posts(count)}`;
  if (platform === 'reddit') return 'Message enregistré';
  if (kind === 'references') return `Publication et références enregistrées`;
  return 'Publication enregistrée';
}
