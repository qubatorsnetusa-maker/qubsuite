import type { DriveItemDto } from '@qub/shared';
import { SPAM_RETENTION_DAYS } from '@qub/shared';
import { Ban } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { formatRelative } from '@/lib/utils';
import { useBlockedPeople, useReportSpam, useUnblock } from './queries';

/** "Report spam": moves the item to Spam, optionally blocking its owner. */
export function ReportSpamDialog({ item, onOpenChange }: { item: DriveItemDto | null; onOpenChange(open: boolean): void }) {
  const report = useReportSpam();
  const [block, setBlock] = useState(false);
  useEffect(() => setBlock(false), [item]);
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      {item && (
        <DialogContent title="Report spam" description={`“${item.name}” moves to Spam and disappears from Shared with me, Recent, Starred, search and suggestions. It’s removed from your Drive after ${SPAM_RETENTION_DAYS} days.`}>
          <div className="flex items-center gap-3 rounded-xl bg-surface p-3 text-sm">
            <Avatar user={item.owner} size={32} />
            <div className="min-w-0">
              <p className="truncate font-medium">Shared by {item.owner.name}</p>
              <p className="truncate text-xs text-muted">{item.owner.email}</p>
            </div>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm hover:bg-surface">
            <input type="checkbox" className="mt-0.5 size-4" checked={block} onChange={(e) => setBlock(e.target.checked)} />
            <span>
              <span className="block font-medium">Also block {item.owner.name}</span>
              <span className="mt-0.5 block text-xs text-muted">They won’t be able to share files with you or notify you, and everything they’ve already shared with you moves to Spam. You can unblock them any time.</span>
            </span>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant={block ? 'danger' : 'primary'} loading={report.isPending} onClick={() => report.mutate({ item, blockOwner: block }, { onSuccess: () => onOpenChange(false) })}>
              {block ? 'Report and block' : 'Report spam'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** People the user blocked, with Unblock. */
export function BlockedPeopleDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const blocked = useBlockedPeople(open);
  const unblock = useUnblock();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Blocked people" description="People you’ve blocked can’t share files with you or send you notifications.">
        {blocked.isLoading ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : !blocked.data?.length ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
            <Ban className="size-8 text-subtle" />
            You haven’t blocked anyone.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {blocked.data.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
                <Avatar user={p} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted">
                    {p.email} · blocked {formatRelative(p.blockedAt)}
                  </p>
                </div>
                <Button variant="outline" size="sm" loading={unblock.isPending && unblock.variables?.id === p.id} onClick={() => unblock.mutate(p)}>
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
