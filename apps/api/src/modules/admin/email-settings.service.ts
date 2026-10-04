import { emailSettingsSchema, type EmailSettings, type EmailSettingsDto, type EmailSettingsInput } from '@qub/shared';
import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env';
import type { Database } from '../../db';
import { emailSettings } from '../../db/schema';
import type { MailMessage, Mailer } from '../../services/mailer';
import { deriveKey, openSecret, sealSecret } from '../../utils/crypto';
import { badRequest, unprocessable } from '../../utils/errors';
import type { AuditContext, AuditService } from '../activity/activity.service';
import { UserRepository } from '../users/user.repository';

const ROW_ID = 'org';
const CACHE_MS = 30_000;
const SEND_TIMEOUT_MS = 15_000;

type ProviderSettings = Exclude<EmailSettings, { provider: 'environment' }>;
/** Saved settings with the secret decrypted, ready to send with. */
type Active = { provider: 'environment' } | (ProviderSettings & { secret: string | null });

const SECRET_FIELD = { smtp: 'password', resend: 'apiKey', sendgrid: 'apiKey', mailgun: 'apiKey', postmark: 'apiKey' } as const;

class DeliveryError extends Error {}

/** Settings without the write-only secret field. */
function publicSettings(s: EmailSettings): EmailSettingsDto['settings'] {
  if (s.provider === 'environment') return { provider: 'environment' };
  const { [SECRET_FIELD[s.provider]]: _secret, ...rest } = s as Record<string, unknown>;
  return rest as EmailSettingsDto['settings'];
}

function quoteName(name: string): string {
  return `"${name.replace(/["\\]/g, '\\$&')}"`;
}

/** Best-effort message from a provider's JSON or text error body. */
async function providerError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  let detail = text;
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const errors = body.errors as { message?: string }[] | undefined;
    detail = String(body.message ?? body.Message ?? errors?.[0]?.message ?? body.error ?? text);
  } catch {
    // not JSON
  }
  const reason = res.status === 401 || res.status === 403 ? 'The API key was rejected' : `The provider returned ${res.status}`;
  return `${reason}${detail ? `: ${detail.slice(0, 300)}` : ''}`;
}

/**
 * Organization-wide email delivery. Implements the app's Mailer: every message (invites, password links, sharing
 * and comment notifications, form receipts) goes through the provider an admin chose, or the server's .env
 * transport ("Server default") until one is configured.
 */
export class EmailSettingsService implements Mailer {
  private cache: { value: Active; at: number } | null = null;
  private smtp: { key: string; transport: Transporter } | null = null;
  private readonly key: Buffer;

  constructor(
    private readonly db: Database,
    private readonly env: Env,
    private readonly fallback: Mailer,
    private readonly audit: AuditService,
    private readonly log: FastifyBaseLogger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.key = deriveKey(env.SETTINGS_ENCRYPTION_KEY ?? env.JWT_SECRET, 'settings-secrets');
  }

  // ---------- Mailer ----------

  async send(message: MailMessage): Promise<void> {
    let active: Active;
    try {
      active = await this.active();
    } catch (err) {
      this.log.error({ err }, 'Email settings unreadable; using the server default transport');
      return this.fallback.send(message);
    }
    if (active.provider === 'environment') return this.fallback.send(message);
    try {
      await this.deliver(active, message);
    } catch (err) {
      // Mail failures must not break the user-facing request; they are logged for follow-up.
      this.log.error({ err, provider: active.provider, to: message.to, subject: message.subject }, 'Failed to send email');
    }
  }

  // ---------- admin ----------

  async get(): Promise<EmailSettingsDto> {
    const [row] = await this.db.select().from(emailSettings).where(eq(emailSettings.id, ROW_ID)).limit(1);
    const parsed = row ? emailSettingsSchema.safeParse({ provider: row.provider, ...row.config }) : null;
    const settings = parsed?.success ? parsed.data : ({ provider: 'environment' } as const);
    const updatedBy = row?.updatedBy ? ((await UserRepository.summaries(this.db, [row.updatedBy])).get(row.updatedBy) ?? null) : null;
    return {
      settings: publicSettings(settings),
      hasSecret: !!row?.secrets,
      environment: { transport: this.env.MAIL_TRANSPORT, from: this.env.MAIL_FROM, host: this.env.MAIL_TRANSPORT === 'smtp' ? (this.env.SMTP_HOST ?? null) : null },
      lastTestAt: row?.lastTestAt?.toISOString() ?? null,
      lastTestError: row?.lastTestError ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy,
    };
  }

