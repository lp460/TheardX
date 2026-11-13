import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { repository } from '@/storage/repository';
import type { Collection, Entry } from '@/types/model';
import { useWebI18n, type WebLanguage } from '@/web/i18n';
import { prepareSharedSnapshot } from './prepare';

export type ShareTarget =
  | { type: 'article'; entry: Entry }
  | { type: 'collection'; collection: Collection; entries: Entry[] };

type ShareRecord = {
  id: string;
  url: string;
  type: 'article' | 'collection';
  title: string;
  createdAt: number;
  expiresAt: number | null;
  collaboration?: boolean;
};

const labels = {
  fr: {
    title: 'Partager',
    description:
      'Le texte complet des publications sélectionnées sera accessible sans connexion à toute personne disposant du lien. Vos notes, favoris et tags privés ne seront pas partagés.',
    expiry: 'Durée du lien',
    week: '7 jours',
    month: '30 jours',
    never: 'Sans expiration',
    publish: 'Créer le lien',
    creating: 'Création…',
    copy: 'Copier',
    copied: 'Copié',
    close: 'Fermer',
    allLinks: 'Mes liens de partage',
    noLinks: 'Aucun lien créé pour le moment.',
    revoke: 'Révoquer',
    confirmRevoke: 'Révoquer définitivement ce lien de partage ?',
    ready: 'Lien prêt : toute personne qui le possède peut lire le contenu.',
    huge: 'Sélection trop grande (50 articles ou 1 Mo maximum).',
    noEntries: 'Cette collection est vide.',
    error: 'Impossible de préparer le partage.',
    open: 'Ouvrir',
    accessTitle: 'Mode de partage',
    readOnly: 'Lecture seule (par défaut)',
    collaboration: 'Autoriser la collaboration',
    collaborationHint: 'Les personnes connectées pourront ajouter des notes, commentaires et annotations visibles sur ce lien. Le contenu original ne pourra jamais être modifié.',
  },
  en: {
    title: 'Share',
    description:
      'The full text of selected posts will be available without signing in to anyone with the link. Your private notes, favorites and tags will not be shared.',
    expiry: 'Link duration',
    week: '7 days',
    month: '30 days',
    never: 'No expiration',
    publish: 'Create link',
    creating: 'Creating…',
    copy: 'Copy',
    copied: 'Copied',
    close: 'Close',
    allLinks: 'My shared links',
    noLinks: 'No links created yet.',
    revoke: 'Revoke',
    confirmRevoke: 'Permanently revoke this shared link?',
    ready: 'Link ready: anyone with it can read the content.',
    huge: 'Selection too large (maximum 50 articles or 1 MB).',
    noEntries: 'This collection is empty.',
    error: 'Unable to prepare this share.',
    open: 'Open',
    accessTitle: 'Sharing mode',
    readOnly: 'Read-only (default)',
    collaboration: 'Allow collaboration',
    collaborationHint: 'Signed-in visitors can add shared notes, comments and annotations. The original content can never be edited.',
  },
  es: {
    title: 'Compartir',
    description:
      'El texto completo de las publicaciones seleccionadas estará disponible sin iniciar sesión para quien tenga el enlace. No se comparten notas, favoritos ni etiquetas privadas.',
    expiry: 'Duración del enlace',
    week: '7 días',
    month: '30 días',
    never: 'Sin caducidad',
    publish: 'Crear enlace',
    creating: 'Creando…',
    copy: 'Copiar',
    copied: 'Copiado',
    close: 'Cerrar',
    allLinks: 'Mis enlaces compartidos',
    noLinks: 'Todavía no hay enlaces.',
    revoke: 'Revocar',
    confirmRevoke: '¿Revocar definitivamente este enlace?',
    ready: 'Enlace listo: cualquiera que lo tenga podrá leer el contenido.',
    huge: 'Selección demasiado grande (máximo 50 artículos o 1 MB).',
    noEntries: 'Esta colección está vacía.',
    error: 'No se puede preparar el contenido.',
    open: 'Abrir',
    accessTitle: 'Modo de compartir',
    readOnly: 'Solo lectura (predeterminado)',
    collaboration: 'Permitir colaboración',
    collaborationHint: 'Los usuarios conectados pueden añadir notas, comentarios y anotaciones visibles en este enlace. El contenido original nunca se modifica.',
  },
} satisfies Record<WebLanguage, Record<string, string>>;

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

