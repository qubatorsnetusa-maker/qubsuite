import { KingsChatButton } from './kingschat-button';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, loginSchema, passwordSchema, registerSchema, type LoginInput, type RegisterInput } from '@qub/shared';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { QubLogo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/form-controls';
import { ApiError, errorMessage } from '@/lib/api';
import { authService } from '@/services/auth';

function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-[448px] rounded-3xl bg-background p-8 shadow-card sm:p-10">
        <QubLogo />
        <h1 className="mt-8 text-[28px] font-normal leading-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}

function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {errorMessage(error)}
    </div>
  );
}

/** Only allow same-origin, relative redirect targets (prevents open redirects). */
function defaultDestination(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.startsWith('docs.')) return '/docs';
    if (host.startsWith('sheets.')) return '/sheets';
    if (host.startsWith('forms.')) return '/forms';
    if (host.startsWith('drive.')) return '/drive';
    if (host.startsWith('pdf.')) return '/drive?filter=pdf';
  }
  return '/drive';
}

/** Only allow same-origin, relative redirect targets (prevents open redirects). */
function safeRedirect(target: string | undefined): string {
  if (!target) return defaultDestination();
  try {
    const url = new URL(target, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : defaultDestination();
  } catch {
    return defaultDestination();
  }
}

export function LoginPage() {
  const search = useSearch({ from: '/login' });
  const navigate = useNavigate();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: search.email ?? '', password: '' } });
  const login = useMutation({ mutationFn: authService.login, meta: { silent: true } });

  const [kcError, setKcError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    await login.mutateAsync(values);
    await navigate({ href: safeRedirect(search.redirect), replace: true });
  });

  return (
    <AuthCard
      title="Sign in"
      subtitle="to continue to Qub"
      footer={
        <>
          New to Qub?{' '}
          <Link to="/register" search={{ redirect: search.redirect }} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <FormError error={login.error || kcError} />
      <KingsChatButton
        onSignedIn={() => void navigate({ href: safeRedirect(search.redirect), replace: true })}
        onError={setKcError}
      />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" autoFocus className="mt-1.5" invalid={!!form.formState.errors.email} aria-describedby="email-error" {...form.register('email')} />
          <FieldError id="email-error" message={form.formState.errors.email?.message} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" className="mt-1.5" invalid={!!form.formState.errors.password} aria-describedby="password-error" {...form.register('password')} />
          <FieldError id="password-error" message={form.formState.errors.password?.message} />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}

export function RegisterPage() {
  const search = useSearch({ from: '/register' });
  const navigate = useNavigate();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [kcError, setKcError] = useState<string | null>(null);
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { name: '', email: search.email ?? '', password: '' } });
  const register = useMutation({ mutationFn: authService.register, meta: { silent: true } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await register.mutateAsync(values);
      if ('requiresVerification' in result) setPendingEmail(result.email);
      else await navigate({ href: safeRedirect(search.redirect), replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) form.setError('email', { message: err.message });
    }
  });

  if (pendingEmail) {
    return (
      <AuthCard title="Check your email" subtitle={<>We sent a verification link to <b>{pendingEmail}</b>.</>}>
        <div className="flex justify-center py-6 text-primary">
          <MailCheck className="size-16" />
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your Qub account"
      subtitle="One account for Drive, Docs, Sheets and Forms"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" search={{ redirect: search.redirect }} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <FormError error={(register.error && !(register.error instanceof ApiError && register.error.status === 409) ? register.error : null) || kcError} />
      <KingsChatButton
        onSignedIn={() => void navigate({ href: safeRedirect(search.redirect), replace: true })}
        onError={setKcError}
      />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" autoFocus className="mt-1.5" invalid={!!form.formState.errors.name} {...form.register('name')} />
          <FieldError message={form.formState.errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" className="mt-1.5" invalid={!!form.formState.errors.email} {...form.register('email')} />
          <FieldError message={form.formState.errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" className="mt-1.5" invalid={!!form.formState.errors.password} aria-describedby="password-hint" {...form.register('password')} />
          <FieldError message={form.formState.errors.password?.message} />
          {!form.formState.errors.password && (
            <p id="password-hint" className="mt-1 text-[13px] text-muted">
              At least 8 characters, with a letter and a number.
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const form = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  const mutation = useMutation({ mutationFn: (email: string) => authService.forgotPassword(email), meta: { silent: true } });
  return (
    <AuthCard title="Reset your password" subtitle="Enter your email and we’ll send you a reset link." footer={<Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
      {mutation.isSuccess ? (
        <div className="flex items-start gap-3 rounded-lg bg-[#e6f4ea] p-4 text-sm text-success" role="status">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          {mutation.data.message}
        </div>
      ) : (
        <form onSubmit={form.handleSubmit((v) => mutation.mutateAsync(v.email))} noValidate className="space-y-5">
          <FormError error={mutation.error} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" autoFocus className="mt-1.5" invalid={!!form.formState.errors.email} {...form.register('email')} />
            <FieldError message={form.formState.errors.email?.message} />
          </div>
          <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

const resetFormSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords don’t match', path: ['confirm'] });

export function ResetPasswordPage() {
  const { token } = useSearch({ from: '/reset-password' });
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof resetFormSchema>>({ resolver: zodResolver(resetFormSchema), defaultValues: { password: '', confirm: '' } });
  const mutation = useMutation({ mutationFn: (password: string) => authService.resetPassword(token, password), meta: { silent: true } });
  return (
    <AuthCard title="Choose a new password">
      <FormError error={mutation.error ?? (!token ? new Error('This reset link is missing its token.') : null)} />
      <form
        noValidate
        className="space-y-5"
        onSubmit={form.handleSubmit(async (v) => {
          await mutation.mutateAsync(v.password);
          await navigate({ to: '/login' });
        })}
      >
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" autoFocus className="mt-1.5" {...form.register('password')} />
          <FieldError message={form.formState.errors.password?.message} />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" className="mt-1.5" {...form.register('confirm')} />
          <FieldError message={form.formState.errors.confirm?.message} />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={mutation.isPending} disabled={!token}>
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}

export function VerifyEmailPage() {
  const { token } = useSearch({ from: '/verify-email' });
  const mutation = useMutation({ mutationFn: () => authService.verifyEmail(token), meta: { silent: true } });
  const { mutate } = mutation;
  useEffect(() => {
    if (token) mutate();
  }, [token, mutate]);
  return (
    <AuthCard title="Email verification">
      {mutation.isPending && <p className="text-muted">Verifying…</p>}
      {mutation.isSuccess && (
        <div className="flex items-start gap-3 rounded-lg bg-[#e6f4ea] p-4 text-sm text-success" role="status">
          <CheckCircle2 className="size-5" /> Your email address is verified.
        </div>
      )}
      <FormError error={mutation.error ?? (!token ? new Error('This verification link is missing its token.') : null)} />
      <Button asChild className="mt-6 w-full">
        <Link to="/drive">Continue to Qub</Link>
      </Button>
    </AuthCard>
  );
}