  async update(raw: EmailSettingsInput, ctx: AuditContext): Promise<EmailSettingsDto> {
    const next = emailSettingsSchema.parse(raw);
    const secret = await this.resolveSecret(next);
    const { provider, ...rest } = publicSettings(next);
    await this.db
      .insert(emailSettings)
      .values({ id: ROW_ID, provider, config: rest, secrets: secret ? sealSecret(secret, this.key) : null, updatedBy: ctx.actorId, lastTestAt: null, lastTestError: null })
      .onConflictDoUpdate({
        target: emailSettings.id,
        set: { provider, config: rest, secrets: secret ? sealSecret(secret, this.key) : null, updatedBy: ctx.actorId, updatedAt: new Date(), lastTestAt: null, lastTestError: null },
      });
    this.invalidate();
    const secretChanged = next.provider !== 'environment' && !!(next as Record<string, unknown>)[SECRET_FIELD[next.provider]];
    await this.audit.log(ctx, 'admin.email_settings_updated', { type: 'org', id: ROW_ID }, { provider, fromEmail: 'fromEmail' in next ? next.fromEmail : null, secretChanged });
    return this.get();
  }

  /**
   * Sends a test message and reports failures to the admin (unlike normal sends, which only log). Without a draft
   * it tests the saved settings and records the result.
   */
  async test(to: string, draftRaw: EmailSettingsInput | undefined, ctx: AuditContext): Promise<{ provider: string }> {
    let settings: Active;
    try {
      settings = draftRaw ? await this.withSecret(emailSettingsSchema.parse(draftRaw)) : await this.active(true);
    } catch (err) {
      if (err instanceof DeliveryError) throw badRequest(err.message);
      throw err;
    }
    const message: MailMessage = {
      to,
      subject: 'Qub test email',
      text: `This is a test message from Qub.\n\nIf you can read it, email delivery through ${settings.provider === 'environment' ? 'the server default transport' : settings.provider} works.`,
    };
    let error: string | null = null;
    try {
      if (settings.provider === 'environment') await this.fallback.send(message);
      else await this.deliver(settings, message);
    } catch (err) {
      error = err instanceof DeliveryError ? err.message : `Couldn't send: ${(err as Error).message}`.slice(0, 500);
    }
    if (!draftRaw) await this.db.update(emailSettings).set({ lastTestAt: new Date(), lastTestError: error }).where(eq(emailSettings.id, ROW_ID));
    await this.audit.log(ctx, 'admin.email_test_sent', { type: 'org', id: ROW_ID }, { provider: settings.provider, to, ok: !error });
    if (error) throw badRequest(error);
    return { provider: settings.provider };
  }

  invalidate(): void {
    this.cache = null;
    this.smtp?.transport.close();
    this.smtp = null;
  }

  // ---------- internals ----------

  /** The secret to store: the one entered, else the saved one if the provider is unchanged. */
  private async resolveSecret(next: EmailSettings): Promise<string | null> {
    if (next.provider === 'environment') return null;
    const entered = (next as Record<string, unknown>)[SECRET_FIELD[next.provider]] as string | undefined;
    if (entered) return entered;
    const saved = await this.active(true).catch(() => null);
    if (saved && saved.provider === next.provider && saved.secret) return saved.secret;
    // SMTP servers without authentication are allowed.
    if (next.provider === 'smtp' && !next.username) return null;
    throw unprocessable(next.provider === 'smtp' ? 'Enter the SMTP password.' : 'Enter the API key.', { path: SECRET_FIELD[next.provider] });
  }

  private async withSecret(s: EmailSettings): Promise<Active> {
    if (s.provider === 'environment') return s;
    return { ...s, secret: await this.resolveSecret(s) };
  }

