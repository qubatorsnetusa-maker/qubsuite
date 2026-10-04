import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;
let carol: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Owner');
  bob = await registerUser(ctx.app, 'Bob Collaborator');
  carol = await registerUser(ctx.app, 'Carol Outsider');
});
afterAll(async () => {
  await ctx.close();
});

describe('resource isolation', () => {
  it("returns 404 (not 403) for other users' private items and never trusts client ids", async () => {
    const A = client(ctx.app, alice);
    const B = client(ctx.app, bob);
    const file = data(await A.upload('/api/drive/files/upload', 'secret.txt', 'top secret', 'text/plain'));
    const doc = data(await A.post('/api/docs', { title: 'Private doc' }));

    for (const url of [`/api/drive/files/${file.id}`, `/api/drive/files/${file.id}/download`, `/api/docs/${doc.id}`, `/api/drive/folders/${alice.rootFolderId}`]) {
      expect((await B.get(url)).statusCode).toBe(404);
    }
    expect((await B.patch(`/api/drive/files/${file.id}`, { name: 'pwned.txt' })).statusCode).toBe(404);
    // Bob cannot create items inside Alice's drive by passing her folder id.
    expect((await B.post('/api/drive/folders', { name: 'intrusion', parentId: alice.rootFolderId })).statusCode).toBe(404);
    expect((await B.post('/api/docs', { title: 'intrusion', folderId: alice.rootFolderId })).statusCode).toBe(404);
    // Search never leaks.
    const search = data(await B.get('/api/drive/search?q=secret'));
    expect(search.items).toHaveLength(0);
  });
});

describe('sharing flow (Alice → Bob as editor)', () => {
  it('creates a permission, notifies Bob, and lists the doc under Shared with me', async () => {
    const A = client(ctx.app, alice);
    const B = client(ctx.app, bob);
    const doc = data(await A.post('/api/docs', { title: 'Team plan' }));

    const shared = await A.post(`/api/drive/files/${doc.fileId}/share`, { email: bob.email, role: 'EDITOR', canShare: false });
    expect(shared.statusCode).toBe(200);
    expect(data(shared).permissions[0]).toMatchObject({ role: 'EDITOR', user: { id: bob.id } });

    const notes = data(await B.get('/api/notifications'));
    expect(notes.items[0]).toMatchObject({ type: 'SHARED_WITH_YOU', link: `/docs/${doc.id}` });
    expect(notes.unreadCount).toBeGreaterThan(0);

    const sharedWithMe = data(await B.get('/api/drive/shared'));
    expect(sharedWithMe.items.map((i: { id: string }) => i.id)).toContain(doc.fileId);

    const opened = await B.get(`/api/docs/${doc.id}`);
    expect(opened.statusCode).toBe(200);
    expect(data(opened).capabilities).toMatchObject({ role: 'EDITOR', canEdit: true, canShare: false, canTrash: false });

    // Editors without the share flag cannot re-share; nobody but the owner can trash.
    expect((await B.post(`/api/drive/files/${doc.fileId}/share`, { email: carol.email, role: 'VIEWER' })).statusCode).toBe(403);
    expect((await B.post(`/api/drive/files/${doc.fileId}/trash`)).statusCode).toBe(403);
  });

  it('enforces role levels: viewers cannot edit or comment', async () => {
    const A = client(ctx.app, alice);
    const C = client(ctx.app, carol);
    const doc = data(await A.post('/api/docs', { title: 'Viewer only' }));
    await A.post(`/api/drive/files/${doc.fileId}/share`, { email: carol.email, role: 'VIEWER' });
    expect((await C.get(`/api/docs/${doc.id}`)).statusCode).toBe(200);
    expect((await C.patch(`/api/docs/${doc.id}`, { title: 'hacked' })).statusCode).toBe(403);
    expect((await C.post(`/api/docs/${doc.id}/comments`, { anchorId: 'anchor-12345', body: 'hi' })).statusCode).toBe(403);
  });

  it('folder permissions are inherited by everything inside', async () => {
    const A = client(ctx.app, alice);
    const B = client(ctx.app, bob);
    const project = data(await A.post('/api/drive/folders', { name: 'Shared Project' }));
    const nested = data(await A.post('/api/drive/folders', { name: 'Deep', parentId: project.id }));
    const sheet = data(await A.post('/api/sheets', { title: 'Budget', folderId: nested.id }));
    expect((await B.get(`/api/sheets/${sheet.id}`)).statusCode).toBe(404);

    await A.post(`/api/drive/folders/${project.id}/share`, { email: bob.email, role: 'VIEWER' });
    const viaFolder = await B.get(`/api/sheets/${sheet.id}`);
    expect(viaFolder.statusCode).toBe(200);
    expect(data(viaFolder).capabilities.role).toBe('VIEWER');
    // Breadcrumbs stop at the highest folder Bob can access.
    const crumbs = data(await B.get(`/api/drive/folders/${nested.id}`)).path.map((p: { name: string }) => p.name);
    expect(crumbs).toEqual(['Shared Project', 'Deep']);
    const state = data(await A.get(`/api/drive/files/${sheet.fileId}/share`));
    expect(state.permissions.find((p: { user: { id: string } }) => p.user.id === bob.id).inheritedFrom.id).toBe(project.id);
  });

  it('removing a permission revokes access immediately', async () => {
    const A = client(ctx.app, alice);
    const B = client(ctx.app, bob);
    const file = data(await A.upload('/api/drive/files/upload', 'temp-share.txt', 'x', 'text/plain'));
    const state = data(await A.post(`/api/drive/files/${file.id}/share`, { email: bob.email, role: 'VIEWER' }));
    expect((await B.get(`/api/drive/files/${file.id}`)).statusCode).toBe(200);
    await A.delete(`/api/drive/files/${file.id}/permissions/${state.permissions[0].id}`);
    expect((await B.get(`/api/drive/files/${file.id}`)).statusCode).toBe(404);
  });

  it('sharing with an unregistered email becomes a real permission on sign-up', async () => {
    const A = client(ctx.app, alice);
    const file = data(await A.upload('/api/drive/files/upload', 'invite.txt', 'x', 'text/plain'));
    const email = `future.${Date.now()}@example.com`;
    const state = data(await A.post(`/api/drive/files/${file.id}/share`, { email, role: 'COMMENTER' }));
    expect(state.pendingInvites[0].email).toBe(email);
    const reg = await ctx.app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, name: 'Future', password: 'abcdefg1' } });
    const token = reg.json().data.accessToken;
    const res = await client(ctx.app, { token }).get(`/api/drive/files/${file.id}`);
    expect(res.statusCode).toBe(200);
    expect(data(res).capabilities.role).toBe('COMMENTER');
  });

  it('trashed items are invisible to collaborators', async () => {
    const A = client(ctx.app, alice);
    const B = client(ctx.app, bob);
    const file = data(await A.upload('/api/drive/files/upload', 'trash-shared.txt', 'x', 'text/plain'));
    await A.post(`/api/drive/files/${file.id}/share`, { email: bob.email, role: 'EDITOR' });
    await A.post(`/api/drive/files/${file.id}/trash`);
    expect((await B.get(`/api/drive/files/${file.id}`)).statusCode).toBe(404);
    expect((await A.get(`/api/drive/files/${file.id}`)).statusCode).toBe(200);
  });
});

