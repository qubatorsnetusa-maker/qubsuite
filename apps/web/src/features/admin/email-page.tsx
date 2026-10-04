import type { EmailProvider, EmailSettingsDto, EmailSettingsInput } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Mail, Send, Server, XCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { ApiError, errorMessage } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';
import { adminService } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { Card, PageHeader } from './admin-ui';
import { SaveBar } from './policies-page';

type Draft = Record<string, string | number> & { provider: EmailProvider };

const PROVIDERS: { id: EmailProvider; name: string; description: string }[] = [
  { id: 'environment', name: 'Server default', description: 'Use the transport configured in the server’s .env file' },
  { id: 'smtp', name: 'SMTP server', description: 'Gmail, Microsoft 365, Zoho, Amazon SES, Brevo or your own mail server' },
  { id: 'resend', name: 'Resend', description: 'Send through the Resend API with an API key' },
  { id: 'sendgrid', name: 'SendGrid', description: 'Twilio SendGrid Mail Send API' },
  { id: 'mailgun', name: 'Mailgun', description: 'Mailgun Messages API, US or EU region' },
  { id: 'postmark', name: 'Postmark', description: 'Postmark server token and message stream' },
];

const SMTP_PRESETS: { name: string; host: string; port: number; security: 'tls' | 'starttls'; hint: string }[] = [
  { name: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 465, security: 'tls', hint: 'Use your full address as the username and an app password (requires 2-Step Verification).' },
  { name: 'Microsoft 365', host: 'smtp.office365.com', port: 587, security: 'starttls', hint: 'SMTP AUTH must be enabled for the mailbox in the Microsoft 365 admin center.' },
  { name: 'Zoho Mail', host: 'smtp.zoho.com', port: 465, security: 'tls', hint: 'Use smtp.zoho.eu or smtp.zoho.in for accounts in those regions.' },
  { name: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: 587, security: 'starttls', hint: 'Change the region in the host to match yours, and use SES SMTP credentials (not IAM keys).' },
  { name: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, security: 'starttls', hint: 'Use the SMTP login and key from Brevo’s SMTP & API settings.' },
];

const SECRET_LABEL: Partial<Record<EmailProvider, string>> = { smtp: 'Password', resend: 'API key', sendgrid: 'API key', mailgun: 'API key', postmark: 'Server API token' };
const secretField = (p: EmailProvider) => (p === 'smtp' ? 'password' : 'apiKey');

/** Fields a provider needs, with their starting values when switching to it. */
function defaultsFor(p: EmailProvider): Record<string, string | number> {
  switch (p) {
    case 'smtp':
      return { host: '', port: 587, security: 'starttls', username: '', password: '' };
    case 'mailgun':
      return { domain: '', region: 'us', apiKey: '' };
    case 'postmark':
      return { messageStream: 'outbound', apiKey: '' };
    case 'resend':
    case 'sendgrid':
      return { apiKey: '' };
    default:
      return {};
  }
}

function toDraft(dto: EmailSettingsDto): Draft {
  const s = dto.settings;
  if (s.provider === 'environment') return { provider: 'environment' };
  return { ...defaultsFor(s.provider), fromName: '', fromEmail: '', replyTo: '', ...(s as Record<string, string | number>), provider: s.provider };
}

function toInput(d: Draft): EmailSettingsInput {
  if (d.provider === 'environment') return { provider: 'environment' };
  const out: Record<string, unknown> = {};
  const keys = ['provider', 'fromName', 'fromEmail', 'replyTo', ...Object.keys(defaultsFor(d.provider))];
  for (const k of keys) out[k] = k === 'port' ? Number(d[k]) : d[k];
  return out as EmailSettingsInput;
}

