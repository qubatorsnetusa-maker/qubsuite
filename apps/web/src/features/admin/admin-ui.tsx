import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Switch } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium text-muted">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, actions, children, className, icon }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-background p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon && <span className="mt-0.5 text-muted [&_svg]:size-5">{icon}</span>}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, detail, icon, tone = 'blue', to }: { label: string; value: ReactNode; detail?: ReactNode; icon: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple'; to?: string }) {
  const tones = {
    blue: 'bg-[#e8f0fe] text-[#1a73e8]',
    green: 'bg-[#e6f4ea] text-[#137333]',
    amber: 'bg-[#fef7e0] text-[#b06000]',
    red: 'bg-[#fce8e6] text-[#c5221f]',
    purple: 'bg-[#f3e8fd] text-[#7248b9]',
  };
  const body = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className={cn('flex size-9 items-center justify-center rounded-xl [&_svg]:size-5', tones[tone])}>{icon}</span>
      </div>
      <div className="text-[26px] font-semibold leading-tight">{value}</div>
      {detail && <div className="mt-2 text-xs text-muted">{detail}</div>}
    </>
  );
  const cls = 'block rounded-2xl border border-border bg-background p-5 transition-shadow';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:border-primary/60 hover:shadow-card')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A labelled switch row for policy pages. */
export function ToggleRow({ label, description, checked, onChange, disabled }: { label: string; description?: ReactNode; checked: boolean; onChange(v: boolean): void; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center justify-between gap-4 rounded-xl bg-surface px-4 py-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </label>
  );
}

export function SeverityBadge({ severity }: { severity: 'info' | 'warning' | 'critical' }) {
  const styles = {
    critical: 'text-[#c5221f] [&>span]:bg-[#d93025]',
    warning: 'text-[#b06000] [&>span]:bg-[#f29900]',
    info: 'text-[#1a73e8] [&>span]:bg-[#1a73e8]',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium capitalize', styles[severity])}>
      <span className="size-2 rounded-full" aria-hidden />
      {severity}
    </span>
  );
}

export function UsageBar({ used, total, className }: { used: number; total: number | null; className?: string }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Storage used">
      <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-[#d93025]' : pct >= 90 ? 'bg-[#f29900]' : 'bg-[#1a73e8]')} style={{ width: total ? `${Math.max(pct, used ? 2 : 0)}%` : '0%' }} />
    </div>
  );
}

export const APP_COLORS = { DOCUMENT: '#4285f4', SPREADSHEET: '#0f9d58', FORM: '#7248b9', DRIVE: '#f4b400' } as const;
export const APP_LABELS = { DOCUMENT: 'Docs', SPREADSHEET: 'Sheets', FORM: 'Forms', DRIVE: 'Drive' } as const;

/** "admin.user_suspended" → "User suspended"; "auth.login_failed" → "Login failed". */
export function eventLabel(event: string): string {
  const name = event.slice(event.indexOf('.') + 1).replace(/_/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "FILE_SHARED" → "File shared". */
export function actionLabel(action: string): string {
  const s = action.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
