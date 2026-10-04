import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { orgSettings, users } from '../src/db/schema';
import { client, cookieFrom, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let admin: TestUser;
let member: TestUser;

const makeAdmin = async (u: TestUser) => ctx.db.db.update(users).set({ platformRole: 'SUPER_ADMIN' }).where(eq(users.id, u.id));
const setPolicies = async (body: unknown) => {
  const res = await client(ctx.app, admin).put('/api/admin/policies', body);
  expect(res.statusCode, res.body).toBe(200);
  return data(res).policies;
};

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await registerUser(ctx.app, 'Ada Admin');
  member = await registerUser(ctx.app, 'Max Member');
  await makeAdmin(admin);
});
afterEach(async () => {
  // Policies are organization-wide; every test starts from the defaults.
  await ctx.db.db.delete(orgSettings);
  ctx.app.services.policies.invalidate();
});
afterAll(async () => {
  await ctx.close();
});

describe('access control', () => {
  it('requires a signed-in super admin for every admin endpoint', async () => {
    expect((await client(ctx.app).get('/api/admin/overview')).statusCode).toBe(401);
    for (const url of ['/api/admin/overview', '/api/admin/users', '/api/admin/policies', '/api/admin/audit', '/api/admin/storage', '/api/admin/system']) {
      const res = await client(ctx.app, member).get(url);
      expect(res.statusCode, url).toBe(403);
    }
    expect((await client(ctx.app, member).put('/api/admin/policies', {})).statusCode).toBe(403);
    expect((await client(ctx.app, admin).get('/api/admin/overview')).statusCode).toBe(200);
  });

  it('exposes the platform role on the current user', async () => {
    const me = data(await client(ctx.app, admin).get('/api/users/me'));
    expect(me.platformRole).toBe('SUPER_ADMIN');
    expect(data(await client(ctx.app, member).get('/api/users/me')).platformRole).toBe('USER');
  });

  it('takes a demotion into account on the very next request', async () => {
    const temp = await registerUser(ctx.app, 'Temp Admin');
    await makeAdmin(temp);
    expect((await client(ctx.app, temp).get('/api/admin/overview')).statusCode).toBe(200);
    await client(ctx.app, admin).patch(`/api/admin/users/${temp.id}`, { platformRole: 'USER' });
    expect((await client(ctx.app, temp).get('/api/admin/overview')).statusCode).toBe(403);
  });
});

