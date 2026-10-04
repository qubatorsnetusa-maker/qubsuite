import { Check, ChevronRight } from 'lucide-react';
import { ContextMenu as ContextPrimitive, DropdownMenu as DropdownPrimitive } from 'radix-ui';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const contentClass =
  'z-50 min-w-[220px] overflow-hidden rounded-lg border border-border/60 bg-background py-2 shadow-pop animate-pop-in data-[side=bottom]:origin-top';
const itemClass =
  'relative flex h-9 cursor-default select-none items-center gap-3 px-4 text-sm outline-none data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-[18px] [&_svg]:text-muted';

// ---------- Dropdown ----------
export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content sideOffset={sideOffset} className={cn(contentClass, className)} {...props} />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, icon, shortcut, children, destructive, ...props }: ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { icon?: ReactNode; shortcut?: string; destructive?: boolean }) {
  return (
    <DropdownPrimitive.Item className={cn(itemClass, destructive && 'text-danger [&_svg]:text-danger', className)} {...props}>
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-subtle">{shortcut}</span>}
    </DropdownPrimitive.Item>
  );
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem>) {
  return (
    <DropdownPrimitive.CheckboxItem className={cn(itemClass, 'pl-10', className)} {...props}>
      <DropdownPrimitive.ItemIndicator className="absolute left-3">
        <Check />
      </DropdownPrimitive.ItemIndicator>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
}

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="my-2 h-px bg-border" />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <DropdownPrimitive.Label className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-subtle">{children}</DropdownPrimitive.Label>;
}

export const DropdownMenuSub = DropdownPrimitive.Sub;
export function DropdownMenuSubTrigger({ children, icon, className }: { children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <DropdownPrimitive.SubTrigger className={cn(itemClass, 'data-[state=open]:bg-hover', className)}>
      {icon}
      <span className="flex-1">{children}</span>
      <ChevronRight />
    </DropdownPrimitive.SubTrigger>
  );
}
export function DropdownMenuSubContent({ className, ...props }: ComponentPropsWithoutRef<typeof DropdownPrimitive.SubContent>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.SubContent className={cn(contentClass, className)} sideOffset={4} {...props} />
    </DropdownPrimitive.Portal>
  );
}

// ---------- Context menu ----------
export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;

export function ContextMenuContent({ className, ...props }: ComponentPropsWithoutRef<typeof ContextPrimitive.Content>) {
  return (
    <ContextPrimitive.Portal>
      <ContextPrimitive.Content className={cn(contentClass, className)} {...props} />
    </ContextPrimitive.Portal>
  );
}

export function ContextMenuItem({ className, icon, children, destructive, shortcut, ...props }: ComponentPropsWithoutRef<typeof ContextPrimitive.Item> & { icon?: ReactNode; destructive?: boolean; shortcut?: string }) {
  return (
    <ContextPrimitive.Item className={cn(itemClass, destructive && 'text-danger [&_svg]:text-danger', className)} {...props}>
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-subtle">{shortcut}</span>}
    </ContextPrimitive.Item>
  );
}

export function ContextMenuSeparator() {
  return <ContextPrimitive.Separator className="my-2 h-px bg-border" />;
}
