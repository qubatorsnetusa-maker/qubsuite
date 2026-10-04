import type { DriveItemDto } from '@qub/shared';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Cloud, History, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { FileIcon } from '@/components/file-icon';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Skeleton, Tooltip } from '@/components/ui/misc';
import { cn, formatBytes, formatRelative } from '@/lib/utils';
import { DetailsPanel } from './details-panel';
import { ListingPreview } from './file-viewer';
import { ItemActionsProvider, useItemActions } from './item-actions';
import { useEmptyTrash, useMyStorage } from './queries';

const PALETTE = ['#1a73e8', '#0f9d58', '#f4b400', '#db4437', '#7248b9', '#00acc1', '#ff7043', '#9e9e9e', '#5c6bc0', '#8d6e63', '#26a69a'];

export function StorageMeter({ used, quota, className }: { used: number; quota: number | null; className?: string }) {
  const pct = quota ? Math.min(100, (used / quota) * 100) : 0;
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[#dde3ea]', className)} role="meter" aria-label="Storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-danger' : pct >= 90 ? 'bg-[#f29900]' : 'bg-primary')} style={{ width: quota ? `${Math.max(pct, used ? 1.5 : 0)}%` : '0%' }} />
    </div>
  );
}

function CleanupCard({ icon, title, value, detail, children, tone }: { icon: ReactNode; title: string; value: string; detail: string; children?: ReactNode; tone: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className={cn('flex size-9 items-center justify-center rounded-xl [&_svg]:size-5', tone)}>{icon}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 flex-1 text-xs text-muted">{detail}</p>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

function StorageContent() {
  const s = useMyStorage();
  const actions = useItemActions();
  const empty = useEmptyTrash();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { preview?: string };
  const [confirm, setConfirm] = useState(false);

  if (s.error) return <ErrorState error={s.error} onRetry={() => void s.refetch()} />;
  const d = s.data;
  const pct = d?.quotaBytes ? (d.usedBytes / d.quotaBytes) * 100 : null;
  const free = d?.quotaBytes != null ? Math.max(0, d.quotaBytes - d.usedBytes) : null;
  const chart = d ? [...d.breakdown, ...(free ? [{ key: 'free', label: 'Available', bytes: free }] : [])] : [];

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto px-4 pb-10 pt-3">
        <h1 className="mx-auto mb-4 max-w-5xl text-[22px]">Storage</h1>
        {!d ? (
          <Skeleton className="mx-auto h-72 max-w-5xl rounded-2xl" />
        ) : (
          <div className="mx-auto max-w-5xl space-y-6">
            <section className="grid items-center gap-6 rounded-2xl bg-surface p-5 md:grid-cols-[260px_1fr]">
              <div className="relative h-60" role="img" aria-label="Storage by category">
                {chart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chart} dataKey="bytes" nameKey="label" innerRadius={70} outerRadius={104} paddingAngle={chart.length > 1 ? 1.5 : 0} stroke="none">
                        {chart.map((b, i) => (
                          <Cell key={b.key} fill={b.key === 'free' ? '#e3e8ef' : PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(v) => formatBytes(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex size-full items-center justify-center rounded-full border-[18px] border-[#e3e8ef]" />
                )}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-semibold">{formatBytes(d.usedBytes)}</span>
                  <span className="text-xs text-muted">{d.quotaBytes ? `of ${formatBytes(d.quotaBytes)}` : 'used'}</span>
                  {pct != null && <span className={cn('mt-0.5 text-xs font-semibold', pct >= 100 ? 'text-danger' : pct >= 90 ? 'text-warning' : 'text-primary')}>{Math.round(pct)}% used</span>}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">
                  {d.quotaBytes == null ? 'You have unlimited storage' : pct! >= 100 ? 'You’re out of storage' : `${formatBytes(free!)} available`}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {d.quotaSource === 'custom'
                    ? 'Your administrator set this limit for you.'
                    : d.quotaSource === 'unlimited'
                      ? 'Your administrator removed the storage limit for your account.'
                      : d.quotaBytes == null
                        ? 'Your organization doesn’t limit storage.'
                        : 'This is your organization’s standard storage limit.'}{' '}
                  Uploads, images in your Docs and files uploaded to your Forms count; Docs, Sheets and Forms themselves don’t.
                </p>
                {d.quotaBytes != null && <StorageMeter used={d.usedBytes} quota={d.quotaBytes} className="mt-3 h-2" />}
                {pct != null && pct >= 90 && (
                  <p className={cn('mt-3 rounded-lg p-2.5 text-xs', pct >= 100 ? 'bg-danger-soft text-danger' : 'bg-[#fef7e0] text-[#7a4a00]')} role="status">
                    {pct >= 100 ? 'New uploads will fail until you free up space.' : 'You’re almost out of storage.'} Clean up below, or ask your administrator for more space.
                  </p>
                )}
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {d.breakdown.map((b, i) => (
                    <li key={b.key} className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden />
                        <span className="truncate">{b.label}</span>
                      </span>
                      <span className="shrink-0 font-medium">{formatBytes(b.bytes)}</span>
                    </li>
                  ))}
                  {d.breakdown.length === 0 && <li className="text-sm text-muted">Nothing uses storage yet.</li>}
                </ul>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-base font-medium">Clean up space</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <CleanupCard
                  icon={<Trash2 />}
                  tone="bg-danger-soft text-danger"
                  title="Trash"
                  value={d.trash.bytes ? formatBytes(d.trash.bytes) : '0 B'}
                  detail={d.trash.items ? `${d.trash.items} item${d.trash.items === 1 ? '' : 's'} in the trash. Uploaded files there still count toward your storage until they’re deleted.` : 'Your trash is empty.'}
                >
                  {d.trash.items > 0 && (
                    <>
                      <Button size="sm" variant="outline" className="text-danger" onClick={() => setConfirm(true)}>
                        Empty trash
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/drive/trash">Review</Link>
                      </Button>
                    </>
                  )}
                </CleanupCard>
                <CleanupCard icon={<History />} tone="bg-[#fef7e0] text-[#b06000]" title="Older versions" value={d.olderVersions.bytes ? formatBytes(d.olderVersions.bytes) : '0 B'} detail={d.olderVersions.files ? `${d.olderVersions.files} file${d.olderVersions.files === 1 ? ' keeps' : 's keep'} earlier versions. Delete ones you don’t need from each file’s Versions tab.` : 'No older versions are stored.'} />
                <CleanupCard icon={<Cloud />} tone="bg-[#e8f0fe] text-primary" title="Largest files" value={d.largestFiles[0] ? formatBytes(d.largestFiles[0].storedBytes) : '—'} detail={d.largestFiles.length ? 'Your biggest uploads are listed below, with every version counted.' : 'You haven’t uploaded any files yet.'} />
              </div>
            </section>

            {d.largestFiles.length > 0 && (
              <section>
                <h2 className="mb-3 text-base font-medium">Files using the most storage</h2>
                <div className="overflow-hidden rounded-2xl border border-border">
                  <ul className="divide-y divide-border">
                    {d.largestFiles.map((f) => (
                      <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover">
                        <FileIcon type={f.fileType} size={22} />
                        <button className="min-w-0 flex-1 text-left" onClick={() => actions.open(f)}>
                          <span className="block truncate">{f.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {f.folderName ?? 'My Drive'} · modified {formatRelative(f.updatedAt)}
                            {f.versions > 1 ? ` · ${f.versions} versions` : ''}
                          </span>
                        </button>
                        <span className="shrink-0 font-medium">{formatBytes(f.storedBytes)}</span>
                        {f.versions > 1 && (
                          <Tooltip content="Manage versions">
                            <Button variant="subtle" size="icon-sm" onClick={() => actions.details(f)} aria-label={`Versions of ${f.name}`}>
                              <History />
                            </Button>
                          </Tooltip>
                        )}
                        <Tooltip content="Move to trash">
                          <Button variant="subtle" size="icon-sm" onClick={() => actions.trash([f as DriveItemDto])} aria-label={`Move ${f.name} to trash`}>
                            <Trash2 />
                          </Button>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      {actions.detailsItem && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/30 lg:static lg:bg-transparent">
          <DetailsPanel item={actions.detailsItem} onClose={() => actions.details(null)} />
        </div>
      )}
      <ListingPreview items={d?.largestFiles ?? []} previewId={search.preview} onChange={(preview) => void navigate({ to: '/drive/storage', search: { preview }, replace: !preview })} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Empty trash?"
        description={`${d?.trash.items ?? 0} item${d?.trash.items === 1 ? '' : 's'} (${formatBytes(d?.trash.bytes ?? 0)}) will be deleted forever and can’t be restored.`}
        confirmLabel="Empty trash"
        destructive
        loading={empty.isPending}
        onConfirm={() => empty.mutate(undefined, { onSettled: () => setConfirm(false) })}
      />
    </div>
  );
}

export function StoragePage() {
  return (
    <ItemActionsProvider inlinePreview>
      <StorageContent />
    </ItemActionsProvider>
  );
}
