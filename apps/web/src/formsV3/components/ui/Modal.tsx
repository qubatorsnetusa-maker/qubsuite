import { useRef, type ReactNode } from 'react'
import { useModalA11y } from '../../hooks/useModalA11y'

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
} as const

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  ariaLabelledBy: string
  children: ReactNode
  maxWidth?: keyof typeof MAX_WIDTH_CLASSES
  /** For content that needs to scroll internally (e.g. a search+grid picker) rather than growing the whole dialog. */
  bodyClassName?: string
}

/**
 * Shared chrome + accessibility for the app's simpler, CSS-animated dialogs
 * (confirm/edit forms, settings, drafts) — one backdrop opacity, one corner
 * radius, one shadow, real focus trapping/restoration, Escape-to-close, and
 * backdrop-click-to-close, instead of each modal reimplementing (and subtly
 * varying) all of that on its own.
 *
 * AddQuestionTypeDialog keeps its own richer Motion-based enter/exit chrome
 * and uses the underlying useModalA11y hook directly instead of this
 * wrapper — the behavior is still shared, just not the markup.
 */
export function Modal({ isOpen, onClose, ariaLabelledBy, children, maxWidth = 'md', bodyClassName }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useModalA11y(isOpen, onClose, containerRef)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className={`w-full ${MAX_WIDTH_CLASSES[maxWidth]} max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 focus:outline-none ${bodyClassName ?? ''}`}
      >
        {children}
      </div>
    </div>
  )
}
