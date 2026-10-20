import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleDashed,
  Copy,
  Info,
  Layers3,
  Library,
  Loader2,
  MessageSquareQuote,
  MousePointerClick,
  Radio,
  Save,
  Trash2,
  X,
  XCircle,
  Hand,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { completenessLabel, issueLabel } from '@/thread-engine/labels';
import type { CaptureMode } from '@/thread-engine';
import { useContent, type ContentToast, type MenuAction } from '../store';
import { ActionMenu, FloatingButton } from './ActionMenu';

export interface PanelActions {
  menuAction: (a: MenuAction) => void;
  closeMenu: () => void;
  openFabMenu: (anchor: DOMRect) => void;
  save: () => void;
  copy: (format: 'markdown' | 'text') => void;
  read: () => void;
  remove: () => void;
  openLibrary: () => void;
  setMode: (m: CaptureMode) => void;
  close: () => void;
  createCollection: (name: string) => void;
  createCategory: (name: string) => void;
}

const MODES: { id: CaptureMode; label: string; hint: string; icon: ReactNode }[] = [
  {
    id: 'tweet',
    label: 'Publication',
    hint: 'Uniquement cette publication',
    icon: <Save size={14} />,
  },
  {
    id: 'thread',
    label: 'Thread',
    hint: 'Les publications reliées de l’auteur',
    icon: <Layers3 size={14} />,
  },
  {
    id: 'references',
    label: '+ Références',
    hint: 'Avec les publications citées ou liées',
    icon: <MessageSquareQuote size={14} />,
  },
  {
    id: 'selection',
    label: 'Sélection',
    hint: 'Cochez les publications à regrouper',
    icon: <MousePointerClick size={14} />,
  },
];

function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

function StatusLine() {
  const preview = useContent((s) => s.preview);
  const mode = useContent((s) => s.mode);
  if (!preview || mode === 'tweet') return null;
  const c = preview.completeness;
  if (mode === 'selection' || mode === 'references') return null;
  const Icon =
    c.status === 'complete'
      ? CheckCircle2
      : c.status === 'unreconstructable'
        ? XCircle
        : c.status === 'manual'
          ? Hand
          : c.status === 'needs_more'
            ? CircleDashed
            : AlertTriangle;
  const color =
    c.status === 'complete'
      ? 'text-success'
      : c.status === 'unreconstructable'
        ? 'text-danger'
        : 'text-warning';
  return (
    <div className="mt-3 rounded-xl bg-subtle px-3 py-2.5" data-testid="ts-status">
      <div className={cls('flex items-center gap-2 text-[12.5px] font-medium', color)}>
        <Icon size={14} /> {completenessLabel(c.status)} · {preview.posts.length} publication
        {preview.posts.length > 1 ? 's' : ''}
      </div>
      {c.issues.length ? (
        <ul className="mt-1 space-y-0.5 pl-6 text-[12px] leading-snug text-muted">
          {c.issues.map((i) => (
            <li key={i} className="list-disc">
              {issueLabel(i)}
            </li>
          ))}
        </ul>
      ) : null}
      {c.status !== 'complete' ? (
        <p className="mt-1.5 pl-6 text-[12px] leading-snug text-muted">
          Faites défiler la conversation : les publications chargées sont ajoutées automatiquement.
          Si la structure reste incertaine, utilisez le mode Sélection.
        </p>
      ) : null}
    </div>
  );
}

function PostList() {
  const preview = useContent((s) => s.preview);
  const mode = useContent((s) => s.mode);
  const selection = useContent((s) => s.selection);
  if (mode === 'selection') {
    return (
      <div
        className="mt-3 rounded-xl border border-dashed border-line px-3 py-3 text-[12.5px] text-muted"
        data-testid="ts-selection"
      >
        <div className="flex items-center gap-2 font-medium text-fg">
          <MousePointerClick size={14} className="text-accent" /> {selection.length} publication
          {selection.length > 1 ? 's' : ''} sélectionnée{selection.length > 1 ? 's' : ''}
        </div>
        <p className="mt-1">
          Cochez les publications avec le bouton ThreadShelf affiché dans leur barre d’actions, puis
          enregistrez.
        </p>
      </div>
    );
  }
  if (!preview) return null;
  const posts =
    mode === 'thread' ? preview.posts : preview.posts.filter((p) => p.id === preview.focalId);
  return (
    <ol className="mt-3 max-h-48 space-y-1 overflow-y-auto pr-1" aria-label="Aperçu">
      {posts.map((p, i) => (
        <li
          key={p.id}
          className={cls(
            'flex gap-2 rounded-lg px-2 py-1.5 text-[12.5px] leading-snug',
            p.id === preview.focalId ? 'bg-accent-soft' : '',
          )}
        >
          <span className="w-5 shrink-0 tabular-nums text-faint">{i + 1}</span>
          <span className="line-clamp-2 text-fg">
            {p.text || <em className="text-muted">Média</em>}
            {p.media ? (
              <span className="text-faint">
                {' '}
                · {p.media} média{p.media > 1 ? 's' : ''}
              </span>
            ) : null}
          </span>
        </li>
      ))}
      {mode === 'references' && preview.references.length
        ? preview.references.map((r) => (
            <li key={r.url} className="flex gap-2 px-2 py-1 text-[12px] text-muted">
              <span className="w-5 shrink-0">↳</span>
              <span className="truncate">
                {r.kind === 'quote' ? 'Citation' : 'Lien'} ·{' '}
                {r.captured ? 'capturée' : 'référence seulement'}
              </span>
            </li>
          ))
        : null}
      {mode === 'references' && !preview.references.length ? (
        <li className="px-2 text-[12px] text-muted">Aucune publication citée ou liée.</li>
      ) : null}
    </ol>
  );
}

