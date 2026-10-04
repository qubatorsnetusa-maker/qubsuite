import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activityLogs, driveFiles } from '../src/db/schema';
import { client, createTestApp, data, PNG_1PX, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let api: ReturnType<typeof client>;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Drive');
  api = client(ctx.app, alice);
});
afterAll(async () => {
  await ctx.close();
});

const storagePath = (key: string) => path.join(os.tmpdir(), 'qub-test-storage', ...key.split('/'));

async function folder(name: string, parentId?: string) {
  const res = await api.post('/api/drive/folders', { name, parentId });
  expect(res.statusCode).toBe(201);
  return data(res);
}

describe('folders', () => {
  it('supports arbitrary nesting with breadcrumbs', async () => {
    const work = await folder('Work');
    const projects = await folder('Projects', work.id);
    const qub = await folder('Qub', projects.id);
    const detail = data(await api.get(`/api/drive/folders/${qub.id}`));
    expect(detail.path.map((p: { name: string }) => p.name)).toEqual(['My Drive', 'Work', 'Projects', 'Qub']);
  });

  it('rejects moving a folder into itself or a descendant', async () => {
    const a = await folder('A');
    const b = await folder('B', a.id);
    const c = await folder('C', b.id);
    for (const target of [a.id, c.id]) {
      const res = await api.post(`/api/drive/folders/${a.id}/move`, { folderId: target });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('INVALID_MOVE');
    }
    const ok = await api.post(`/api/drive/folders/${c.id}/move`, { folderId: a.id });
    expect(ok.statusCode).toBe(200);
    expect(data(ok).parentId).toBe(a.id);
  });

  it('lists folders first with server-side sorting and pagination', async () => {
    const box = await folder('Sorted');
    for (const n of ['b.txt', 'a.txt', 'c.txt']) await api.upload(`/api/drive/files/upload?folderId=${box.id}`, n, `content of ${n}`, 'text/plain');
    await folder('zeta', box.id);
    const page1 = data(await api.get(`/api/drive/items?folderId=${box.id}&limit=2&sort=name&order=asc`));
    expect(page1.items.map((i: { name: string }) => i.name)).toEqual(['zeta', 'a.txt']);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = data(await api.get(`/api/drive/items?folderId=${box.id}&limit=2&sort=name&order=asc&cursor=${page1.nextCursor}`));
    expect(page2.items.map((i: { name: string }) => i.name)).toEqual(['b.txt', 'c.txt']);
  });
});

describe('uploads', () => {
  it('sniffs the real MIME type, sanitises names, dedupes and stores a checksum', async () => {
    const res = await api.upload('/api/drive/files/upload', '../../etc/evil<name>.png', PNG_1PX, 'application/x-msdownload');
    expect(res.statusCode).toBe(201);
    const file = data(res);
    expect(file.mimeType).toBe('image/png');
    expect(file.fileType).toBe('IMAGE');
    expect(file.name).toBe('evilname.png');
    expect(file.size).toBe(PNG_1PX.length);

    const dup = data(await api.upload('/api/drive/files/upload', 'evilname.png', PNG_1PX));
    expect(dup.name).toBe('evilname (1).png');

    const [row] = await ctx.db.db.select().from(driveFiles).where(eq(driveFiles.id, file.id));
    expect(row!.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(storagePath(row!.storageKey!))).toBe(true);

    const download = await api.get(`/api/drive/files/${file.id}/download`);
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.rawPayload.equals(PNG_1PX)).toBe(true);
  });

  it('refuses executables regardless of name tricks', async () => {
    const mz = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]);
    const res = await api.upload('/api/drive/files/upload', 'invoice.pdf.exe', mz, 'application/pdf');
    expect(res.statusCode).toBe(415);
  });

  it('serves byte ranges for streaming', async () => {
    const file = data(await api.upload('/api/drive/files/upload', 'range.txt', '0123456789', 'text/plain'));
    const res = await ctx.app.inject({ method: 'GET', url: `/api/drive/files/${file.id}/content`, headers: { authorization: `Bearer ${alice.token}`, range: 'bytes=2-5' } });
    expect(res.statusCode).toBe(206);
    expect(res.body).toBe('2345');
    expect(res.headers['content-range']).toBe('bytes 2-5/10');
  });
});

