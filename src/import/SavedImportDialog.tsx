import { useRef, useState } from 'react';
import { Download, FileArchive, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { importSavedItems, parseSavedItems, type SavedItemRef, type SavedImportProgress } from './saved-items';

export function SavedImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [items, setItems] = useState<SavedItemRef[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<SavedImportProgress | null>(null);
  const abort = useRef<AbortController | null>(null);

  const selectFiles = async (files: File[]) => {
    if (!files.length || busy) return;
    setError('');
    setDone(false);
    setProgress(null);
    try {
      const all = new Map<string, SavedItemRef>();
      for (const file of files) {
        if (file.size > 60 * 1024 * 1024) throw new Error(`${file.name} dépasse 60 Mo.`);
        const refs = parseSavedItems(await file.text(), file.name);
        for (const item of refs) all.set(`${item.platform}:${item.id}`, item);
      }
      if (!all.size) throw new Error('Aucun favori reconnu. Sélectionnez les CSV de Reddit ou un export de signets X en CSV/JSON/JS.');
      setItems([...all.values()]);
      setNames(files.map((f) => f.name));
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Impossible de lire le fichier.');
    }
  };

  const begin = async () => {
    setError('');
    setDone(false);
    setBusy(true);
    abort.current = new AbortController();
    try {
      await importSavedItems(items, setProgress, abort.current.signal);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Importation impossible.');
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (busy) { abort.current?.abort(); return; }
      onOpenChange(next);
    }} title="Importer les favoris X et Reddit"
      description="Importez vos éléments enregistrés dans votre bibliothèque personnelle, sans envoyer les fichiers sur un serveur."
      footer={
        <>
          {busy ? <Button variant="ghost" onClick={() => abort.current?.abort()}>Interrompre</Button>
            : <Button variant="ghost" onClick={() => onOpenChange(false)}>Fermer</Button>}
          <Button variant="primary" disabled={!items.length || busy || done} onClick={() => void begin()}>
            <Download size={14}/> {busy ? 'Import en cours…' : 'Importer les favoris'}
          </Button>
        </>
      }>
      <div className="space-y-4 text-[13px]">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-subtle/50 p-6 text-center hover:bg-subtle">
          <FolderOpen size={22} className="text-accent"/>
          <span className="font-semibold">Choisir un ou plusieurs fichiers</span>
          <span className="text-xs text-muted">Reddit : saved_posts.csv et saved_comments.csv · X : export CSV, JSON ou bookmarks.js</span>
          <input type="file" accept=".csv,.json,.js,.txt" multiple className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = ''; // Selecting the same file again must trigger a new import.
              void selectFiles(files);
            }} aria-label="Fichiers de favoris à importer" />
        </label>
        <div className="rounded-xl bg-subtle p-3 text-muted">
          <div className="mb-1 flex items-center gap-2 font-medium text-fg"><FileArchive size={14}/> Récupérer les données</div>
          <p>Reddit : demandez votre archive sur <a className="text-accent hover:underline" target="_blank" rel="noopener noreferrer" href="https://www.reddit.com/settings/data-request">Reddit</a>, décompressez-la et choisissez les fichiers de sauvegardes.</p>
          <p className="mt-1">X : importez un export de signets contenant leurs liens ou identifiants. L'archive X ne garantit pas la présence de ces données.</p>
        </div>
        {!!items.length && <div className="rounded-xl border border-line p-3" data-testid="saved-import-preview">
          <p className="font-semibold">{items.length} favoris identifiés</p>
          <p className="text-muted">X : {items.filter((i) => i.platform === 'x').length} · Reddit : {items.filter((i) => i.platform === 'reddit').length}</p>
          <p className="mt-1 text-xs text-faint">{names.join(' · ')}</p>
        </div>}
        {progress && <div role="status" className="rounded-xl border border-line p-3">
          <p>{progress.processed}/{progress.total} traités · {progress.added} ajoutés · {progress.skipped} déjà présents</p>
          <progress value={progress.processed} max={progress.total || 1} className="mt-2 w-full accent-[hsl(var(--ts-accent))]" />
          {done && <p className="mt-1 text-green-600">Import terminé. Les publications sont dans « À lire ».</p>}
        </div>}
        {error && <p role="alert" className="rounded-lg bg-warning/10 p-3 text-warning">{error}</p>}
        <p className="text-xs text-muted">L'import conserve d'abord les liens ; ouvrez les publications sur X ou Reddit avec l'extension pour récupérer le texte complet. Relancer un import ne crée pas de doublons.</p>
      </div>
    </Dialog>
  );
}