function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AdminEmailPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.admin.email, queryFn: adminService.email });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [testTo, setTestTo] = useState(me.email);
  const [preset, setPreset] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) setDraft(toDraft(q.data));
  }, [q.data]);

  const save = useMutation({
    mutationFn: (d: Draft) => adminService.saveEmail(toInput(d)),
    meta: { silent: true },
    onSuccess: (dto) => {
      qc.setQueryData(qk.admin.email, dto);
      void qc.invalidateQueries({ queryKey: qk.admin.audit({}).slice(0, 2) });
      toast.success(dto.settings.provider === 'environment' ? 'Qub now sends email with the server default.' : 'Email settings saved. All Qub email now goes through this provider.');
    },
  });
  const test = useMutation({
    mutationFn: () => adminService.testEmail(testTo.trim(), dirty && draft ? toInput(draft) : undefined),
    meta: { silent: true },
    onSuccess: () => {
      toast.success(`Test email sent to ${testTo.trim()}`);
      void qc.invalidateQueries({ queryKey: qk.admin.email });
    },
    onError: () => void qc.invalidateQueries({ queryKey: qk.admin.email }),
  });

  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const dto = q.data;
  const dirty = !!draft && !!dto && JSON.stringify(toInput(draft)) !== JSON.stringify(toInput(toDraft(dto)));
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const err = (k: string) => fieldErrors[k];
  const set = (patch: Record<string, string | number>) => setDraft((d) => (d ? ({ ...d, ...patch } as Draft) : d));
  const switchTo = (p: EmailProvider) =>
    setDraft((d) => {
      if (!d || d.provider === p) return d;
      const sender = { fromName: String(d.fromName ?? dto?.environment.from.replace(/\s*<.*$/, '') ?? 'Qub'), fromEmail: String(d.fromEmail ?? ''), replyTo: String(d.replyTo ?? '') };
      // Returning to the saved provider restores its saved settings.
      if (dto && dto.settings.provider === p) return toDraft(dto);
      return p === 'environment' ? { provider: p } : ({ provider: p, ...sender, ...defaultsFor(p) } as Draft);
    });
  const active = PROVIDERS.find((p) => p.id === dto?.settings.provider);
  const savedSecret = !!dto && dto.hasSecret && draft?.provider === dto.settings.provider;
  const sp = draft && draft.provider !== 'environment' ? draft.provider : null;
  const presetHint = SMTP_PRESETS.find((p) => p.name === preset)?.hint;

  return (
    <>
      <PageHeader
        eyebrow="Organization"
        title="Email delivery"
        description="Choose how Qub sends email for the whole organization: account setup and password links, email verification, sharing invitations, and notifications from Docs, Sheets and Forms."
        actions={
          dto && (
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              <Mail className="size-4" /> Sending with {active?.name ?? dto.settings.provider}
            </span>
          )
        }
      />
      {!draft || !dto ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <>
          <Card title="Provider" description="Every email Qub sends uses the provider selected here.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Email provider">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={draft.provider === p.id}
                  onClick={() => switchTo(p.id)}
                  className={cn('flex items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors', draft.provider === p.id ? 'border-primary bg-[#e8f0fe]' : 'border-border hover:bg-surface')}
                >
                  <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2', draft.provider === p.id ? 'border-primary' : 'border-border-strong')}>
                    {draft.provider === p.id && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium">
                      {p.name}
                      {dto.settings.provider === p.id && <span className="rounded-full bg-[#e6f4ea] px-1.5 text-[10px] font-semibold text-success">In use</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{p.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {draft.provider === 'environment' ? (
            <Card title="Server default" icon={<Server />} description="Configured by whoever runs the server, with MAIL_TRANSPORT and SMTP_* in .env.">
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted">Transport</dt>
                  <dd className="mt-0.5 font-medium">{dto.environment.transport === 'smtp' ? `SMTP (${dto.environment.host ?? 'no host'})` : 'Console — emails are written to the server log, not sent'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">From</dt>
                  <dd className="mt-0.5 font-medium">{dto.environment.from}</dd>
                </div>
              </dl>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Connection" icon={<KeyRound />} description={sp === 'smtp' ? 'Your mail server’s SMTP settings.' : `Credentials from your ${PROVIDERS.find((p) => p.id === sp)?.name} account.`}>
                <div className="space-y-4">
                  {sp === 'smtp' && (
                    <>
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-muted">Fill in for</p>
                        <div className="flex flex-wrap gap-1.5">
                          {SMTP_PRESETS.map((p) => (
                            <button
                              key={p.name}
                              onClick={() => {
                                setPreset(p.name);
                                set({ host: p.host, port: p.port, security: p.security });
                              }}
                              className={cn('rounded-full border px-2.5 py-1 text-xs', preset === p.name ? 'border-primary bg-primary-soft font-medium text-primary' : 'border-border hover:bg-hover')}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                        {presetHint && <p className="mt-2 rounded-lg bg-surface p-2 text-xs text-muted">{presetHint}</p>}
                      </div>
                      <div className="grid grid-cols-[1fr_96px] gap-3">
                        <Field label="Host" htmlFor="smtp-host" error={err('host')}>
                          <Input id="smtp-host" value={String(draft.host)} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.example.com" invalid={!!err('host')} />
                        </Field>
                        <Field label="Port" htmlFor="smtp-port" error={err('port')}>
                          <Input id="smtp-port" type="number" min={1} max={65535} value={String(draft.port)} onChange={(e) => set({ port: Number(e.target.value) })} />
                        </Field>
                      </div>
                      <Field label="Encryption" htmlFor="smtp-security" hint="TLS is usually port 465; STARTTLS is usually 587.">
                        <NativeSelect id="smtp-security" value={String(draft.security)} onChange={(e) => set({ security: e.target.value })} className="h-10 w-full">
                          <option value="tls">TLS (implicit)</option>
                          <option value="starttls">STARTTLS</option>
                          <option value="none">None (not recommended)</option>
                        </NativeSelect>
                      </Field>
                      <Field label="Username" htmlFor="smtp-user" hint="Leave blank if the server doesn’t require sign-in." error={err('username')}>
                        <Input id="smtp-user" value={String(draft.username)} onChange={(e) => set({ username: e.target.value })} autoComplete="off" />
                      </Field>
                    </>
                  )}
                  {sp === 'mailgun' && (
                    <div className="grid grid-cols-[1fr_120px] gap-3">
                      <Field label="Sending domain" htmlFor="mg-domain" error={err('domain')}>
                        <Input id="mg-domain" value={String(draft.domain)} onChange={(e) => set({ domain: e.target.value })} placeholder="mg.example.com" invalid={!!err('domain')} />
                      </Field>
                      <Field label="Region" htmlFor="mg-region">
                        <NativeSelect id="mg-region" value={String(draft.region)} onChange={(e) => set({ region: e.target.value })} className="h-10 w-full">
                          <option value="us">US</option>
                          <option value="eu">EU</option>
                        </NativeSelect>
                      </Field>
                    </div>
                  )}
                  {sp === 'postmark' && (
                    <Field label="Message stream" htmlFor="pm-stream" hint="Transactional streams are usually called “outbound”." error={err('messageStream')}>
                      <Input id="pm-stream" value={String(draft.messageStream)} onChange={(e) => set({ messageStream: e.target.value })} />
                    </Field>
                  )}
                  {sp && (
                    <Field
                      label={SECRET_LABEL[sp]!}
                      htmlFor="email-secret"
                      hint={savedSecret ? 'Saved and encrypted. Leave blank to keep it, or enter a new one to replace it.' : 'Stored encrypted. It is never shown again after saving.'}
                      error={err(secretField(sp))}
                    >
                      <Input
                        id="email-secret"
                        type="password"
                        autoComplete="new-password"
                        value={String(draft[secretField(sp)] ?? '')}
                        onChange={(e) => set({ [secretField(sp)]: e.target.value })}
                        placeholder={savedSecret ? '•••••••••••• (saved)' : ''}
                        invalid={!!err(secretField(sp))}
                      />
                    </Field>
                  )}
                </div>
              </Card>

              <Card title="Sender" icon={<Mail />} description="How messages appear in people’s inboxes. The address must be one your provider lets you send from.">
                <div className="space-y-4">
                  <Field label="From name" htmlFor="from-name" error={err('fromName')}>
                    <Input id="from-name" value={String(draft.fromName ?? '')} onChange={(e) => set({ fromName: e.target.value })} placeholder="Qub" invalid={!!err('fromName')} />
                  </Field>
                  <Field label="From address" htmlFor="from-email" error={err('fromEmail')}>
                    <Input id="from-email" type="email" value={String(draft.fromEmail ?? '')} onChange={(e) => set({ fromEmail: e.target.value })} placeholder="no-reply@example.com" invalid={!!err('fromEmail')} />
                  </Field>
                  <Field label="Reply-to (optional)" htmlFor="reply-to" hint="Where replies go, if not the From address." error={err('replyTo')}>
                    <Input id="reply-to" type="email" value={String(draft.replyTo ?? '')} onChange={(e) => set({ replyTo: e.target.value })} placeholder="support@example.com" />
                  </Field>
                  <div className="rounded-xl bg-surface p-3 text-xs text-muted">
                    Preview: <span className="font-medium text-foreground">{String(draft.fromName || 'Qub')}</span> &lt;{String(draft.fromEmail || 'address@example.com')}&gt;
                  </div>
                </div>
              </Card>
            </div>
          )}

          <Card title="Send a test email" icon={<Send />} description={dirty ? 'Tests the settings above before you save them.' : 'Checks the saved settings end to end.'}>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                test.mutate();
              }}
            >
              <div className="min-w-[240px] flex-1">
                <Label htmlFor="test-to">Send to</Label>
                <Input id="test-to" type="email" required value={testTo} onChange={(e) => setTestTo(e.target.value)} className="mt-1.5" />
              </div>
              <Button type="submit" variant="outline" loading={test.isPending}>
                <Send /> Send test
              </Button>
            </form>
            {test.error ? (
              <p className="mt-3 flex gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger" role="alert">
                <XCircle className="size-5 shrink-0" /> {errorMessage(test.error)}
              </p>
            ) : test.isSuccess ? (
              <p className="mt-3 flex gap-2 rounded-xl bg-[#e6f4ea] p-3 text-sm text-success">
                <CheckCircle2 className="size-5 shrink-0" /> Sent. Check {testTo.trim()}’s inbox (and spam folder).
              </p>
            ) : dto.lastTestAt ? (
              <p className={cn('mt-3 text-xs', dto.lastTestError ? 'text-danger' : 'text-muted')}>
                Last test {formatRelative(dto.lastTestAt)}: {dto.lastTestError ?? 'delivered to the provider successfully'}
              </p>
            ) : null}
          </Card>

          {dto.updatedAt && (
            <p className="text-xs text-muted">
              Last changed {formatRelative(dto.updatedAt)}
              {dto.updatedBy ? ` by ${dto.updatedBy.name}` : ''}.
            </p>
          )}
          <SaveBar dirty={dirty} saving={save.isPending} error={save.error} onSave={() => save.mutate(draft)} onReset={() => (setDraft(toDraft(dto)), save.reset())} />
        </>
      )}
    </>
  );
}
