import type { AuthResult, ChangePasswordInput, LoginInput, RegisterInput, SessionInfo } from '@qub/shared';
import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Env } from '../../config/env';
import type { Database, Executor } from '../../db';
import {
  driveFolders,
  emailVerifications,
  filePermissions,
  fileShares,
  folderPermissions,
  passwordResetTokens,
  refreshTokens,
  sessions,
  users,
  type UserRow,
} from '../../db/schema';
import { dummyPasswordHash, hashPassword, hmacToken, randomToken, verifyPassword } from '../../utils/crypto';
import { AppError, conflict, unauthenticated } from '../../utils/errors';
import type { AuditContext, AuditService } from '../activity/activity.service';
import type { PolicyService } from '../admin/policy.service';
import type { Mailer } from '../../services/mailer';
import { UserRepository } from '../users/user.repository';

export interface ClientContext extends AuditContext {
  userAgent?: string | null;
  ip?: string | null;
}

export interface IssuedSession extends AuthResult {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  sessionId: string;
}

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
/** Links an administrator sends: account setup lasts a week, admin-initiated resets a day. */
const SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_RESET_TTL_MS = 24 * 60 * 60 * 1000;
/** Parallel refreshes (e.g. two tabs) within this window are not treated as token theft. */
const REFRESH_REUSE_GRACE_MS = 30_000;

export class AuthService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly db: Database,
    private readonly env: Env,
    private readonly mailer: Mailer,
    private readonly audit: AuditService,
    private readonly policies: PolicyService,
  ) {}

  private hash(token: string): string {
    return hmacToken(token, this.env.JWT_REFRESH_SECRET);
  }

  async register(input: RegisterInput, ctx: ClientContext): Promise<IssuedSession | { requiresVerification: true; email: string }> {
    if (await UserRepository.findByEmail(this.db, input.email)) {
      throw conflict('An account with this email already exists.');
    }
    const passwordHash = await hashPassword(input.password);
    const verificationToken = randomToken();
    const user = await this.db.transaction(async (tx) => {
      const created = await this.provisionUser(tx, { email: input.email, name: input.name, passwordHash });
      await tx.insert(emailVerifications).values({
        userId: created.id,
        email: created.email,
        tokenHash: this.hash(verificationToken),
        expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
      });
      await this.audit.log({ ...ctx, actorId: created.id }, 'auth.register', { type: 'user', id: created.id }, {}, tx);
      return created;
    });
    await this.sendVerificationEmail(user, verificationToken);
    if (this.env.REQUIRE_EMAIL_VERIFICATION) return { requiresVerification: true, email: user.email };
    return this.issueSession(user, ctx);
  }

  /** A new account with its My Drive; invitations sent to the email before it existed become real permissions. */
  async provisionUser(tx: Executor, data: { email: string; name: string; passwordHash: string }): Promise<UserRow> {
    const created = await UserRepository.create(tx, data);
    await tx.insert(driveFolders).values({ ownerId: created.id, name: 'My Drive', isRoot: true });
    await this.acceptPendingShares(tx, created);
    return created;
  }

  /**
   * Emails a one-time link to choose a password: 'setup' for accounts an administrator created, 'reset' when an
   * administrator resets someone's password. The token is only ever sent to the account's own address.
   */
  async sendPasswordLink(user: UserRow, kind: 'setup' | 'reset', adminName: string): Promise<void> {
    const token = randomToken();
    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: this.hash(token),
      expiresAt: new Date(Date.now() + (kind === 'setup' ? SETUP_TTL_MS : ADMIN_RESET_TTL_MS)),
    });
    const link = `${this.env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    const org = (await this.policies.get()).organizationName;
    await this.mailer.send(
      kind === 'setup'
        ? {
            to: user.email,
            subject: `${adminName} created a ${org} account for you`,
            text: `Hi ${user.name},

${adminName} created an account for you on ${org} (Qub Drive, Docs, Sheets and Forms).

Choose your password to sign in. This link expires in 7 days.

