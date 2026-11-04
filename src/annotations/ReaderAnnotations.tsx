import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Highlighter, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type MouseEvent, type RefObject } from 'react';
import { toast } from '@/components/ToastNotification';
import { Button } from '@/components/ui/Button';
import { repository } from '@/storage/repository';
import type { Annotation } from '@/types/model';
import { anchorFromSelection, rangeForAnchor, type TextAnchor } from './anchors';

const COLORS: Record<Annotation['color'], string> = {
  yellow: 'rgba(250,204,21,.38)',
  green: 'rgba(74,222,128,.32)',
  pink: 'rgba(244,114,182,.35)',
  blue: 'rgba(96,165,250,.32)',
};
const COLOR_NAMES: Record<Annotation['color'], string> = {
  yellow: 'jaune', green: 'vert', pink: 'rose', blue: 'bleu',
};

interface PendingSelection {
  tweetId: string;
  anchor: TextAnchor;
  x: number;
  y: number;
}

interface HighlightRect {
  id: string;
  color: Annotation['color'];
  left: number;
  top: number;
  width: number;
  height: number;
}

const EMPTY_ANNOTATIONS: Annotation[] = [];

/** The same personal annotation UI runs in the PWA and the MV3 extension reader. */
export function useReaderAnnotations(
  entryId: string,
  articleRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const annotations = useLiveQuery(
    () => entryId ? repository.listAnnotations(entryId) : Promise.resolve([]),
    [entryId],
    EMPTY_ANNOTATIONS,
  );
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<Annotation['color']>('yellow');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [rects, setRects] = useState<HighlightRect[]>([]);
  const [orphaned, setOrphaned] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    const article = articleRef.current;
    if (!article || !enabled) { setRects([]); return; }
    const bounds = article.getBoundingClientRect();
    const next: HighlightRect[] = [];
    const missing = new Set<string>();
    const roots = new Map(Array.from(article.querySelectorAll<HTMLElement>('[data-annotation-tweet]'))
      .map((el) => [el.dataset.annotationTweet, el]));
    for (const item of annotations) {
      const root = roots.get(item.tweetId);
      const range = root ? rangeForAnchor(root, item) : null;
      if (!range) { missing.add(item.id); continue; }
      for (const rect of Array.from(range.getClientRects())) {
        if (!rect.width || !rect.height) continue;
        next.push({
          id: item.id,
          color: item.color,
          left: rect.left - bounds.left,
          top: rect.top - bounds.top,
          width: rect.width,
          height: rect.height,
        });
      }
    }
    setRects(next);
    setOrphaned(missing);
  }, [annotations, articleRef, enabled]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    };
    schedule();
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    resize?.observe(article);
    window.addEventListener('resize', schedule);
    // Image loading or font changes can alter the position without changing the text.
    article.addEventListener('load', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      window.removeEventListener('resize', schedule);
      article.removeEventListener('load', schedule, true);
    };
  }, [articleRef, refresh]);

  const onSelection = useCallback(() => {
    if (!enabled) return;
    const selection = window.getSelection();
    const found = selection && anchorFromSelection(selection);
    if (!found || !articleRef.current?.contains(selection?.anchorNode ?? null)) return;
    setPending({
      tweetId: found.tweetId,
      anchor: found.anchor,
      x: Math.min(window.innerWidth - 185, Math.max(12, found.rect.left)),
      y: Math.max(62, found.rect.top - 50),
    });
    setCommenting(false);
    setDraft('');
  }, [articleRef, enabled]);

  const dismiss = () => {
    setPending(null);
    setCommenting(false);
    window.getSelection()?.removeAllRanges();
  };

  const save = async (comment: string) => {
    if (!pending) return;
    try {
      await repository.saveAnnotation({
        entryId, tweetId: pending.tweetId, ...pending.anchor, color, comment,
      });
      toast.success(comment ? 'Commentaire enregistré' : 'Passage surligné');
      setPanelOpen(!!comment || panelOpen);
      dismiss();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Annotation impossible');
    }
  };

  const jump = (a: Annotation) => {
    const root = Array.from(articleRef.current?.querySelectorAll<HTMLElement>('[data-annotation-tweet]') ?? [])
      .find((el) => el.dataset.annotationTweet === a.tweetId);
    root?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFocused(a.id);
  };

  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (window.getSelection()?.toString().trim() || (event.target as Element).closest('a,button,input,textarea')) return;
    const bounds = articleRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const hit = rects.find((r) => x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height);
    if (hit) { setFocused(hit.id); setPanelOpen(true); }
  };

  useEffect(() => {
    if (!focused || !panelOpen) return;
    const timeout = window.setTimeout(() => {
      const el = document.querySelector(`[data-annotation-id="${CSS.escape(focused)}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 30);
    return () => window.clearTimeout(timeout);
  }, [focused, panelOpen]);

  const onDelete = async (a: Annotation) => {
    if (!window.confirm('Supprimer ce surlignage et son commentaire ?')) return;
    await repository.deleteAnnotation(a.id);
  };

  const overlay = enabled ? (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-visible print:hidden" aria-hidden="true">
      {rects.map((rect, index) => (
        <span key={`${rect.id}-${index}`} className="absolute rounded-[2px]"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height,
            background: COLORS[rect.color] }} />
      ))}
    </div>
  ) : null;

  const toolbar = pending ? (
    <div className="fixed z-50 max-w-[calc(100vw-24px)] rounded-xl border border-line bg-elevated p-2 shadow-float print:hidden"
      role="toolbar" aria-label="Annoter la sélection" style={{ top: pending.y, left: pending.x }}
      onMouseDown={(e) => e.preventDefault()}>
      {commenting ? (
        <div className="w-72 max-w-full space-y-2">
          <label className="text-xs font-semibold text-fg" htmlFor="annotation-comment">Commentaire personnel</label>
          <textarea id="annotation-comment" value={draft} maxLength={20_000}
            onChange={(e) => setDraft(e.target.value)} autoFocus rows={3}
            className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-fg" />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={dismiss}>Annuler</Button>
            <Button size="sm" variant="primary" disabled={!draft.trim()} onClick={() => void save(draft.trim())}>Enregistrer</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {(Object.keys(COLORS) as Annotation['color'][]).map((c) => (
            <button key={c} type="button" title={`Surligner en ${COLOR_NAMES[c]}`}
              aria-label={`Surligner en ${COLOR_NAMES[c]}`} aria-pressed={color === c}
              onClick={() => { setColor(c); void repository.saveAnnotation({ entryId, tweetId: pending.tweetId,
                ...pending.anchor, color: c, comment: '' }).then(dismiss).catch(() => toast.error('Surlignage impossible')); }}
              className="ts-focus h-6 w-6 rounded-full border border-line"
              style={{ background: COLORS[c], outline: color === c ? '2px solid hsl(var(--ts-accent))' : undefined }} />
          ))}
          <button type="button" className="ts-focus inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-subtle"
            onClick={() => setCommenting(true)}><MessageSquare size={14}/> Commenter</button>
          <button type="button" className="rounded-md p-1 text-muted hover:bg-subtle" onClick={dismiss} aria-label="Fermer"><X size={14}/></button>
        </div>
      )}
    </div>
  ) : null;

  const panel = panelOpen ? (
    <aside className="fixed inset-x-2 bottom-2 z-40 max-h-[67vh] overflow-y-auto rounded-2xl border border-line bg-elevated p-4 shadow-float sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-80 xl:sticky xl:top-20 xl:right-auto xl:bottom-auto xl:ml-0 xl:max-h-[calc(100vh-6rem)] xl:w-72 xl:shrink-0 xl:self-start print:hidden"
      aria-label="Annotations personnelles" data-testid="reader-annotations-panel">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Highlighter size={15}/> Mes annotations ({annotations.length})</h2>
        <button type="button" aria-label="Fermer les annotations" onClick={() => setPanelOpen(false)}><X size={17}/></button>
      </div>
      {!annotations.length ? <p className="text-xs text-muted">Sélectionnez une phrase dans l'article pour la surligner ou la commenter.</p> : null}
      <ol className="space-y-3">
        {annotations.map((a) => (
          <li key={a.id} data-annotation-id={a.id} className={`rounded-xl border bg-surface p-3 text-[12px] ${focused === a.id ? 'border-accent' : 'border-line'}`}>
            <button type="button" onClick={() => jump(a)}
              className="w-full border-l-4 pl-2 text-left leading-relaxed text-fg hover:underline"
              style={{ borderColor: COLORS[a.color] }}>
              <span className="line-clamp-3">« {a.exact.trim()} »</span>
            </button>
            {orphaned.has(a.id) ? <p className="mt-1 text-warning">Passage introuvable dans cette version du texte.</p> : null}
            {editing === a.id ? (
              <div className="mt-2 space-y-2">
                <textarea value={editText} maxLength={20_000} rows={3} onChange={(e) => setEditText(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface p-2 text-fg" aria-label="Modifier le commentaire" />
                <Button size="sm" onClick={() => void repository.updateAnnotation(a.id, { comment: editText.trim() }).then(() => setEditing(null))}><Check size={12}/> Enregistrer</Button>
              </div>
            ) : a.comment ? <p className="mt-2 whitespace-pre-wrap text-fg">{a.comment}</p> : null}
            {a.resolved ? <span className="mt-2 inline-block text-green-600">✓ Résolu</span> : null}
            <div className="mt-2 flex flex-wrap gap-2 text-muted">
              <button type="button" onClick={() => { setEditing(a.id); setEditText(a.comment); }} className="hover:text-fg" title="Modifier"><Pencil size={14}/></button>
              <button type="button" onClick={() => void repository.updateAnnotation(a.id, { resolved: !a.resolved })}
                className="hover:text-fg" title={a.resolved ? 'Rouvrir' : 'Résoudre'}><Check size={14}/></button>
              <button type="button" onClick={() => void onDelete(a)} className="hover:text-red-500" title="Supprimer"><Trash2 size={14}/></button>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  ) : null;

  return {
    count: annotations.length,
    panelOpen,
    togglePanel: () => setPanelOpen((v) => !v),
    onSelection,
    onClick,
    overlay,
    toolbar,
    panel,
  };
}
