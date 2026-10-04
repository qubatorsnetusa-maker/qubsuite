import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { emailSettings, orgSettings, users } from '../src/db/schema';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

const GB = 1024 ** 3;

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: string;
}
const requests: Captured[] = [];
/** Stands in for the email providers' HTTP APIs; a key of "bad-key" is rejected like a real provider would. */
const fakeFetch: typeof fetch = async (input, init) => {
  const headers = Object.fromEntries(new Headers(init?.headers).entries());
  requests.push({ url: String(input), headers, body: String(init?.body ?? '') });
  const auth = headers.authorization ?? headers['x-postmark-server-token'] ?? '';
  if (auth.includes('bad-key')) return new Response(JSON.stringify({ message: 'API key is invalid' }), { status: 401 });
  return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 });
};

let ctx: TestContext;
let admin: TestUser;
let member: TestUser;

beforeAll(async () => {
  ctx = await createTestApp({ fetch: fakeFetch });
  admin = await registerUser(ctx.app, 'Sia Storage Admin');
  member = await registerUser(ctx.app, 'Quinn Quota');
  await ctx.db.db.update(users).set({ platformRole: 'SUPER_ADMIN' }).where(eq(users.id, admin.id));
});
afterEach(async () => {
  await ctx.db.db.delete(orgSettings);
  await ctx.db.db.delete(emailSettings);
  ctx.app.services.policies.invalidate();
  ctx.app.services.email.invalidate();
  requests.length = 0;
});
afterAll(async () => {
  await ctx.close();
});

describe('per-person storage', () => {
  const setStorage = (body: unknown) => client(ctx.app, admin).put(`/api/admin/users/${member.id}/storage`, body);

  it('sets a size, increases and decreases it, and tells the person', async () => {
    let res = await setStorage({ mode: 'custom', gb: 2 });
    expect(res.statusCode, res.body).toBe(200);
    expect(data(res)).toMatchObject({ quotaMode: 'custom', storageQuota: 2 * GB, quotaOverride: 2 * GB });

    res = await setStorage({ mode: 'adjust', deltaGb: 3 });
    expect(data(res)).toMatchObject({ quotaMode: 'custom', storageQuota: 5 * GB });
    res = await setStorage({ mode: 'adjust', deltaGb: -1.5 });
    expect(data(res).storageQuota).toBe(3.5 * GB);

    // Can't go below the minimum.
    expect((await setStorage({ mode: 'adjust', deltaGb: -4 })).statusCode).toBe(422);

    const notes = data(await client(ctx.app, member).get('/api/notifications'));
    const titles = (notes.items ?? notes).map((n: { title: string }) => n.title);
    expect(titles).toEqual(expect.arrayContaining(['Your storage was increased to 5.0 GB', 'Your storage was reduced to 3.5 GB']));

    const audit = data(await client(ctx.app, admin).get(`/api/admin/audit?q=${encodeURIComponent(member.email)}`));
    expect(audit.items.some((e: { event: string }) => e.event === 'admin.storage_changed')).toBe(true);
  });

  it('adjusts from the organization default, and supports unlimited', async () => {
    await client(ctx.app, admin).put('/api/admin/policies', { storage: { defaultQuotaGb: 10 } });
    let res = await setStorage({ mode: 'default' });
    expect(data(res)).toMatchObject({ quotaMode: 'default', storageQuota: 10 * GB, quotaOverride: null });
    res = await setStorage({ mode: 'adjust', deltaGb: 5 });
    expect(data(res)).toMatchObject({ quotaMode: 'custom', storageQuota: 15 * GB });

    res = await setStorage({ mode: 'unlimited' });
    expect(data(res)).toMatchObject({ quotaMode: 'unlimited', storageQuota: null, quotaOverride: null });
    expect((await client(ctx.app, member).get('/api/drive/storage')).json().data).toMatchObject({ quotaBytes: null, quotaSource: 'unlimited' });
    // Adding space to an unlimited account makes no sense.
    expect((await setStorage({ mode: 'adjust', deltaGb: 1 })).statusCode).toBe(400);
    // Unlimited people aren't counted in the organization's allocation.
    expect(data(await client(ctx.app, admin).get('/api/admin/storage')).allocatedBytes).toBeNull();
  });

  it('lets an unlimited person upload past a full quota', async () => {
    // A tiny quota (below what the API accepts) keeps the test fast.
    await ctx.db.db.update(users).set({ storageQuotaBytes: 2048, storageUnlimited: false }).where(eq(users.id, member.id));
    const api = client(ctx.app, member);
    const file = Buffer.alloc(4096, 1);
    const blocked = await api.upload('/api/drive/files/upload', 'full.bin', file);
    expect(blocked.statusCode).toBe(413);
    expect(blocked.json().error.code).toBe('STORAGE_QUOTA_EXCEEDED');

    await setStorage({ mode: 'unlimited' });
    expect((await api.upload('/api/drive/files/upload', 'full.bin', file)).statusCode).toBe(201);
    await setStorage({ mode: 'default' });
  });

  it('is only available to super admins', async () => {
    expect((await client(ctx.app, member).put(`/api/admin/users/${member.id}/storage`, { mode: 'unlimited' })).statusCode).toBe(403);
    expect((await setStorage({ mode: 'adjust', deltaGb: 0 })).statusCode).toBe(422);
  });
});

