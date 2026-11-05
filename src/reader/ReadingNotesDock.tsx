import { Highlighter, NotebookPen, Pencil, X } from 'lucide-react';
import { useState } from 'react';

const STORAGE_KEY = 'threadshelf.reader.notesDockHidden';

function initiallyHidden(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

interface ReadingNotesDockProps {
  note: string;
  annotationCount: number;
  annotationsOpen: boolean;
  onToggleAnnotations: () => void;
  onEditNote: () => void;
}

/** A dismissible reading companion: the original note stays in the editor. */
export function ReadingNotesDock({
  note,
  annotationCount,
  annotationsOpen,
  onToggleAnnotations,
  onEditNote,
}: ReadingNotesDockProps) {
  const [hidden, setHidden] = useState(initiallyHidden);
  const [noteOpen, setNoteOpen] = useState(false);
  const trimmedNote = note.trim();

  // Don't cover an untouched article just to advertise the feature.
  if (!trimmedNote && annotationCount === 0) return null;

  const toggleHidden = (next: boolean) => {
    setHidden(next);
    setNoteOpen(false);
    if (next && annotationsOpen) onToggleAnnotations();
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Private browsing can disable storage; hiding still works for this visit.
    }
  };

  return (
    <aside
      className="fixed inset-x-3 z-[45] mx-auto w-fit max-w-[calc(100vw-24px)] font-sans print:hidden sm:inset-x-auto sm:right-4 sm:mx-0"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      aria-label="Mes notes de lecture"
      data-testid="reader-notes-dock"
    >
      {hidden ? (
        <button
          type="button"
          className="ts-focus ml-auto flex min-h-11 items-center gap-2 rounded-full border border-line bg-elevated px-4 text-xs font-semibold text-fg shadow-float"
          onClick={() => toggleHidden(false)}
          aria-label="Afficher mes notes et annotations"
          data-testid="reader-notes-restore"
        >
          <NotebookPen size={17} className="text-accent" />
          Mes notes
          {annotationCount > 0 ? <span className="rounded-full bg-subtle px-1.5 tabular-nums">{annotationCount}</span> : null}
        </button>
      ) : (
        <div className="w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-line bg-elevated shadow-float">
          <div className="flex min-h-12 items-center gap-1 px-2 py-1">
            <button
              type="button"
              aria-label={`Afficher mes annotations (${annotationCount})`}
              aria-pressed={annotationsOpen}
              onClick={() => {
                setNoteOpen(false);
                onToggleAnnotations();
              }}
              className={`ts-focus inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium ${annotationsOpen ? 'bg-subtle text-accent' : 'text-fg hover:bg-subtle'}`}
              data-testid="reader-notes-annotations"
            >
              <Highlighter size={16} />
              <span className="tabular-nums">{annotationCount}</span>
            </button>
            <button
              type="button"
              aria-label="Afficher ma note personnelle"
              aria-expanded={noteOpen}
              onClick={() => {
                if (annotationsOpen) onToggleAnnotations();
                setNoteOpen((open) => !open);
              }}
              className={`ts-focus flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left text-xs ${noteOpen ? 'bg-subtle' : 'hover:bg-subtle'}`}
              data-testid="reader-notes-preview"
            >
              <NotebookPen size={16} className="shrink-0 text-accent" />
              <span className="truncate text-fg">{trimmedNote || 'Note personnelle'}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleHidden(true)}
              aria-label="Masquer mes notes"
              className="ts-focus flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-subtle hover:text-fg"
            >
              <X size={17} />
            </button>
          </div>
          {noteOpen ? (
            <div className="border-t border-line px-3 pb-3 pt-2" data-testid="reader-notes-expanded">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Note personnelle</p>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg">
                {trimmedNote || 'Aucune note enregistrée.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setNoteOpen(false);
                  onEditNote();
                }}
                className="ts-focus mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-accent hover:bg-subtle"
              >
                <Pencil size={13} /> Modifier la note
              </button>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
