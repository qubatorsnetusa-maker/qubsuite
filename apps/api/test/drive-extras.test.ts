import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Extras');
  bob = await registerUser(ctx.app, 'Bob Extras');
});
afterAll(async () => {
  await ctx.close();
});

const names = (res: { json(): { data: { items: { name: string }[] } } }) => res.json().data.items.map((i) => i.name);

describe('listing filters', () => {
  it('filters by owner, a specific person and modified date', async () => {
    const a = client(ctx.app, alice);
    const b = client(ctx.app, bob);
    const folder = data(await a.post('/api/drive/folders', { name: 'Filter lab' }));
    await a.upload(`/api/drive/files/upload?folderId=${folder.id}`, 'alice-notes.txt', 'mine');
    await a.post(`/api/drive/folders/${folder.id}/share`, { email: bob.email, role: 'EDITOR', notify: false });
    await b.upload(`/api/drive/files/upload?folderId=${folder.id}`, 'bob-notes.txt', 'his');

    const base = `/api/drive/items?folderId=${folder.id}`;
    expect(names(await a.get(base)).sort()).toEqual(['alice-notes.txt', 'bob-notes.txt']);
    expect(names(await a.get(`${base}&owner=me`))).toEqual(['alice-notes.txt']);
    expect(names(await a.get(`${base}&owner=not_me`))).toEqual(['bob-notes.txt']);
    expect(names(await a.get(`${base}&ownerId=${bob.id}`))).toEqual(['bob-notes.txt']);

    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(names(await a.get(`${base}&modifiedAfter=${encodeURIComponent(future)}`))).toEqual([]);
    expect(names(await a.get(`${base}&modifiedAfter=${encodeURIComponent(past)}`)).length).toBe(2);
    expect(names(await a.get(`${base}&modifiedBefore=${encodeURIComponent(past)}`))).toEqual([]);

    // Views accept the same filters.
    expect(names(await b.get(`/api/drive/shared?owner=me`))).toEqual([]);
    expect(names(await b.get(`/api/drive/shared?ownerId=${alice.id}`))).toContain('Filter lab');
  });

  it('lists the people the user shares with, and nobody else', async () => {
    const stranger = await registerUser(ctx.app, 'Stranger Extras');
    const people = data(await client(ctx.app, alice).get('/api/drive/people'));
    const ids = people.map((p: { id: string }) => p.id);
    expect(ids).toContain(bob.id);
    expect(ids).not.toContain(stranger.id);
    expect(ids).not.toContain(alice.id);
  });
});

describe('folder upload', () => {
  it('creates nested folders in one call and dedupes the top-level name', async () => {
    const a = client(ctx.app, alice);
    const first = await a.post('/api/drive/folders/tree', { paths: ['Trip', 'Trip/Photos/Day 1', 'Trip/Docs'] });
    expect(first.statusCode, first.body).toBe(201);
    const map = data(first).folders;
    expect(Object.keys(map).sort()).toEqual(['Trip', 'Trip/Docs', 'Trip/Photos', 'Trip/Photos/Day 1']);

    const up = await a.upload(`/api/drive/files/upload?folderId=${map['Trip/Photos/Day 1']}`, 'beach.txt', 'sand');
    expect(up.statusCode).toBe(201);
    const day = data(await a.get(`/api/drive/folders/${map['Trip/Photos/Day 1']}`));
    expect(day.path.map((p: { name: string }) => p.name)).toEqual(['My Drive', 'Trip', 'Photos', 'Day 1']);

    const second = data(await a.post('/api/drive/folders/tree', { paths: ['Trip/Docs'] })).folders;
    const trip2 = data(await a.get(`/api/drive/folders/${second.Trip}`));
    expect(trip2.name).toBe('Trip (1)');
  });

  it('rejects unsafe names and folders the user cannot edit', async () => {
    const a = client(ctx.app, alice);
    expect((await a.post('/api/drive/folders/tree', { paths: ['ok/..'] })).statusCode).toBe(422);
    expect((await a.post('/api/drive/folders/tree', { paths: [] })).statusCode).toBe(422);
    const aliceOnly = data(await a.post('/api/drive/folders', { name: 'Private' }));
    // Folders someone can't see don't reveal that they exist.
    expect((await client(ctx.app, bob).post('/api/drive/folders/tree', { parentId: aliceOnly.id, paths: ['x'] })).statusCode).toBe(404);
  });
});

