import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared modal accessibility behavior — used by every dialog in the app
 * regardless of how it renders its own chrome/animation (some use plain
 * CSS transitions via the shared <Modal>, others like AddQuestionTypeDialog
 * keep their own Motion-based enter/exit and just want the same behavior).
 *
 * Handles what every one of them was previously doing inconsistently or not
 * at all: Escape closes, Tab/Shift+Tab cycle within the dialog instead of
 * escaping into the page behind it, focus moves into the dialog on open,
 * and returns to whatever triggered it on close.
 */
export function useModalA11y(
  isOpen: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    triggerRef.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    const first = focusable?.[0]
    // Prefer a consumer-specified target (e.g. a search box that should get
    // typed into immediately) over the generic "first focusable control,"
    // falling back to the container itself (given tabIndex={-1} by
    // consumers) rather than leaving focus on whatever was behind the dialog.
    ;(initialFocusRef?.current ?? first ?? container)?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab') return
      const nodes = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (!nodes || nodes.length === 0) return

      const firstEl = nodes[0]
      const lastEl = nodes[nodes.length - 1]
      if (!firstEl || !lastEl) return

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Return focus to whatever opened the dialog, unless it's gone.
      triggerRef.current?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])
}
