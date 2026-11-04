import {
  Braces,
  Check,
  Copy,
  Download,
  FileCode2,
  FileText,
  FileType2,
  Printer,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadSettings } from '@/settings/store';
import { applyTranslations, type PostTranslation } from '@/translate/engine';
import { languageName } from '@/translate/languages';
import { exportFileName, FORMAT_META, render, type ExportFormat } from '@/export';
import { exportEntries } from '@/storage/backup';
import { repository } from '@/storage/repository';
import type { EntryBundle } from '@/types/model';
import { copyText } from '@/utils/clipboard';
import { blobToDataUri, downloadFile } from '@/utils/download';
import { isoDay } from '@/utils/format';
import { toast } from './ToastNotification';
import { Button } from './ui/Button';
import { cn } from './ui/cn';
import { Dialog } from './ui/Dialog';

type Choice = ExportFormat | 'pdf';

const CHOICES: { id: Choice; label: string; hint: string; icon: typeof FileText }[] = [
  { id: 'markdown', label: 'Markdown', hint: 'Notes, Obsidian, GitHub', icon: FileText },
  { id: 'text', label: 'Texte brut', hint: 'Lisible partout', icon: FileType2 },
  { id: 'html', label: 'HTML autonome', hint: 'Fichier unique, sans script', icon: FileCode2 },
  { id: 'json', label: 'JSON structuré', hint: 'Données et relations', icon: Braces },
  { id: 'pdf', label: 'PDF', hint: 'Vue d’impression optimisée', icon: Printer },
];

export async function dataUrisFor(bundle: EntryBundle): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [url, rec] of Object.entries(bundle.media)) {
    if (rec.status === 'cached' && rec.blob) out[url] = await blobToDataUri(rec.blob);
  }
  return out;
}

async function loadBundles(ids: string[]): Promise<EntryBundle[]> {
  const out: EntryBundle[] = [];
  for (const id of ids) {
    const b = await repository.getBundle(id);
    if (b) out.push(b);
  }
  return out;
}