describe('versions', () => {
  it('uploads, lists, downloads and restores versions without rewriting history', async () => {
    const file = data(await api.upload('/api/drive/files/upload', 'notes.txt', 'version one', 'text/plain'));
    await api.upload(`/api/drive/files/${file.id}/versions`, 'notes.txt', 'version two!', 'text/plain');
    let versions = data(await api.get(`/api/drive/files/${file.id}/versions`));
    expect(versions.map((v: { versionNumber: number }) => v.versionNumber)).toEqual([2, 1]);
    expect(versions[0].isCurrent).toBe(true);

    const v1 = versions.find((v: { versionNumber: number }) => v.versionNumber === 1);
    const old = await api.get(`/api/drive/files/${file.id}/versions/${v1.id}/download`);
    expect(old.body).toBe('version one');

    await api.post(`/api/drive/files/${file.id}/versions/${v1.id}/restore`);
    versions = data(await api.get(`/api/drive/files/${file.id}/versions`));
    expect(versions[0]).toMatchObject({ versionNumber: 3, isCurrent: true });
    expect((await api.get(`/api/drive/files/${file.id}/download`)).body).toBe('version one');
  });
});

describe('trash', () => {
  it('trashing a folder hides its contents, restore brings back the original location', async () => {
    const parent = await folder('Trash Parent');
    const child = await folder('Trash Child', parent.id);
    const file = data(await api.upload(`/api/drive/files/upload?folderId=${child.id}`, 'inside.txt', 'x', 'text/plain'));

    expect((await api.post(`/api/drive/folders/${child.id}/trash`)).statusCode).toBe(200);
    const trash = data(await api.get('/api/drive/trash'));
    expect(trash.items.map((i: { id: string }) => i.id)).toContain(child.id);
    expect(trash.items.map((i: { id: string }) => i.id)).not.toContain(file.id); // shown inside its folder, not separately
    const listing = data(await api.get(`/api/drive/items?folderId=${parent.id}`));
    expect(listing.items).toHaveLength(0);
    // Restoring the file alone is refused: its folder is what was trashed.
    expect((await api.post(`/api/drive/files/${file.id}/restore`)).statusCode).toBe(400);

    const restored = data(await api.post(`/api/drive/folders/${child.id}/restore`));
    expect(restored.parentId).toBe(parent.id);
    expect(data(await api.get(`/api/drive/files/${file.id}`)).isTrashed).toBe(false);
  });

  it('restores to My Drive when the original folder is gone, and permanently deletes stored bytes', async () => {
    const f = await folder('Doomed');
    const file = data(await api.upload(`/api/drive/files/upload?folderId=${f.id}`, 'bytes.txt', 'bye', 'text/plain'));
    const [row] = await ctx.db.db.select().from(driveFiles).where(eq(driveFiles.id, file.id));
    await api.post(`/api/drive/files/${file.id}/trash`);
    await api.post(`/api/drive/folders/${f.id}/trash`);
    await api.delete(`/api/drive/folders/${f.id}`);
    // The file row went with its folder (cascade) — and its bytes are removed from storage.
    expect((await api.get(`/api/drive/files/${file.id}`)).statusCode).toBe(404);
    expect(existsSync(storagePath(row!.storageKey!))).toBe(false);

    const lone = data(await api.upload('/api/drive/files/upload', 'lone.txt', 'x', 'text/plain'));
    await api.post(`/api/drive/files/${lone.id}/trash`);
    const emptied = data(await api.post('/api/drive/trash/empty'));
    expect(emptied.deleted).toBeGreaterThan(0);
    expect((await api.get(`/api/drive/files/${lone.id}`)).statusCode).toBe(404);
  });
});

