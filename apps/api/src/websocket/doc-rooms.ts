import { DOC_MESSAGE_SAVE_STATUS, roleAtLeast, type DocSaveStatus, type Role } from '@qub/shared';
import type { JSONContent } from '@qub/editor-schema';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import type { FastifyBaseLogger } from 'fastify';
import type { WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { DOC_FRAGMENT, type DocumentService, type LiveDocumentRooms } from '../modules/docs/document.service';
import type { CommentBroadcaster } from '../modules/docs/comment.service';
import type { PermissionService } from '../modules/permissions/permission.service';
import { CLOSE_FORBIDDEN } from './socket-utils';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const MSG_QUERY_AWARENESS = 3;
/** Custom message: identity assigned by the server (JSON). */
const MSG_IDENTITY = 101;
/** Custom message: comment threads changed (client refetches). */
const MSG_COMMENTS_CHANGED = 102;

/** Top-level Y.Map holding comment anchors as Yjs relative positions. Commenters may write only here. */
export const COMMENT_ANCHORS_MAP = 'commentAnchors';

const SAVE_DEBOUNCE_MS = 1500;
const SAVE_MAX_WAIT_MS = 10_000;
const ACCESS_RECHECK_MS = 60_000;
const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;

interface Conn {
  socket: WebSocket;
  userId: string;
  role: Role;
  /** Awareness client ids this connection controls. */
  clientIds: Set<number>;
}

function roleCanWrite(role: Role) {
  return roleAtLeast(role, 'EDITOR');
}

class DocRoom {
  readonly doc = new Y.Doc({ gc: true });
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  readonly conns = new Map<WebSocket, Conn>();
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private firstDirtyAt = 0;
  private saving: Promise<void> | null = null;
  private editors: string[] = [];
  private recheckTimer: NodeJS.Timeout;
  destroyed = false;

  constructor(
    readonly documentId: string,
    readonly fileId: string,
    private readonly hub: DocRoomHub,
  ) {
    // The server never has a cursor of its own.
    this.awareness.setLocalState(null);

    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      // Loading the stored state is not an edit: nobody is connected yet and nothing needs saving.
      if (origin === 'load') return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder));
      const conn = origin as Conn | undefined;
      if (conn && typeof conn === 'object' && 'userId' in conn) {
        this.editors = [...this.editors.filter((e) => e !== conn.userId), conn.userId];
      }
      this.markDirty();
    });

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      const conn = origin as Conn | undefined;
      if (conn && typeof conn === 'object' && 'clientIds' in conn) {
        for (const id of added) conn.clientIds.add(id);
        for (const id of removed) conn.clientIds.delete(id);
        // Presence identity is enforced: a client may only present itself as the authenticated user.
        const spoofed = [...added, ...updated].filter((id) => {
          const state = this.awareness.getStates().get(id) as { user?: { id?: string } } | undefined;
          return state && state.user?.id !== conn.userId;
        });
        if (spoofed.length) awarenessProtocol.removeAwarenessStates(this.awareness, spoofed, 'server');
      }
      const changed = [...added, ...updated, ...removed];
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
      this.broadcast(encoding.toUint8Array(encoder));
    });

    this.recheckTimer = setInterval(() => void this.recheckAccess(), ACCESS_RECHECK_MS);
    this.recheckTimer.unref();
  }

  broadcast(message: Uint8Array): void {
    for (const { socket } of this.conns.values()) {
      if (socket.readyState === socket.OPEN) socket.send(message);
    }
  }

  private markDirty(): void {
    if (!this.dirty) this.firstDirtyAt = Date.now();
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const wait = Math.max(0, Math.min(SAVE_DEBOUNCE_MS, SAVE_MAX_WAIT_MS - (Date.now() - this.firstDirtyAt)));
    this.saveTimer = setTimeout(() => void this.save(), wait);
  }

  /** Persists the current state; acknowledges to clients so they can show "Saved". */
  async save(): Promise<void> {
    if (this.saving) {
      await this.saving;
      if (!this.dirty) return;
    }
    if (!this.dirty) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.dirty = false;
    const editors = this.editors;
    this.editors = [];
    const state = Y.encodeStateAsUpdate(this.doc);
    const content = yXmlFragmentToProsemirrorJSON(this.doc.getXmlFragment(DOC_FRAGMENT)) as JSONContent;
    this.saving = (async () => {
      try {
        const savedAt = await this.hub.docs.persistFromCollaboration(this.documentId, { state, content, editorIds: editors });
        this.sendStatus({ status: 'saved', savedAt: savedAt.toISOString() });
      } catch (err) {
        this.hub.log.error({ err, documentId: this.documentId }, 'Failed to persist document');
        // Keep the edits and retry; clients keep showing unsaved state until acknowledged.
        this.editors = [...new Set([...editors, ...this.editors])];
        this.dirty = true;
        this.sendStatus({ status: 'error', savedAt: new Date().toISOString() });
        this.saveTimer = setTimeout(() => void this.save(), 5000);
      } finally {
        this.saving = null;
      }
    })();
    await this.saving;
  }

  private sendStatus(status: DocSaveStatus): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, DOC_MESSAGE_SAVE_STATUS);
    encoding.writeVarString(encoder, JSON.stringify(status));
    this.broadcast(encoding.toUint8Array(encoder));
  }

  commentsChanged(): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_COMMENTS_CHANGED);
    this.broadcast(encoding.toUint8Array(encoder));
  }

  /** Replaces the whole body (version restore). Runs as a normal Yjs transaction, so every client converges. */
  replaceContent(content: JSONContent): void {
    const fragment = this.doc.getXmlFragment(DOC_FRAGMENT);
    this.doc.transact(() => {
      fragment.delete(0, fragment.length);
      prosemirrorJSONToYXmlFragment(this.hub.docs.schema, content, fragment);
    }, 'restore');
  }

  join(conn: Conn): void {
    this.conns.set(conn.socket, conn);
    // Identity and role for the client's awareness state and UI.
    const identity = encoding.createEncoder();
    encoding.writeVarUint(identity, MSG_IDENTITY);
    encoding.writeVarString(identity, JSON.stringify({ userId: conn.userId, role: conn.role }));
    conn.socket.send(encoding.toUint8Array(identity));
    // Sync step 1: ask the client for anything it has that we don't (e.g. edits made while offline).
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    conn.socket.send(encoding.toUint8Array(encoder));
    const states = this.awareness.getStates();
    if (states.size > 0) {
      const aw = encoding.createEncoder();
      encoding.writeVarUint(aw, MSG_AWARENESS);
      encoding.writeVarUint8Array(aw, awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...states.keys()]));
      conn.socket.send(encoding.toUint8Array(aw));
    }
  }

  handleMessage(conn: Conn, data: Uint8Array): void {
    const decoder = decoding.createDecoder(data);
    const type = decoding.readVarUint(decoder);
    switch (type) {
      case MSG_SYNC: {
        const syncType = decoding.readVarUint(decoder);
        if (syncType === syncProtocol.messageYjsSyncStep1) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          syncProtocol.readSyncStep1(decoder, encoder, this.doc);
          conn.socket.send(encoding.toUint8Array(encoder));
        } else if (syncType === syncProtocol.messageYjsSyncStep2 || syncType === syncProtocol.messageYjsUpdate) {
          const update = decoding.readVarUint8Array(decoder);
          this.applyClientUpdate(conn, update);
        }
        break;
      }
      case MSG_AWARENESS:
        awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), conn);
        break;
      case MSG_QUERY_AWARENESS: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...this.awareness.getStates().keys()]));
        conn.socket.send(encoding.toUint8Array(encoder));
        break;
      }
      default:
        break;
    }
  }

  /**
   * Enforces roles on document writes. Editors apply freely. Commenters may only change the comment-anchor map:
   * the update is trial-applied to a copy and rejected if it touches the document body. Viewers cannot write.
   */
  private applyClientUpdate(conn: Conn, update: Uint8Array): void {
    if (roleCanWrite(conn.role)) {
      Y.applyUpdate(this.doc, update, conn);
      return;
    }
    if (!roleAtLeast(conn.role, 'COMMENTER')) return;
    const probe = new Y.Doc();
    Y.applyUpdate(probe, Y.encodeStateAsUpdate(this.doc));
    const anchors = probe.getMap(COMMENT_ANCHORS_MAP);
    let allowed = true;
    probe.on('afterTransaction', (tr: Y.Transaction) => {
      for (const changedType of tr.changed.keys()) {
        let root: Y.AbstractType<unknown> = changedType as Y.AbstractType<unknown>;
        while (root._item?.parent) root = root._item.parent as Y.AbstractType<unknown>;
        if (root !== (anchors as unknown)) allowed = false;
      }
    });
    Y.applyUpdate(probe, update);
    probe.destroy();
    if (allowed) Y.applyUpdate(this.doc, update, conn);
    else this.hub.log.warn({ documentId: this.documentId, userId: conn.userId }, 'Rejected document write from non-editor');
  }

  leave(socket: WebSocket): void {
    const conn = this.conns.get(socket);
    if (!conn) return;
    this.conns.delete(socket);
    awarenessProtocol.removeAwarenessStates(this.awareness, [...conn.clientIds], null);
  }

  /** Access can be revoked or downgraded while a document is open; re-check periodically. */
  private async recheckAccess(): Promise<void> {
    for (const conn of [...this.conns.values()]) {
      try {
        const access = await this.hub.permissions.fileAccess(conn.userId, this.fileId);
        if (!access) {
          conn.socket.close(CLOSE_FORBIDDEN, 'Access revoked');
          continue;
        }
        if (access.role !== conn.role) {
          conn.role = access.role;
          const identity = encoding.createEncoder();
          encoding.writeVarUint(identity, MSG_IDENTITY);
          encoding.writeVarString(identity, JSON.stringify({ userId: conn.userId, role: conn.role }));
          conn.socket.send(encoding.toUint8Array(identity));
        }
      } catch (err) {
        this.hub.log.warn({ err }, 'Access recheck failed');
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    clearInterval(this.recheckTimer);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.awareness.destroy();
    this.doc.destroy();
  }
}

/** Manages one collaboration room per open document. Rooms live in this process (see README: scaling). */
export class DocRoomHub implements LiveDocumentRooms, CommentBroadcaster {
  private readonly rooms = new Map<string, DocRoom>();
  private readonly loading = new Map<string, Promise<DocRoom>>();

  constructor(
    readonly docs: DocumentService,
    readonly permissions: PermissionService,
    readonly log: FastifyBaseLogger,
  ) {}

  private async room(documentId: string): Promise<DocRoom> {
    const existing = this.rooms.get(documentId);
    if (existing && !existing.destroyed) return existing;
    let pending = this.loading.get(documentId);
    if (!pending) {
      pending = (async () => {
        const { state, fileId } = await this.docs.loadState(documentId);
        const room = new DocRoom(documentId, fileId, this);
        Y.applyUpdate(room.doc, state, 'load');
        this.rooms.set(documentId, room);
        return room;
      })().finally(() => this.loading.delete(documentId));
      this.loading.set(documentId, pending);
    }
    return pending;
  }

  /** Authorises and attaches a socket. Only users with at least viewer access to the Drive file can join. */
  async connect(socket: WebSocket, userId: string, documentId: string): Promise<void> {
    const { access } = await this.docs.access(userId, documentId, 'VIEWER');
    await this.docs.touchCollaborator(documentId, userId);
    const room = await this.room(documentId);
    const conn: Conn = { socket, userId, role: access.role, clientIds: new Set() };
    socket.binaryType = 'arraybuffer';
    socket.on('message', (data: ArrayBuffer | Buffer, isBinary: boolean) => {
      if (!isBinary) return;
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      if (bytes.byteLength > MAX_MESSAGE_BYTES) {
        socket.close(1009, 'Message too large');
        return;
      }
      try {
        room.handleMessage(conn, bytes);
      } catch (err) {
        this.log.warn({ err, documentId }, 'Invalid collaboration message');
      }
    });
    socket.on('close', () => {
      room.leave(socket);
      if (room.conns.size === 0) {
        void room.save().finally(() => {
          if (room.conns.size === 0 && !room.destroyed) {
            room.destroy();
            if (this.rooms.get(documentId) === room) this.rooms.delete(documentId);
          }
        });
      }
    });
    room.join(conn);
  }

  async replaceContent(documentId: string, content: JSONContent): Promise<boolean> {
    const room = this.rooms.get(documentId);
    if (!room || room.destroyed) return false;
    room.replaceContent(content);
    return true;
  }

  async flush(documentId: string): Promise<void> {
    await this.rooms.get(documentId)?.save();
  }

  commentsChanged(documentId: string): void {
    this.rooms.get(documentId)?.commentsChanged();
  }

  /** Graceful shutdown: persist every open document. */
  async closeAll(): Promise<void> {
    await Promise.all([...this.rooms.values()].map((r) => r.save().catch(() => undefined)));
    for (const r of this.rooms.values()) {
      for (const c of r.conns.values()) c.socket.close(1012, 'Server restarting');
      r.destroy();
    }
    this.rooms.clear();
  }

  stats() {
    return { rooms: this.rooms.size, connections: [...this.rooms.values()].reduce((n, r) => n + r.conns.size, 0) };
  }

  /** For tests/diagnostics: JSON of a live room. */
  liveContent(documentId: string) {
    const room = this.rooms.get(documentId);
    return room ? yXmlFragmentToProsemirrorJSON(room.doc.getXmlFragment(DOC_FRAGMENT)) : null;
  }
}
