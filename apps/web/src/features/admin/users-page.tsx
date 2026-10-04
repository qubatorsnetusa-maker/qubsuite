import type { AdminUserDto, PlatformRole } from '@qub/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { BadgeCheck, Download, HardDrive, KeyRound, LogOut, MoreVertical, Pause, Pencil, Play, Search, Trash2, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, Label, NativeSelect } from '@/components/ui/form-controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { Avatar, Skeleton, Tooltip } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { errorMessage } from '@/lib/api';
import { cn, formatBytes, formatDate, formatRelative } from '@/lib/utils';
import { adminService, type AdminUsersParams } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { PageHeader, UsageBar } from './admin-ui';
import { StorageDialog } from './storage-dialog';

export interface UsersSearch {
  q?: string;
  role?: PlatformRole;
  status?: 'ACTIVE' | 'SUSPENDED';
  new?: boolean;
}

function useAdminMutation<T, V>(fn: (v: V) => Promise<T>, success?: (r: T, v: V) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      const msg = success?.(r, v);
      if (msg) toast.success(msg);
    },
  });
}

export function AdminUsersPage({ search }: { search: UsersSearch }) {
  const navigate = useNavigate();
  const me = useCurrentUser();
  const [text, setText] = useState(search.q ?? '');
  const [sort, setSort] = useState<NonNullable<AdminUsersParams['sort']>>('name');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminUserDto | null>(null);
  const [deleting, setDeleting] = useState<AdminUserDto | null>(null);
  const [storageFor, setStorageFor] = useState<AdminUserDto | null>(null);
  const setSearch = (patch: Partial<UsersSearch>) => void navigate({ to: '/admin/users', search: { ...search, ...patch }, replace: true });

  useEffect(() => setText(search.q ?? ''), [search.q]);
  useEffect(() => {
    const t = setTimeout(() => (text.trim() || undefined) !== search.q && setSearch({ q: text.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const params: AdminUsersParams = { q: search.q, role: search.role, status: search.status, sort, order: sort === 'name' ? 'asc' : 'desc' };
  const list = useInfiniteQuery({
    queryKey: qk.admin.users(params),
    queryFn: ({ pageParam }) => adminService.users({ ...params, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const users = list.data?.pages.flatMap((p) => p.items) ?? [];
  const allSelected = users.length > 0 && users.every((u) => selected.has(u.id));

  const bulk = useAdminMutation(
    ({ action }: { action: 'suspend' | 'activate' | 'signOut' }) => adminService.bulkUsers([...selected], action),
    (r) => {
      setSelected(new Set());
      if (r.skipped.length) toast.warning(`${r.skipped.length} skipped: ${r.skipped[0]!.reason}`);
      return `${r.updated.length} ${r.updated.length === 1 ? 'person' : 'people'} updated`;
    },
  );

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Users"
        description="Create accounts, set roles and storage quotas, suspend access, and offboard people with their files."
        actions={
          <>
            <Button asChild variant="outline">
              <a href={adminService.usersExportUrl({ q: search.q, role: search.role, status: search.status, sort })} download>
                <Download /> Export CSV
              </a>
            </Button>
            <Button onClick={() => setSearch({ new: true })}>
              <UserPlus /> Add person
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <Search className="size-5 text-muted" aria-hidden />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by name or email" aria-label="Filter people" className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted" />
          {text && (
            <button onClick={() => setText('')} className="rounded-full p-1 text-muted hover:bg-hover" aria-label="Clear filter">
              <X className="size-4" />
            </button>
          )}
        </div>
        <NativeSelect aria-label="Role" value={search.role ?? ''} onChange={(e) => setSearch({ role: (e.target.value || undefined) as PlatformRole | undefined })}>
          <option value="">All roles</option>
          <option value="SUPER_ADMIN">Super admins</option>
          <option value="USER">Members</option>
        </NativeSelect>
        <NativeSelect aria-label="Status" value={search.status ?? ''} onChange={(e) => setSearch({ status: (e.target.value || undefined) as UsersSearch['status'] })}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </NativeSelect>
        <NativeSelect aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="name">Name</option>
          <option value="storage">Storage used</option>
          <option value="lastLoginAt">Last sign-in</option>
          <option value="createdAt">Newest</option>
        </NativeSelect>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary-soft bg-[#e8f0fe] px-4 py-2.5" role="toolbar" aria-label="Bulk actions">
          <span className="text-sm font-medium text-[#174ea6]">{selected.size} selected</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" loading={bulk.isPending} onClick={() => bulk.mutate({ action: 'signOut' })}>
              <LogOut /> Sign out
            </Button>
            <Button size="sm" variant="outline" loading={bulk.isPending} onClick={() => bulk.mutate({ action: 'activate' })}>
              <Play /> Activate
            </Button>
            <Button size="sm" variant="danger" loading={bulk.isPending} onClick={() => bulk.mutate({ action: 'suspend' })}>
              <Pause /> Suspend
            </Button>
          </div>
        </div>
      )}

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border bg-surface text-xs font-semibold text-muted">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(users.map((u) => u.id)) : new Set())} />
                  </th>
                  <th className="px-3 py-3">Person</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Storage</th>
                  <th className="px-3 py-3">Files</th>
                  <th className="px-3 py-3">Sessions</th>
                  <th className="px-3 py-3">Last sign-in</th>
                  <th className="w-12 px-3 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.isLoading
                  ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={9} className="px-4 py-3">
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  : users.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        isMe={u.id === me.id}
                        selected={selected.has(u.id)}
                        onSelect={(v) => setSelected((s) => {
                          const next = new Set(s);
                          if (v) next.add(u.id);
                          else next.delete(u.id);
                          return next;
                        })}
                        onEdit={() => setEditing(u)}
                        onStorage={() => setStorageFor(u)}
                        onDelete={() => setDeleting(u)}
                      />
                    ))}
              </tbody>
            </table>
          </div>
          {!list.isLoading && users.length === 0 && <EmptyState icon={<Search />} title="No one matches" description="Try a different name, email or filter." />}
          {list.hasNextPage && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="ghost" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      <AddUserDialog open={!!search.new} onOpenChange={(o) => !o && setSearch({ new: undefined })} />
      <EditUserDialog user={editing} isMe={editing?.id === me.id} onOpenChange={(o) => !o && setEditing(null)} />
      <DeleteUserDialog user={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
      <StorageDialog user={storageFor} onOpenChange={(o) => !o && setStorageFor(null)} />
    </>
  );
}

function UserRow({
  user: u,
  isMe,
  selected,
  onSelect,
  onEdit,
  onStorage,
  onDelete,
}: {
  user: AdminUserDto;
  isMe: boolean;
  selected: boolean;
  onSelect(v: boolean): void;
  onEdit(): void;
  onStorage(): void;
  onDelete(): void;
}) {
  const suspended = u.status === 'SUSPENDED';
  const update = useAdminMutation(
    (status: 'ACTIVE' | 'SUSPENDED') => adminService.updateUser(u.id, { status }),
    (_r, status) => (status === 'SUSPENDED' ? `${u.name} was suspended and signed out` : `${u.name} can sign in again`),
  );
  const signOut = useAdminMutation(() => adminService.signOutUser(u.id), () => `${u.name} was signed out everywhere`);
  const link = useAdminMutation(() => adminService.sendPasswordLink(u.id), () => `Password link sent to ${u.email}`);
  return (
    <tr className={cn('hover:bg-surface', selected && 'bg-surface', suspended && 'text-muted')}>
      <td className="px-4 py-3">
        <input type="checkbox" aria-label={`Select ${u.name}`} checked={selected} onChange={(e) => onSelect(e.target.checked)} />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <Avatar user={u} size={32} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
              {u.name}
              {isMe && <span className="text-xs font-normal text-muted">(you)</span>}
            </p>
            <p className="truncate text-xs text-muted">
              {u.email}
              {!u.emailVerified && ' · not verified'}
            </p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        {u.platformRole === 'SUPER_ADMIN' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
            <BadgeCheck className="size-3.5" /> Super admin
          </span>
        ) : (
          <span className="text-xs">Member</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', suspended ? 'text-danger' : 'text-success')}>
          <span className={cn('size-1.5 rounded-full', suspended ? 'bg-danger' : 'bg-success')} />
          {suspended ? 'Suspended' : 'Active'}
        </span>
      </td>
      <td className="min-w-[160px] px-3 py-2">
        <Tooltip content="Change storage">
          <button onClick={onStorage} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-hover" aria-label={`Change storage for ${u.name}`}>
            <span className="mb-1 flex justify-between gap-2 text-[11px] text-muted">
              <span>{u.storageUsed ? formatBytes(u.storageUsed) : '0 B'}</span>
              <span className={cn(u.quotaMode === 'custom' && 'font-medium text-foreground')}>{u.storageQuota ? formatBytes(u.storageQuota) : 'Unlimited'}</span>
            </span>
            <UsageBar used={u.storageUsed} total={u.storageQuota} />
          </button>
        </Tooltip>
      </td>
      <td className="px-3 py-3 text-xs">{u.ownedFiles}</td>
      <td className="px-3 py-3 text-xs">{u.activeSessions}</td>
      <td className="whitespace-nowrap px-3 py-3 text-xs" title={u.lastLoginAt ? formatDate(u.lastLoginAt, true) : undefined}>
        {u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Never'}
      </td>
      <td className="px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full p-1.5 text-muted hover:bg-hover" aria-label={`Actions for ${u.name}`}>
              <MoreVertical className="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem icon={<Pencil />} onSelect={onEdit}>
              Edit name, role and status
            </DropdownMenuItem>
            <DropdownMenuItem icon={<HardDrive />} onSelect={onStorage}>
              Change storage…
            </DropdownMenuItem>
            <DropdownMenuItem icon={<KeyRound />} disabled={suspended} onSelect={() => link.mutate(undefined)}>
              {u.lastLoginAt ? 'Send password reset link' : 'Resend account setup link'}
            </DropdownMenuItem>
            {!isMe && (
              <DropdownMenuItem icon={<LogOut />} disabled={!u.activeSessions} onSelect={() => signOut.mutate(undefined)}>
                Sign out everywhere
              </DropdownMenuItem>
            )}
            {!isMe && (
              <>
                <DropdownMenuSeparator />
                {suspended ? (
                  <DropdownMenuItem icon={<Play />} onSelect={() => update.mutate('ACTIVE')}>
                    Reactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem icon={<Pause />} onSelect={() => update.mutate('SUSPENDED')}>
                    Suspend
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem icon={<Trash2 />} destructive onSelect={onDelete}>
                  Delete account…
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformRole>('USER');
  const [quota, setQuota] = useState('');
  const create = useAdminMutation(
    () => adminService.createUser({ name: name.trim(), email: email.trim(), platformRole: role, quotaGb: quota ? Number(quota) : null }),
    (u) => `Account created. ${u.email} was emailed a link to choose a password.`,
  );
  useEffect(() => {
    if (open) (setName(''), setEmail(''), setRole('USER'), setQuota(''), create.reset());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a person" description="They'll get an email with a link to choose their password (valid for 7 days).">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(undefined, { onSuccess: () => onOpenChange(false) });
          }}
        >
          <div>
            <Label htmlFor="new-name">Full name</Label>
            <Input id="new-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-role">Role</Label>
              <NativeSelect id="new-role" value={role} onChange={(e) => setRole(e.target.value as PlatformRole)} className="mt-1 h-10 w-full">
                <option value="USER">Member</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="new-quota">Storage quota (GB)</Label>
              <Input id="new-quota" type="number" min={0.1} step={0.1} placeholder="Organization default" value={quota} onChange={(e) => setQuota(e.target.value)} className="mt-1" />
            </div>
          </div>
          {create.error && <p className="text-sm text-danger" role="alert">{errorMessage(create.error)}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, isMe, onOpenChange }: { user: AdminUserDto | null; isMe: boolean; onOpenChange(o: boolean): void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<PlatformRole>('USER');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setRole(user.platformRole);
    setStatus(user.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE');
  }, [user]);
  const save = useAdminMutation(
    () =>
      adminService.updateUser(user!.id, {
        name: name.trim(),
        ...(isMe ? {} : { platformRole: role, status }),
      }),
    () => 'Changes saved',
  );
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      {user && (
        <DialogContent title={`Edit ${user.name}`} description={user.email}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(undefined, { onSuccess: () => onOpenChange(false) });
            }}
          >
            <div>
              <Label htmlFor="edit-name">Full name</Label>
              <Input id="edit-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <NativeSelect id="edit-role" disabled={isMe} value={role} onChange={(e) => setRole(e.target.value as PlatformRole)} className="mt-1 h-10 w-full">
                  <option value="USER">Member</option>
                  <option value="SUPER_ADMIN">Super admin</option>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <NativeSelect id="edit-status" disabled={isMe} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="mt-1 h-10 w-full">
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended (can't sign in)</option>
                </NativeSelect>
              </div>
            </div>
            {isMe && <p className="text-xs text-muted">You can't change your own role or status, so the organization always keeps an admin.</p>}
            {save.error && <p className="text-sm text-danger" role="alert">{errorMessage(save.error)}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

function DeleteUserDialog({ user, onOpenChange }: { user: AdminUserDto | null; onOpenChange(o: boolean): void }) {
  const [mode, setMode] = useState<'transfer' | 'delete'>('transfer');
  const [target, setTarget] = useState('');
  const [confirm, setConfirm] = useState('');
  const candidates = useQuery({
    queryKey: qk.admin.users({ status: 'ACTIVE', limit: 200, purpose: 'transfer' }),
    queryFn: () => adminService.users({ status: 'ACTIVE', sort: 'name', limit: 200 }),
    enabled: !!user,
  });
  useEffect(() => {
    if (user) (setMode('transfer'), setTarget(''), setConfirm(''));
  }, [user]);
  const del = useAdminMutation(
    () => adminService.deleteUser(user!.id, mode === 'transfer' ? { transferToUserId: target } : { deleteData: true }),
    (r) => (r.transferredTo ? `${user!.name}'s account was deleted and their files transferred` : `${user!.name}'s account and ${r.deletedFiles} files were deleted`),
  );
  const ready = mode === 'transfer' ? !!target : confirm.trim().toLowerCase() === user?.email;
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      {user && (
        <DialogContent title={`Delete ${user.name}'s account?`} description="The account is removed and its email can be used again. Choose what happens to the files they own.">
          <div className="space-y-3 text-sm">
            <label className={cn('block cursor-pointer rounded-xl border p-3', mode === 'transfer' ? 'border-primary bg-[#e8f0fe]' : 'border-border')}>
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" name="del" checked={mode === 'transfer'} onChange={() => setMode('transfer')} /> Transfer their files
              </span>
              <span className="mt-1 block text-xs text-muted">
                Everything {user.name} owns ({user.ownedFiles} files, {formatBytes(user.storageUsed)}) moves to the person you choose, in a folder named “{user.name}'s files”.
              </span>
              {mode === 'transfer' && (
                <NativeSelect aria-label="Transfer files to" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-2 h-10 w-full">
                  <option value="">Choose a person…</option>
                  {(candidates.data?.items ?? [])
                    .filter((c) => c.id !== user.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                </NativeSelect>
              )}
            </label>
            <label className={cn('block cursor-pointer rounded-xl border p-3', mode === 'delete' ? 'border-danger bg-danger-soft' : 'border-border')}>
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" name="del" checked={mode === 'delete'} onChange={() => setMode('delete')} /> Delete their files permanently
              </span>
              <span className="mt-1 block text-xs text-muted">Their Docs, Sheets, Forms and uploads — and everything inside folders they own — are deleted and can't be recovered.</span>
              {mode === 'delete' && (
                <Input className="mt-2" placeholder={`Type ${user.email} to confirm`} aria-label="Confirm email" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              )}
            </label>
          </div>
          {del.error && <p className="mt-3 text-sm text-danger" role="alert">{errorMessage(del.error)}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!ready} loading={del.isPending} onClick={() => del.mutate(undefined, { onSuccess: () => onOpenChange(false) })}>
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