describe('storage summary and version clean-up', () => {
  it('breaks down the user’s storage and frees space by deleting an old version', async () => {
    const carol = await registerUser(ctx.app, 'Carol Storage');
    const c = client(ctx.app, carol);
    const file = data(await c.upload('/api/drive/files/upload', 'report.txt', 'x'.repeat(3000)));
    await c.upload(`/api/drive/files/${file.id}/versions`, 'report.txt', 'y'.repeat(1000));
    const trashed = data(await c.upload('/api/drive/files/upload', 'old.txt', 'z'.repeat(500)));
    await c.post(`/api/drive/files/${trashed.id}/trash`);

    let s = data(await c.get('/api/drive/storage'));
    expect(s).toMatchObject({ usedBytes: 4500, quotaSource: 'default', trash: { bytes: 500, items: 1 }, olderVersions: { bytes: 3000, files: 1 } });
    expect(s.breakdown.find((b: { key: string }) => b.key === 'older_versions').bytes).toBe(3000);
    expect(s.largestFiles[0]).toMatchObject({ id: file.id, storedBytes: 4000, versions: 2 });

    const versions = data(await c.get(`/api/drive/files/${file.id}/versions`));
    const current = versions.find((v: { isCurrent: boolean }) => v.isCurrent);
    const old = versions.find((v: { isCurrent: boolean }) => !v.isCurrent);
    expect((await c.delete(`/api/drive/files/${file.id}/versions/${current.id}`)).statusCode).toBe(400);
    expect((await client(ctx.app, bob).delete(`/api/drive/files/${file.id}/versions/${old.id}`)).statusCode).toBe(404);
    const del = await c.delete(`/api/drive/files/${file.id}/versions/${old.id}`);
    expect(data(del)).toEqual({ freedBytes: 3000 });

    s = data(await c.get('/api/drive/storage'));
    expect(s.usedBytes).toBe(1500);
    expect(s.olderVersions).toEqual({ bytes: 0, files: 0 });
    const activity = data(await c.get(`/api/drive/files/${file.id}/activity`));
    expect(activity.items[0].action).toBe('FILE_VERSION_DELETED');
  });

  it('keeps bytes that a restored version still uses', async () => {
    const dan = await registerUser(ctx.app, 'Dan Restore');
    const d = client(ctx.app, dan);
    const file = data(await d.upload('/api/drive/files/upload', 'plan.txt', 'first'));
    await d.upload(`/api/drive/files/${file.id}/versions`, 'plan.txt', 'second');
    let versions = data(await d.get(`/api/drive/files/${file.id}/versions`));
    await d.post(`/api/drive/files/${file.id}/versions/${versions.find((v: { versionNumber: number }) => v.versionNumber === 1).id}/restore`);
    versions = data(await d.get(`/api/drive/files/${file.id}/versions`));
    // v1 and the current v3 share the same stored bytes; deleting v1 must not break the current version.
    await d.delete(`/api/drive/files/${file.id}/versions/${versions.find((v: { versionNumber: number }) => v.versionNumber === 1).id}`);
    const content = await ctx.app.inject({ method: 'GET', url: `/api/drive/files/${file.id}/download`, headers: { authorization: `Bearer ${dan.token}` } });
    expect(content.statusCode).toBe(200);
    expect(content.body).toBe('first');
  });
});

describe('suggested files', () => {
  it('surfaces what the user worked on and what others changed, with previews', async () => {
    const erin = await registerUser(ctx.app, 'Erin Suggest');
    const e = client(ctx.app, erin);
    const b = client(ctx.app, bob);
    const doc = data(await e.post('/api/docs', { templateId: 'doc-resume', title: 'Erin CV' }));
    const sharedDoc = data(await b.post('/api/docs', { title: 'Bob plan' }));
    await b.post(`/api/drive/files/${sharedDoc.fileId}/share`, { email: erin.email, role: 'VIEWER', notify: false });
    const hidden = data(await b.post('/api/docs', { title: 'Bob private' }));

    const items = data(await e.get('/api/drive/suggested'));
    const byName = new Map(items.map((i: { name: string }) => [i.name, i]));
    expect(byName.get('Erin CV')).toMatchObject({ reason: { kind: 'created', actor: null }, preview: { kind: 'document' } });
    expect(byName.get('Bob plan')).toMatchObject({ reason: { kind: 'shared', actor: { id: bob.id } } });
    expect(byName.has('Bob private')).toBe(false);
    expect(items[0].name).toBe('Bob plan'); // most recent first
    void doc;
    void hidden;
  });
});

