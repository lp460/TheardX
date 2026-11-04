import { cn } from './ui/cn';

/** ThreadShelf mark: three stacked posts on a shelf. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="ts-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7bff" />
          <stop offset="1" stopColor="#5b47e0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#ts-g)" />
      <rect x="8" y="8" width="16" height="3.2" rx="1.6" fill="#fff" />
      <rect x="8" y="13.6" width="12" height="3.2" rx="1.6" fill="#fff" opacity="0.85" />
      <rect x="8" y="19.2" width="8" height="3.2" rx="1.6" fill="#fff" opacity="0.7" />
      <rect x="6" y="24.4" width="20" height="1.6" rx="0.8" fill="#fff" opacity="0.55" />
    </svg>
  );
}

export function Logo({ className, name = 'ThreadShelf' }: { className?: string; name?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{name}</span>
    </span>
  );
}
