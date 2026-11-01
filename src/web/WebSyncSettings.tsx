import { useEffect, useState } from 'react';
import { Cloud, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { downloadWebMedia, getSyncState, setWebPassphrase, subscribeSync, syncWebNow, type WebSyncState } from './sync';

export function WebSyncSettings() {
  const [state, setState] = useState<WebSyncState>(getSyncState);
  const [passphrase, setPassphrase] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaMessage, setMediaMessage] = useState('');
  useEffect(() => subscribeSync(setState), []);
  return <section className="rounded-2xl border border-line bg-surface px-5 py-4">
    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg"><Cloud size={16} /> Synchronisation GitHub Web</h2>
    <p className="text-xs leading-relaxed text-muted">
      Même bibliothèque que l'extension : <code>threadshelf/library.json</code> dans votre dépôt privé
      <code> threadshelf-data</code>. Le contenu reste consultable localement hors connexion.
    </p>
    <div className="mt-3 flex items-center justify-between gap-3">
      <div className="text-xs text-muted">{state.phase === 'running' ? 'Synchronisation en cours…'
        : state.lastSyncAt ? `Dernière synchro : ${new Date(state.lastSyncAt).toLocaleString('fr-FR')}`
          : 'Aucune synchronisation terminée'}</div>
      <Button size="sm" disabled={state.phase === 'running'} onClick={() => void syncWebNow()}>
        <RefreshCw size={14} /> Synchroniser
      </Button>
    </div>
    {state.error ? <p className="mt-3 text-xs text-warning">{state.error}</p> : null}
    {state.phase === 'needs-passphrase' ? <form className="mt-4 flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => { e.preventDefault(); setWebPassphrase(passphrase); setPassphrase(''); }}>
      <label className="flex-1 text-xs text-muted">Phrase secrète de la bibliothèque chiffrée
        <input type="password" minLength={8} required value={passphrase} autoComplete="off"
          onChange={(e) => setPassphrase(e.target.value)}
          className="mt-1 h-9 w-full rounded-lg border border-line bg-bg px-3 text-fg" />
      </label>
      <Button size="sm" type="submit">Déverrouiller</Button>
    </form> : null}
    <p className="mt-3 flex items-start gap-2 text-xs text-muted"><ShieldCheck size={16} className="shrink-0" />
      La phrase secrète reste uniquement en mémoire pendant cette session et n'est jamais envoyée à Vercel.
    </p>
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
      <Button size="sm" disabled={mediaBusy} loading={mediaBusy} onClick={() => {
        setMediaBusy(true);
        void downloadWebMedia().then((r) => setMediaMessage(
          `${r.entries} entrées vérifiées · ${r.cached} images ajoutées · ${r.failed} échecs`,
        )).catch((e) => setMediaMessage(String(e))).finally(() => setMediaBusy(false));
      }}>Télécharger les images hors ligne</Button>
      {mediaMessage ? <span className="text-xs text-muted">{mediaMessage}</span> : null}
    </div>
  </section>;
}
