import type { AdminContentItemDto, AdminContentType } from '@qub/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Globe2, Lock, MoreVertical, Search, UserRoundCog, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileIcon } from '@/components/file-icon';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/form-controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { cn, formatBytes, formatRelative } from '@/lib/utils';
import { adminService, type AdminContentParams } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { PageHeader } from './admin-ui';

const TABS: { type: AdminContentType; label: string }[] = [
  { type: 'DOCUMENT', label: 'Docs' },
  { type: 'SPREADSHEET', label: 'Sheets' },
  { type: 'FORM', label: 'Forms' },
  { type: 'UPLOAD', label: 'Drive uploads' },
];

const count = (n: number | undefined, word: string) => `${(n ?? 0).toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

function details(item: AdminContentItemDto): string {
  const d = item.details;
  switch (item.fileType) {
    case 'DOCUMENT':
      return count(d.wordCount, 'word');
    case 'SPREADSHEET':
      return `${count(d.sheets, 'sheet')} · ${count(d.cells, 'cell')}`;
    case 'FORM':
      return `${d.published ? 'Published' : 'Draft'} · ${count(d.questions, 'question')} · ${count(d.responses, 'response')}`;
    default:
      return count(d.versions ?? 1, 'version');
  }
}

export function AdminContentPage({ type }: { type: AdminContentType }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [publicOnly, setPublicOnly] = useState(false);
  const [includeTrashed, setIncludeTrashed] = useState(false);
  const [sort, setSort] = useState<NonNullable<AdminContentParams['sort']>>('updatedAt');
  const [revoking, setRevoking] = useState<AdminContentItemDto | null>(null);
  const [transferring, setTransferring] = useState<AdminContentItemDto | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const params: AdminContentParams = { type, q, publicOnly, includeTrashed, sort };
  const list = useInfiniteQuery({
    queryKey: qk.admin.content(params),
    queryFn: ({ pageParam }) => adminService.content({ ...params, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const revoke = useMutation({
    mutationFn: (id: string) => adminService.revokeLink(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      toast.success('Public link turned off. The old URL no longer works.');
      setRevoking(null);
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Docs, Sheets, Forms and files"
        description="Everything stored in the organization, with who owns it, how it's shared and how much space it uses. Admins see details, not contents."
      />

      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="App">
        {TABS.map((t) => (
          <button
            key={t.type}
            role="tab"
            aria-selected={type === t.type}
            onClick={() => void navigate({ to: '/admin/content', search: { type: t.type }, replace: true })}
            className={cn('-mb-px flex items-center gap-2 border-b-[3px] px-4 py-2.5 text-sm font-medium', type === t.type ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground')}
          >
            <FileIcon type={t.type === 'UPLOAD' ? 'OTHER' : t.type} size={18} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <Search className="size-5 text-muted" aria-hidden />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by name or owner email" aria-label="Search content" className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted" />
          {text && (
            <button onClick={() => setText('')} className="rounded-full p-1 text-muted hover:bg-hover" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publicOnly} onChange={(e) => setPublicOnly(e.target.checked)} /> Shared publicly
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeTrashed} onChange={(e) => setIncludeTrashed(e.target.checked)} /> Include trash
        </label>
        <NativeSelect aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="updatedAt">Recently modified</option>
          <option value="size">Largest</option>
          <option value="name">Name</option>
        </NativeSelect>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-surface text-xs font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Details</th>
                  <th className="px-3 py-3">Sharing</th>
                  <th className="px-3 py-3">Size</th>
                  <th className="px-3 py-3">Modified</th>
                  <th className="w-12 px-3 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.isLoading
                  ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={7} className="px-4 py-3">
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  : items.map((item) => (
                      <tr key={item.id} className={cn('hover:bg-surface', item.isTrashed && 'text-muted')}>
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <FileIcon type={item.fileType} size={22} />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.name}</p>
                              <p className="truncate text-xs text-muted">
                                {item.isTrashed ? 'In trash' : (item.location ?? '—')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar user={item.owner} size={24} />
                            <span className="truncate text-xs">{item.owner.email}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted">{details(item)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs">
                          {item.generalAccess === 'ANYONE_WITH_LINK' ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[#b06000]">
                              <Globe2 className="size-3.5" /> Anyone with the link
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted">
                              <Lock className="size-3.5" /> {item.sharedWith ? `${item.sharedWith} ${item.sharedWith === 1 ? 'person' : 'people'}` : 'Private'}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs">{item.bytes ? formatBytes(item.bytes) : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs">{formatRelative(item.updatedAt)}</td>
                        <td className="px-3 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-full p-1.5 text-muted hover:bg-hover" aria-label={`Actions for ${item.name}`}>
                                <MoreVertical className="size-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem icon={<Lock />} disabled={item.generalAccess !== 'ANYONE_WITH_LINK'} onSelect={() => setRevoking(item)}>
                                Turn off public link
                              </DropdownMenuItem>
                              <DropdownMenuItem icon={<UserRoundCog />} disabled={item.isTrashed} onSelect={() => setTransferring(item)}>
                                Transfer ownership…
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!list.isLoading && items.length === 0 && <EmptyState icon={<Search />} title="Nothing here" description={q || publicOnly ? 'No items match these filters.' : 'No one has created any yet.'} />}
          {list.hasNextPage && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="ghost" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Turn off the public link?"
        description={`“${revoking?.name}” will only be available to people it's shared with. The current link stops working for everyone.`}
        confirmLabel="Turn off link"
        destructive
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
      />
      <TransferDialog item={transferring} onOpenChange={(o) => !o && setTransferring(null)} />
    </>
  );
}

function TransferDialog({ item, onOpenChange }: { item: AdminContentItemDto | null; onOpenChange(o: boolean): void }) {
  const [to, setTo] = useState('');
  const qc = useQueryClient();
  useEffect(() => setTo(''), [item]);
  const people = useQuery({ queryKey: qk.admin.users({ status: 'ACTIVE', limit: 200, purpose: 'transfer' }), queryFn: () => adminService.users({ status: 'ACTIVE', sort: 'name', limit: 200 }), enabled: !!item });
  const transfer = useMutation({
    mutationFn: () => adminService.transferFile(item!.id, to),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      toast.success('Ownership transferred. The previous owner can still edit it.');
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      {item && (
        <DialogContent title="Transfer ownership" description={`“${item.name}” stays where it is. ${item.owner.name} keeps editor access.`}>
          <NativeSelect aria-label="New owner" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-full">
            <option value="">Choose the new owner…</option>
            {(people.data?.items ?? [])
              .filter((p) => p.id !== item.owner.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </option>
              ))}
          </NativeSelect>
          {transfer.error && <p className="mt-3 text-sm text-danger" role="alert">{errorMessage(transfer.error)}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!to} loading={transfer.isPending} onClick={() => transfer.mutate()}>
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
