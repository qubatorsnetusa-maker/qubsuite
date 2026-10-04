import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Globe2, HardDrive, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { FileIcon } from '@/components/file-icon';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { formatBytes, formatRelative } from '@/lib/utils';
import { adminService } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { APP_COLORS, APP_LABELS, Card, eventLabel, PageHeader, SeverityBadge, StatCard, UsageBar } from './admin-ui';

export function AdminDashboardPage() {
  const q = useQuery({ queryKey: qk.admin.overview, queryFn: adminService.overview, refetchInterval: 60_000 });
  const org = useQuery({ queryKey: qk.admin.policies, queryFn: adminService.policies });
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const o = q.data;

  return (
    <>
      <PageHeader
        eyebrow={org.data?.policies.organizationName}
        title="Admin console"
        description="People, content and policies across Qub Drive, Docs, Sheets and Forms."
        actions={
          <>
            <Button asChild className="rounded-full">
              <Link to="/admin/users" search={{ new: true }}>
                <UserPlus /> Add person
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/admin/policies">Policies</Link>
            </Button>
          </>
        }
      />

      {!o ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              to="/admin/users"
              label="People"
              value={o.users.total}
              icon={<Users />}
              detail={
                <>
                  <span className="font-medium text-success">{o.users.active} active</span> · {o.users.superAdmins} super admin{o.users.superAdmins === 1 ? '' : 's'}
                  {o.users.suspended > 0 && <span className="text-danger"> · {o.users.suspended} suspended</span>}
                  <br />
                  {o.users.signedInLast7Days} signed in this week · {o.users.newLast30Days} new this month
                </>
              }
            />
            <StatCard
              to="/admin/storage"
              tone="green"
              label="Storage used"
              value={formatBytes(o.storage.usedBytes)}
              icon={<HardDrive />}
              detail={
                <>
                  <UsageBar used={o.storage.usedBytes} total={o.storage.quotaBytes} className="mb-1.5" />
                  {o.storage.quotaBytes ? `of ${formatBytes(o.storage.quotaBytes)} allocated in quotas` : 'Some accounts have no quota'}
                </>
              }
            />
            <StatCard
              to="/admin/content"
              tone="amber"
              label="Shared publicly"
              value={o.sharing.publicLinks}
              icon={<Globe2 />}
              detail={`${o.sharing.directShares} people shares · ${o.sharing.pendingInvites} pending invitations`}
            />
            <StatCard
              to="/admin/security"
              tone="red"
              label="Security alerts"
              value={o.alerts.filter((a) => a.severity !== 'info').length}
              icon={<ShieldCheck />}
              detail={o.alerts.length ? `${o.alerts.length} item${o.alerts.length === 1 ? '' : 's'} to review` : 'Nothing needs attention'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(
              [
                ['DOCUMENT', 'Qub Docs', o.content.documents, 'documents'],
                ['SPREADSHEET', 'Qub Sheets', o.content.spreadsheets, 'spreadsheets'],
                ['FORM', 'Qub Forms', o.content.forms, `forms · ${o.forms.published} published · ${o.forms.responses} responses (${o.forms.responsesLast7Days} this week)`],
                ['OTHER', 'Qub Drive', o.content.uploads, `uploaded files · ${o.content.folders} folders · ${o.content.trashed} in trash`],
              ] as const
            ).map(([type, name, n, detail]) => (
              <Link
                key={type}
                to="/admin/content"
                search={{ type: type === 'OTHER' ? 'UPLOAD' : type }}
                className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4 hover:border-primary/60 hover:shadow-card"
              >
                {type === 'OTHER' ? <HardDrive className="size-7 shrink-0 text-[#f4b400]" /> : <FileIcon type={type} size={28} />}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xl font-semibold">{n}</p>
                  <p className="text-xs text-muted">{detail}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2" title="Activity" description="Opens, edits, shares and other actions in the last 14 days, by app">
              <div className="h-64" role="img" aria-label="Daily activity by app">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={o.activity.map((d) => ({ ...d, day: new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) }))}>
                    <CartesianGrid vertical={false} stroke="#eceff1" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={32} />
                    <ChartTooltip cursor={{ fill: 'rgba(26,86,219,0.06)' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    {(['DOCUMENT', 'SPREADSHEET', 'FORM', 'DRIVE'] as const).map((k) => (
                      <Bar key={k} dataKey={k} name={APP_LABELS[k]} stackId="a" fill={APP_COLORS[k]} radius={k === 'DRIVE' ? [3, 3, 0, 0] : 0} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Alerts" description="Derived from current data; they clear when resolved">
              {o.alerts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">Nothing needs your attention.</p>
              ) : (
                <ul className="space-y-3">
                  {o.alerts.map((a) => (
                    <li key={a.id} className="rounded-xl border border-border bg-surface p-3 text-xs">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="text-[13px] font-semibold">{a.title}</span>
                        <SeverityBadge severity={a.severity} />
                      </div>
                      <p className="text-muted">{a.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card
            title="Recent admin & security events"
            description="From the audit log"
            actions={
              <Link to="/admin/audit" className="text-xs font-medium text-primary hover:underline">
                View audit log
              </Link>
            }
          >
            <ul className="divide-y divide-border">
              {o.recentAudit.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="flex min-w-0 items-start gap-3">
                    {e.actor ? <Avatar user={e.actor} size={28} /> : <span className="size-7 shrink-0 rounded-full bg-surface-2" aria-hidden />}
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{e.actor?.name ?? 'System'}</span>
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{e.event}</span>
                      </p>
                      <p className="truncate text-xs text-muted">
                        {eventLabel(e.event)}
                        {e.targetLabel ? ` · ${e.targetLabel}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-muted">
                    <div>{formatRelative(e.createdAt)}</div>
                    {e.ipAddress && <div className="font-mono">{e.ipAddress}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
