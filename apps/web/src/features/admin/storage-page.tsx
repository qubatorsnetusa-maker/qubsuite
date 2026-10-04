import type { AdminUserDto } from '@qub/shared';
import { useQuery } from '@tanstack/react-query';
import { HardDrive } from 'lucide-react';
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { FileIcon } from '@/components/file-icon';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { formatBytes } from '@/lib/utils';
import { adminService } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { Card, PageHeader, UsageBar } from './admin-ui';
import { StorageDialog } from './storage-dialog';

const PALETTE = ['#1a73e8', '#0f9d58', '#f4b400', '#db4437', '#7248b9', '#00acc1', '#ff7043', '#9e9e9e', '#5c6bc0', '#8d6e63', '#26a69a'];

export function AdminStoragePage() {
  const q = useQuery({ queryKey: qk.admin.storage, queryFn: adminService.storage });
  const [quotaFor, setQuotaFor] = useState<AdminUserDto | null>(null);
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const s = q.data;

  return (
    <>
      <PageHeader
        eyebrow="Storage"
        title="Storage & quotas"
        description="Space used across the organization: every version of uploaded files, images in Docs and files uploaded to Forms, charged to each item's owner."
        actions={
          s && (
            <div className="text-right">
              <p className="text-2xl font-semibold">{formatBytes(s.usedBytes)}</p>
              <p className="text-xs text-muted">{s.allocatedBytes ? `of ${formatBytes(s.allocatedBytes)} allocated` : 'used · some accounts are unlimited'}</p>
            </div>
          )
        }
      />
      {!s ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : (
        <>
          <Card title="What's using space">
            {s.breakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Nothing is stored yet.</p>
            ) : (
              <div className="grid items-center gap-6 md:grid-cols-[260px_1fr]">
                <div className="h-60" role="img" aria-label="Storage by category">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={s.breakdown} dataKey="bytes" nameKey="label" innerRadius={62} outerRadius={100} paddingAngle={1} stroke="none">
                        {s.breakdown.map((b, i) => (
                          <Cell key={b.key} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(v) => formatBytes(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {s.breakdown.map((b, i) => (
                    <li key={b.key} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="size-3 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden />
                        {b.label}
                      </span>
                      <span className="font-medium">
                        {formatBytes(b.bytes)} <span className="text-xs font-normal text-muted">({Math.round((b.bytes / Math.max(1, s.usedBytes)) * 100)}%)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Who uses the most" description="Increase or decrease anyone's storage here or in Users; set the default in Drive & sharing policies">
              {s.topUsers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No one is storing files yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {s.topUsers.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 py-3">
                      <Avatar user={u} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{u.name}</span>
                          <span className="shrink-0 text-xs text-muted">
                            {formatBytes(u.storageUsed)} / {u.storageQuota ? formatBytes(u.storageQuota) : '∞'}
                          </span>
                        </div>
                        <UsageBar used={u.storageUsed} total={u.storageQuota} className="mt-1.5" />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setQuotaFor(u)} aria-label={`Change storage for ${u.name}`}>
                        <HardDrive /> Change
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Largest files" description="All versions included">
              {s.largestFiles.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No uploaded files yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {s.largestFiles.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 py-3 text-sm">
                      <FileIcon type={f.fileType} size={22} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="truncate text-xs text-muted">
                          {f.owner.email}
                          {f.versions > 1 ? ` · ${f.versions} versions` : ''}
                          {f.isTrashed ? ' · in trash' : ''}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium">{formatBytes(f.bytes)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
      <StorageDialog user={quotaFor} onOpenChange={(o) => !o && setQuotaFor(null)} />
    </>
  );
}