function Options({ actions }: { actions: PanelActions }) {
  const s = useContent();
  const form = s.form;
  const setForm = (patch: Partial<typeof form>) => s.set({ form: { ...form, ...patch } });
  const input =
    'h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-fg outline-none focus:border-accent/60';
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <label className="text-[11.5px] font-medium text-muted">
        Collection
        <select
          className={cls(input, 'mt-1')}
          value={form.collectionId}
          onChange={(e) => {
            if (e.target.value === '__new') {
              const name = prompt('Nom de la nouvelle collection');
              if (name) actions.createCollection(name);
              return;
            }
            setForm({ collectionId: e.target.value });
          }}
        >
          <option value="">Aucune</option>
          {s.collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__new">+ Nouvelle…</option>
        </select>
      </label>
      <label className="text-[11.5px] font-medium text-muted">
        Catégorie
        <select
          className={cls(input, 'mt-1')}
          value={form.categoryId}
          onChange={(e) => {
            if (e.target.value === '__new') {
              const name = prompt('Nom de la nouvelle catégorie');
              if (name) actions.createCategory(name);
              return;
            }
            setForm({ categoryId: e.target.value });
          }}
        >
          <option value="">Aucune</option>
          {s.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__new">+ Nouvelle…</option>
        </select>
      </label>
      <label className="col-span-2 text-[11.5px] font-medium text-muted">
        Tags
        <input
          className={cls(input, 'mt-1')}
          value={form.tags}
          placeholder="react, tutoriel"
          onChange={(e) => setForm({ tags: e.target.value })}
        />
      </label>
      <label className="col-span-2 text-[11.5px] font-medium text-muted">
        Note
        <textarea
          className={cls(input, 'mt-1 h-16 resize-none py-1.5')}
          value={form.note}
          placeholder="Note personnelle"
          onChange={(e) => setForm({ note: e.target.value })}
        />
      </label>
    </div>
  );
}

/** FloatingPanel — opened from the inline bar, a per-post button, the popup or a shortcut. */
export function FloatingPanel({ actions }: { actions: PanelActions }) {
  const s = useContent();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!s.panelOpen) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') actions.close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [s.panelOpen, actions]);
  if (!s.panelOpen) return null;
  const canSave = s.mode === 'selection' ? s.selection.length > 0 : !!s.preview;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label="ThreadShelf"
      data-testid="ts-panel"
      className="pointer-events-auto fixed bottom-[84px] right-6 w-[380px] max-w-[calc(100vw-32px)] rounded-2xl border border-line bg-elevated p-4 text-fg shadow-float outline-none"
      style={{
        animation: 'ts-in 180ms cubic-bezier(.2,.8,.2,1)',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold">
          <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden>
            <rect x="1" y="1" width="30" height="30" rx="8.5" fill="#6857e8" />
            <rect x="8" y="8" width="16" height="3.2" rx="1.6" fill="#fff" />
            <rect x="8" y="13.6" width="12" height="3.2" rx="1.6" fill="#fff" opacity=".85" />
            <rect x="8" y="19.2" width="8" height="3.2" rx="1.6" fill="#fff" opacity=".7" />
          </svg>
          ThreadShelf
          {s.preview ? <span className="font-normal text-muted">· @{s.preview.handle}</span> : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Ouvrir la bibliothèque"
            title="Bibliothèque"
            onClick={actions.openLibrary}
            className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-fg"
          >
            <Library size={15} />
          </button>
          <button
            type="button"
            aria-label="Fermer"
            onClick={actions.close}
            className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Mode de capture"
        className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-subtle p-1"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={s.mode === m.id}
            title={m.hint}
            onClick={() => actions.setMode(m.id)}
            data-testid={`ts-mode-${m.id}`}
            className={cls(
              'flex h-8 items-center justify-center rounded-lg px-1 text-[11.5px] font-medium transition-colors',
              s.mode === m.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <StatusLine />
      <PostList />
      {s.live ? (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[12px] text-accent"
          role="status"
        >
          <Radio size={13} /> Suivi actif : les publications chargées en défilant sont ajoutées (
          {s.live.count}).
        </div>
      ) : null}
      <Options actions={actions} />

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!canSave || s.busy}
          onClick={actions.save}
          data-testid="ts-save"
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-[13px] font-medium text-accent-fg shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {s.busy ? (
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Save size={14} />
          )}
          {s.savedEntryId ? 'Mettre à jour' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={() => actions.copy('markdown')}
          disabled={!canSave}
          title="Copier en Markdown"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-medium hover:bg-subtle disabled:opacity-50"
          data-testid="ts-copy"
        >
          <Copy size={14} /> Copier
        </button>
        <button
          type="button"
          onClick={actions.read}
          disabled={!canSave}
          title="Lire dans ThreadShelf"
          aria-label="Lire"
          className="inline-flex h-9 items-center rounded-xl border border-line px-2.5 hover:bg-subtle disabled:opacity-50"
        >
          <BookOpen size={14} />
        </button>
        {s.savedEntryId ? (
          <button
            type="button"
            onClick={actions.remove}
            title="Supprimer la sauvegarde"
            aria-label="Supprimer la sauvegarde"
            className="inline-flex h-9 items-center rounded-xl border border-line px-2.5 text-danger hover:bg-danger/10"
            data-testid="ts-delete"
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => actions.copy('text')}
        disabled={!canSave}
        className="mt-2 text-[11.5px] text-muted hover:text-fg disabled:opacity-50"
      >
        Copier en texte brut
      </button>
    </div>
  );
}

const TOAST_ICON = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info };
const TOAST_COLOR = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  info: 'text-accent',
};

function ToastView({ t }: { t: ContentToast }) {
  const dismiss = useContent((s) => s.dismissToast);
  useEffect(() => {
    const timer = setTimeout(
      () => dismiss(t.id),
      t.tone === 'error' ? 7000 : t.tone === 'warning' ? 6000 : 3500,
    );
    return () => clearTimeout(timer);
  }, [t, dismiss]);
  const Icon = TOAST_ICON[t.tone];
  return (
    <div
      role={t.tone === 'error' ? 'alert' : 'status'}
      data-testid="ts-toast"
      className="pointer-events-auto flex w-[340px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-xl border border-line bg-elevated px-3.5 py-3 shadow-float"
      style={{ animation: 'ts-in 180ms cubic-bezier(.2,.8,.2,1)' }}
    >
      <Icon size={16} className={cls('mt-px shrink-0', TOAST_COLOR[t.tone])} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-fg">{t.title}</div>
        {t.description ? (
          <div className="mt-0.5 text-[12px] leading-snug text-muted">{t.description}</div>
        ) : null}
        {t.action ? (
          <button
            type="button"
            onClick={() => {
              t.action!.run();
              dismiss(t.id);
            }}
            className="mt-1 text-[12px] font-medium text-accent hover:underline"
          >
            {t.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Fermer"
        onClick={() => dismiss(t.id)}
        className="text-faint hover:text-fg"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function ContentApp({ actions }: { actions: PanelActions }) {
  const tone = useContent((s) => s.tone);
  const toasts = useContent((s) => s.toasts);
  const panelOpen = useContent((s) => s.panelOpen);
  const busy = useContent((s) => s.busy);
  return (
    <div
      className={cls('ts-root', tone === 'dark' && 'dark')}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483000 }}
    >
      <FloatingPanel actions={actions} />
      <FloatingButton onOpen={actions.openFabMenu} />
      <ActionMenu onAction={actions.menuAction} onClose={actions.closeMenu} />
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-6 flex flex-col items-end gap-2"
        style={{ bottom: panelOpen ? 'auto' : 84, top: panelOpen ? 16 : 'auto' }}
      >
        {toasts.map((t) => (
          <ToastView key={t.id} t={t} />
        ))}
      </div>
      {busy && !panelOpen ? <span className="sr-only">Enregistrement en cours</span> : null}
    </div>
  );
}