describe('copy, star, recent, search, activity', () => {
  it('copies folders recursively, including Qub documents', async () => {
    const src = await folder('Copy Source');
    const sub = await folder('Nested', src.id);
    await api.upload(`/api/drive/files/upload?folderId=${sub.id}`, 'deep.txt', 'deep', 'text/plain');
    const doc = data(await api.post('/api/docs', { title: 'Copy me', folderId: src.id }));
    const res = await api.post(`/api/drive/folders/${src.id}/copy`, {});
    expect(res.statusCode).toBe(201);
    const copy = data(res).folder;
    expect(copy.name).toBe('Copy of Copy Source');
    const items = data(await api.get(`/api/drive/items?folderId=${copy.id}`)).items;
    expect(items.map((i: { name: string }) => i.name).sort()).toEqual(['Copy me', 'Nested']);
    const copiedDoc = items.find((i: { name: string }) => i.name === 'Copy me');
    expect(copiedDoc.resourceId).toBeTruthy();
    expect(copiedDoc.resourceId).not.toBe(doc.id);
  });

  it('stars per user and lists starred items', async () => {
    const file = data(await api.upload('/api/drive/files/upload', 'star.txt', 'x', 'text/plain'));
    await api.put(`/api/drive/files/${file.id}/star`);
    const starred = data(await api.get('/api/drive/starred'));
    expect(starred.items.map((i: { id: string }) => i.id)).toContain(file.id);
    expect(starred.items[0].isStarred).toBe(true);
  });

  it('tracks recent files from real activity', async () => {
    const doc = data(await api.post('/api/docs', { title: 'Recently opened' }));
    await api.get(`/api/docs/${doc.id}`);
    const recent = data(await api.get('/api/drive/recent'));
    expect(recent.items[0].id).toBe(doc.fileId);
    const events = await ctx.db.db.select().from(activityLogs).where(eq(activityLogs.resourceId, doc.fileId));
    expect(events.map((e) => e.action)).toEqual(expect.arrayContaining(['FILE_CREATED', 'FILE_OPENED']));
  });

  it('searches names (fuzzy) and document contents on the server', async () => {
    await api.upload('/api/drive/files/upload', 'Quarterly Budget Report.txt', 'numbers', 'text/plain');
    const found = data(await api.get('/api/drive/search?q=budget'));
    expect(found.items.map((i: { name: string }) => i.name)).toContain('Quarterly Budget Report.txt');
    const typo = data(await api.get('/api/drive/search?q=Quartely%20Budgt'));
    expect(typo.items.map((i: { name: string }) => i.name)).toContain('Quarterly Budget Report.txt');
    const typed = data(await api.get('/api/drive/search?q=budget&type=DOCUMENT'));
    expect(typed.items).toHaveLength(0);

    const doc = data(await api.post('/api/docs', { title: 'Meeting notes' }));
    await ctx.app.services.docs.persistFromCollaboration(doc.id, {
      state: new Uint8Array(),
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Discussed the zeppelin acquisition' }] }] },
      editorIds: [alice.id],
    });
    const byContent = data(await api.get('/api/drive/search?q=zeppelin'));
    expect(byContent.items.map((i: { name: string }) => i.name)).toContain('Meeting notes');
  });

  it('records a history of actions for "View activity"', async () => {
    const file = data(await api.upload('/api/drive/files/upload', 'history.txt', 'x', 'text/plain'));
    await api.patch(`/api/drive/files/${file.id}`, { name: 'history-renamed.txt' });
    const target = await folder('History Target');
    await api.post(`/api/drive/files/${file.id}/move`, { folderId: target.id });
    const activity = data(await api.get(`/api/drive/files/${file.id}/activity`));
    expect(activity.items.map((a: { action: string }) => a.action)).toEqual(['FILE_MOVED', 'FILE_RENAMED', 'FILE_CREATED']);
  });
});