describe('email delivery settings', () => {
  const api = () => client(ctx.app, admin);
  const resend = { provider: 'resend', fromName: 'Qub Team', fromEmail: 'team@qub.example', apiKey: 're_live_secret' };

  it('defaults to the server transport and hides secrets once saved', async () => {
    const initial = data(await api().get('/api/admin/email'));
    expect(initial).toMatchObject({ settings: { provider: 'environment' }, hasSecret: false, environment: { transport: 'console' } });

    const saved = data(await api().put('/api/admin/email', resend));
    expect(saved.settings).toEqual({ provider: 'resend', fromName: 'Qub Team', fromEmail: 'team@qub.example', replyTo: null });
    expect(saved.hasSecret).toBe(true);
    expect(JSON.stringify(saved)).not.toContain('re_live_secret');

    // The key is encrypted at rest.
    const [row] = await ctx.db.db.select().from(emailSettings);
    expect(row!.secrets).toMatch(/^v1\./);
    expect(row!.secrets).not.toContain('re_live_secret');
  });

  it('sends every app email through the chosen provider', async () => {
    await api().put('/api/admin/email', resend);
    const before = ctx.mailer.sent.length;
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: member.email } });
    expect(res.statusCode).toBeLessThan(300);
    await new Promise((r) => setTimeout(r, 50));
    const sent = requests.find((r) => r.url === 'https://api.resend.com/emails');
    expect(sent, 'password reset went through Resend').toBeDefined();
    expect(sent!.headers.authorization).toBe('Bearer re_live_secret');
    expect(JSON.parse(sent!.body)).toMatchObject({ from: '"Qub Team" <team@qub.example>', to: [member.email] });
    // Nothing went to the server-default transport.
    expect(ctx.mailer.sent.length).toBe(before);
  });

  it('keeps the saved key when the form is saved without re-entering it, and requires one for a new provider', async () => {
    await api().put('/api/admin/email', resend);
    const updated = await api().put('/api/admin/email', { ...resend, apiKey: '', fromName: 'Qub' });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(data(updated).hasSecret).toBe(true);
    await api().post('/api/admin/email/test', { to: 'ops@qub.example' });
    expect(requests.at(-1)!.headers.authorization).toBe('Bearer re_live_secret');

    const noKey = await api().put('/api/admin/email', { provider: 'postmark', fromName: 'Qub', fromEmail: 'team@qub.example' });
    expect(noKey.statusCode).toBe(422);
  });

  it('tests drafts and saved settings, reporting provider errors', async () => {
    const draft = await api().post('/api/admin/email/test', {
      to: 'ops@qub.example',
      settings: { provider: 'mailgun', fromName: 'Qub', fromEmail: 'team@mg.qub.example', domain: 'mg.qub.example', region: 'eu', apiKey: 'key-123' },
    });
    expect(draft.statusCode, draft.body).toBe(200);
    const mg = requests.at(-1)!;
    expect(mg.url).toBe('https://api.eu.mailgun.net/v3/mg.qub.example/messages');
    expect(mg.headers.authorization).toBe(`Basic ${Buffer.from('api:key-123').toString('base64')}`);
    expect(new URLSearchParams(mg.body).get('to')).toBe('ops@qub.example');

    await api().put('/api/admin/email', { provider: 'sendgrid', fromName: 'Qub', fromEmail: 'team@qub.example', apiKey: 'bad-key' });
    const failed = await api().post('/api/admin/email/test', { to: 'ops@qub.example' });
    expect(failed.statusCode).toBe(400);
    expect(failed.json().error.message).toContain('The API key was rejected: API key is invalid');
    expect(data(await api().get('/api/admin/email')).lastTestError).toContain('API key was rejected');
  });

  it('reports an unreachable SMTP server', async () => {
    const res = await api().post('/api/admin/email/test', {
      to: 'ops@qub.example',
      settings: { provider: 'smtp', fromName: 'Qub', fromEmail: 'team@qub.example', host: '127.0.0.1', port: 1, security: 'none', username: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain("Couldn't connect to 127.0.0.1:1");
  });

  it('validates settings and is admin-only', async () => {
    expect((await api().put('/api/admin/email', { provider: 'smtp', fromName: 'Qub', fromEmail: 'nope', host: 'smtp.x.com', port: 587, security: 'starttls' })).statusCode).toBe(422);
    expect((await client(ctx.app, member).get('/api/admin/email')).statusCode).toBe(403);
    expect((await client(ctx.app, member).post('/api/admin/email/test', { to: 'x@y.com' })).statusCode).toBe(403);
  });
});
