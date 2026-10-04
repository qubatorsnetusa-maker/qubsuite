import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut, MonitorSmartphone, ShieldAlert, Timer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/form-controls';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { formatDate, formatRelative } from '@/lib/utils';
import { adminService } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { Card, PageHeader, StatCard } from './admin-ui';
import { SaveBar, usePolicyDraft } from './policies-page';

const LIFETIMES: { hours: number | null; label: string }[] = [
  { hours: null, label: 'Until the refresh token expires (default)' },
  { hours: 1, label: '1 hour' },
  { hours: 8, label: '8 hours (a working day)' },
  { hours: 24, label: '24 hours' },
  { hours: 24 * 7, label: '7 days' },
  { hours: 24 * 14, label: '14 days' },
  { hours: 24 * 30, label: '30 days' },
];

/** A short, readable device name from a user-agent string. */
function device(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

export function AdminSecurityPage() {
  const qc = useQueryClient();
  const sec = useQuery({ queryKey: qk.admin.security, queryFn: adminService.security });
  const { draft, update, save, dirty, reset } = usePolicyDraft();
  const [confirmAll, setConfirmAll] = useState(false);
  const sessions = useInfiniteQuery({
    queryKey: qk.admin.sessions({}),
    queryFn: ({ pageParam }) => adminService.sessions({ cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: qk.admin.all });
  const revoke = useMutation({ mutationFn: adminService.revokeSession, onSuccess: () => (invalidate(), toast.success('Session signed out')) });
  const revokeAll = useMutation({
    mutationFn: adminService.revokeAllSessions,
    onSuccess: (r) => {
      invalidate();
      setConfirmAll(false);
      toast.success(`${r.revoked} session${r.revoked === 1 ? '' : 's'} signed out. Your session stays active.`);
    },
  });

  if (sec.error) return <ErrorState error={sec.error} onRetry={() => void sec.refetch()} />;
  const s = sec.data;
  const items = sessions.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Sign-in & sessions"
        description="Who is signed in, suspicious sign-in activity, and how long sessions last."
        actions={
          <Button variant="danger" onClick={() => setConfirmAll(true)}>
            <LogOut /> Sign everyone out
          </Button>
        }
      />
      {!s ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Active sessions" value={s.activeSessions} detail={`${s.usersWithSessions} people signed in`} icon={<MonitorSmartphone />} />
          <StatCard tone="amber" label="Failed sign-ins (24 h)" value={s.failedLogins24h} detail={`${s.failedLoginAccounts.length} accounts with 5 or more`} icon={<KeyRound />} />
          <StatCard tone="red" label="Stolen-token detections (7 d)" value={s.tokenReuse7d} detail="Sessions revoked automatically after a reused refresh token" icon={<ShieldAlert />} />
        </div>
      )}

      <Card title="Session length" icon={<Timer />} description="People are asked to sign in again once their session is older than this">
        {draft ? (
          <NativeSelect
            aria-label="Session length"
            value={draft.security.sessionMaxHours ?? ''}
            onChange={(e) => update('security', { sessionMaxHours: e.target.value ? Number(e.target.value) : null })}
            className="h-10 w-full max-w-sm"
          >
            {LIFETIMES.map((l) => (
              <option key={l.label} value={l.hours ?? ''}>
                {l.label}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <Skeleton className="h-10 w-80" />
        )}
      </Card>
      {draft && <SaveBar dirty={dirty} saving={save.isPending} error={save.error} onSave={() => save.mutate(draft)} onReset={() => (reset(), save.reset())} />}

      {s && s.failedLoginAccounts.length > 0 && (
        <Card title="Repeated failed sign-ins" description="Accounts with 5 or more failed attempts in the last 24 hours">
          <ul className="divide-y divide-border text-sm">
            {s.failedLoginAccounts.map((a) => (
              <li key={a.email} className="flex items-center justify-between py-2.5">
                <span className="font-medium">{a.email}</span>
                <span className="text-xs text-muted">
                  {a.attempts} attempts · last {formatRelative(a.lastAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Active sessions" description="Signing a session out ends it immediately">
        {sessions.error ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs font-semibold text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Person</th>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">IP address</th>
                  <th className="px-3 py-2">Signed in</th>
                  <th className="px-3 py-2">Last active</th>
                  <th className="w-24 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ) : (
                  items.map((x) => (
                    <tr key={x.id}>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <Avatar user={x.user} size={26} />
                          <span className="truncate">{x.user.email}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{device(x.userAgent)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{x.ipAddress ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs" title={formatDate(x.createdAt, true)}>{formatRelative(x.createdAt)}</td>
                      <td className="px-3 py-2.5 text-xs">{formatRelative(x.lastUsedAt)}</td>
                      <td className="py-2.5 text-right">
                        {x.current ? (
                          <span className="text-xs font-medium text-success">This session</span>
                        ) : (
                          <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === x.id} onClick={() => revoke.mutate(x.id)}>
                            Sign out
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {sessions.hasNextPage && (
              <div className="pt-3 text-center">
                <Button variant="ghost" loading={sessions.isFetchingNextPage} onClick={() => void sessions.fetchNextPage()}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign everyone out?"
        description="Every session except yours ends now. People keep their accounts and files and can sign in again straight away."
        confirmLabel="Sign everyone out"
        destructive
        loading={revokeAll.isPending}
        onConfirm={() => revokeAll.mutate()}
      />
    </>
  );
}
