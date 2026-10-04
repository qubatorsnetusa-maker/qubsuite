import { Loader2 } from 'lucide-react'

export function RouteLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-3 text-zinc-500">
      <Loader2 className="w-6 h-6 animate-spin" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}
