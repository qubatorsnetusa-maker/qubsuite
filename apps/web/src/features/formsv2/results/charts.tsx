import type { Bucket } from './summarize';

/** Share of `count` in `of`, as a whole percentage (0 when there is nothing to divide by). */
export const percent = (count: number, of: number) => (of > 0 ? Math.round((count / of) * 100) : 0);

/**
 * Horizontal bar list for choice answers: label, bar, count and percentage of respondents. Hand-built with CSS
 * (no chart library); the list itself carries the numbers, so the bars are decorative.
 */
export function BarList({ rows, of, label }: { rows: { key: string; label: string; count: number }[]; of: number; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              {r.count} <span className="text-muted">· {percent(r.count, of)}%</span>
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
            <div className="h-full rounded-full bg-form" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Column chart of a numeric distribution (one column per scale point or range), count above, label below. */
export function Distribution({ buckets, label }: { buckets: Bucket[]; label: string }) {
  if (buckets.length === 0) return null;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <ol className="flex h-40 items-end gap-1" aria-label={label}>
      {buckets.map((b, i) => (
        <li key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 text-xs" aria-label={`${b.label}: ${b.count}`}>
          <span className="tabular-nums text-muted" aria-hidden>
            {b.count}
          </span>
          <div className="w-full rounded-t bg-form" style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 2 : 0 }} aria-hidden />
          <span className="w-full truncate text-center" title={b.label} aria-hidden>
            {b.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
