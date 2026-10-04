import type { AdminAuditEventDto, AuditCategory } from '@qub/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, Download, Search, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { FileIcon } from '@/components/file-icon';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/form-controls';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { cn, formatDate } from '@/lib/utils';
import { adminService, type AdminActivityParams, type AdminAuditParams } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { actionLabel, APP_LABELS, eventLabel, PageHeader, SeverityBadge } from './admin-ui';

const RANGES = { day: 1, week: 7, month: 30, quarter: 90 } as const;
type Range = keyof typeof RANGES | 'all';

export type AuditTab = 'audit' | 'activity';

function useSearchText(delay = 300) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), delay);
    return () => clearTimeout(t);
  }, [text, delay]);
  return { text, setText, q };
}

function useFrom(range: Range): string | undefined {
  // Recomputed when the range changes, not on every render (keeps the query key stable).
  return useMemo(() => (range === 'all' ? undefined : new Date(Date.now() - RANGES[range] * 86_400_000).toISOString()), [range]);
}

function SearchBox({ text, setText, placeholder }: { text: string; setText(v: string): void; placeholder: string }) {
  return (
    <div className="flex min-w-[240px] flex-1 items-center gap-2">
      <Search className="size-5 text-muted" aria-hidden />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted" />
      {text && (
        <button onClick={() => setText('')} className="rounded-full p-1 text-muted hover:bg-hover" aria-label="Clear search">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function RangeSelect({ value, onChange }: { value: Range; onChange(v: Range): void }) {
  return (
    <NativeSelect aria-label="Time range" value={value} onChange={(e) => onChange(e.target.value as Range)}>
      <option value="day">Last 24 hours</option>
      <option value="week">Last 7 days</option>
      <option value="month">Last 30 days</option>
      <option value="quarter">Last 90 days</option>
      <option value="all">All time</option>
    </NativeSelect>
  );
}

export function AdminAuditPage({ tab }: { tab: AuditTab }) {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow="Investigation"
        title="Audit & activity"
        description="A permanent record of sign-ins, sharing changes and admin actions, and of what people do in Docs, Sheets, Forms and Drive."
      />
      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Log">
        {(
          [
            ['audit', 'Admin & security log'],
            ['activity', 'Drive, Docs, Sheets & Forms activity'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => void navigate({ to: '/admin/audit', search: { tab: id }, replace: true })}
            className={cn('-mb-px border-b-[3px] px-4 py-2.5 text-sm font-medium', tab === id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'audit' ? <AuditLog /> : <ActivityLog />}
    </>
  );
}

function AuditLog() {
  const { text, setText, q } = useSearchText();
  const [category, setCategory] = useState<AuditCategory | ''>('');
  const [severity, setSeverity] = useState<AdminAuditParams['severity'] | ''>('');
  const [range, setRange] = useState<Range>('month');
  const [open, setOpen] = useState<string | null>(null);
  const from = useFrom(range);
  const params: AdminAuditParams = { q, category: category || undefined, severity: severity || undefined, from };
  const list = useInfiniteQuery({
    queryKey: qk.admin.audit(params),
    queryFn: ({ pageParam }) => adminService.audit({ ...params, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3">
        <SearchBox text={text} setText={setText} placeholder="Search by person, event, item or IP address" />
        <NativeSelect aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as AuditCategory | '')}>
          <option value="">All categories</option>
          <option value="auth">Sign-in</option>
          <option value="sharing">Sharing</option>
          <option value="admin">Admin actions</option>
        </NativeSelect>
        <NativeSelect aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </NativeSelect>
        <RangeSelect value={range} onChange={setRange} />
        <Button asChild variant="outline" size="sm">
          <a href={adminService.auditExportUrl(params)} download>
            <Download /> Export CSV
          </a>
        </Button>
      </div>
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-surface text-xs font-semibold text-muted">
                <tr>
                  <th className="w-8 py-3 pl-3" />
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Who</th>
                  <th className="px-3 py-3">Event</th>
                  <th className="px-3 py-3">Target</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3 text-right">IP address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-4">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ) : (
                  items.map((e) => <AuditRow key={e.id} e={e} open={open === e.id} onToggle={() => setOpen((o) => (o === e.id ? null : e.id))} />)
                )}
              </tbody>
            </table>
          </div>
          {!list.isLoading && items.length === 0 && <EmptyState icon={<Search />} title="No events" description="Nothing matches these filters." />}
          {list.hasNextPage && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="ghost" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AuditRow({ e, open, onToggle }: { e: AdminAuditEventDto; open: boolean; onToggle(): void }) {
  const hasDetails = Object.keys(e.metadata).length > 0 || !!e.userAgent;
  return (
    <Fragment>
      <tr className="hover:bg-surface">
        <td className="py-2.5 pl-3">
          {hasDetails && (
            <button onClick={onToggle} className="rounded p-0.5 text-muted hover:bg-hover" aria-expanded={open} aria-label={open ? 'Hide details' : 'Show details'}>
              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{formatDate(e.createdAt, true)}</td>
        <td className="px-3 py-2.5">
          {e.actor ? (
            <div className="flex items-center gap-2">
              <Avatar user={e.actor} size={24} />
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium">{e.actor.name}</p>
                <p className="truncate text-muted">{e.actor.email}</p>
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted">{e.userAgent === 'cli' ? 'Command line' : 'System'}</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <p className="text-[13px]">{eventLabel(e.event)}</p>
          <p className="font-mono text-[11px] text-muted">{e.event}</p>
        </td>
        <td className="max-w-xs truncate px-3 py-2.5 text-xs">{e.targetLabel ?? (e.targetType ? `${e.targetType} ${e.targetId?.slice(0, 8) ?? ''}` : '—')}</td>
        <td className="px-3 py-2.5">
          <SeverityBadge severity={e.severity} />
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[11px] text-muted">{e.ipAddress ?? '—'}</td>
      </tr>
      {open && (
        <tr className="bg-surface">
          <td />
          <td colSpan={6} className="px-3 pb-3">
            <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[max-content_1fr]">
              {Object.entries(e.metadata).map(([k, v]) => (
                <Fragment key={k}>
                  <dt className="font-medium text-muted">{k}</dt>
                  <dd className="break-all font-mono">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
                </Fragment>
              ))}
              {e.userAgent && (
                <>
                  <dt className="font-medium text-muted">user agent</dt>
                  <dd className="break-all font-mono">{e.userAgent}</dd>
                </>
              )}
            </dl>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function ActivityLog() {
  const { text, setText, q } = useSearchText();
  const [app, setApp] = useState<AdminActivityParams['app'] | ''>('');
  const [range, setRange] = useState<Range>('week');
  const from = useFrom(range);
  const params: AdminActivityParams = { q, app: app || undefined, from };
  const list = useInfiniteQuery({
    queryKey: qk.admin.activity(params),
    queryFn: ({ pageParam }) => adminService.activity({ ...params, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3">
        <SearchBox text={text} setText={setText} placeholder="Search by item, person or action" />
        <NativeSelect aria-label="App" value={app} onChange={(e) => setApp(e.target.value as typeof app)}>
          <option value="">All apps</option>
          <option value="DOCUMENT">Docs</option>
          <option value="SPREADSHEET">Sheets</option>
          <option value="FORM">Forms</option>
          <option value="DRIVE">Drive (folders & files)</option>
        </NativeSelect>
        <RangeSelect value={range} onChange={setRange} />
      </div>
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <ul className="divide-y divide-border">
            {list.isLoading ? (
              <li className="p-4">
                <Skeleton className="h-8 w-full" />
              </li>
            ) : (
              items.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {a.user ? <Avatar user={a.user} size={28} /> : <span className="size-7 rounded-full bg-surface-2" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-medium">{a.user?.name ?? 'Deleted user'}</span> <span className="text-muted">{actionLabel(a.action).toLowerCase()}</span>{' '}
                      <span className="font-medium">{a.resourceName ?? 'an item'}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      {a.app === 'DRIVE' ? <FileIcon type={a.resourceType === 'FOLDER' ? 'FOLDER' : 'OTHER'} size={14} /> : <FileIcon type={a.app} size={14} />}
                      {APP_LABELS[a.app]} · {formatDate(a.createdAt, true)}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
          {!list.isLoading && items.length === 0 && <EmptyState icon={<Search />} title="No activity" description="Nothing matches these filters." />}
          {list.hasNextPage && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="ghost" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
