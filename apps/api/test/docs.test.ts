import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';
import { documents, driveFiles } from '../src/db/schema';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;
let baseUrl: string;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Docs');
  bob = await registerUser(ctx.app, 'Bob Docs');
  await ctx.app.listen({ port: 0, host: '127.0.0.1' });
  baseUrl = `ws://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await ctx.close();
});

/** A minimal y-websocket-protocol client backed by a real Y.Doc. */
class YClient {
  readonly doc = new Y.Doc();
  readonly ws: WebSocket;
  readonly statuses: { status: string }[] = [];
  closeCode: number | null = null;
  private synced!: () => void;
  readonly ready = new Promise<void>((r) => (this.synced = r));

  constructor(documentId: string, token: string) {
    this.ws = new WebSocket(`${baseUrl}/api/ws/docs/${documentId}?token=${token}`);
    this.ws.binaryType = 'arraybuffer';
    this.ws.on('open', () => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, 0);
      syncProtocol.writeSyncStep1(enc, this.doc);
      this.ws.send(encoding.toUint8Array(enc));
    });
    this.ws.on('close', (code) => (this.closeCode = code));
    this.ws.on('message', (raw: ArrayBuffer) => {
      const dec = decoding.createDecoder(new Uint8Array(raw));
      const type = decoding.readVarUint(dec);
      if (type === 0) {
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, 0);
        const syncType = syncProtocol.readSyncMessage(dec, enc, this.doc, 'server');
        if (encoding.length(enc) > 1) this.ws.send(encoding.toUint8Array(enc));
        if (syncType === syncProtocol.messageYjsSyncStep2) this.synced();
      } else if (type === 100) {
        this.statuses.push(JSON.parse(decoding.readVarString(dec)));
      }
    });
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      // Like y-websocket: only stream updates on an open socket; anything missed is exchanged by the sync handshake.
      if (origin === 'server' || this.ws.readyState !== WebSocket.OPEN) return;
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, 0);
      syncProtocol.writeUpdate(enc, update);
      this.ws.send(encoding.toUint8Array(enc));
    });
  }

  text(): string {
    return this.doc.getXmlFragment('default').toString();
  }

  close() {
    this.ws.close();
  }
}

async function until(fn: () => boolean, timeout = 5000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
}

function typeParagraph(c: YClient, text: string) {
  const schema = ctx.app.services.docs.schema;
  const fragment = c.doc.getXmlFragment('default');
  c.doc.transact(() => {
    fragment.delete(0, fragment.length);
    prosemirrorJSONToYXmlFragment(schema, { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, fragment);
  });
}

describe('document creation flow', () => {
  it('creates drive_file (DOCUMENT) + document in My Drive, linked by fileId', async () => {
    const res = await client(ctx.app, alice).post('/api/docs', { title: 'Design doc' });
    expect(res.statusCode).toBe(201);
    const doc = data(res);
    const [file] = await ctx.db.db.select().from(driveFiles).where(eq(driveFiles.id, doc.fileId));
    expect(file).toMatchObject({ fileType: 'DOCUMENT', folderId: alice.rootFolderId, name: 'Design doc', ownerId: alice.id });
    const [row] = await ctx.db.db.select().from(documents).where(eq(documents.id, doc.id));
    expect(row!.fileId).toBe(file!.id);
    expect(row!.content).toEqual({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null, lineHeight: null } }] });
  });

  it('rolls back the drive file when the document cannot be created', async () => {
    const before = await ctx.db.db.select().from(driveFiles).where(eq(driveFiles.ownerId, alice.id));
    await expect(
      ctx.app.services.docs.create(alice.id, { title: 'Broken' }, { type: 'doc', content: [{ type: 'no-such-node' }] } as never),
    ).rejects.toThrow();
    const after = await ctx.db.db.select().from(driveFiles).where(eq(driveFiles.ownerId, alice.id));
    expect(after.length).toBe(before.length);
  });

  it('moving and trashing keeps the same document connected to its file', async () => {
    const api = client(ctx.app, alice);
    const doc = data(await api.post('/api/docs', { title: 'Qub Budget' }));
    const work = data(await api.post('/api/drive/folders', { name: 'Work' }));
    const finance = data(await api.post('/api/drive/folders', { name: 'Finance', parentId: work.id }));
    await api.post(`/api/drive/files/${doc.fileId}/move`, { folderId: finance.id });
    const moved = data(await api.get(`/api/docs/${doc.id}`));
    expect(moved).toMatchObject({ id: doc.id, fileId: doc.fileId, folderId: finance.id });

    await api.post(`/api/docs/${doc.id}/trash`);
    const trashed = data(await api.get(`/api/docs/${doc.id}`));
    expect(trashed.isTrashed).toBe(true); // document remains available to its owner
    await api.post(`/api/drive/files/${doc.fileId}/restore`);
    expect(data(await api.get(`/api/docs/${doc.id}`))).toMatchObject({ isTrashed: false, folderId: finance.id });
  });
});

describe('real-time collaboration over WebSocket', () => {
  it("delivers User A's edits to User B without refresh, persists them, and acknowledges the save", async () => {
    const api = client(ctx.app, alice);
    const doc = data(await api.post('/api/docs', { title: 'Live doc' }));
    await api.post(`/api/drive/files/${doc.fileId}/share`, { email: bob.email, role: 'EDITOR', notify: false });

    const a = new YClient(doc.id, alice.token);
    const b = new YClient(doc.id, bob.token);
    await Promise.all([a.ready, b.ready]);

    typeParagraph(a, 'Hello from Alice');
    await until(() => b.text().includes('Hello from Alice'));

    await until(() => a.statuses.some((s) => s.status === 'saved'), 8000);
    const [row] = await ctx.db.db.select().from(documents).where(eq(documents.id, doc.id));
    expect(JSON.stringify(row!.content)).toContain('Hello from Alice');
    expect(row!.plainText).toContain('Hello from Alice');
    a.close();
    b.close();
  });

  it('ignores document writes from viewers and rejects users without access', async () => {
    const api = client(ctx.app, alice);
    const doc = data(await api.post('/api/docs', { title: 'Read only' }));
    await api.post(`/api/drive/files/${doc.fileId}/share`, { email: bob.email, role: 'VIEWER', notify: false });
    const owner = new YClient(doc.id, alice.token);
    const viewer = new YClient(doc.id, bob.token);
    await Promise.all([owner.ready, viewer.ready]);

    typeParagraph(viewer, 'Vandalism');
    await new Promise((r) => setTimeout(r, 500));
    expect(owner.text()).not.toContain('Vandalism');

    const outsider = await registerUser(ctx.app, 'Outsider');
    const denied = new YClient(doc.id, outsider.token);
    await until(() => denied.closeCode !== null);
    expect(denied.closeCode).toBe(4404);

    const anonymous = new YClient(doc.id, 'garbage');
    await until(() => anonymous.closeCode !== null);
    expect(anonymous.closeCode).toBe(4401);
    owner.close();
    viewer.close();
  });

  it('merges edits made while disconnected when the client reconnects', async () => {
    const api = client(ctx.app, alice);
    const doc = data(await api.post('/api/docs', { title: 'Offline edits' }));
    const first = new YClient(doc.id, alice.token);
    await first.ready;
    first.close();
    // Edit locally while offline, then reconnect with the same Y.Doc state.
    typeParagraph(first, 'Written offline');
    const offlineState = Y.encodeStateAsUpdate(first.doc);
    const second = new YClient(doc.id, alice.token);
    Y.applyUpdate(second.doc, offlineState, 'local');
    await second.ready;
    // The server asked for our missing updates via sync step 1; our step 2 carries the offline edit.
    const observer = new YClient(doc.id, alice.token);
    await observer.ready;
    await until(() => observer.text().includes('Written offline'));
    second.close();
    observer.close();
  });

  it('restores a previous version into the live document', async () => {
    const api = client(ctx.app, alice);
    const doc = data(await api.post('/api/docs', { title: 'Versioned' }));
    const live = new YClient(doc.id, alice.token);
    await live.ready;
    typeParagraph(live, 'First draft');
    await until(() => live.statuses.length > 0, 8000);
    const v1 = data(await api.post(`/api/docs/${doc.id}/versions`, { name: 'Draft 1' }));
    typeParagraph(live, 'Second draft');
    await until(() => live.statuses.length > 1, 8000);

    await api.post(`/api/docs/${doc.id}/versions/${v1.id}/restore`);
    await until(() => live.text().includes('First draft') && !live.text().includes('Second draft'));
    const versions = data(await api.get(`/api/docs/${doc.id}/versions`));
    expect(versions.map((v: { name: string | null }) => v.name)).toContain('Before restoring version 2');
    live.close();
  });
});

describe('comments and mentions', () => {
  it('supports threads, replies, resolve/reopen, edit, delete and mention notifications', async () => {
    const A = client(ctx.app, alice);
    const B = client(ctx.app, bob);
    const doc = data(await A.post('/api/docs', { title: 'Commented' }));
    await A.post(`/api/drive/files/${doc.fileId}/share`, { email: bob.email, role: 'COMMENTER', notify: false });
    const outsider = await registerUser(ctx.app, 'Not Invited');

    const created = await B.post(`/api/docs/${doc.id}/comments`, { anchorId: 'anchor-abcdef12', quotedText: 'intro', body: 'Please clarify @Alice', mentions: [alice.id, outsider.id] });
    expect(created.statusCode).toBe(201);
    const comment = data(created);
    // Only users with access can be mentioned.
    expect(comment.mentions).toEqual([alice.id]);
    const aliceNotes = data(await A.get('/api/notifications')).items;
    expect(aliceNotes[0].type).toBe('MENTIONED');

    await A.post(`/api/docs/${doc.id}/comments/${comment.id}/replies`, { body: 'Done!' });
    let threads = data(await A.post(`/api/docs/${doc.id}/comments/${comment.id}/resolve`));
    expect(threads[0]).toMatchObject({ resolved: true, replies: [{ body: 'Done!' }] });
    threads = data(await B.post(`/api/docs/${doc.id}/comments/${comment.id}/reopen`));
    expect(threads[0].resolved).toBe(false);

    expect((await A.patch(`/api/docs/${doc.id}/comments/${comment.id}`, { body: 'edited by someone else' })).statusCode).toBe(403);
    threads = data(await B.patch(`/api/docs/${doc.id}/comments/${comment.id}`, { body: 'Please clarify (edited)' }));
    expect(threads[0]).toMatchObject({ body: 'Please clarify (edited)' });
    expect(threads[0].editedAt).toBeTruthy();
    // Owners can delete anyone's comment.
    expect((await A.delete(`/api/docs/${doc.id}/comments/${comment.id}`)).statusCode).toBe(200);
    expect(data(await A.get(`/api/docs/${doc.id}/comments`))).toHaveLength(0);
  });

  it('notifies users newly @mentioned in the document body', async () => {
    const A = client(ctx.app, alice);
    const doc = data(await A.post('/api/docs', { title: 'Mention body' }));
    await A.post(`/api/drive/files/${doc.fileId}/share`, { email: bob.email, role: 'EDITOR', notify: false });
    await ctx.app.services.docs.persistFromCollaboration(doc.id, {
      state: new Uint8Array(),
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: bob.id, label: 'Bob' } }] }] },
      editorIds: [alice.id],
    });
    const notes = data(await client(ctx.app, bob).get('/api/notifications')).items;
    expect(notes.some((n: { type: string; link: string }) => n.type === 'MENTIONED' && n.link === `/docs/${doc.id}`)).toBe(true);
  });
});

describe('rich document features', () => {
  const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
  const RICH = {
    type: 'doc',
    content: [
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false }, content: [p('todo')] },
          { type: 'taskItem', attrs: { checked: true }, content: [p('done'), { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p('nested')] }] }] },
        ],
      },
      {
        type: 'paragraph',
        attrs: { lineHeight: '1.15' },
        content: [
          { type: 'text', text: 'H' },
          { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
          { type: 'text', text: 'O x' },
          { type: 'text', text: '2', marks: [{ type: 'superscript' }] },
          { type: 'text', text: ' styled', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] },
        ],
      },
      { type: 'pageBreak' },
      p('after'),
    ],
  };

  function expectRich(c: any) {
    expect(c.content[0].type).toBe('taskList');
    expect(c.content[0].content[1].attrs.checked).toBe(true);
    expect(c.content[0].content[1].content[1].type).toBe('taskList');
    expect(c.content[1].attrs.lineHeight).toBe('1.15');
    expect(c.content[1].content[1].marks.map((m: any) => m.type)).toEqual(['subscript']);
    expect(c.content[1].content[3].marks.map((m: any) => m.type)).toEqual(['superscript']);
    expect(c.content[1].content[4].marks[0].attrs).toMatchObject({ fontFamily: 'Georgia, serif', fontSize: '14pt' });
    expect(c.content[2].type).toBe('pageBreak');
  }

  it('keeps checklists, sub/superscript, fonts, line spacing and page breaks through collaboration, versions and restore', async () => {
    expectRich(ctx.app.services.docs.normalizeContent(RICH));

    const api = client(ctx.app, alice);
    const doc = data(await api.post('/api/docs', { title: 'Rich doc' }));
    const live = new YClient(doc.id, alice.token);
    await live.ready;
    const fragment = live.doc.getXmlFragment('default');
    live.doc.transact(() => {
      fragment.delete(0, fragment.length);
      prosemirrorJSONToYXmlFragment(ctx.app.services.docs.schema, RICH, fragment);
    });
    await until(() => live.statuses.length > 0, 8000);

    let [row] = await ctx.db.db.select().from(documents).where(eq(documents.id, doc.id));
    expectRich(row!.content);
    expect(row!.plainText).toContain('☑ done');
    expect(row!.wordCount).toBe(7); // todo done nested H2O x2 styled after — task markers are not words

    const v1 = data(await api.post(`/api/docs/${doc.id}/versions`, { name: 'Rich' }));
    typeParagraph(live, 'Overwritten');
    await until(() => live.statuses.length > 1, 8000);
    await api.post(`/api/docs/${doc.id}/versions/${v1.id}/restore`);
    await until(() => live.text().includes('<tasklist>') && !live.text().includes('Overwritten'), 8000);

    // Restore flushes the live room to the database; poll the row until the restored content lands.
    for (let i = 0; i < 80; i++) {
      [row] = await ctx.db.db.select().from(documents).where(eq(documents.id, doc.id));
      if ((row!.content as any)?.content?.[0]?.type === 'taskList') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expectRich(row!.content);
    live.close();
  });
});
