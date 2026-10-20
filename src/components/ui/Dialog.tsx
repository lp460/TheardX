import * as RD from '@radix-ui/react-dialog';
import * as AD from '@radix-ui/react-alert-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-ts-fade" />
        <RD.Content
          className={cn(
            'fixed left-1/2 top-[12vh] z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-line bg-elevated p-0 shadow-float animate-ts-in focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4">
            <div>
              <RD.Title className="text-[15px] font-semibold text-fg">{title}</RD.Title>
              {description ? (
                <RD.Description className="mt-1 text-[13px] text-muted">
                  {description}
                </RD.Description>
              ) : (
                <RD.Description className="sr-only">{title}</RD.Description>
              )}
            </div>
            <RD.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Fermer">
                <X size={15} />
              </Button>
            </RD.Close>
          </div>
          <div className="max-h-[64vh] overflow-y-auto px-5 pb-4">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
              {footer}
            </div>
          ) : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmer',
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-ts-fade" />
        <AD.Content className="fixed left-1/2 top-[18vh] z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-line bg-elevated p-5 shadow-float animate-ts-in">
          <AD.Title className="text-[15px] font-semibold text-fg">{title}</AD.Title>
          <AD.Description className="mt-1.5 text-[13px] leading-relaxed text-muted">
            {description}
          </AD.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AD.Cancel asChild>
              <Button variant="ghost">Annuler</Button>
            </AD.Cancel>
            <AD.Action asChild>
              <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