describe('directory', () => {
  it('creates an account that the person activates through the emailed link', async () => {
    const res = await client(ctx.app, admin).post('/api/admin/users', { name: 'Nia New', email: 'nia.new@example.com', quotaGb: 5 });
    expect(res.statusCode, res.body).toBe(201);
    const created = data(res);
    expect(created).toMatchObject({ email: 'nia.new@example.com', platformRole: 'USER', status: 'ACTIVE', storageQuota: 5 * 1024 ** 3, quotaOverride: 5 * 1024 ** 3 });

    const mail = ctx.mailer.sent.find((m) => m.to === 'nia.new@example.com')!;
    expect(mail.subject).toContain('created a Qub account for you');
    const token = decodeURIComponent(/token=([^\s]+)/.exec(mail.text)![1]!);
    // The account can't be used before a password is chosen.
    expect((await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'nia.new@example.com', password: 'whatever-123' } })).statusCode).toBe(401);
    const reset = await ctx.app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, password: 'nia-password-1' } });
    expect(reset.statusCode, reset.body).toBe(200);
    const login = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'nia.new@example.com', password: 'nia-password-1' } });
    expect(login.statusCode).toBe(200);
    expect(data(login).user).toMatchObject({ emailVerified: true, platformRole: 'USER' });

    expect((await client(ctx.app, admin).post('/api/admin/users', { name: 'Dup', email: 'nia.new@example.com' })).statusCode).toBe(409);
  });

  it('lists, searches and filters users with their storage and sessions', async () => {
    const api = client(ctx.app, admin);
    const all = data(await api.get('/api/admin/users?limit=200'));
    const me = all.items.find((u: { id: string }) => u.id === member.id);
    expect(me).toMatchObject({ email: member.email, platformRole: 'USER', status: 'ACTIVE' });
    expect(me.activeSessions).toBeGreaterThanOrEqual(1);
    const found = data(await api.get(`/api/admin/users?q=${encodeURIComponent('max member')}`));
    expect(found.items.map((u: { id: string }) => u.id)).toContain(member.id);
    const admins = data(await api.get('/api/admin/users?role=SUPER_ADMIN&limit=200'));
    expect(admins.items.every((u: { platformRole: string }) => u.platformRole === 'SUPER_ADMIN')).toBe(true);
  });

  it('suspends (signing the person out everywhere) and reactivates', async () => {
    const sam = await registerUser(ctx.app, 'Sam Suspend');
    const api = client(ctx.app, admin);
    const suspended = data(await api.patch(`/api/admin/users/${sam.id}`, { status: 'SUSPENDED' }));
    expect(suspended).toMatchObject({ status: 'SUSPENDED', activeSessions: 0 });
    expect((await client(ctx.app, sam).get('/api/users/me')).statusCode).toBe(401);
    expect((await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: sam.email, password: 'correct-horse-1' } })).statusCode).toBe(403);

    await api.patch(`/api/admin/users/${sam.id}`, { status: 'ACTIVE' });
    expect((await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: sam.email, password: 'correct-horse-1' } })).statusCode).toBe(200);

    const audit = data(await api.get(`/api/admin/audit?q=${encodeURIComponent(sam.email)}`));
    const events = audit.items.map((e: { event: string }) => e.event);
    expect(events).toEqual(expect.arrayContaining(['admin.user_suspended', 'admin.user_activated']));
    const suspendEvent = audit.items.find((e: { event: string }) => e.event === 'admin.user_suspended');
    expect(suspendEvent).toMatchObject({ category: 'admin', severity: 'warning', targetLabel: sam.email, actor: { id: admin.id } });
  });

  it('keeps the organization administrable', async () => {
    const api = client(ctx.app, admin);
    expect((await api.patch(`/api/admin/users/${admin.id}`, { platformRole: 'USER' })).statusCode).toBe(400);
    expect((await api.patch(`/api/admin/users/${admin.id}`, { status: 'SUSPENDED' })).statusCode).toBe(400);
    expect((await api.post(`/api/admin/users/${admin.id}/delete`, { deleteData: true })).statusCode).toBe(400);

    // Another admin can't remove the last super admin either.
    const second = await registerUser(ctx.app, 'Second Admin');
    await makeAdmin(second);
    await ctx.db.db.update(users).set({ platformRole: 'USER' }).where(eq(users.id, admin.id));
    try {
      const res = await client(ctx.app, second).patch(`/api/admin/users/${second.id}`, { platformRole: 'USER' });
      expect(res.statusCode).toBe(400); // own role
      const other = await registerUser(ctx.app, 'Third Person');
      await makeAdmin(other);
      await client(ctx.app, second).patch(`/api/admin/users/${other.id}`, { status: 'SUSPENDED' });
      // `second` is now the only active super admin: `other` (suspended) can't be the one to demote them.
      const lone = await client(ctx.app, second).patch(`/api/admin/users/${other.id}`, { platformRole: 'USER' });
      expect(lone.statusCode).toBe(200);
    } finally {
      await makeAdmin(admin);
    }
  });

  it('runs bulk actions and reports what was skipped', async () => {
    const a = await registerUser(ctx.app, 'Bulk A');
    const b = await registerUser(ctx.app, 'Bulk B');
    const res = data(await client(ctx.app, admin).post('/api/admin/users/bulk', { userIds: [a.id, b.id, admin.id], action: 'suspend' }));
    expect(res.updated.sort()).toEqual([a.id, b.id].sort());
    expect(res.skipped).toEqual([{ id: admin.id, reason: "You can't suspend your own account." }]);
  });
});