export function ExportDialog({
  entryIds,
  open,
  onOpenChange,
}: {
  entryIds: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [format, setFormat] = useState<Choice>('markdown');
  const [includeUrls, setIncludeUrls] = useState(true);
  const [embedImages, setEmbedImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const multi = entryIds.length > 1;
  // Saved translations of this entry (single-entry export only).
  const [translation, setTranslation] = useState<{
    target: string;
    records: Record<string, PostTranslation>;
  } | null>(null);
  const [useTranslation, setUseTranslation] = useState(false);
  useEffect(() => {
    if (!open || entryIds.length !== 1) return;
    void (async () => {
      const { translateTo } = await loadSettings();
      const b = await repository.getBundle(entryIds[0]!);
      if (!b) return;
      const records = await repository.getTranslations(Object.keys(b.tweets), translateTo);
      setTranslation(Object.keys(records).length ? { target: translateTo, records } : null);
    })();
  }, [open, entryIds]);

  const build = async (): Promise<{ content: string; name: string; mime: string } | null> => {
    const bundles = await loadBundles(entryIds);
    if (!bundles.length) throw new Error('Rien à exporter.');
    if (format === 'pdf') return null;
    if (format === 'json' && multi) {
      const backup = await exportEntries(entryIds);
      return {
        content: JSON.stringify(backup, null, 2),
        name: `threadshelf-selection-${isoDay()}.json`,
        mime: FORMAT_META.json.mime,
      };
    }
    const parts: string[] = [];
    for (const original of bundles) {
      const b =
        useTranslation && translation && !multi
          ? applyTranslations(original, translation.records, translation.target)
          : original;
      const dataUris = format === 'html' && embedImages ? await dataUrisFor(b) : undefined;
      parts.push(render(format, b, { includeUrls, embedImages, dataUris }));
    }
    const content = multi
      ? format === 'html'
        ? parts.join('\n<hr style="margin:64px 0;border:none;border-top:1px solid #ddd">\n')
        : parts.join(format === 'markdown' ? '\n\n---\n\n' : '\n\n────────────────────\n\n')
      : parts[0]!;
    const name = multi
      ? `threadshelf-${bundles.length}-entrees-${isoDay()}.${FORMAT_META[format].ext}`
      : exportFileName(bundles[0]!, format);
    return { content, name, mime: FORMAT_META[format].mime };
  };

  const onDownload = async () => {
    setBusy(true);
    try {
      if (format === 'pdf') {
        for (const id of entryIds.slice(0, 5)) {
          window.open(
            typeof chrome !== 'undefined' && chrome.runtime?.getURL
              ? chrome.runtime.getURL(`reader/index.html?id=${encodeURIComponent(id)}&print=1`)
              : `/reader/index.html?id=${encodeURIComponent(id)}&print=1`,
            '_blank',
            'noopener',
          );
        }
        toast.info(
          'Vue d’impression ouverte',
          'Choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.',
        );
      } else {
        const out = await build();
        if (out) {
          downloadFile(out.content, out.name, out.mime);
          toast.success('Export téléchargé', out.name);
        }
      }
      onOpenChange(false);
    } catch (e) {
      toast.error('Export impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    setBusy(true);
    try {
      const out = await build();
      if (out) {
        await copyText(out.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast.success('Copié dans le presse-papiers');
      }
    } catch (e) {
      toast.error('Copie impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={multi ? `Exporter ${entryIds.length} entrées` : 'Exporter'}
      description="Les fichiers sont générés localement, rien n’est envoyé sur Internet."
      footer={
        <>
          {format === 'markdown' || format === 'text' ? (
            <Button variant="ghost" onClick={onCopy} disabled={busy}>
              {copied ? <Check size={14} /> : <Copy size={14} />} Copier
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={onDownload}
            loading={busy}
            data-testid="export-confirm"
          >
            {format === 'pdf' ? <Printer size={14} /> : <Download size={14} />}{' '}
            {format === 'pdf' ? 'Ouvrir l’impression' : 'Télécharger'}
          </Button>
        </>
      }
    >
      <div
        role="radiogroup"
        aria-label="Format"
        className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
      >
        {CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={format === c.id}
            onClick={() => setFormat(c.id)}
            disabled={c.id === 'pdf' && entryIds.length > 5}
            className={cn(
              'ts-focus flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-40',
              format === c.id ? 'border-accent/70 bg-accent-soft' : 'border-line hover:bg-subtle',
            )}
          >
            <c.icon size={17} className={format === c.id ? 'text-accent' : 'text-muted'} />
            <span>
              <span className="block text-[13px] font-medium text-fg">{c.label}</span>
              <span className="block text-[11.5px] text-muted">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-[13px]">
        {format !== 'json' && format !== 'pdf' ? (
          <label className="flex items-center gap-2 text-fg">
            <input
              type="checkbox"
              checked={includeUrls}
              onChange={(e) => setIncludeUrls(e.target.checked)}
              className="accent-[hsl(var(--ts-accent))]"
            />
            Inclure l’URL de chaque publication
          </label>
        ) : null}
        {format === 'html' ? (
          <label className="flex items-center gap-2 text-fg">
            <input
              type="checkbox"
              checked={embedImages}
              onChange={(e) => setEmbedImages(e.target.checked)}
              className="accent-[hsl(var(--ts-accent))]"
            />
            Intégrer les images enregistrées (fichier lisible hors ligne)
          </label>
        ) : null}
        {translation && !multi && format !== 'json' && format !== 'pdf' ? (
          <label className="flex items-center gap-2 text-fg">
            <input
              type="checkbox"
              checked={useTranslation}
              onChange={(e) => setUseTranslation(e.target.checked)}
              className="accent-[hsl(var(--ts-accent))]"
              data-testid="export-translation"
            />
            Exporter la traduction ({languageName(translation.target)})
          </label>
        ) : null}
        {format === 'pdf' ? (
          <p className="text-muted">
            Le PDF est produit par la fenêtre d’impression du navigateur, avec une mise en page
            éditoriale.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
