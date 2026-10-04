import { Avatar as AvatarPrimitive, Popover as PopoverPrimitive, Tabs as TabsPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn, initials } from '@/lib/utils';

// ---------- Tooltip ----------
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children, side = 'bottom' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipPrimitive.Root delayDuration={400}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="z-[60] rounded bg-[#3c4043] px-2 py-1 text-xs text-white shadow animate-fade-in">
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ---------- Popover ----------
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export function PopoverContent({ className, sideOffset = 8, ...props }: ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content sideOffset={sideOffset} className={cn('z-50 rounded-xl border border-border/60 bg-background p-4 shadow-pop animate-pop-in focus:outline-none', className)} {...props} />
    </PopoverPrimitive.Portal>
  );
}

// ---------- Tabs ----------
export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex gap-1 border-b border-border', className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px border-b-[3px] border-transparent px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary',
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = TabsPrimitive.Content;

// ---------- Avatar ----------
export function Avatar({ user, size = 32, className, ring }: { user: { name: string; avatarUrl: string | null }; size?: number; className?: string; ring?: string }) {
  const hue = [...user.name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <AvatarPrimitive.Root
      className={cn('inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full align-middle', className)}
      style={{ width: size, height: size, boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 4px ${ring}` : undefined }}
      title={user.name}
    >
      {user.avatarUrl && <AvatarPrimitive.Image src={user.avatarUrl} alt={user.name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        className="flex size-full items-center justify-center font-medium text-white"
        style={{ background: `hsl(${hue} 55% 45%)`, fontSize: size * 0.4 }}
        delayMs={user.avatarUrl ? 400 : 0}
      >
        {initials(user.name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

// ---------- Misc ----------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={cn('inline-block size-5 animate-spin rounded-full border-2 border-primary border-t-transparent', className)} />;
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    primary: 'bg-primary-soft text-primary',
    success: 'bg-[#e6f4ea] text-success',
    warning: 'bg-[#fef7e0] text-warning',
    danger: 'bg-danger-soft text-danger',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
}