describe('storage quotas', () => {
  it('stops uploads beyond the owner’s quota and reports usage', async () => {
    const q = await registerUser(ctx.app, 'Quota Quinn');
    await ctx.db.db.update(users).set({ storageQuotaBytes: 3000 }).where(eq(users.id, q.id));
    const api = client(ctx.app, q);
    expect((await api.upload(`/api/drive/files/upload?folderId=${q.rootFolderId}`, 'a.txt', 'x'.repeat(2000), 'text/plain')).statusCode).toBe(201);
    const over = await api.upload(`/api/drive/files/upload?folderId=${q.rootFolderId}`, 'b.txt', 'y'.repeat(2000), 'text/plain');
    expect(over.statusCode).toBe(413);
    expect(over.json().error).toMatchObject({ code: 'STORAGE_QUOTA_EXCEEDED' });
    expect(over.json().error.message).toContain('out of storage');

    const row = data(await client(ctx.app, admin).get(`/api/admin/users/${q.id}`));
    expect(row).toMatchObject({ storageUsed: 2000, storageQuota: 3000, ownedFiles: 1 });

    // An admin raises the quota (null = organization default, which is unlimited here).
    await client(ctx.app, admin).patch(`/api/admin/users/${q.id}`, { quotaGb: null });
    expect((await api.upload(`/api/drive/files/upload?folderId=${q.rootFolderId}`, 'b.txt', 'y'.repeat(2000), 'text/plain')).statusCode).toBe(201);

    const alerts = data(await client(ctx.app, admin).get('/api/admin/alerts'));
    expect(alerts.find((a: { id: string }) => a.id === 'storage-full')).toBeUndefined();
  });

  it('applies the organization default quota and raises alerts near it', async () => {
    const d = await registerUser(ctx.app, 'Default Dana');
    await client(ctx.app, d).upload(`/api/drive/files/upload?folderId=${d.rootFolderId}`, 'c.txt', 'z'.repeat(1500), 'text/plain');
    await ctx.db.db.update(users).set({ storageQuotaBytes: 1600 }).where(eq(users.id, d.id));
    const alerts = data(await client(ctx.app, admin).get('/api/admin/alerts'));
    expect(alerts.find((a: { id: string }) => a.id === 'storage-near')).toMatchObject({ severity: 'warning', section: 'storage' });
  });
});

