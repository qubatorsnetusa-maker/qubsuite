import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Cookie } from 'lucide-react'

const DISMISSED_KEY = 'qubforms_cookie_notice_dismissed'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISSED_KEY)) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // localStorage unavailable (private browsing, etc.) — banner just won't persist dismissal
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-4 sm:max-w-sm z-[100] bg-white border border-outline-variant shadow-lg rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-accent-indigo-subtle border border-primary/20 flex items-center justify-center text-primary">
          <Cookie className="w-4 h-4" />
        </div>
        <p className="text-sm text-on-surface-variant leading-snug">
          We use only essential cookies to keep you signed in — no advertising or tracking cookies.{' '}
          <Link to={'/privacy' as any} className="text-primary font-medium hover:underline">
            Learn more
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="self-end bg-primary text-white hover:bg-accent-indigo-hover px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
      >
        Got it
      </button>
    </div>
  )
}
