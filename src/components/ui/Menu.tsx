import * as DM from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

const content =
  'z-50 min-w-[200px] overflow-hidden rounded-xl border border-line bg-elevated p-1 text-[13px] shadow-pop animate-ts-in';
const item =
  'relative flex h-8 cursor-default select-none items-center gap-2 rounded-lg px-2 text-fg outline-none data-[highlighted]:bg-subtle data-[disabled]:opacity-40';

export function MenuContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode;
  align?: 'start' | 'end' | 'center';
  className?: string;
}) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={6} className={cn(content, className)}>
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon,
  shortcut,
  destructive,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(item, destructive && 'text-danger data-[highlighted]:bg-danger/10')}
    >
      {icon ? <span className="flex w-4 justify-center text-muted">{icon}</span> : null}
      <span className="flex-1 truncate">{children}</span>
      {shortcut ? <span className="text-[11px] text-faint">{shortcut}</span> : null}
    </DM.Item>
  );
}

export function MenuCheckItem({
  children,
  checked,
  onCheckedChange,
}: {
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <DM.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(e) => e.preventDefault()}
      className={item}
    >
      <span className="flex w-4 justify-center">
        {checked ? <Check size={14} className="text-accent" /> : null}
      </span>
      <span className="flex-1 truncate">{children}</span>
    </DM.CheckboxItem>
  );
}

export function MenuSub({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DM.Sub>
      <DM.SubTrigger className={item}>
        {icon ? <span className="flex w-4 justify-center text-muted">{icon}</span> : null}
        <span className="flex-1">{label}</span>
        <ChevronRight size={14} className="text-faint" />
      </DM.SubTrigger>
      <DM.Portal>
        <DM.SubContent sideOffset={4} className={cn(content, 'max-h-80 overflow-y-auto')}>
          {children}
        </DM.SubContent>
      </DM.Portal>
    </DM.Sub>
  );
}

export function MenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DM.Label className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
      {children}
    </DM.Label>
  );
}
