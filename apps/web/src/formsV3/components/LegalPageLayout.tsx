import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

export function LegalPageLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface font-body-md">
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b border-outline-variant">
        <div className="flex justify-between items-center w-full px-6 md:px-12 max-w-3xl mx-auto h-16">
          <Link to="/" className="font-bold tracking-tight text-on-surface">
            qub-forms
          </Link>
          <Link to="/" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 md:px-12 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-on-surface mb-2">{title}</h1>
        <p className="text-sm text-on-surface-variant mb-10">Last updated: {updated}</p>
        <div className="space-y-8 text-on-surface-variant leading-relaxed">{children}</div>
      </main>

      <footer className="border-t border-outline-variant py-8">
        <div className="max-w-3xl mx-auto px-6 md:px-12 text-xs text-on-surface-variant">
          © 2026 Qubator. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-on-surface mb-3">{title}</h2>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  )
}