export function ShareDialog({
  target,
  onClose,
}: {
  target: ShareTarget | null;
  onClose: () => void;
}) {
  const { language } = useWebI18n();
  const t = labels[language];
  const [expiresInDays, setExpiresInDays] = useState<'7' | '30' | 'never'>('30');
  const [collaboration, setCollaboration] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<ShareRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [shares, setShares] = useState<ShareRecord[]>([]);

  useEffect(() => {
    if (!target) return;
    let active = true;
    setError('');
    setCreated(null);
    setCopied(false);
    setCollaboration(false);
    void fetch('/api/share?mine=1', { credentials: 'same-origin' })
      .then((response) => parseResponse<{ shares: ShareRecord[] }>(response))
      .then((result) => {
        if (active) setShares(result.shares);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [target]);

  const create = async () => {
    if (!target || busy) return;
    setBusy(true);
    setError('');
    try {
      const entries = target.type === 'article' ? [target.entry] : target.entries;
      if (!entries.length) throw new Error(t.noEntries);
      if (entries.length > 50) throw new Error(t.huge);
      const bundles = await Promise.all(entries.map((entry) => repository.getBundle(entry.id)));
      if (bundles.some((bundle) => !bundle)) throw new Error(t.error);
      const snapshot = prepareSharedSnapshot(
        bundles.filter((bundle) => bundle !== null),
        {
          type: target.type,
          title: target.type === 'article' ? target.entry.title : target.collection.name,
          ...(target.type === 'collection' && target.collection.description
            ? { description: target.collection.description }
            : {}),
        },
      );
      const body = JSON.stringify({
        snapshot,
        expiresInDays: expiresInDays === 'never' ? null : Number(expiresInDays),
        collaboration,
      });
      if (new TextEncoder().encode(body).length > 1_000_000) throw new Error(t.huge);
      const record = await parseResponse<ShareRecord>(
        await fetch('/api/share', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
      );
      setCreated(record);
      setShares((items) => [record, ...items]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (record: ShareRecord) => {
    if (!window.confirm(t.confirmRevoke)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/share?id=${encodeURIComponent(record.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) await parseResponse(response);
      setShares((items) => items.filter((item) => item.id !== record.id));
      if (created?.id === record.id) setCreated(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Impossible de copier le lien sur cet appareil.');
    }
  };

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => !open && onClose()}
      title={t.title}
      description={t.description}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      <div className="space-y-5 pt-2">
        <div>
          <label className="mb-2 block text-xs font-semibold text-muted" htmlFor="share-expiry">
            {t.expiry}
          </label>
          <select
            id="share-expiry"
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value as typeof expiresInDays)}
            className="ts-focus min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-fg"
          >
            <option value="7">{t.week}</option>
            <option value="30">{t.month}</option>
            <option value="never">{t.never}</option>
          </select>
        </div>
        <fieldset className="rounded-xl border border-line p-3">
          <legend className="px-1 text-xs font-semibold text-muted">{t.accessTitle}</legend>
          <label className="flex min-h-10 items-center gap-3 text-sm">
            <input type="radio" name="share-access" checked={!collaboration}
              onChange={() => setCollaboration(false)} />
            {t.readOnly}
          </label>
          <label className="flex min-h-10 items-center gap-3 text-sm">
            <input type="radio" name="share-access" checked={collaboration}
              onChange={() => setCollaboration(true)} />
            {t.collaboration}
          </label>
          {collaboration ? <p className="mt-1 text-xs leading-relaxed text-muted">{t.collaborationHint}</p> : null}
        </fieldset>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void create()}
          className="min-h-11 w-full justify-center"
        >
          <Share2 size={16} />
          {busy ? t.creating : t.publish}
        </Button>
        {error ? (
          <p role="alert" className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-fg">
            {error}
          </p>
        ) : null}
        {created ? (
          <div
            role="status"
            className="space-y-2 rounded-xl border border-accent/30 bg-accent-soft/40 p-3"
          >
            <p className="flex items-start gap-2 text-xs text-fg">
              <Check size={15} className="shrink-0 text-accent" />
              {t.ready}
            </p>
            <p className="break-all text-xs text-muted">{created.url}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void copy(created.url)}>
                <Copy size={14} />
                {copied ? t.copied : t.copy}
              </Button>
              <a
                href={created.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ts-focus inline-flex min-h-8 items-center gap-1 text-xs text-accent"
              >
                <ExternalLink size={13} />
                {t.open}
              </a>
            </div>
          </div>
        ) : null}
        <div className="border-t border-line pt-4">
          <h3 className="mb-3 text-xs font-semibold text-muted">{t.allLinks}</h3>
          {shares.length ? (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {shares.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                >
                  <Link2 size={14} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-xs" title={record.title}>
                    {record.title}
                  </span>
                  <button
                    type="button"
                    className="ts-focus rounded p-2 text-accent"
                    aria-label={t.copy}
                    onClick={() => void copy(record.url)}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="ts-focus rounded p-2 text-warning"
                    aria-label={t.revoke}
                    onClick={() => void revoke(record)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">{t.noLinks}</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
