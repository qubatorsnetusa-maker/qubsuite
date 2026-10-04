import type { FastifyBaseLogger } from 'fastify';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** SMTP delivery for staging/production. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;
  constructor(
    private readonly env: Env,
    private readonly log: FastifyBaseLogger,
  ) {
    this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  async send(message: MailMessage): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.env.MAIL_FROM, ...message });
    } catch (err) {
      // Mail failures must not break the user-facing request; they are logged for follow-up.
      this.log.error({ err, to: message.to, subject: message.subject }, 'Failed to send email');
    }
  }
}

/**
 * Development transport: writes the message (including action links) to the server log.
 * Env validation refuses this transport in staging/production.
 */
export class ConsoleMailer implements Mailer {
  constructor(private readonly log: FastifyBaseLogger) {}
  async send(message: MailMessage): Promise<void> {
    this.log.info({ mail: { to: message.to, subject: message.subject, text: message.text } }, 'Email (development transport)');
  }
}

/** Collects messages in memory; used by the test suite to read verification/reset links. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

export function createMailer(env: Env, log: FastifyBaseLogger): Mailer {
  return env.MAIL_TRANSPORT === 'smtp' ? new SmtpMailer(env, log) : new ConsoleMailer(log);
}