describe('public links', () => {
  it('issues random tokens, supports passwords, scopes folder links, and can be turned off', async () => {
    const A = client(ctx.app, alice);
    const folder = data(await A.post('/api/drive/folders', { name: 'Public Folder' }));
    const inside = data(await A.upload(`/api/drive/files/upload?folderId=${folder.id}`, 'public.txt', 'hello world', 'text/plain'));
    const outside = data(await A.upload('/api/drive/files/upload', 'not-public.txt', 'nope', 'text/plain'));

    const state = data(await A.put(`/api/drive/folders/${folder.id}/general-access`, { access: 'ANYONE_WITH_LINK', linkRole: 'VIEWER', password: 'open sesame' }));
    const token = state.link.token as string;
    expect(token).not.toContain(folder.id);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(state.visibility).toBe('ANYONE_WITH_LINK');

    const locked = data(await ctx.app.inject({ method: 'GET', url: `/api/share/${token}` }));
    expect(locked).toMatchObject({ requiresPassword: true, accessToken: null });
    expect(locked.folder).toBeUndefined();
    expect((await ctx.app.inject({ method: 'POST', url: `/api/share/${token}/access`, payload: { password: 'wrong' } })).statusCode).toBe(403);
    const unlocked = data(await ctx.app.inject({ method: 'POST', url: `/api/share/${token}/access`, payload: { password: 'open sesame' } }));
    expect(unlocked.folder.items.map((i: { name: string }) => i.name)).toEqual(['public.txt']);

    const access = unlocked.accessToken as string;
    const dl = await ctx.app.inject({ method: 'GET', url: `/api/share/${token}/files/${inside.id}/download?access=${access}` });
    expect(dl.body).toBe('hello world');
    const escape = await ctx.app.inject({ method: 'GET', url: `/api/share/${token}/files/${outside.id}/download?access=${access}` });
    expect(escape.statusCode).toBe(404);

    await A.put(`/api/drive/folders/${folder.id}/general-access`, { access: 'RESTRICTED' });
    expect((await ctx.app.inject({ method: 'GET', url: `/api/share/${token}` })).statusCode).toBe(404);
  });

  it('redeeming a link grants a real permission at the link role', async () => {
    const A = client(ctx.app, alice);
    const C = client(ctx.app, carol);
    const doc = data(await A.post('/api/docs', { title: 'Link doc' }));
    const state = data(await A.put(`/api/drive/files/${doc.fileId}/general-access`, { access: 'ANYONE_WITH_LINK', linkRole: 'COMMENTER' }));
    const redeemed = data(await C.post(`/api/share/${state.link.token}/redeem`, {}));
    expect(redeemed).toMatchObject({ resourceType: 'FILE', fileType: 'DOCUMENT', resourceId: doc.id });
    const opened = data(await C.get(`/api/docs/${doc.id}`));
    expect(opened.capabilities.role).toBe('COMMENTER');
  });
});
