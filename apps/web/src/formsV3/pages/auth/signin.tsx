import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ListChecks,
  LockKeyhole,
  Sparkles,
  SplitSquareHorizontal,
  Tally5,
} from 'lucide-react'

import { buildLoginUrl, buildRegisterUrl, redirectToLogin, redirectToRegister } from '@/formsV3/services/sso'

function SignInPage() {
  const [isRedirecting, setIsRedirecting] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    timerRef.current = window.setTimeout(() => {
      setIsRedirecting(true)
      redirectToLogin('/workspace')
    }, 800)
    return () => window.clearTimeout(timerRef.current ?? undefined)
  }, [])

  function goToLogin() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    setIsRedirecting(true)
    redirectToLogin('/workspace')
  }

  function goToRegister() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    redirectToRegister('/workspace')
  }

  return (
    <div className="theme-auth h-full min-h-screen bg-background text-on-surface antialiased flex flex-col font-body-md text-body-md selection:bg-accent-indigo-subtle selection:text-primary">
      <header className="w-full bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors duration-150"
            to="/"
          >
            <span className="font-label-md text-label-md font-semibold">qub-forms</span>
          </Link>
          <Link
            className="font-label-md text-label-md font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
            to="/"
          >
            Back to landing
          </Link>
        </div>
      </header>

      <main className="flex-1 flex w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-indigo-subtle border border-primary/20 text-primary font-label-sm text-label-sm font-semibold mb-4">
              <Sparkles size={14} />
              <span>Workspace access</span>
            </div>

            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight leading-tight">
              Build and ship forms your team can trust.
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-3 max-w-md">
              qub-forms keeps your drafts, logic branches, and response data in one workspace, with
              accounts and sessions handled by Qubator SSO.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-8">
              <div className="flex flex-col items-start gap-2 rounded-lg border border-outline-variant bg-surface p-3">
                <ListChecks size={18} className="text-primary" />
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">Build</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Conversational steps
                </span>
              </div>
              <div className="flex flex-col items-start gap-2 rounded-lg border border-outline-variant bg-surface p-3">
                <SplitSquareHorizontal size={18} className="text-primary" />
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">Route</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Conditional logic
                </span>
              </div>
              <div className="flex flex-col items-start gap-2 rounded-lg border border-outline-variant bg-surface p-3">
                <Tally5 size={18} className="text-primary" />
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">Analyze</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Real-time responses
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-6 sm:p-10 shadow-sm" aria-busy={isRedirecting}>
            <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shadow-sm mb-6">
              <LockKeyhole size={20} />
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant font-medium">
              Welcome back
            </p>
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">
              Sign in to qub-forms
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              qub-forms accounts are managed by Qubator SSO. You&apos;ll be redirected to the secure
              sign-in page to continue.
            </p>

            <a
              className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg text-on-primary font-label-md text-label-md font-semibold bg-primary-container hover:bg-accent-indigo-hover active:scale-[0.99] transition-all shadow-sm"
              href={buildLoginUrl('/workspace')}
              onClick={(event) => {
                event.preventDefault()
                goToLogin()
              }}
            >
              <span>{isRedirecting ? 'Redirecting…' : 'Continue to sign in'}</span>
              <ArrowRight size={18} />
            </a>

            <div className="mt-5 flex items-center justify-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
              <span>New to qub-forms?</span>
              <a
                className="font-label-md text-label-md font-semibold text-primary hover:text-accent-indigo-hover transition-colors"
                href={buildRegisterUrl('/workspace')}
                onClick={(event) => {
                  event.preventDefault()
                  goToRegister()
                }}
              >
                Create account
              </a>
            </div>

            <div className="mt-6 pt-5 border-t border-outline-variant/60 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-label-sm text-label-sm text-on-surface-variant">
              <span>Protected by Qubator SSO</span>
              <span className="text-outline">·</span>
              <Link className="hover:text-primary transition-colors" to={'/terms' as any}>
                Terms
              </Link>
              <span className="text-outline">·</span>
              <Link className="hover:text-primary transition-colors" to={'/privacy' as any}>
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default SignInPage
