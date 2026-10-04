import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spamItems } from '../src/db/schema';
import { purgeTrash } from '../src/jobs/purge-trash';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let owner: TestUser;
let me: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  owner = await registerUser(ctx.app, 'Sam Spammer');
  me = await registerUser(ctx.app, 'Rita Recipient');
});
afterAll(async () => {
  await ctx.close();
});

const names = (res: { json(): { data: { items: { name: string }[] } } }) => res.json().data.items.map((i) => i.name);

async function shareFile(from: TestUser, to: TestUser, name: string) {
  const file = data(await client(ctx.app, from).upload('/api/drive/files/upload', name, `content of ${name}`));
  const res = await client(ctx.app, from).post(`/api/drive/files/${file.id}/share`, { email: to.email, role: 'VIEWER', notify: false });
  expect(res.statusCode, res.body).toBe(200);
  return file as { id: string };
}

describe('spam', () => {
  it('moves a shared item out of every view into Spam, and back', async () => {
    const r = client(ctx.app, me);
    const file = await shareFile(owner, me, 'free-prize-offer.txt');
    await r.put(`/api/drive/files/${file.id}/star`);
    await r.get(`/api/drive/files/${file.id}/content`);
    expect(names(await r.get('/api/drive/shared'))).toContain('free-prize-offer.txt');

    const res = await r.post(`/api/drive/files/${file.id}/spam`, {});
    expect(res.statusCode, res.body).toBe(200);

    for (const url of ['/api/drive/shared', '/api/drive/starred', '/api/drive/recent', '/api/drive/search?q=prize']) {
      expect(names(await r.get(url)), url).not.toContain('free-prize-offer.txt');
    }
    expect(data(await r.get('/api/drive/suggested')).map((i: { name: string }) => i.name)).not.toContain('free-prize-offer.txt');
    const spam = data(await r.get('/api/drive/spam'));
    expect(spam.items).toHaveLength(1);
    expect(spam.items[0]).toMatchObject({ id: file.id, isSpam: true, sharedWithMe: true });
    // Opening it directly still works: spam is a view, not a permission change.
    expect((await r.get(`/api/drive/files/${file.id}`)).statusCode).toBe(200);

    expect((await r.delete(`/api/drive/files/${file.id}/spam`)).statusCode).toBe(200);
    expect(names(await r.get('/api/drive/shared'))).toContain('free-prize-offer.txt');
    expect(data(await r.get('/api/drive/spam')).items).toEqual([]);
  });

  it('hides the contents of a spam folder from search and the app home pages', async () => {
    const o = client(ctx.app, owner);
    const folder = data(await o.post('/api/drive/folders', { name: 'Promo pack' }));
    await o.upload(`/api/drive/files/upload?folderId=${folder.id}`, 'promo-inside.txt', 'x');
    await o.post(`/api/drive/folders/${folder.id}/share`, { email: me.email, role: 'VIEWER', notify: false });
    const r = client(ctx.app, me);
    expect(names(await r.get('/api/drive/search?q=promo-inside'))).toContain('promo-inside.txt');
    await r.post(`/api/drive/folders/${folder.id}/spam`, {});
    expect(names(await r.get('/api/drive/search?q=promo'))).toEqual([]);
    expect(names(await r.get('/api/drive/shared'))).not.toContain('Promo pack');
    const feed = data(await r.get('/api/drive/activity'));
    expect(feed.items.some((i: { item: { name: string } }) => i.item.name === 'Promo pack' || i.item.name === 'promo-inside.txt')).toBe(false);
  });

  it('only accepts items shared directly with you', async () => {
    const r = client(ctx.app, me);
    const mine = data(await r.upload('/api/drive/files/upload', 'my-own.txt', 'x'));
    expect((await r.post(`/api/drive/files/${mine.id}/spam`, {})).statusCode).toBe(404);
    const notShared = data(await client(ctx.app, owner).upload('/api/drive/files/upload', 'private.txt', 'x'));
    expect((await r.post(`/api/drive/files/${notShared.id}/spam`, {})).statusCode).toBe(404);
  });

  it('removes your access when deleted from Spam, or after 30 days', async () => {
    const r = client(ctx.app, me);
    const a = await shareFile(owner, me, 'junk-a.txt');
    const b = await shareFile(owner, me, 'junk-b.txt');
    await r.post(`/api/drive/files/${a.id}/spam`, {});
    await r.post(`/api/drive/files/${b.id}/spam`, {});

    expect((await r.delete(`/api/drive/files/${a.id}/access`)).statusCode).toBe(200);
    expect((await r.get(`/api/drive/files/${a.id}`)).statusCode).toBe(404);
    // The owner's file is untouched.
    expect((await client(ctx.app, owner).get(`/api/drive/files/${a.id}`)).statusCode).toBe(200);

    await ctx.db.db.update(spamItems).set({ createdAt: sql`now() - interval '31 days'` }).where(eq(spamItems.fileId, b.id));
    const result = await purgeTrash(ctx.app.services, ctx.app.log);
    expect(result.expiredSpam).toBeGreaterThanOrEqual(1);
    expect((await r.get(`/api/drive/files/${b.id}`)).statusCode).toBe(404);
    expect(data(await r.get('/api/drive/spam')).items.map((i: { id: string }) => i.id)).not.toContain(b.id);
  });

  it('empties Spam in one go', async () => {
    const r = client(ctx.app, me);
    const c = await shareFile(owner, me, 'junk-c.txt');
    await r.post(`/api/drive/files/${c.id}/spam`, {});
    const res = data(await r.post('/api/drive/spam/empty'));
    expect(res.removed).toBeGreaterThanOrEqual(1);
    expect(data(await r.get('/api/drive/spam')).items).toEqual([]);
    expect((await r.get(`/api/drive/files/${c.id}`)).statusCode).toBe(404);
  });

  it('removes an item shared with you without reporting it', async () => {
    const r = client(ctx.app, me);
    const d = await shareFile(owner, me, 'not-needed.txt');
    expect(data(await r.get(`/api/drive/files/${d.id}`)).sharedWithMe).toBe(true);
    await r.delete(`/api/drive/files/${d.id}/access`);
    expect(names(await r.get('/api/drive/shared'))).not.toContain('not-needed.txt');
  });
});

