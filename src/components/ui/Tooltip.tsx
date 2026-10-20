import * as TT from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export const TooltipProvider = TT.Provider;

export function Tooltip({
  label,
  children,
  side = 'bottom',
}: {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <TT.Provider delayDuration={350}>
      <TT.Root delayDuration={350}>
        <TT.Trigger asChild>{children}</TT.Trigger>
        <TT.Portal>
          <TT.Content
            side={side}
            sideOffset={6}
            className="z-50 rounded-md bg-fg px-2 py-1 text-[11.5px] font-medium text-bg shadow-pop animate-ts-fade"
          >
            {label}
          </TT.Content>
        </TT.Portal>
      </TT.Root>
    </TT.Provider>
  );
}
