import { emailSchema, ROLE_RANK, type GrantableRole, type PermissionDto, type SharingStateDto } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Globe2, Link2, Lock, RefreshCw, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FieldError, Input, NativeSelect, Switch, Textarea } from '@/components/ui/form-controls';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { errorMessage } from '@/lib/api';
import { driveService } from '@/services/drive';
import { qk } from '@/services/query-keys';

const ROLE_LABEL: Record<string, string> = { OWNER: 'Owner', EDITOR: 'Editor', COMMENTER: 'Commenter', VIEWER: 'Viewer' };

export interface ShareTarget {
  kind: 'file' | 'folder';
  id: string;
  name: string;
}

export function ShareDialog({ target, onOpenChange }: { target: ShareTarget | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      {target && (
        <DialogContent title={`Share "${target.name}"`} className="max-w-[560px]">
          <ShareDialogBody target={target} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ShareDialogBody({ target }: { target: ShareTarget }) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const key = qk.drive.sharing(target.kind, target.id);
  const state = useQuery({ queryKey: key, queryFn: () => driveService.sharing(target.kind, target.id) });
  const setState = (s: SharingStateDto) => {
    qc.setQueryData(key, s);
    void qc.invalidateQueries({ queryKey: qk.drive.all, refetchType: 'none' });
  };

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<GrantableRole>('EDITOR');
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const share = useMutation({
    mutationFn: () => driveService.share(target.kind, target.id, { email, role, notify, message: message || undefined, canShare: role === 'EDITOR' }),
    meta: { silent: true },
    onSuccess: (s) => {
      setState(s);
      setEmail('');
      setMessage('');
      toast.success('Shared');
    },
    onError: (err) => setEmailError(errorMessage(err)),
  });

  const update = useMutation({
    mutationFn: ({ p, patch }: { p: PermissionDto; patch: Partial<Pick<PermissionDto, 'role' | 'canShare' | 'canDownload' | 'canCopy'>> }) =>
      driveService.updatePermission(target.kind, target.id, p.id, patch as never),
    onSuccess: setState,
  });
  const remove = useMutation({
    mutationFn: (p: PermissionDto) => driveService.removePermission(target.kind, target.id, p.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const cancelInvite = useMutation({
    mutationFn: (inviteId: string) => driveService.cancelInvite(target.kind, target.id, inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  if (state.isLoading) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-24" /><Skeleton className="h-16" /></div>;
  if (state.error) return <p className="text-sm text-danger">{errorMessage(state.error)}</p>;
  const s = state.data!;
  const canManage = s.capabilities.canShare;

  return (
    <div className="space-y-6">
      {canManage && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = emailSchema.safeParse(email);
            if (!parsed.success) return setEmailError('Enter a valid email address');
            setEmailError(null);
            share.mutate();
          }}
        >
          <div className="flex gap-2">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Add people by email" type="email" aria-label="Email address" invalid={!!emailError} className="flex-1" />
            <NativeSelect value={role} onChange={(e) => setRole(e.target.value as GrantableRole)} aria-label="Role for new person" className="h-10">
              {(['VIEWER', 'COMMENTER', 'EDITOR'] as const)
                .filter((r) => s.capabilities.role === 'OWNER' || r !== 'EDITOR' || s.capabilities.canEdit)
                .map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
            </NativeSelect>
          </div>
          <FieldError message={emailError ?? undefined} />
          {email && (
            <>
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={notify} onCheckedChange={setNotify} aria-label="Notify people" /> Notify people
              </label>
              {notify && <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message (optional)" maxLength={1000} />}
              <div className="flex justify-end">
                <Button type="submit" loading={share.isPending}>
                  Send
                </Button>
              </div>
            </>
          )}
        </form>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium">People with access</h3>
        <ul className="space-y-1">
          <li className="flex items-center gap-3 py-1.5">
            <Avatar user={s.owner} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {s.owner.name} {s.owner.id === me.id && <span className="text-muted">(you)</span>}
              </p>
              <p className="truncate text-xs text-muted">{s.owner.email}</p>
            </div>
            <span className="text-sm text-muted">Owner</span>
          </li>
          {s.permissions.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-1.5">
              <Avatar user={p.user} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {p.user.name} {p.user.id === me.id && <span className="text-muted">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted">{p.inheritedFrom ? `Access from folder “${p.inheritedFrom.name}”` : p.user.email}</p>
              </div>
              {canManage && !p.inheritedFrom ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="rounded-md">
                      {ROLE_LABEL[p.role]} <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(['VIEWER', 'COMMENTER', 'EDITOR'] as const).map((r) => (
                      <DropdownMenuItem key={r} onSelect={() => update.mutate({ p, patch: { role: r, canShare: r === 'EDITOR' ? p.canShare : false } })} icon={p.role === r ? <Check /> : <span className="size-[18px]" />}>
                        {ROLE_LABEL[r]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {p.role === 'EDITOR' && (
                      <DropdownMenuCheckboxItem checked={p.canShare} onCheckedChange={(v) => update.mutate({ p, patch: { canShare: v } })}>
                        Can share
                      </DropdownMenuCheckboxItem>
                    )}
                    {p.role !== 'EDITOR' && (
                      <DropdownMenuCheckboxItem checked={p.canDownload} onCheckedChange={(v) => update.mutate({ p, patch: { canDownload: v, canCopy: v } })}>
                        Can download, print & copy
                      </DropdownMenuCheckboxItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => remove.mutate(p)}>
                      Remove access
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="text-sm text-muted">{ROLE_LABEL[p.role]}</span>
              )}
            </li>
          ))}
          {s.pendingInvites.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 py-1.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted">
                <Users className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{inv.email}</p>
                <p className="text-xs text-muted">Invited · will get access after signing up</p>
              </div>
              <span className="text-sm text-muted">{ROLE_LABEL[inv.role]}</span>
              {canManage && (
                <Button variant="subtle" size="sm" onClick={() => cancelInvite.mutate(inv.id)}>
                  Cancel
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <GeneralAccess state={s} target={target} onChange={setState} canManage={canManage} />
    </div>
  );
}

function GeneralAccess({ state, target, onChange, canManage }: { state: SharingStateDto; target: ShareTarget; onChange: (s: SharingStateDto) => void; canManage: boolean }) {
  const [password, setPassword] = useState('');
  const [expires, setExpires] = useState(state.link?.expiresAt?.slice(0, 10) ?? '');
  const mutate = useMutation({
    mutationFn: (input: Parameters<typeof driveService.setGeneralAccess>[2]) => driveService.setGeneralAccess(target.kind, target.id, input),
    onSuccess: onChange,
  });
  const rotate = useMutation({ mutationFn: () => driveService.rotateLink(target.kind, target.id), onSuccess: (s) => {
    onChange(s);
    toast.success('New link created. The old link no longer works.');
  } });
  const anyone = state.generalAccess === 'ANYONE_WITH_LINK';
  const linkRole = (state.link?.role ?? 'VIEWER') as GrantableRole;
  // Organization policy (admin console): options it doesn't allow are shown disabled.
  const { allowPublicLinks, maxLinkRole } = state.policy;
  const roleAllowed = (r: GrantableRole) => ROLE_RANK[r] <= ROLE_RANK[maxLinkRole];

  const copy = async () => {
    let url = state.link?.url;
    if (!url) return;
    try {
      const parsed = new URL(url);
      const token = parsed.pathname.split('/share/')[1] || state.link?.token;
      const basePath = window.location.pathname.startsWith('/qubsuite') ? '/qubsuite' : '';
      url = window.location.origin + basePath + '/share/' + (token || '');
    } catch {
      // fallback to original url if parsing fails
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  return (
    <section className="rounded-xl bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium">General access</h3>
      <div className="flex items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${anyone ? 'bg-[#e6f4ea] text-success' : 'bg-surface-2 text-muted'}`}>
          {anyone ? <Globe2 className="size-5" /> : <Lock className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          {canManage ? (
            <NativeSelect
              aria-label="General access"
              value={state.generalAccess}
              onChange={(e) => mutate.mutate({ access: e.target.value as 'RESTRICTED' | 'ANYONE_WITH_LINK', linkRole })}
              className="border-none bg-transparent px-0 font-medium"
            >
              <option value="RESTRICTED">Restricted</option>
              <option value="ANYONE_WITH_LINK" disabled={!allowPublicLinks && !anyone}>
                Anyone with the link{allowPublicLinks ? '' : ' (turned off by your organization)'}
              </option>
            </NativeSelect>
          ) : (
            <p className="text-sm font-medium">{anyone ? 'Anyone with the link' : 'Restricted'}</p>
          )}
          <p className="text-xs text-muted">
            {anyone
              ? `Anyone on the internet with the link can ${linkRole === 'VIEWER' ? 'view' : linkRole === 'COMMENTER' ? 'comment' : 'edit'}${state.link?.hasPassword ? ' (password required)' : ''}`
              : state.visibility === 'PRIVATE'
                ? 'Private — only you can open this'
                : 'Only people with access can open with the link'}
          </p>
        </div>
        {anyone && canManage && (
          <NativeSelect aria-label="Link role" value={linkRole} onChange={(e) => mutate.mutate({ access: 'ANYONE_WITH_LINK', linkRole: e.target.value as GrantableRole })}>
            {(['VIEWER', 'COMMENTER', 'EDITOR'] as const).map((r) => (
              <option key={r} value={r} disabled={!roleAllowed(r)}>
                {r === 'VIEWER' ? 'Viewer' : r === 'COMMENTER' ? 'Commenter' : 'Editor'}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>

      {anyone && canManage && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Password {state.link?.hasPassword && <span className="text-success">(set)</span>}
            <div className="mt-1 flex gap-2">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={state.link?.hasPassword ? '••••••' : 'Optional'} className="h-9" minLength={4} />
              <Button size="sm" variant="outline" disabled={password.length < 4} onClick={() => mutate.mutate({ access: 'ANYONE_WITH_LINK', linkRole, password }, { onSuccess: () => setPassword('') })}>
                Set
              </Button>
            </div>
            {state.link?.hasPassword && (
              <button className="mt-1 text-primary hover:underline" onClick={() => mutate.mutate({ access: 'ANYONE_WITH_LINK', linkRole, password: null })}>
                Remove password
              </button>
            )}
          </label>
          <label className="text-xs text-muted">
            Expires
            <div className="mt-1 flex gap-2">
              <Input type="date" value={expires} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={(e) => setExpires(e.target.value)} className="h-9" />
              <Button size="sm" variant="outline" onClick={() => mutate.mutate({ access: 'ANYONE_WITH_LINK', linkRole, expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() as never : null })}>
                Save
              </Button>
            </div>
          </label>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        {anyone && state.link ? (
          <>
            {canManage ? (
              <Button variant="subtle" size="sm" onClick={() => rotate.mutate()} loading={rotate.isPending}>
                <RefreshCw /> Reset link
              </Button>
            ) : (
              <span />
            )}
            <Button variant="outline" onClick={() => void copy()}>
              <Link2 /> Copy link
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted">Turn on link sharing to get a link anyone can open.</p>
        )}
      </div>
    </section>
  );
}