describe('activity feed', () => {
  it('shows activity on reachable items, with categories and privacy for views', async () => {
    const fay = await registerUser(ctx.app, 'Fay Feed');
    const gus = await registerUser(ctx.app, 'Gus Feed');
    const f = client(ctx.app, fay);
    const g = client(ctx.app, gus);
    const folder = data(await f.post('/api/drive/folders', { name: 'Team room' }));
    await f.post(`/api/drive/folders/${folder.id}/share`, { email: gus.email, role: 'EDITOR', notify: false });
    const upload = data(await g.upload(`/api/drive/files/upload?folderId=${folder.id}`, 'gus.txt', 'hello'));
    await g.patch(`/api/drive/files/${upload.id}`, { name: 'gus-renamed.txt' });
    const secret = data(await g.upload('/api/drive/files/upload', 'gus-secret.txt', 'private'));
    // Fay downloads Gus's file: Gus (the owner) and Fay (who did it) may see that; others with access may not.
    await ctx.app.inject({ method: 'GET', url: `/api/drive/files/${upload.id}/download`, headers: { authorization: `Bearer ${fay.token}` } });

    const all = data(await f.get('/api/drive/activity'));
    const names = all.items.map((i: { item: { name: string } }) => i.item.name);
    expect(names).toContain('gus-renamed.txt');
    expect(names).toContain('Team room');
    expect(names).not.toContain('gus-secret.txt');
    // Opens and downloads only appear under Views.
    expect(all.items.some((i: { action: string }) => i.action === 'FILE_DOWNLOADED' || i.action === 'FILE_OPENED')).toBe(false);
    const renamed = all.items.find((i: { action: string }) => i.action === 'FILE_RENAMED');
    expect(renamed).toMatchObject({ actor: { id: gus.id }, item: { kind: 'file', available: true, fileType: 'TEXT' } });

    const edits = data(await f.get('/api/drive/activity?category=edits'));
    expect(edits.items.every((i: { action: string }) => !['FILE_DOWNLOADED', 'FILE_OPENED', 'FOLDER_SHARED'].includes(i.action))).toBe(true);
    const sharing = data(await f.get('/api/drive/activity?category=sharing'));
    expect(sharing.items.map((i: { action: string }) => i.action)).toEqual(['FOLDER_SHARED']);
    const mine = data(await f.get('/api/drive/activity?actor=me'));
    expect(mine.items.every((i: { actor: { id: string } }) => i.actor.id === fay.id)).toBe(true);
    const search = data(await f.get('/api/drive/activity?q=renamed'));
    expect(search.items.length).toBeGreaterThan(0);

    // Gus owns the file, so he sees Fay's download; a third person with access would not.
    const gusViews = data(await g.get('/api/drive/activity?category=views'));
    expect(gusViews.items.some((i: { action: string; actor: { id: string } }) => i.action === 'FILE_DOWNLOADED' && i.actor.id === fay.id)).toBe(true);
    const hal = await registerUser(ctx.app, 'Hal Feed');
    await f.post(`/api/drive/folders/${folder.id}/share`, { email: hal.email, role: 'VIEWER', notify: false });
    const halViews = data(await client(ctx.app, hal).get('/api/drive/activity?category=views'));
    expect(halViews.items).toEqual([]);

    // Trashed items stay in the history but can't be opened from it.
    await g.post(`/api/drive/files/${upload.id}/trash`);
    const after = data(await f.get('/api/drive/activity?category=trash'));
    expect(after.items[0]).toMatchObject({ action: 'FILE_DELETED', item: { available: false } });
    void secret;
  });

  it('pages with a cursor', async () => {
    const f = client(ctx.app, alice);
    const first = data(await f.get('/api/drive/activity?limit=2'));
    expect(first.items.length).toBe(2);
    expect(first.nextCursor).toBeTruthy();
    const second = data(await f.get(`/api/drive/activity?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`));
    expect(second.items[0].id).not.toBe(first.items[1].id);
  });
});
