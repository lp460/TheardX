import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { create } from 'zustand';
import { cn } from './ui/cn';

export type ToastTone = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string, action?: Toast['action']) =>
    useToasts.getState().push({ tone: 'success', title, description, action }),
  warning: (title: string, description?: string, action?: Toast['action']) =>
    useToasts.getState().push({ tone: 'warning', title, description, action, duration: 6000 }),
  error: (title: string, description?: string) =>
    useToasts.getState().push({ tone: 'error', title, description, duration: 7000 }),
  info: (title: string, description?: string) =>
    useToasts.getState().push({ tone: 'info', title, description }),
};

const ICONS = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info };
const COLORS = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  info: 'text-accent',
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.duration ?? 3800);
    return () => clearTimeout(timer);
  }, [t, dismiss]);
  const Icon = ICONS[t.tone];
  return (
    <div
      role={t.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-[340px] items-start gap-3 rounded-xl border border-line bg-elevated px-3.5 py-3 shadow-float animate-ts-in"
    >
      <Icon size={17} className={cn('mt-px shrink-0', COLORS[t.tone])} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-fg">{t.title}</div>
        {t.description ? (
          <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{t.description}</div>
        ) : null}
        {t.action ? (
          <button
            type="button"
            className="mt-1.5 text-[12.5px] font-medium text-accent hover:underline"
            onClick={() => {
              t.action!.onClick();
              dismiss(t.id);
            }}
          >
            {t.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Fermer la notification"
        onClick={() => dismiss(t.id)}
        className="text-faint hover:text-fg"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** ToastNotification host — bottom-right stack. */
export function ToastNotification() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
