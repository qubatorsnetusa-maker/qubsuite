import type { AdminStorageQuotaInput, AdminUserDto, QuotaMode } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { cn, formatBytes } from '@/lib/utils';
import { adminService } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { UsageBar } from './admin-ui';

const GB = 1024 ** 3;
const STEPS = [1, 5, 10, 50, 100];
const PRESETS = [5, 15, 30, 100, 1024];
const round = (gb: number) => Math.round(gb * 100) / 100;
const size = (bytes: number) => (bytes ? formatBytes(bytes) : '0 B');
const gbLabel = (gb: number) => (gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${round(gb)} GB`);

/**
 * Change one person's storage: the organization default, a size of their own, or no limit. The âˆ’/+ buttons change
 * the size relative to what applies now; they're sent as an adjustment so concurrent changes by other admins add up.
 */
export function StorageDialog({ user, onOpenChange }: { user: AdminUserDto | null; onOpenChange(open: boolean): void }) {
  const qc = useQueryClient();
  const policies = useQuery({ queryKey: qk.admin.policies, queryFn: adminService.policies, enabled: !!user });
  const defaultGb = policies.data?.policies.storage.defaultQuotaGb ?? null;
  const [mode, setMode] = useState<QuotaMode>('default');
  const [gb, setGb] = useState(15);
  const [step, setStep] = useState(5);
  /** Size the âˆ’/+ buttons started from, and whether the size was typed or picked (then it's set, not adjusted). */
  const [baseGb, setBaseGb] = useState<number | null>(null);
  const [absolute, setAbsolute] = useState(false);

  useEffect(() => {
    if (!user) return;
    const current = user.storageQuota == null ? null : user.storageQuota / GB;
    setMode(user.quotaMode);
    setGb(round(current ?? defaultGb ?? 15));
    setBaseGb(current == null ? null : round(current));
    setAbsolute(false);
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const save = useMutation({
    mutationFn: (input: AdminStorageQuotaInput) => adminService.setStorage(user!.id, input),
    meta: { silent: true },
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      toast.success(u.storageQuota == null ? `${u.name} now has unlimited storage` : `${u.name} can now store ${formatBytes(u.storageQuota)}`);
      onOpenChange(false);
    },
  });

  if (!user) return <Dialog open={false} onOpenChange={onOpenChange} />;

  const nextBytes = mode === 'unlimited' ? null : mode === 'default' ? (defaultGb == null ? null : defaultGb * GB) : gb * GB;
  const change = mode === 'custom' && baseGb != null ? round(gb - baseGb) : null;
  const over = nextBytes != null && user.storageUsed > nextBytes;
  const unchanged =
    (mode === user.quotaMode && mode !== 'custom') || (mode === 'custom' && user.quotaMode === 'custom' && user.storageQuota != null && Math.abs(gb * GB - user.storageQuota) < 1024 ** 2);
  const valid = mode !== 'custom' || (gb >= 0.1 && gb <= 1_000_000);

  const bump = (dir: 1 | -1) => {
    if (mode !== 'custom') setMode('custom');
    setGb((g) => Math.max(0.1, round(g + dir * step)));
  };
  const submit = () => {
    if (mode === 'default') return save.mutate({ mode: 'default' });
    if (mode === 'unlimited') return save.mutate({ mode: 'unlimited' });
    // Relative when the admin only used âˆ’/+ from the size in effect; otherwise set the exact size.
    if (!absolute && change && user.quotaMode !== 'unlimited') return save.mutate({ mode: 'adjust', deltaGb: change });
    save.mutate({ mode: 'custom', gb });
  };

  const option = (value: QuotaMode, label: string, detail: string) => (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm', mode === value ? 'border-primary bg-[#e8f0fe]' : 'border-border hover:bg-surface')}>
      <input type="radio" name="storage-mode" className="mt-0.5" checked={mode === value} onChange={() => setMode(value)} />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
    </label>
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Change storage" description="Increase or decrease how much this person can store in Qub Drive, Docs, Sheets and Forms.">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
            <Avatar user={user} size={36} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted">
                Using {size(user.storageUsed)} of {user.storageQuota == null ? 'unlimited storage' : formatBytes(user.storageQuota)}
                {user.quotaMode === 'default' ? ' (organization default)' : ''}
              </p>
              <UsageBar used={user.storageUsed} total={user.storageQuota} className="mt-1.5" />
            </div>
          </div>

          <div className="grid gap-2">
            {option('default', 'Organization default', defaultGb == null ? 'Unlimited (no default is set in Drive & sharing policies)' : `${gbLabel(defaultGb)}, from Drive & sharing policies`)}
            {option('custom', 'Custom size', 'A limit for this person only')}
            {option('unlimited', 'Unlimited', 'No storage limit for this person, whatever the default')}
          </div>

          {mode === 'custom' && (
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="icon" onClick={() => bump(-1)} disabled={gb <= 0.1} aria-label={`Decrease by ${step} GB`}>
                  <Minus />
                </Button>
                <label className="flex items-baseline gap-1.5">
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={gb}
                    onChange={(e) => {
                      setGb(Number(e.target.value));
                      setAbsolute(true);
                    }}
                    aria-label="Storage limit in GB"
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-2xl font-semibold outline-none focus:border-primary"
                  />
                  <span className="text-sm text-muted">GB</span>
                </label>
                <Button variant="outline" size="icon" onClick={() => bump(1)} aria-label={`Increase by ${step} GB`}>
                  <Plus />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs" role="group" aria-label="Step size">
                <span className="text-muted">Step</span>
                {STEPS.map((s) => (
                  <button key={s} onClick={() => setStep(s)} aria-pressed={step === s} className={cn('rounded-full border px-2.5 py-0.5', step === s ? 'border-primary bg-primary-soft font-medium text-primary' : 'border-border hover:bg-hover')}>
                    {s} GB
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs" role="group" aria-label="Common sizes">
                <span className="text-muted">Set to</span>
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setGb(p);
                      setAbsolute(true);
                    }}
                    className={cn('rounded-full border px-2.5 py-0.5', gb === p ? 'border-primary bg-primary-soft font-medium text-primary' : 'border-border hover:bg-hover')}
                  >
                    {gbLabel(p)}
                  </button>
                ))}
              </div>
              {change != null && change !== 0 && (
                <p className={cn('mt-3 text-center text-sm font-medium', change > 0 ? 'text-success' : 'text-warning')}>
                  {change > 0 ? `+${gbLabel(change)} more space` : `${gbLabel(-change)} less space`}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl bg-surface p-3 text-sm">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>After this change</span>
              <span className="font-medium text-foreground">{nextBytes == null ? 'Unlimited' : `${size(user.storageUsed)} of ${formatBytes(nextBytes)}`}</span>
            </div>
            <UsageBar used={user.storageUsed} total={nextBytes} />
          </div>

          {over && (
            <p className="flex gap-2 rounded-xl bg-[#fef7e0] p-3 text-xs text-[#7a4a00]" role="alert">
              <AlertTriangle className="size-4 shrink-0" />
              {user.name} already uses {formatBytes(user.storageUsed)}. Nothing is deleted, but they can't upload files, add images to Docs or receive Form uploads until they free up {formatBytes(user.storageUsed - nextBytes!)}.
            </p>
          )}
          {save.error && (
            <p className="text-sm text-danger" role="alert">
              {errorMessage(save.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={unchanged || !valid} loading={save.isPending}>
            Save storage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
