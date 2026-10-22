import {
  Database,
  Download,
  HardDrive,
  Keyboard,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { exportLibrary, importLibrary, ImportError, type ImportReport } from '@/storage/backup';
import { repository } from '@/storage/repository';
import { replaceSettings } from '@/settings/store';
import type { Settings } from '@/settings/schema';
import { detectCapabilities, shortcutsUrl } from '@/utils/browser';
import { downloadFile } from '@/utils/download';
import { formatBytes, isoDay } from '@/utils/format';
import { useSettings } from './hooks';
import { SyncSettings } from './SyncSettings';
import { toast } from './ToastNotification';
import { Button } from './ui/Button';
import { cn } from './ui/cn';
import { ConfirmDialog } from './ui/Dialog';
import { Kbd, Switch } from './ui/primitives';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

function Section({
  title,
  icon,
  children,
  id,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-2xl border border-line bg-surface px-5 py-4">
      <h2 className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-fg">
        <span className="text-muted">{icon}</span>
        {title}
      </h2>
      <div className="divide-y divide-line/70">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'ts-focus inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <div className="text-[13.5px] font-medium text-fg">{label}</div>
        {description ? <div className="mt-0.5 text-[12.5px] text-muted">{description}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function StorageMeter() {
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof repository.storageUsage>> | null>(
    null,
  );
  useEffect(() => {
    repository
      .storageUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);
  if (!usage) return <div className="skeleton h-10 w-full" />;
  const pct = usage.quota ? Math.min(100, (usage.usage / usage.quota) * 100) : 0;
  return (
    <div className="py-2.5" data-testid="storage-meter">
      <div className="flex justify-between text-[12.5px] text-muted">
        <span>
          {usage.entries} entrées · {usage.tweets} publications · médias{' '}
          {formatBytes(usage.mediaBytes)}
        </span>
        <span>
          {formatBytes(usage.usage)}
          {usage.quota ? ` / ${formatBytes(usage.quota)}` : ''}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${Math.max(pct, 0.5)}%` }}
        />
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const [s, update, loaded] = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [strategy, setStrategy] = useState<'merge' | 'replace'>('merge');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const caps = detectCapabilities();

  if (!loaded)
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-32" />
        ))}
      </div>
    );

  const onExport = async (includeMedia: boolean) => {
    setBusy(includeMedia ? 'export-media' : 'export');
    try {
      const backup = await exportLibrary({ includeMedia, settings: s, appVersion: VERSION });
      downloadFile(
        JSON.stringify(backup, null, 2),
        `threadshelf-sauvegarde-${isoDay()}.json`,
        'application/json',
      );
      toast.success('Sauvegarde exportée', `${backup.data.entries.length} entrées`);
    } catch (e) {
      toast.error('Export impossible', String(e));
    } finally {
      setBusy(null);
    }
  };

  const onImport = async (file: File) => {
    setBusy('import');
    setReport(null);
    try {
      const text = await file.text();
      const r = await importLibrary(text, { strategy });
      if (r.settings) await replaceSettings(r.settings as Settings);
      setReport(r);
      toast.success(
        'Import terminé',
        `${r.entries.added} ajoutée(s), ${r.entries.updated} mise(s) à jour`,
      );
    } catch (e) {
      toast.error(
        'Import refusé',
        e instanceof ImportError ? e.message : `Aucune donnée n’a été modifiée. ${String(e)}`,
      );
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4" data-testid="settings-panel">
      <Section title="Général" icon={<Monitor size={15} />}>
        <Switch
          id="set-enabled"
          checked={s.enabled}
          onChange={(v) => update({ enabled: v })}
          label="Activer ThreadShelf sur X"
          description="Désactivé : aucune détection ni interface sur les pages X."
        />
        <Switch
          id="set-auto"
          checked={s.autoDetect}
          onChange={(v) => update({ autoDetect: v })}
          disabled={!s.enabled}
          label="Détection automatique"
          description="Repère les publications pendant la navigation. Rien n’est enregistré sans votre action."
        />
        <Switch
          id="set-inject"
          checked={s.injectUi}
          onChange={(v) => update({ injectUi: v })}
          disabled={!s.enabled}
          label="Interface dans la page"
          description="Barre ThreadShelf sous la publication ouverte. Désactivée : utilisez la popup ou les raccourcis."
        />
        <Switch
          id="set-buttons"
          checked={s.perPostButtons}
          onChange={(v) => update({ perPostButtons: v })}
          disabled={!s.enabled || !s.injectUi}
          label="Bouton sur chaque publication"
          description="Petit bouton discret dans la barre d’actions de chaque publication."
        />
        <Switch
          id="set-fab"
          checked={s.floatingButton}
          onChange={(v) => update({ floatingButton: v })}
          disabled={!s.enabled || !s.injectUi}
          label="Bouton flottant ThreadShelf"
          description="Bouton toujours visible en bas à droite de X, qui ouvre toutes les actions."
        />
        <Switch
          id="set-notif"
          checked={s.notifications}
          onChange={(v) => update({ notifications: v })}
          label="Notifications"
          description="Confirmation discrète après un enregistrement ou une copie."
        />
        <Row label="Domaines" description="Activer ThreadShelf par domaine.">
          <div className="flex gap-3 text-[13px]">
            {(['x.com', 'twitter.com'] as const).map((d) => (
              <label key={d} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={!s.disabledDomains.includes(d)}
                  className="accent-[hsl(var(--ts-accent))]"
                  onChange={(e) =>
                    update({
                      disabledDomains: e.target.checked
                        ? s.disabledDomains.filter((x) => x !== d)
                        : [...s.disabledDomains, d],
                    })
                  }
                />
                {d}
              </label>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Apparence et lecture" icon={<Sun size={15} />}>
        <Row label="Thème">
          <Segmented
            label="Thème"
            value={s.theme}
            onChange={(v) => update({ theme: v })}
            options={[
              { value: 'system', label: 'Système', icon: <Monitor size={13} /> },
              { value: 'light', label: 'Clair', icon: <Sun size={13} /> },
              { value: 'dark', label: 'Sombre', icon: <Moon size={13} /> },
            ]}
          />
        </Row>
        <Row label="Police du lecteur">
          <Segmented
            label="Police"
            value={s.reader.font}
            onChange={(v) => update({ reader: { font: v } })}
            options={[
              { value: 'serif', label: 'Serif' },
              { value: 'sans', label: 'Sans-serif' },
            ]}
          />
        </Row>
        <Row label="Taille du texte" description={`${s.reader.fontSize} px`}>
          <input
            type="range"
            min={14}
            max={26}
            value={s.reader.fontSize}
            onChange={(e) => update({ reader: { fontSize: Number(e.target.value) } })}
            aria-label="Taille du texte"
            className="w-40 accent-[hsl(var(--ts-accent))]"
          />
        </Row>
        <Row label="Largeur de lecture" description={`${s.reader.width} px`}>
          <input
            type="range"
            min={520}
            max={960}
            step={20}
            value={s.reader.width}
            onChange={(e) => update({ reader: { width: Number(e.target.value) } })}
            aria-label="Largeur de lecture"
            className="w-40 accent-[hsl(var(--ts-accent))]"
          />
        </Row>
      </Section>

      <Section title="Copie" icon={<Keyboard size={15} />}>
        <Row label="Format par défaut">
          <Segmented
            label="Format de copie"
            value={s.copy.format}
            onChange={(v) => update({ copy: { format: v } })}
            options={[
              { value: 'markdown', label: 'Markdown' },
              { value: 'text', label: 'Texte' },
            ]}
          />
        </Row>
        <Switch
          checked={s.copy.includeUrls}
          onChange={(v) => update({ copy: { includeUrls: v } })}
          label="Inclure l’URL de chaque publication"
        />
      </Section>

      <Section title="Hors ligne" icon={<HardDrive size={15} />}>
        <Switch
          checked={s.cacheMedia}
          onChange={(v) => update({ cacheMedia: v })}
          label="Conserver les images enregistrées"
          description="Les images des publications enregistrées sont copiées localement. Les vidéos restent des liens vers X."
        />
        <Row label="Taille maximale par image" description={`${s.maxMediaMB} Mo`}>
          <input
            type="range"
            min={1}
            max={50}
            value={s.maxMediaMB}
            onChange={(e) => update({ maxMediaMB: Number(e.target.value) })}
            aria-label="Taille maximale par image"
            className="w-40 accent-[hsl(var(--ts-accent))]"
          />
        </Row>
        <StorageMeter />
      </Section>

      <SyncSettings />

      <Section title="Données" icon={<Database size={15} />} id="data">
        <Row
          label="Exporter la bibliothèque"
          description="Fichier JSON complet : entrées, publications, relations, collections, préférences."
        >
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onExport(false)}
              loading={busy === 'export'}
              data-testid="backup-export"
            >
              <Download size={13} /> JSON
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExport(true)}
              loading={busy === 'export-media'}
            >
              avec images
            </Button>
          </div>
        </Row>
        <Row
          label="Importer une sauvegarde"
          description="Le fichier est validé ; en cas d’erreur, rien n’est modifié."
        >
          <div className="flex items-center gap-2">
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as 'merge' | 'replace')}
              aria-label="Mode d’import"
              className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12.5px]"
            >
              <option value="merge">Fusionner</option>
              <option value="replace">Remplacer</option>
            </select>
            <Button size="sm" onClick={() => fileRef.current?.click()} loading={busy === 'import'}>
              <Upload size={13} /> Choisir…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              data-testid="backup-import-input"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
          </div>
        </Row>
        {report ? (
          <div className="py-2.5 text-[12.5px] text-muted" data-testid="import-report">
            {report.entries.added} ajoutée(s) · {report.entries.updated} mise(s) à jour ·{' '}
            {report.entries.skipped} ignorée(s) · {report.conflicts} conflit(s)
            {report.warnings.length ? (
              <ul className="mt-1 list-disc pl-4">
                {report.warnings.slice(0, 5).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <Row
          label="Effacer toute la bibliothèque"
          description="Supprime définitivement les entrées, publications et images enregistrées."
        >
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:bg-danger/10"
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 size={13} /> Effacer…
          </Button>
        </Row>
      </Section>

      <Section title="Raccourcis clavier" icon={<Keyboard size={15} />}>
        <div className="grid grid-cols-[1fr_auto] gap-y-2 py-2.5 text-[13px]">
          <span>Ouvrir ThreadShelf</span>
          <span>
            <Kbd>⌥</Kbd> <Kbd>⇧</Kbd> <Kbd>T</Kbd>
          </span>
          <span>Enregistrer le thread affiché</span>
          <span>
            <Kbd>⌥</Kbd> <Kbd>⇧</Kbd> <Kbd>S</Kbd>
          </span>
          <span>Copier le thread (Markdown)</span>
          <span>
            <Kbd>⌥</Kbd> <Kbd>⇧</Kbd> <Kbd>C</Kbd>
          </span>
          <span>Ouvrir la bibliothèque</span>
          <span>
            <Kbd>⌥</Kbd> <Kbd>⇧</Kbd> <Kbd>L</Kbd>
          </span>
        </div>
        <p className="py-2.5 text-[12.5px] text-muted">
          Modifiables dans{' '}
          <code className="rounded bg-subtle px-1">{shortcutsUrl(caps.browser)}</code>.
        </p>
      </Section>

      <Section title="Fonctions IA (facultatives)" icon={<Sparkles size={15} />}>
        <p className="py-2.5 text-[12.5px] leading-relaxed text-muted">
          Résumé, traduction ou catégorisation pourront être ajoutés via un fournisseur de votre
          choix. Aucun fournisseur n’est configuré : aucun contenu n’est jamais envoyé à un service
          d’IA sans votre consentement explicite.
        </p>
      </Section>

      <p className="px-1 text-[12px] text-faint">
        ThreadShelf {VERSION} · navigateur détecté : {caps.browser} · panneau latéral natif :{' '}
        {caps.sidePanel ? 'disponible' : 'non disponible'} · aucune télémétrie.
      </p>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Effacer toute la bibliothèque ?"
        description="Cette action est définitive. Pensez à exporter une sauvegarde avant."
        confirmLabel="Tout effacer"
        destructive
        onConfirm={async () => {
          await repository.clearAll();
          toast.success('Bibliothèque effacée');
        }}
      />
    </div>
  );
}