describe('policies', () => {
  it('returns defaults and audits changes', async () => {
    const res = data(await client(ctx.app, admin).get('/api/admin/policies'));
    expect(res.policies).toMatchObject({ sharing: { allowPublicLinks: true, maxLinkRole: 'EDITOR', allowExternalInvites: true, allowedDomains: [] }, content: { viewersCanDownload: true } });
    await setPolicies({ ...res.policies, organizationName: 'Acme' });
    const audit = data(await client(ctx.app, admin).get('/api/admin/audit?category=admin'));
    const event = audit.items.find((e: { event: string }) => e.event === 'admin.policies_updated');
    expect(event.metadata.changed).toEqual(['organizationName']);
  });

  it('rejects limits above the server configuration', async () => {
    const res = await client(ctx.app, admin).put('/api/admin/policies', { uploads: { maxFileSizeMb: 5000 } });
    expect(res.statusCode).toBe(422);
  });

  it('controls public links, including links that already exist', async () => {
    const api = client(ctx.app, member);
    const file = data(await api.upload(`/api/drive/files/upload?folderId=${member.rootFolderId}`, 'pub.txt', 'public', 'text/plain'));
    const state = data(await api.put(`/api/drive/files/${file.id}/general-access`, { access: 'ANYONE_WITH_LINK', linkRole: 'EDITOR' }));
    const token = state.link.token;
    expect((await client(ctx.app).get(`/api/share/${token}`)).statusCode).toBe(200);

    await setPolicies({ sharing: { allowPublicLinks: false } });
    expect((await client(ctx.app).get(`/api/share/${token}`)).statusCode).toBe(404);
    const blocked = await api.put(`/api/drive/files/${file.id}/general-access`, { access: 'ANYONE_WITH_LINK', linkRole: 'VIEWER' });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe('POLICY_VIOLATION');
    expect(data(await api.get(`/api/drive/files/${file.id}/share`)).policy).toMatchObject({ allowPublicLinks: false });

    // Links are capped at the maximum role.
    await setPolicies({ sharing: { maxLinkRole: 'VIEWER' } });
    const shared = data(await client(ctx.app).get(`/api/share/${token}`));
    expect(shared.role).toBe('VIEWER');
    expect((await api.put(`/api/drive/files/${file.id}/general-access`, { access: 'ANYONE_WITH_LINK', linkRole: 'EDITOR' })).statusCode).toBe(403);
  });

  it('restricts who items can be shared with', async () => {
    const api = client(ctx.app, member);
    const file = data(await api.upload(`/api/drive/files/upload?folderId=${member.rootFolderId}`, 'share.txt', 'x', 'text/plain'));
    await setPolicies({ sharing: { allowExternalInvites: false } });
    const invite = await api.post(`/api/drive/files/${file.id}/share`, { email: 'nobody-yet@example.com', role: 'VIEWER', notify: false });
    expect(invite.statusCode).toBe(403);
    expect((await api.post(`/api/drive/files/${file.id}/share`, { email: admin.email, role: 'VIEWER', notify: false })).statusCode).toBe(200);

    await setPolicies({ sharing: { allowedDomains: ['partner.org'] } });
    const outside = await api.post(`/api/drive/files/${file.id}/share`, { email: admin.email, role: 'VIEWER', notify: false });
    expect(outside.statusCode).toBe(403);
    expect(outside.json().error.message).toContain('partner.org');
  });

  it('blocks extensions and can stop viewers from downloading', async () => {
    const api = client(ctx.app, member);
    await setPolicies({ uploads: { blockedExtensions: ['CSV', '.bin'] } });
    const csv = await api.upload(`/api/drive/files/upload?folderId=${member.rootFolderId}`, 'data.csv', 'a,b\n1,2', 'text/csv');
    expect(csv.statusCode).toBe(403);
    expect(csv.json().error.code).toBe('POLICY_VIOLATION');

    const file = data(await api.upload(`/api/drive/files/upload?folderId=${member.rootFolderId}`, 'notes.txt', 'hello', 'text/plain'));
    await api.post(`/api/drive/files/${file.id}/share`, { email: admin.email, role: 'VIEWER', notify: false });
    const viewer = client(ctx.app, admin);
    expect((await viewer.get(`/api/drive/files/${file.id}/download`)).statusCode).toBe(200);
    await setPolicies({ content: { viewersCanDownload: false } });
    expect((await viewer.get(`/api/drive/files/${file.id}/download`)).statusCode).toBe(403);
    expect(data(await viewer.get(`/api/drive/files/${file.id}`)).capabilities).toMatchObject({ canDownload: false, canCopy: false });
    // The owner is unaffected.
    expect((await api.get(`/api/drive/files/${file.id}/download`)).statusCode).toBe(200);
  });

  it('can require sign-in for every form', async () => {
    const api = client(ctx.app, member);
    const form = data(await api.post('/api/forms', { templateId: 'form-rsvp' }));
    await api.post(`/api/forms/${form.id}/publish`);
    expect((await client(ctx.app).get(`/api/public/forms/${form.publicId}`)).statusCode).toBe(200);
    await setPolicies({ forms: { requireSignIn: true } });
    expect((await client(ctx.app).get(`/api/public/forms/${form.publicId}`)).statusCode).toBe(401);
    expect((await client(ctx.app, admin).get(`/api/public/forms/${form.publicId}`)).statusCode).toBe(200);
  });

  it('ends sessions older than the maximum age', async () => {
    const s = await registerUser(ctx.app, 'Session Sid');
    await ctx.db.db.execute(`update sessions set created_at = now() - interval '3 hours' where user_id = '${s.id}'` as never);
    expect((await client(ctx.app, s).get('/api/users/me')).statusCode).toBe(200);
    await setPolicies({ security: { sessionMaxHours: 2 } });
    expect((await client(ctx.app, s).get('/api/users/me')).statusCode).toBe(401);
    const refresh = await ctx.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: `qub_rt=${s.refreshCookie}`, origin: 'http://localhost:5180', 'x-requested-with': 'qub' } });
    expect(refresh.statusCode).toBe(401);
  });
});

