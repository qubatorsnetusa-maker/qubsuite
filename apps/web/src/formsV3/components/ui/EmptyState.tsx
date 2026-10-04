import type { ComponentType, ReactNode } from 'react'

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: ReactNode
}

/**
 * One "nothing here yet" treatment for the whole product surface. Before
 * this, Workspace, Submissions (top-level), and Submissions (filtered) each
 * had their own slightly different radius/border/icon-wrapper combination
 * for the same underlying idea.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-zinc-200 shadow-2xs max-w-lg mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-zinc-900">{title}</h3>
      {description && <p className="text-xs text-zinc-500 mt-1 mb-4 max-w-sm mx-auto">{description}</p>}
      {action}
    </div>
  )
}
