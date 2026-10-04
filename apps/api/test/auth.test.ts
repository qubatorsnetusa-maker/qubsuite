import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLogs, users } from '../src/db/schema';
import { client, cookieFrom, createTestApp, data, registerUser, type TestContext } from './helpers';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

const refresh = (cookie: string) =>
  ctx.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: `qub_rt=${cookie}`, origin: 'http://localhost:5180' } });

describe('registration and login', () => {
  it('registers, creates My Drive, hashes the password and signs in', async () => {
    const user = await registerUser(ctx.app, 'Alice Register');
    const me = await client(ctx.app, user).get('/api/auth/me');
    expect(me.statusCode).toBe(200);
    expect(data(me)).toMatchObject({ id: user.id, email: user.email, rootFolderId: user.rootFolderId, emailVerified: false });

    const [row] = await ctx.db.db.select().from(users).where(eq(users.id, user.id));
    expect(row!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row!.passwordHash).not.toContain('correct-horse-1');

    const root = await client(ctx.app, user).get('/api/drive/root');
    expect(data(root)).toMatchObject({ id: user.rootFolderId, isRoot: true, name: 'My Drive' });
  });

  it('sets the refresh token as an httpOnly, SameSite=Strict cookie scoped to /api/auth', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `cookie.${Date.now()}@example.com`, name: 'Cookie', password: 'abcdefg1' } });
    const header = ([] as string[]).concat(res.headers['set-cookie'] as string[]).find((c) => c.startsWith('qub_rt='))!;
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Strict/i);
    expect(header).toMatch(/Path=\/api\/auth/);
    expect(res.json().data).not.toHaveProperty('refreshToken');
  });

  it('rejects invalid input with 422 and duplicate emails with 409', async () => {
    const bad = await ctx.app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'not-an-email', name: '', password: 'short' } });
    expect(bad.statusCode).toBe(422);
    expect(bad.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });

    const user = await registerUser(ctx.app, 'Dup');
    const dup = await ctx.app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: user.email.toUpperCase(), name: 'Dup', password: 'abcdefg1' } });
    expect(dup.statusCode).toBe(409);
  });

  it('returns 401 for wrong passwords without revealing whether the account exists, and audits failures', async () => {
    const user = await registerUser(ctx.app, 'Wrong Password');
    const wrong = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: 'nope-nope-1' } });
    const missing = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'nobody@example.com', password: 'nope-nope-1' } });
    expect(wrong.statusCode).toBe(401);
    expect(missing.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe(missing.json().error.message);
    const audits = await ctx.db.db.select().from(auditLogs).where(eq(auditLogs.actorId, user.id));
    expect(audits.map((a) => a.event)).toContain('auth.login_failed');

    const ok = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: 'correct-horse-1' } });
    expect(ok.statusCode).toBe(200);
    expect(data(ok).accessToken).toBeTruthy();
  });

  it('requires authentication on protected routes', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/drive/items' })).statusCode).toBe(401);
    const garbage = await ctx.app.inject({ method: 'GET', url: '/api/drive/items', headers: { authorization: 'Bearer not.a.jwt' } });
    expect(garbage.statusCode).toBe(401);
  });
});

describe('refresh tokens', () => {
  it('rotates on every refresh and revokes the session when an old token is replayed', async () => {
    const user = await registerUser(ctx.app, 'Rotator');
    const first = await refresh(user.refreshCookie);
    expect(first.statusCode).toBe(200);
    const rotated = cookieFrom(first, 'qub_rt')!;
    expect(rotated).not.toBe(user.refreshCookie);

    // Replaying the original token outside the grace window = theft: whole session revoked.
    await ctx.db.sql`update refresh_tokens set used_at = now() - interval '5 minutes' where used_at is not null`;
    const replay = await refresh(user.refreshCookie);
    expect(replay.statusCode).toBe(401);
    const afterTheft = await refresh(rotated);
    expect(afterTheft.statusCode).toBe(401);
    // The access token for that session stops working immediately too.
    expect((await client(ctx.app, user).get('/api/auth/me')).statusCode).toBe(401);
  });

  it('rejects refresh from a foreign origin (CSRF defence)', async () => {
    const user = await registerUser(ctx.app, 'Csrf');
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: `qub_rt=${user.refreshCookie}`, origin: 'https://evil.example' } });
    expect(res.statusCode).toBe(403);
  });

  it('logout revokes the session', async () => {
    const user = await registerUser(ctx.app, 'Logout');
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { authorization: `Bearer ${user.token}`, cookie: `qub_rt=${user.refreshCookie}` } });
    expect(res.statusCode).toBe(200);
    expect((await client(ctx.app, user).get('/api/auth/me')).statusCode).toBe(401);
    expect((await refresh(user.refreshCookie)).statusCode).toBe(401);
  });
});

describe('password flows', () => {
  it('forgot/reset password works once and signs out every session', async () => {
    const user = await registerUser(ctx.app, 'Forgetful');
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: user.email } });
    expect(res.statusCode).toBe(200);
    const mail = ctx.mailer.sent.findLast((m) => m.to === user.email && m.subject.includes('Reset'))!;
    const token = decodeURIComponent(/token=([^\s]+)/.exec(mail.text)![1]!);

    const reset = await ctx.app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, password: 'brand-new-pass-2' } });
    expect(reset.statusCode).toBe(200);
    expect((await client(ctx.app, user).get('/api/auth/me')).statusCode).toBe(401);
    const again = await ctx.app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, password: 'another-pass-3' } });
    expect(again.statusCode).toBe(400);
    const login = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: 'brand-new-pass-2' } });
    expect(login.statusCode).toBe(200);
  });

  it('does not reveal whether an email is registered', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'ghost@example.com' } });
    expect(res.statusCode).toBe(200);
  });

  it('verifies email with the emailed token', async () => {
    const user = await registerUser(ctx.app, 'Verifier');
    const mail = ctx.mailer.sent.findLast((m) => m.to === user.email && m.subject.includes('Verify'))!;
    const token = decodeURIComponent(/token=([^\s]+)/.exec(mail.text)![1]!);
    expect((await ctx.app.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } })).statusCode).toBe(200);
    expect(data((await client(ctx.app, user).get('/api/auth/me'))).emailVerified).toBe(true);
  });

  it('change password requires the current password and keeps only the current session', async () => {
    const user = await registerUser(ctx.app, 'Changer');
    const other = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: 'correct-horse-1' } });
    const otherToken = data(other).accessToken as string;

    const wrong = await client(ctx.app, user).post('/api/auth/change-password', { currentPassword: 'wrong', newPassword: 'new-password-9' });
    expect(wrong.statusCode).toBe(422);
    const ok = await client(ctx.app, user).post('/api/auth/change-password', { currentPassword: 'correct-horse-1', newPassword: 'new-password-9' });
    expect(ok.statusCode).toBe(200);
    expect((await client(ctx.app, user).get('/api/auth/me')).statusCode).toBe(200);
    expect((await client(ctx.app, { token: otherToken }).get('/api/auth/me')).statusCode).toBe(401);
  });
});