describe('deleting accounts', () => {
  it('transfers everything the person owns to someone else', async () => {
    const leaver = await registerUser(ctx.app, 'Leo Leaver');
    const heir = await registerUser(ctx.app, 'Hana Heir');
    const api = client(ctx.app, leaver);
    const folder = data(await api.post('/api/drive/folders', { name: 'Projects', parentId: leaver.rootFolderId }));
    const inside = data(await api.upload(`/api/drive/files/upload?folderId=${folder.id}`, 'plan.txt', 'plan', 'text/plain'));
    const doc = data(await api.post('/api/docs', { title: 'Handbook' }));

    const res = await client(ctx.app, admin).post(`/api/admin/users/${leaver.id}/delete`, { transferToUserId: heir.id });
    expect(res.statusCode, res.body).toBe(200);
    expect(data(res)).toMatchObject({ transferredTo: heir.id, deletedFiles: 0 });

    const heirApi = client(ctx.app, heir);
    const root = data(await heirApi.get(`/api/drive/items?folderId=${heir.rootFolderId}`));
    const holder = root.items.find((i: { name: string }) => i.name === "Leo Leaver's files");
    expect(holder).toBeTruthy();
    const moved = data(await heirApi.get(`/api/drive/items?folderId=${holder.id}`)).items.map((i: { name: string }) => i.name).sort();
    expect(moved).toEqual(['Handbook', 'Projects']);
    expect(data(await heirApi.get(`/api/drive/files/${inside.id}`)).owner.id).toBe(heir.id);
    expect((await heirApi.get(`/api/docs/${doc.id}`)).statusCode).toBe(200);
    // The email is free again.
    expect((await ctx.app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: leaver.email, name: 'Leo Again', password: 'correct-horse-1' } })).statusCode).toBe(201);
  });

  it('or deletes their files permanently, requiring an explicit choice', async () => {
    const gone = await registerUser(ctx.app, 'Gina Gone');
    const api = client(ctx.app, gone);
    const f = data(await api.upload(`/api/drive/files/upload?folderId=${gone.rootFolderId}`, 'bye.txt', 'bye', 'text/plain'));
    expect((await client(ctx.app, admin).post(`/api/admin/users/${gone.id}/delete`, {})).statusCode).toBe(422);
    const res = data(await client(ctx.app, admin).post(`/api/admin/users/${gone.id}/delete`, { deleteData: true }));
    expect(res).toMatchObject({ transferredTo: null, deletedFiles: 1 });
    expect((await client(ctx.app, admin).get(`/api/admin/content?type=UPLOAD&q=bye.txt`)).json().data.items).toHaveLength(0);
    expect((await client(ctx.app, admin).get(`/api/admin/users/${gone.id}`)).statusCode).toBe(404);
    const audit = data(await client(ctx.app, admin).get('/api/admin/audit?severity=critical'));
    expect(audit.items.some((e: { event: string; metadata: { email?: string } }) => e.event === 'admin.user_deleted' && e.metadata.email === gone.email)).toBe(true);
    expect(f.id).toBeTruthy();
  });
});

