import { useState } from 'react';
import { MessageSquare, PencilLine, Send, X } from 'lucide-react';
import type { SharedPost } from './model';
import type { SharedNote, SharedNoteInput } from './notes';
import type { WebLanguage } from '@/web/i18n';

const labels = {
  fr: {
    title: 'Notes et commentaires partagés', empty: 'Aucune contribution pour le moment.',
    notice: 'Les contributions sont visibles par toutes les personnes ayant le lien. Le texte original reste inchangé.',
    signIn: 'Connectez-vous à TheardX pour contribuer', note: 'Note', comment: 'Commentaire',
    annotation: 'Annotation', selected: 'Extrait sélectionné', remove: 'Retirer la sélection',
    placeholder: 'Ajouter une idée, une remarque ou un commentaire…', send: 'Publier',
    select: 'Sélectionnez du texte dans une publication pour créer une annotation.',
  },
  en: {
    title: 'Shared notes and comments', empty: 'No contributions yet.',
    notice: 'Contributions are visible to anyone with the link. The original content never changes.',
    signIn: 'Sign in to TheardX to contribute', note: 'Note', comment: 'Comment',
    annotation: 'Annotation', selected: 'Selected excerpt', remove: 'Remove selection',
    placeholder: 'Add an idea, remark, or comment…', send: 'Post',
    select: 'Select text in a post to create an annotation.',
  },
  es: {
    title: 'Notas y comentarios compartidos', empty: 'Todavía no hay contribuciones.',
    notice: 'Las contribuciones son visibles para quien tenga el enlace. El contenido original no cambia.',
    signIn: 'Inicia sesión en TheardX para participar', note: 'Nota', comment: 'Comentario',
    annotation: 'Anotación', selected: 'Fragmento seleccionado', remove: 'Quitar selección',
    placeholder: 'Añade una idea, observación o comentario…', send: 'Publicar',
    select: 'Selecciona texto en una publicación para crear una anotación.',
  },
} as const;

export function useSharedNotes({
  language, itemIndex, notes, canContribute, onSubmit,
}: {
  language: WebLanguage;
  itemIndex: number;
  notes: SharedNote[];
  canContribute: boolean;
  onSubmit: (input: SharedNoteInput) => Promise<void>;
}) {
  const t = labels[language];
  const [selection, setSelection] = useState<{ postId: string; quote: string } | null>(null);
  const [kind, setKind] = useState<'note' | 'comment'>('note');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mine = notes.filter((note) => note.itemIndex === itemIndex);

  const selectQuote = (post: SharedPost) => {
    if (!canContribute) return;
    const quote = window.getSelection()?.toString().trim().replace(/\s+/g, ' ').slice(0, 500);
    if (quote && quote.length >= 3) setSelection({ postId: post.id, quote });
  };

  return {
    selectQuote,
    panel: (
      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6" data-testid={`shared-notes-${itemIndex}`}>
        <h3 className="flex items-center gap-2 text-base font-semibold"><MessageSquare size={17} /> {t.title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-muted">{t.notice}</p>
        <div className="mt-4 space-y-3">
          {mine.length ? mine.map((note) => (
            <article key={note.id} className="rounded-xl border border-line bg-bg p-3" data-testid="shared-note">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-semibold text-fg">{note.author}</span>
                <span>· {t[note.kind]}</span>
                <time dateTime={new Date(note.createdAt).toISOString()}>
                  {new Date(note.createdAt).toLocaleString(language)}
                </time>
              </div>
              {note.quote ? <blockquote className="mt-2 border-l-2 border-accent pl-3 text-xs italic text-muted">{note.quote}</blockquote> : null}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{note.text}</p>
            </article>
          )) : <p className="text-xs text-muted">{t.empty}</p>}
        </div>
        {canContribute ? (
          <form className="mt-5 space-y-3 border-t border-line pt-4" onSubmit={(event) => {
            event.preventDefault();
            if (!body.trim() || busy) return;
            setBusy(true);
            setError('');
            void onSubmit({
              kind: selection ? 'annotation' : kind,
              itemIndex,
              ...(selection ? { postId: selection.postId, quote: selection.quote } : {}),
              text: body.trim(),
            }).then(() => { setBody(''); setSelection(null); })
              .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
              .finally(() => setBusy(false));
          }}>
            {selection ? (
              <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs">
                <PencilLine size={15} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1"><strong>{t.selected}</strong><p className="mt-1 line-clamp-3">{selection.quote}</p></div>
                <button type="button" className="ts-focus p-1" aria-label={t.remove} onClick={() => setSelection(null)}><X size={16} /></button>
              </div>
            ) : (
              <><label htmlFor={`shared-kind-${itemIndex}`} className="sr-only">{t.note}</label>
              <select id={`shared-kind-${itemIndex}`} className="min-h-10 rounded-lg border border-line bg-bg px-3 text-sm" value={kind} onChange={(event) => setKind(event.target.value as 'note' | 'comment')}>
                <option value="note">{t.note}</option><option value="comment">{t.comment}</option>
              </select>
              <p className="text-xs text-muted">{t.select}</p></>
            )}
            <label htmlFor={`shared-body-${itemIndex}`} className="sr-only">{t.placeholder}</label>
            <textarea id={`shared-body-${itemIndex}`} className="ts-focus min-h-24 w-full rounded-xl border border-line bg-bg p-3 text-sm" maxLength={2000} required value={body} onChange={(event) => setBody(event.target.value)} placeholder={t.placeholder} />
            {error ? <p role="alert" className="text-xs text-warning">{error}</p> : null}
            <button type="submit" disabled={busy || !body.trim()} className="ts-focus inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"><Send size={15} /> {t.send}</button>
          </form>
        ) : <a href="/" className="ts-focus mt-4 inline-block text-xs font-semibold text-accent">{t.signIn}</a>}
      </section>
    ),
  };
}