  private async active(fresh = false): Promise<Active> {
    if (!fresh && this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const [row] = await this.db.select().from(emailSettings).where(eq(emailSettings.id, ROW_ID)).limit(1);
    let value: Active = { provider: 'environment' };
    if (row && row.provider !== 'environment') {
      const parsed = emailSettingsSchema.safeParse({ provider: row.provider, ...row.config });
      if (!parsed.success || parsed.data.provider === 'environment') throw new Error('Stored email settings are invalid');
      let secret: string | null = null;
      if (row.secrets) {
        try {
          secret = openSecret(row.secrets, this.key);
        } catch {
          throw new DeliveryError("The saved password or API key can't be decrypted (the server's encryption key changed). Enter it again and save.");
        }
      }
      value = { ...parsed.data, secret };
    }
    this.cache = { value, at: Date.now() };
    return value;
  }

  private async deliver(s: Exclude<Active, { provider: 'environment' }>, m: MailMessage): Promise<void> {
    const from = `${quoteName(s.fromName)} <${s.fromEmail}>`;
    const signal = AbortSignal.timeout(SEND_TIMEOUT_MS);
    const post = async (url: string, init: RequestInit) => {
      let res: Response;
      try {
        res = await this.fetchImpl(url, { method: 'POST', signal, ...init });
      } catch (err) {
        throw new DeliveryError(`Couldn't reach ${new URL(url).host}: ${(err as Error).message}`);
      }
      if (!res.ok) throw new DeliveryError(await providerError(res));
    };
    const json = (headers: Record<string, string>, body: unknown): RequestInit => ({ headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers }, body: JSON.stringify(body) });

    switch (s.provider) {
      case 'smtp': {
        const key = JSON.stringify([s.host, s.port, s.security, s.username, s.secret]);
        if (this.smtp?.key !== key) {
          this.smtp?.transport.close();
          this.smtp = {
            key,
            transport: nodemailer.createTransport({
              host: s.host,
              port: s.port,
              secure: s.security === 'tls',
              requireTLS: s.security === 'starttls',
              ignoreTLS: s.security === 'none',
              auth: s.username ? { user: s.username, pass: s.secret ?? '' } : undefined,
              connectionTimeout: SEND_TIMEOUT_MS,
              greetingTimeout: SEND_TIMEOUT_MS,
              socketTimeout: SEND_TIMEOUT_MS * 2,
            }),
          };
        }
        try {
          await this.smtp.transport.sendMail({ from, replyTo: s.replyTo ?? undefined, to: m.to, subject: m.subject, text: m.text, html: m.html });
        } catch (err) {
          const e = err as { code?: string; responseCode?: number; message: string };
          const hint = e.code === 'EAUTH' ? 'The SMTP server rejected the username or password' : e.code === 'ESOCKET' || e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT' ? `Couldn't connect to ${s.host}:${s.port}` : 'The SMTP server refused the message';
          throw new DeliveryError(`${hint}: ${e.message}`.slice(0, 500));
        }
        return;
      }
      case 'resend':
        return post('https://api.resend.com/emails', json({ Authorization: `Bearer ${s.secret}` }, { from, to: [m.to], subject: m.subject, text: m.text, html: m.html, reply_to: s.replyTo ?? undefined }));
      case 'sendgrid':
        return post(
          'https://api.sendgrid.com/v3/mail/send',
          json(
            { Authorization: `Bearer ${s.secret}` },
            {
              personalizations: [{ to: [{ email: m.to }] }],
              from: { email: s.fromEmail, name: s.fromName },
              ...(s.replyTo ? { reply_to: { email: s.replyTo } } : {}),
              subject: m.subject,
              content: [{ type: 'text/plain', value: m.text }, ...(m.html ? [{ type: 'text/html', value: m.html }] : [])],
            },
          ),
        );
      case 'mailgun': {
        const form = new URLSearchParams({ from, to: m.to, subject: m.subject, text: m.text });
        if (m.html) form.set('html', m.html);
        if (s.replyTo) form.set('h:Reply-To', s.replyTo);
        const host = s.region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
        return post(`https://${host}/v3/${encodeURIComponent(s.domain)}/messages`, {
          headers: { Authorization: `Basic ${Buffer.from(`api:${s.secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
      }
      case 'postmark':
        return post(
          'https://api.postmarkapp.com/email',
          json({ 'X-Postmark-Server-Token': s.secret ?? '' }, { From: from, To: m.to, Subject: m.subject, TextBody: m.text, HtmlBody: m.html, ReplyTo: s.replyTo ?? undefined, MessageStream: s.messageStream }),
        );
    }
  }
}