describe('content, overview and security views', () => {
  it('lists content per app with app-specific details and admin actions', async () => {
    const api = client(ctx.app, member);
    const sheet = data(await api.post('/api/sheets', { templateId: 'sheet-invoice', title: 'Admin view invoice' }));
    const form = data(await api.post('/api/forms', { templateId: 'form-contact-information', title: 'Admin view form' }));
    const doc = data(await api.post('/api/docs', { templateId: 'doc-letter', title: 'Admin view letter' }));
    await api.put(`/api/drive/files/${doc.fileId}/general-access`, { access: 'ANYONE_WITH_LINK', linkRole: 'VIEWER' });
    const adminApi = client(ctx.app, admin);

    const sheets = data(await adminApi.get('/api/admin/content?type=SPREADSHEET&q=admin%20view'));
    expect(sheets.items[0]).toMatchObject({ name: 'Admin view invoice', fileType: 'SPREADSHEET', owner: { id: member.id } });
    expect(sheets.items[0].details.cells).toBeGreaterThan(20);
    const forms = data(await adminApi.get('/api/admin/content?type=FORM&q=admin%20view'));
    expect(forms.items[0].details).toMatchObject({ published: false, responses: 0, questions: 5 });
    const docs = data(await adminApi.get('/api/admin/content?type=DOCUMENT&publicOnly=true&q=admin%20view'));
    expect(docs.items.map((d: { id: string }) => d.id)).toEqual([doc.fileId]);
    expect(docs.items[0].details.wordCount).toBeGreaterThan(50);
    // "false" in a query string means false (not a truthy non-empty string).
    const privateToo = data(await adminApi.get('/api/admin/content?type=SPREADSHEET&publicOnly=false&includeTrashed=false&q=admin%20view'));
    expect(privateToo.items.map((d: { id: string }) => d.id)).toEqual([sheet.fileId]);

    // Revoking the link turns the item back to restricted for its owner too.
    expect((await adminApi.post(`/api/admin/content/${doc.fileId}/revoke-link`)).statusCode).toBe(200);
    expect(data(await api.get(`/api/drive/files/${doc.fileId}/share`)).generalAccess).toBe('RESTRICTED');

    // Transfer one file: the previous owner keeps editor access.
    expect((await adminApi.post(`/api/admin/content/${sheet.fileId}/transfer`, { toUserId: admin.id })).statusCode).toBe(200);
    const moved = data(await api.get(`/api/drive/files/${sheet.fileId}`));
    expect(moved.owner.id).toBe(admin.id);
    expect(moved.capabilities.role).toBe('EDITOR');
    expect(form.id).toBeTruthy();
  });

  it('summarises the organization from real data', async () => {
    const o = data(await client(ctx.app, admin).get('/api/admin/overview'));
    expect(o.users.superAdmins).toBeGreaterThanOrEqual(1);
    expect(o.content.documents).toBeGreaterThan(0);
    expect(o.storage.usedBytes).toBeGreaterThan(0);
    expect(o.activity).toHaveLength(14);
    const today = o.activity[13];
    expect(today.DOCUMENT + today.SPREADSHEET + today.FORM + today.DRIVE).toBeGreaterThan(0);
    expect(o.recentAudit.length).toBeGreaterThan(0);

    const storage = data(await client(ctx.app, admin).get('/api/admin/storage'));
    expect(storage.breakdown.length).toBeGreaterThan(0);
    expect(storage.largestFiles[0].bytes).toBeGreaterThan(0);
    const system = data(await client(ctx.app, admin).get('/api/admin/system'));
    expect(system.postgresVersion).toMatch(/^\d+/);
  });

  it('shows and revokes sessions, and records failed sign-ins', async () => {
    const v = await registerUser(ctx.app, 'Val Victim');
    for (let i = 0; i < 5; i++) await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: v.email, password: 'wrong-password' } });
    const sec = data(await client(ctx.app, admin).get('/api/admin/security'));
    expect(sec.failedLoginAccounts.find((a: { email: string }) => a.email === v.email)).toMatchObject({ attempts: 5 });

    const sessions = data(await client(ctx.app, admin).get(`/api/admin/sessions?userId=${v.id}`));
    expect(sessions.items).toHaveLength(1);
    await client(ctx.app, admin).delete(`/api/admin/sessions/${sessions.items[0].id}`);
    expect((await client(ctx.app, v).get('/api/users/me')).statusCode).toBe(401);

    const other = await registerUser(ctx.app, 'Olly Other');
    const all = data(await client(ctx.app, admin).post('/api/admin/sessions/revoke-all'));
    expect(all.revoked).toBeGreaterThanOrEqual(1);
    expect((await client(ctx.app, other).get('/api/users/me')).statusCode).toBe(401);
    // The admin's own session survives.
    expect((await client(ctx.app, admin).get('/api/users/me')).statusCode).toBe(200);
  });

  it('filters audit and activity by time range', async () => {
    const api = client(ctx.app, admin);
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const recent = data(await api.get(`/api/admin/audit?from=${encodeURIComponent(hourAgo)}&limit=5`));
    expect(recent.items.length).toBeGreaterThan(0);
    const future = data(await api.get(`/api/admin/audit?from=${encodeURIComponent(new Date(Date.now() + 3600_000).toISOString())}`));
    expect(future.items).toHaveLength(0);
    const until = data(await api.get(`/api/admin/audit?to=${encodeURIComponent(hourAgo)}`));
    expect(until.items.every((e: { createdAt: string }) => e.createdAt <= hourAgo)).toBe(true);
    const activity = data(await api.get(`/api/admin/activity?from=${encodeURIComponent(hourAgo)}&app=DOCUMENT`));
    expect(activity.items.length).toBeGreaterThan(0);
    expect(activity.items.every((a: { app: string }) => a.app === 'DOCUMENT')).toBe(true);
  });

  it('exports the audit log as CSV with the media cookie', async () => {
    const res = await client(ctx.app, admin).get('/api/admin/audit/export?category=admin');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('Time (UTC),Actor,Actor email,Event');
    expect(res.body).toContain('admin.');
    expect(cookieFrom(res, 'x')).toBeUndefined();
  });
});
