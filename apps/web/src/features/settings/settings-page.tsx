import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordInput } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Laptop, MailWarning } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { QubLogo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/form-controls';
import { Avatar, Badge } from '@/components/ui/misc';
import { UserMenu } from '@/components/user-menu';
import { useCurrentUser } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { authService } from '@/services/auth';
import { qk } from '@/services/query-keys';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-6">
      <h2 className="mb-4 text-lg">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(me.name);
  const avatarInput = useRef<HTMLInputElement>(null);
  const profile = useMutation({ mutationFn: () => authService.updateProfile({ name }), onSuccess: () => toast.success('Profile updated') });
  const avatar = useMutation({ mutationFn: authService.uploadAvatar, onSuccess: () => toast.success('Photo updated') });
  const resend = useMutation({ mutationFn: authService.resendVerification, onSuccess: () => toast.success('Verification email sent') });
  const sessions = useQuery({ queryKey: qk.sessions, queryFn: authService.sessions });
  const revoke = useMutation({ mutationFn: authService.revokeSession, onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions }) });
  const logoutAll = useMutation({ mutationFn: authService.logoutAll, onSuccess: () => void navigate({ to: '/login' }) });

  const pw = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '' } });
  const changePw = useMutation({
    mutationFn: authService.changePassword,
    meta: { silent: true },
    onSuccess: () => {
      pw.reset();
      toast.success('Password changed. Other sessions were signed out.');
      void qc.invalidateQueries({ queryKey: qk.sessions });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors.currentPassword) pw.setError('currentPassword', { message: err.fieldErrors.currentPassword });
      else toast.error((err as Error).message);
    },
  });

  return (
    <div className="min-h-full bg-surface">
      <header className="flex h-16 items-center gap-3 px-4">
        <Button asChild variant="subtle" size="icon" aria-label="Back to Drive">
          <Link to="/drive">
            <ArrowLeft />
          </Link>
        </Button>
        <QubLogo />
        <span className="ml-2 text-xl text-muted">Account</span>
        <span className="flex-1" />
        <UserMenu />
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-12">
        {!me.emailVerified && (
          <div className="flex items-center gap-3 rounded-xl bg-[#fef7e0] p-4 text-sm">
            <MailWarning className="size-5 text-warning" />
            <span className="flex-1">Please verify your email address ({me.email}).</span>
            <Button size="sm" variant="outline" onClick={() => resend.mutate()} loading={resend.isPending}>
              Resend email
            </Button>
          </div>
        )}
        <Card title="Profile">
          <div className="flex items-center gap-4">
            <Avatar user={me} size={72} />
            <div className="space-x-2">
              <Button variant="outline" size="sm" onClick={() => avatarInput.current?.click()} loading={avatar.isPending}>
                Change photo
              </Button>
              <input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => e.target.files?.[0] && avatar.mutate(e.target.files[0])} />
            </div>
          </div>
          <form className="mt-6 flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); profile.mutate(); }}>
            <div className="flex-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" maxLength={100} />
            </div>
            <Button type="submit" loading={profile.isPending} disabled={!name.trim() || name === me.name}>
              Save
            </Button>
          </form>
          <p className="mt-3 text-sm text-muted">Email: {me.email}</p>
        </Card>

        <Card title="Password">
          <form className="space-y-4" noValidate onSubmit={pw.handleSubmit((v) => changePw.mutate(v))}>
            <div>
              <Label htmlFor="current">Current password</Label>
              <Input id="current" type="password" autoComplete="current-password" className="mt-1.5" {...pw.register('currentPassword')} />
              <FieldError message={pw.formState.errors.currentPassword?.message} />
            </div>
            <div>
              <Label htmlFor="new">New password</Label>
              <Input id="new" type="password" autoComplete="new-password" className="mt-1.5" {...pw.register('newPassword')} />
              <FieldError message={pw.formState.errors.newPassword?.message} />
            </div>
            <Button type="submit" loading={changePw.isPending}>
              Change password
            </Button>
          </form>
        </Card>

        <Card title="Where you’re signed in">
          <ul className="divide-y divide-border">
            {sessions.data?.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
                <Laptop className="size-5 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{s.userAgent ?? 'Unknown device'}</p>
                  <p className="text-xs text-muted">
                    {s.ipAddress ?? 'Unknown IP'} · last active {formatDate(s.lastUsedAt, true)}
                  </p>
                </div>
                {s.current ? (
                  <Badge tone="success">This device</Badge>
                ) : (
                  <Button variant="subtle" size="sm" onClick={() => revoke.mutate(s.id)}>
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-4" onClick={() => logoutAll.mutate()} loading={logoutAll.isPending}>
            Sign out everywhere
          </Button>
        </Card>
      </main>
    </div>
  );
}
