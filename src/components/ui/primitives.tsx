import {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'ts-focus h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-fg placeholder:text-faint transition-colors focus:border-accent/60',
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'ts-focus w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-fg placeholder:text-faint focus:border-accent/60',
        className,
      )}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'ts-focus h-8 rounded-lg border border-line bg-surface pl-2.5 pr-7 text-[13px] text-fg',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-subtle px-1 font-sans text-[11px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = {
  neutral: 'bg-subtle text-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[11.5px] font-medium',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 py-2.5',
        disabled && 'cursor-not-allowed opacity-50',
      )}
      htmlFor={id}
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-fg">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{description}</span>
        ) : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'ts-focus relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted/40 border-t-accent',
        className,
      )}
    />
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center animate-ts-fade">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface text-muted shadow-sm">
        {icon}
      </div>
      <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      {children ? (
        <div className="mt-1.5 text-[13px] leading-relaxed text-muted">{children}</div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={cn(
        'px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint',
        className,
      )}
    >
      {children}
    </h3>
  );
}
