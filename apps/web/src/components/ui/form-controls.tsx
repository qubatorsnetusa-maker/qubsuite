import { Label as LabelPrimitive, Switch as SwitchPrimitive } from 'radix-ui';
import { forwardRef, type ComponentPropsWithoutRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...props }, ref) => (
  <input
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-subtle transition-colors',
      'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60',
      invalid && 'border-danger focus:border-danger focus:ring-danger/20',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-subtle',
      'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
      invalid && 'border-danger',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function Label({ className, ...props }: ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-[13px] text-danger">
      {message}
    </p>
  );
}

export function Switch({ className, ...props }: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-border-strong transition-colors data-[state=checked]:bg-primary disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}

export function NativeSelect({ className, ...props }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select
      className={cn('h-9 rounded-md border border-border bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20', className)}
      {...props}
    />
  );
}
