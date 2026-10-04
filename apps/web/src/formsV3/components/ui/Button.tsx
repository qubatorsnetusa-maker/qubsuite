import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-zinc-900 hover:bg-black text-white shadow-xs focus-visible:ring-zinc-900',
  accent: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-600/20 focus-visible:ring-indigo-600',
  secondary: 'border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 focus-visible:ring-zinc-900',
  ghost: 'text-zinc-600 hover:bg-zinc-100 focus-visible:ring-zinc-900',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus-visible:ring-rose-600',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-xs rounded-xl',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

/**
 * Shared primary/accent/secondary/ghost/danger button for the authenticated
 * product surface (workspace, builder, submissions) — extracted so hover,
 * focus, disabled, and loading treatment stay consistent across the ~7
 * modals and toolbar actions that previously hand-rolled their own button
 * classes with small, accidental differences. Auth/marketing pages keep
 * their own styling since they use the separate "Studio" design language
 * (see the note at the top of src/styles/app.css).
 *
 * `accent` (indigo) is the Workspace surface's primary-action color; the
 * plain `primary` (zinc/black) variant is left untouched for other
 * surfaces still on the neutral treatment.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})
