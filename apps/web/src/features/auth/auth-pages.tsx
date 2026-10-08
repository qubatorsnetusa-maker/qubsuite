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
  const [email, setEmail] = useState(search.email ?? '');
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(search.error ? `Sign-in error: ${search.error}` : null);
  const [kcError, setKcError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifying, setVerifying] = useState(search.callback === '1');

  // Handle redirect callback from Neon Auth magic link email verification
  useEffect(() => {
    if (search.callback !== '1') return;

    let active = true;
    async function resolveCallback() {
      try {
        let sessionToken: string | undefined = undefined;
        let neonEmail: string | undefined = search.email;
        let neonName: string | undefined = undefined;
        let neonUserId: string | undefined = undefined;

        try {
          const NEON_AUTH_URL = 'https://ep-small-unit-b1bvawbw.neonauth.c-5.eu-central-1.aws.neon.tech/qubsuite/auth';
          const res = await fetch(`${NEON_AUTH_URL}/get-session`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.session?.token) {
              sessionToken = data.session.token;
              neonEmail = data.user?.email || neonEmail;
              neonName = data.user?.name;
              neonUserId = data.user?.id;
            }
          }
        } catch {
          // Fallback to database lookup
        }

        await authService.neonSession({
          sessionToken,
          email: neonEmail,
          name: neonName,
          neonUserId,
        });

        if (!active) return;
        void navigate({ href: safeRedirect(search.redirect), replace: true });
      } catch (err: any) {
        if (!active) return;
        setVerifying(false);
        setError(errorMessage(err) || 'Sign-in link expired or invalid. Please request a new one.');
      }
    }

    void resolveCallback();
    return () => {
      active = false;
    };
  }, [search, navigate]);

  // Background polling: if the user clicks the magic link on their phone or another tab,
  // this active login tab will automatically detect it and log in!
  useEffect(() => {
    if (!sentEmail || verifying) return;
    const since = new Date().toISOString();
    const interval = setInterval(async () => {
      try {
        const res = await authService.pollMagicLink(sentEmail, since);
        if (res.authenticated) {
          clearInterval(interval);
          void navigate({ href: safeRedirect(search.redirect), replace: true });
        }
      } catch {
        // ignore poll errors
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [sentEmail, verifying, search.redirect, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/login?callback=1${search.redirect ? `&redirect=${encodeURIComponent(search.redirect)}` : ''}`;
      await authService.sendMagicLink(trimmed, callbackUrl);
      setSentEmail(trimmed);
      setResendCooldown(30);
    } catch (err: any) {
      setError(errorMessage(err) || 'Failed to send magic link. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <AuthCard title="Signing you in..." subtitle="Verifying your magic link with QubDocs">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-xs text-muted">Just a moment while we set up your session...</p>
        </div>
      </AuthCard>
    );
  }

  if (sentEmail) {
    return (
      <AuthCard
        title="Check your email"
        subtitle={<>We sent a magic sign-in link to <strong className="text-foreground">{sentEmail}</strong>.</>}
        footer={
          <div className="text-center">
            <button
              type="button"
              onClick={() => { setSentEmail(null); setError(null); }}
              className="text-sm font-medium text-primary hover:underline"
            >
              Use a different email
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-8" />
          </div>
          <p className="mt-4 text-sm text-muted">
            Click the link in the email to sign in instantly. You can close this page, or keep it open to sign in automatically once verified.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={resendCooldown > 0 || loading}
            onClick={() => void handleSendLink()}
          >
            {resendCooldown > 0 ? `Resend link in ${resendCooldown}s` : 'Resend magic link'}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Sign in passwordlessly to continue to QubDocs"
      footer={
        <>
          New to QubDocs?{' '}
          <Link to="/register" search={{ redirect: search.redirect }} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <FormError error={error || kcError} />
      <KingsChatButton
        onSignedIn={() => void navigate({ href: safeRedirect(search.redirect), replace: true })}
        onError={setKcError}
      />
      <form onSubmit={handleSendLink} noValidate className="space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            className="mt-1.5"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            invalid={!!error}
          />
          <p className="mt-1.5 text-xs text-muted">
            We will email you a secure magic link for 1-click passwordless sign in.
          </p>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send Magic Link
        </Button>
      </form>
    </AuthCard>
  );
}

export function RegisterPage() {
  const search = useSearch({ from: '/register' });
  const navigate = useNavigate();
  const [email, setEmail] = useState(search.email ?? '');
  const [name, setName] = useState('');
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kcError, setKcError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/auth/callback${search.redirect ? `?redirect=${encodeURIComponent(search.redirect)}` : ''}`;
      await authService.sendMagicLink(trimmed, callbackUrl);
      setSentEmail(trimmed);
    } catch (err: any) {
      setError(errorMessage(err) || 'Failed to send magic link.');
    } finally {
      setLoading(false);
    }
  };

  if (sentEmail) {
    return (
      <AuthCard
        title="Check your email"
        subtitle={<>We sent a magic sign-up link to <strong className="text-foreground">{sentEmail}</strong>.</>}
        footer={
          <div className="text-center">
            <Link to="/login" className="text-sm font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-8" />
          </div>
          <p className="mt-4 text-sm text-muted">
            Click the link in the email to activate your account and start using QubDocs.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Passwordless access to Drive, Docs, Sheets, and Forms"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" search={{ redirect: search.redirect }} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <FormError error={error || kcError} />
      <KingsChatButton
        onSignedIn={() => void navigate({ href: safeRedirect(search.redirect), replace: true })}
        onError={setKcError}
      />
      <form onSubmit={handleRegister} noValidate className="space-y-5">
        <div>
          <Label htmlFor="name">Full name (optional)</Label>
          <Input
            id="name"
            autoComplete="name"
            className="mt-1.5"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="mt-1.5"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            invalid={!!error}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account with Magic Link
        </Button>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  return (
    <AuthCard
      title="Passwordless Sign In"
      subtitle="QubDocs uses secure magic links instead of passwords."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <p className="text-sm text-muted">
        You do not need a password to access your account! Simply enter your email address on the sign-in page, and we will send you a 1-click magic link.
      </p>
      <div className="mt-6">
        <Button className="w-full" size="lg" onClick={() => void navigate({ to: '/login' })}>
          Go to Sign In
        </Button>
      </div>
    </AuthCard>
  );
}

const resetFormSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: 'Passwords must match', path: ['confirm'] });

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