${link}`,
          }
        : {
            to: user.email,
            subject: 'Set a new Qub password',
            text: `Hi ${user.name},

Your administrator (${adminName}) sent you a link to set a new password. It expires in 24 hours.

${link}`,
          },
    );
  }

  /** Invitations sent to this email before the account existed become real permissions. */
  private async acceptPendingShares(tx: Executor, user: UserRow): Promise<void> {
    const pending = await tx
      .select()
      .from(fileShares)
      .where(and(eq(fileShares.email, user.email), isNull(fileShares.acceptedAt)));
    for (const share of pending) {
      const grant = {
        userId: user.id,
        role: share.role,
        canShare: share.canShare,
        canDownload: share.canDownload,
        canCopy: share.canCopy,
        grantedBy: share.invitedBy,
      };
      if (share.fileId) await tx.insert(filePermissions).values({ ...grant, fileId: share.fileId }).onConflictDoNothing();
      if (share.folderId) await tx.insert(folderPermissions).values({ ...grant, folderId: share.folderId }).onConflictDoNothing();
      await tx.update(fileShares).set({ acceptedAt: new Date() }).where(eq(fileShares.id, share.id));
    }
  }

  async login(input: LoginInput, ctx: ClientContext): Promise<IssuedSession> {
    const user = await UserRepository.findByEmail(this.db, input.email);
    // Always run a hash verification so response time doesn't reveal whether the account exists.
    const ok = await verifyPassword(user?.passwordHash ?? (await dummyPasswordHash()), input.password);
    if (!user || !ok) {
      await this.audit.log({ ...ctx, actorId: user?.id ?? null }, 'auth.login_failed', null, { email: input.email });
      throw new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.');
    }
    if (user.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'This account is not active.');
    if (this.env.REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) {
      throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address before signing in.');
    }
    await UserRepository.update(this.db, user.id, { lastLoginAt: new Date() });
    await this.audit.log({ ...ctx, actorId: user.id }, 'auth.login', { type: 'user', id: user.id });
    return this.issueSession({ ...user, lastLoginAt: new Date() }, ctx);
  }

  private signAccessToken(userId: string, sessionId: string): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + this.env.ACCESS_TOKEN_TTL_SECONDS * 1000);
    const token = this.app.jwt.sign({ sub: userId, sid: sessionId, typ: 'access' }, { expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS });
    return { token, expiresAt };
  }

  private async issueSession(user: UserRow, ctx: ClientContext): Promise<IssuedSession> {
    const refreshToken = randomToken(48);
    const refreshTokenExpiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    const session = await this.db.transaction(async (tx) => {
      const [s] = await tx
        .insert(sessions)
        .values({
          userId: user.id,
          userAgent: ctx.userAgent?.slice(0, 500) ?? null,
          ipAddress: ctx.ip ?? null,
          expiresAt: refreshTokenExpiresAt,
        })
        .returning();
      await tx.insert(refreshTokens).values({ sessionId: s!.id, tokenHash: this.hash(refreshToken), expiresAt: refreshTokenExpiresAt });
      return s!;
    });
    const access = this.signAccessToken(user.id, session.id);
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      user: await UserRepository.toCurrentUser(this.db, user),
      refreshToken,
      refreshTokenExpiresAt,
      sessionId: session.id,
    };
  }

  /** Rotates the refresh token. Reuse of an already-rotated token revokes the whole session. */
  async refresh(presented: string, ctx: ClientContext): Promise<IssuedSession> {
    const tokenHash = this.hash(presented);
    const [row] = await this.db
      .select({ token: refreshTokens, session: sessions })
      .from(refreshTokens)
      .innerJoin(sessions, eq(sessions.id, refreshTokens.sessionId))
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    if (!row) throw unauthenticated('Session expired. Please sign in again.');
    const { token, session } = row;
    const now = Date.now();

    if (token.usedAt || token.revokedAt) {
      if (token.usedAt && !token.revokedAt && now - token.usedAt.getTime() < REFRESH_REUSE_GRACE_MS && !session.revokedAt) {
        throw new AppError('CONFLICT', 'Session refresh already in progress. Retry shortly.');
      }
      await this.revokeSession(session.id, 'refresh_token_reuse');
      await this.audit.log({ ...ctx, actorId: session.userId }, 'auth.refresh_token_reuse', { type: 'session', id: session.id });
      throw unauthenticated('Session expired. Please sign in again.');
    }
    if (session.revokedAt || session.expiresAt.getTime() < now || token.expiresAt.getTime() < now) {
      throw unauthenticated('Session expired. Please sign in again.');
    }
    const maxHours = (await this.policies.get()).security.sessionMaxHours;
    if (maxHours != null && session.createdAt.getTime() + maxHours * 3_600_000 < now) {
      await this.revokeSession(session.id, 'max_age');
      throw unauthenticated('Your session has expired. Sign in again.');
    }
    const user = await UserRepository.findById(this.db, session.userId);
    if (!user || user.status !== 'ACTIVE') throw unauthenticated();

    const nextToken = randomToken(48);
    await this.db.transaction(async (tx) => {
      // Conditional update: only one concurrent request can consume the token.
      const consumed = await tx
        .update(refreshTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(refreshTokens.id, token.id), isNull(refreshTokens.usedAt)))
        .returning({ id: refreshTokens.id });
      if (!consumed.length) throw new AppError('CONFLICT', 'Session refresh already in progress. Retry shortly.');
      const [created] = await tx
        .insert(refreshTokens)
        .values({ sessionId: session.id, tokenHash: this.hash(nextToken), expiresAt: session.expiresAt })
        .returning({ id: refreshTokens.id });
      await tx.update(refreshTokens).set({ replacedById: created!.id }).where(eq(refreshTokens.id, token.id));
      await tx
        .update(sessions)
        .set({ lastUsedAt: new Date(), ipAddress: ctx.ip ?? session.ipAddress, userAgent: ctx.userAgent?.slice(0, 500) ?? session.userAgent })
        .where(eq(sessions.id, session.id));
    });
    const access = this.signAccessToken(user.id, session.id);
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      user: await UserRepository.toCurrentUser(this.db, user),
      refreshToken: nextToken,
      refreshTokenExpiresAt: session.expiresAt,
      sessionId: session.id,
    };
  }

  async logout(presented: string | undefined, sessionId: string | undefined, ctx: ClientContext): Promise<void> {
    let sid = sessionId;
    if (!sid && presented) {
      const [row] = await this.db
        .select({ sessionId: refreshTokens.sessionId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, this.hash(presented)))
        .limit(1);
      sid = row?.sessionId;
    }
    if (sid) {
      await this.revokeSession(sid, 'logout');
      await this.audit.log(ctx, 'auth.logout', { type: 'session', id: sid });
    }
  }

  async revokeSession(sessionId: string, reason: string, tx: Executor = this.db): Promise<void> {
    await tx.update(sessions).set({ revokedAt: new Date(), revokeReason: reason }).where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.sessionId, sessionId), isNull(refreshTokens.revokedAt)));
  }

  async revokeAllSessions(userId: string, reason: string, exceptSessionId?: string, tx: Executor = this.db): Promise<void> {
    const active = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined));
    for (const s of active) await this.revokeSession(s.id, reason, tx);
  }

  async listSessions(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastUsedAt));
    return rows.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  async revokeOwnSession(userId: string, sessionId: string, ctx: ClientContext): Promise<void> {
    const [s] = await this.db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).limit(1);
    if (!s) throw new AppError('RESOURCE_NOT_FOUND', 'Session not found.');
    await this.revokeSession(sessionId, 'user_revoked');
    await this.audit.log(ctx, 'auth.session_revoked', { type: 'session', id: sessionId });
  }

  async forgotPassword(email: string, ctx: ClientContext): Promise<void> {
    const user = await UserRepository.findByEmail(this.db, email);
    // Same response whether or not the account exists (no user enumeration).
    if (!user || user.status !== 'ACTIVE') return;
    const token = randomToken();
    await this.db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: this.hash(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
    await this.audit.log({ ...ctx, actorId: user.id }, 'auth.password_reset_requested', { type: 'user', id: user.id });
    const link = `${this.env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mailer.send({
      to: user.email,
      subject: 'Reset your Qub password',
      text: `Hi ${user.name},\n\nUse this link to reset your password. It expires in 1 hour.\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    });
  }

  async resetPassword(token: string, password: string, ctx: ClientContext): Promise<void> {
    const [row] = await this.db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, this.hash(token))).limit(1);
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new AppError('BAD_REQUEST', 'This reset link is invalid or has expired.');
    }
    const passwordHash = await hashPassword(password);
    await this.db.transaction(async (tx) => {
      const used = await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
        .returning({ id: passwordResetTokens.id });
      if (!used.length) throw new AppError('BAD_REQUEST', 'This reset link is invalid or has expired.');
      // Using a link sent to the address proves the person controls it.
      await tx.update(users).set({ passwordHash, emailVerified: true, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` }).where(eq(users.id, row.userId));
      // Invalidate every other outstanding reset token and every session.
      await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.userId, row.userId), isNull(passwordResetTokens.usedAt)));
      await this.revokeAllSessions(row.userId, 'password_reset', undefined, tx);
      await this.audit.log({ ...ctx, actorId: row.userId }, 'auth.password_reset', { type: 'user', id: row.userId }, {}, tx);
    });
  }

  async verifyEmail(token: string, ctx: ClientContext): Promise<void> {
    const [row] = await this.db.select().from(emailVerifications).where(eq(emailVerifications.tokenHash, this.hash(token))).limit(1);
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new AppError('BAD_REQUEST', 'This verification link is invalid or has expired.');
    }
    await this.db.transaction(async (tx) => {
      await tx.update(emailVerifications).set({ usedAt: new Date() }).where(eq(emailVerifications.id, row.id));
      await tx
        .update(users)
        .set({ emailVerified: true, emailVerifiedAt: new Date() })
        .where(and(eq(users.id, row.userId), eq(users.email, row.email)));
      await this.audit.log({ ...ctx, actorId: row.userId }, 'auth.email_verified', { type: 'user', id: row.userId }, {}, tx);
    });
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await UserRepository.findById(this.db, userId);
    if (!user || user.emailVerified) return;
    // Limit to one outstanding email every minute.
    const [recent] = await this.db
      .select({ id: emailVerifications.id })
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), gt(emailVerifications.createdAt, sql`now() - interval '1 minute'`)))
      .limit(1);
    if (recent) throw new AppError('RATE_LIMITED', 'Please wait a minute before requesting another email.');
    const token = randomToken();
    await this.db.insert(emailVerifications).values({ userId, email: user.email, tokenHash: this.hash(token), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) });
    await this.sendVerificationEmail(user, token);
  }

  private async sendVerificationEmail(user: UserRow, token: string): Promise<void> {
    const link = `${this.env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await this.mailer.send({
      to: user.email,
      subject: 'Verify your Qub email address',
      text: `Welcome to Qub, ${user.name}!\n\nConfirm your email address:\n\n${link}\n\nThis link expires in 24 hours.`,
    });
  }

  async changePassword(userId: string, sessionId: string, input: ChangePasswordInput, ctx: ClientContext): Promise<void> {
    const user = await UserRepository.findById(this.db, userId);
    if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppError('VALIDATION_ERROR', 'Current password is incorrect.', { fieldErrors: { currentPassword: ['Current password is incorrect.'] } });
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
      await this.revokeAllSessions(userId, 'password_changed', sessionId, tx);
      await this.audit.log({ ...ctx, actorId: userId }, 'auth.password_changed', { type: 'user', id: userId }, {}, tx);
    });
  }
}