describe('blocking', () => {
  it('moves everything from the person to Spam, stops new shares and notifications, and can be undone', async () => {
    const pest = await registerUser(ctx.app, 'Pete Pest');
    const r = client(ctx.app, me);
    const p = client(ctx.app, pest);
    const first = await shareFile(pest, me, 'pest-1.txt');
    const second = await shareFile(pest, me, 'pest-2.txt');

    const res = await r.post(`/api/drive/files/${first.id}/spam`, { blockOwner: true });
    expect(data(res)).toEqual({ blocked: true });
    const spamIds = data(await r.get('/api/drive/spam')).items.map((i: { id: string }) => i.id);
    expect(spamIds).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(data(await r.get('/api/users/blocked')).map((u: { id: string }) => u.id)).toEqual([pest.id]);

    // They can't share anything new with me, and I get no notifications from them.
    const third = data(await p.upload('/api/drive/files/upload', 'pest-3.txt', 'x'));
    const blockedShare = await p.post(`/api/drive/files/${third.id}/share`, { email: me.email, role: 'VIEWER', notify: true });
    expect(blockedShare.statusCode).toBe(403);
    const before = data(await r.get('/api/notifications')).items.length;
    await ctx.app.services.notifications.notify([{ userId: me.id, actorId: pest.id, type: 'COMMENTED', title: 'ping' }]);
    expect(data(await r.get('/api/notifications')).items.length).toBe(before);

    await r.delete(`/api/users/blocked/${pest.id}`);
    expect(data(await r.get('/api/users/blocked'))).toEqual([]);
    expect((await p.post(`/api/drive/files/${third.id}/share`, { email: me.email, role: 'VIEWER', notify: false })).statusCode).toBe(200);
  });

  it('blocks from the list endpoint and refuses to block yourself', async () => {
    const other = await registerUser(ctx.app, 'Olly Other');
    const r = client(ctx.app, me);
    expect((await r.post('/api/users/blocked', { userId: other.id })).statusCode).toBe(200);
    expect((await r.post('/api/users/blocked', { userId: me.id })).statusCode).toBe(400);
    await r.delete(`/api/users/blocked/${other.id}`);
  });
});
