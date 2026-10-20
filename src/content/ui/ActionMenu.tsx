import {
  BookOpen,
  Copy,
  FileText,
  Layers3,
  Library,
  MessageSquareQuote,
  MousePointerClick,
  Save,
  SlidersHorizontal,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useContent, type MenuAction } from '../store';

interface Item {
  id: MenuAction;
  label: string;
  hint?: string;
  icon: ReactNode;
  danger?: boolean;
}

const WIDTH = 288;

function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** Every ThreadShelf action for one post, opened from its button, the inline bar or the floating button. */
export function ActionMenu({
  onAction,
  onClose,
}: {
  onAction: (a: MenuAction) => void;
  onClose: () => void;
}) {
  const menu = useContent((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [active, setActive] = useState(0);

  const info = menu?.info;
  const hasTarget = !!menu?.targetId && !!info;
  const count = info?.threadCount ?? 0;
  const groups: Item[][] = hasTarget
    ? [
        [
          {
            id: 'save-thread',
            label: count > 1 ? `Enregistrer le thread (${count})` : 'Enregistrer le thread',
            hint: info?.onStatusPage ? undefined : 'Ouvrez la publication pour un thread vérifié',
            icon: <Layers3 size={15} />,
          },
          { id: 'save-tweet', label: 'Enregistrer cette publication', icon: <Save size={15} /> },
          {
            id: 'save-references',
            label: 'Enregistrer avec citations et liens',
            icon: <MessageSquareQuote size={15} />,
          },
          {
            id: 'select',
            label: 'Ajouter à une sélection…',
            icon: <MousePointerClick size={15} />,
          },
        ],
        [
          { id: 'copy-thread', label: 'Copier le thread (Markdown)', icon: <Copy size={15} /> },
          { id: 'copy-tweet', label: 'Copier cette publication', icon: <Copy size={15} /> },
          { id: 'copy-text', label: 'Copier le thread (texte brut)', icon: <FileText size={15} /> },
        ],
        [
          { id: 'read', label: 'Lire dans ThreadShelf', icon: <BookOpen size={15} /> },
          {
            id: 'options',
            label: 'Collection, tags, note…',
            icon: <SlidersHorizontal size={15} />,
          },
          { id: 'library', label: 'Ouvrir la bibliothèque', icon: <Library size={15} /> },
          ...(info?.saved
            ? [
                {
                  id: 'delete' as const,
                  label: 'Supprimer la sauvegarde',
                  icon: <Trash2 size={15} />,
                  danger: true,
                },
              ]
            : []),
        ],
      ]
    : [
        [
          { id: 'library', label: 'Ouvrir la bibliothèque', icon: <Library size={15} /> },
          {
            id: 'diagnostics',
            label: 'Copier un diagnostic de la page',
            hint: 'Sans contenu de publication — utile pour signaler un problème',
            icon: <Stethoscope size={15} />,
          },
        ],
      ];
  const items = groups.flat();

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const h = ref.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const a = menu.anchor;
    let left = Math.min(Math.max(8, a.right - WIDTH), vw - WIDTH - 8);
    if (menu.source === 'fab') left = vw - WIDTH - 24;
    let top = a.bottom + 6;
    if (top + h > vh - 8) top = Math.max(8, a.top - h - 6);
    setPos({ top, left });
    setActive(0);
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActive((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActive((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const it = items[active];
        if (it) onAction(it.id);
      }
    };
    // Close once the page really scrolls away (ignore the small scroll that can accompany the click).
    const startY = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 120) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll);
    };
  }, [menu, items, active, onAction, onClose]);

  if (!menu) return null;
  let index = -1;
  return (
    <>
      <div
        className="pointer-events-auto fixed inset-0"
        onMouseDown={onClose}
        aria-hidden
        data-testid="ts-menu-backdrop"
      />
      <div
        ref={ref}
        role="menu"
        tabIndex={-1}
        aria-label="Actions ThreadShelf"
        data-testid="ts-menu"
        className="pointer-events-auto fixed overflow-hidden rounded-2xl border border-line bg-elevated text-fg shadow-float outline-none"
        style={{
          width: WIDTH,
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          animation: 'ts-in 140ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div className="border-b border-line px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold">
            <svg viewBox="0 0 32 32" width="16" height="16" aria-hidden>
              <rect x="1" y="1" width="30" height="30" rx="8.5" fill="#6857e8" />
              <rect x="8" y="8" width="16" height="3.2" rx="1.6" fill="#fff" />
              <rect x="8" y="13.6" width="12" height="3.2" rx="1.6" fill="#fff" opacity=".85" />
              <rect x="8" y="19.2" width="8" height="3.2" rx="1.6" fill="#fff" opacity=".7" />
            </svg>
            ThreadShelf
            {info?.handle ? (
              <span className="truncate font-normal text-muted">· @{info.handle}</span>
            ) : null}
            {info?.saved ? (
              <span className="ml-auto rounded-md bg-success/10 px-1.5 py-px text-[10.5px] font-medium text-success">
                Enregistré
              </span>
            ) : null}
          </div>
          {info?.preview ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted">{info.preview}</p>
          ) : null}
          {!hasTarget ? (
            <p className="mt-1 text-[12px] leading-snug text-muted">
              Aucune publication détectée sur cette page. Ouvrez une publication ou faites défiler
              le fil.
            </p>
          ) : null}
        </div>
        <div className="py-1">
          {groups.map((g, gi) => (
            <div key={gi} className={cls(gi > 0 && 'mt-1 border-t border-line pt-1')}>
              {g.map((it) => {
                index += 1;
                const i = index;
                return (
                  <button
                    key={it.id}
                    type="button"
                    role="menuitem"
                    data-action={it.id}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => onAction(it.id)}
                    className={cls(
                      'flex w-full items-start gap-2.5 px-3.5 py-[7px] text-left text-[13px]',
                      active === i && 'bg-subtle',
                      it.danger ? 'text-danger' : 'text-fg',
                    )}
                  >
                    <span
                      className={cls('mt-px shrink-0', it.danger ? 'text-danger' : 'text-muted')}
                    >
                      {it.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block">{it.label}</span>
                      {it.hint ? (
                        <span className="block text-[11px] leading-snug text-faint">{it.hint}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** Floating ThreadShelf button, always reachable on X (bottom right, above X's messages drawer). */
export function FloatingButton({ onOpen }: { onOpen: (anchor: DOMRect) => void }) {
  const visible = useContent((s) => s.fabVisible);
  const panelOpen = useContent((s) => s.panelOpen);
  const menuOpen = useContent((s) => !!s.menu);
  const busy = useContent((s) => s.busy);
  if (!visible || panelOpen) return null;
  return (
    <button
      type="button"
      data-testid="ts-fab"
      aria-label="ThreadShelf — enregistrer, copier, lire"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      title="ThreadShelf"
      onClick={(e) => onOpen(e.currentTarget.getBoundingClientRect())}
      className="pointer-events-auto fixed bottom-[88px] right-6 flex h-12 items-center gap-2 rounded-full border border-white/10 pl-3 pr-4 text-[13.5px] font-semibold text-white shadow-float transition-transform hover:scale-[1.03] active:scale-[0.98]"
      style={{
        background: 'linear-gradient(135deg,#8b7bff,#5b47e0)',
        animation: 'ts-in 200ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      {busy ? (
        <span
          className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      ) : (
        <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden>
          <rect x="8" y="8" width="16" height="3.2" rx="1.6" fill="#fff" />
          <rect x="8" y="13.6" width="12" height="3.2" rx="1.6" fill="#fff" opacity=".85" />
          <rect x="8" y="19.2" width="8" height="3.2" rx="1.6" fill="#fff" opacity=".7" />
          <rect x="6" y="24.4" width="20" height="1.6" rx=".8" fill="#fff" opacity=".55" />
        </svg>
      )}
      ThreadShelf
    </button>
  );
}
