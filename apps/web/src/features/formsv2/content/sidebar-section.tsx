import type { ReactNode } from 'react';

/** One titled block of the Content tab's settings sidebar. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border px-4 py-4 last:border-b-0">
      {title && <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>}
      {children}
    </section>
  );
}
