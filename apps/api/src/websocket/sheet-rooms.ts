import { randomUUID } from 'node:crypto';
import type { PresenceUser, Role, SheetClientMessage, SheetPresenceState, SheetServerMessage } from '@qub/shared';
import { presenceColor, roleAtLeast } from '@qub/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import type { SheetBroadcaster, SpreadsheetService } from '../modules/sheets/spreadsheet.service';
import { UserRepository } from '../modules/users/user.repository';
import type { Database } from '../db';
import { AppError } from '../utils/errors';
import { CLOSE_FORBIDDEN, sendJson } from './socket-utils';

interface SheetConn {
  socket: WebSocket;
  userId: string;
  role: Role;
  user: PresenceUser;
  selection: SheetPresenceState['selection'];
}

const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ops'), clientOpId: z.string().min(1).max(64), baseRevision: z.number().int().min(0), ops: z.array(z.unknown()).min(1).max(100) }),
  z.object({
    type: z.literal('presence'),
    selection: z
      .object({
        sheetId: z.uuid(),
        activeRow: z.number().int().min(0),
        activeCol: z.number().int().min(0),
        range: z.object({ startRow: z.number().int(), endRow: z.number().int(), startCol: z.number().int(), endCol: z.number().int() }).nullable(),
      })
      .nullable(),
  }),
  z.object({ type: z.literal('ping') }),
]);

const ACCESS_RECHECK_MS = 60_000;

/**
 * Real-time sheets: clients send operations; the server applies them in order against the authoritative workbook
 * (recalculating dependents), persists, and broadcasts the resulting cell values to everyone — including the author,
 * whose optimistic state is then replaced by the server result. Presence carries each user's active cell and range.
 */
export class SheetRoomHub implements SheetBroadcaster {
  private readonly rooms = new Map<string, Map<WebSocket, SheetConn>>();
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly db: Database,
    private readonly sheets: SpreadsheetService,
    private readonly log: FastifyBaseLogger,
  ) {
    this.timer = setInterval(() => void this.recheckAccess(), ACCESS_RECHECK_MS);
    this.timer.unref();
  }

  hasRoom(spreadsheetId: string): boolean {
    return (this.rooms.get(spreadsheetId)?.size ?? 0) > 0;
  }

  broadcast(spreadsheetId: string, message: SheetServerMessage): void {
    for (const conn of this.rooms.get(spreadsheetId)?.values() ?? []) sendJson(conn.socket, message);
  }

  private presence(spreadsheetId: string): SheetPresenceState[] {
    return [...(this.rooms.get(spreadsheetId)?.values() ?? [])].map((c) => ({ user: c.user, selection: c.selection }));
  }

  async connect(socket: WebSocket, userId: string, spreadsheetId: string): Promise<void> {
    const { access, sheet } = await this.sheets.access(userId, spreadsheetId, 'VIEWER');
    const color = await this.sheets.touchCollaborator(spreadsheetId, userId);
    const summary = (await UserRepository.summaries(this.db, [userId])).get(userId)!;
    const user: PresenceUser = { ...summary, color: color ?? presenceColor(userId), clientId: randomUUID() };
    const conn: SheetConn = { socket, userId, role: access.role, user, selection: null };
    let room = this.rooms.get(spreadsheetId);
    if (!room) this.rooms.set(spreadsheetId, (room = new Map()));
    room.set(socket, conn);

    sendJson(socket, { type: 'welcome', clientId: user.clientId, revision: sheet.revision, presence: this.presence(spreadsheetId), self: user } satisfies SheetServerMessage);
    this.broadcast(spreadsheetId, { type: 'presence', presence: this.presence(spreadsheetId) });

    socket.on('message', (raw: Buffer, isBinary: boolean) => {
      if (isBinary || raw.length > 5 * 1024 * 1024) return;
      let parsed: SheetClientMessage;
      try {
        parsed = clientMessageSchema.parse(JSON.parse(raw.toString('utf8'))) as SheetClientMessage;
      } catch {
        sendJson(socket, { type: 'error', code: 'BAD_REQUEST', message: 'Invalid message' } satisfies SheetServerMessage);
        return;
      }
      void this.handle(spreadsheetId, conn, parsed);
    });
    socket.on('close', () => {
      room!.delete(socket);
      if (room!.size === 0) this.rooms.delete(spreadsheetId);
      else this.broadcast(spreadsheetId, { type: 'presence', presence: this.presence(spreadsheetId) });
    });
  }

  private async handle(spreadsheetId: string, conn: SheetConn, message: SheetClientMessage): Promise<void> {
    switch (message.type) {
      case 'ping':
        sendJson(conn.socket, { type: 'pong' });
        return;
      case 'presence':
        conn.selection = message.selection;
        this.broadcast(spreadsheetId, { type: 'presence', presence: this.presence(spreadsheetId) });
        return;
      case 'ops': {
        if (!roleAtLeast(conn.role, 'EDITOR')) {
          sendJson(conn.socket, { type: 'rejected', clientOpId: message.clientOpId, code: 'FORBIDDEN', message: 'You have view-only access.' });
          return;
        }
        try {
          await this.sheets.applyOps(conn.userId, spreadsheetId, message.ops, { clientOpId: message.clientOpId, authorClientId: conn.user.clientId });
        } catch (err) {
          const appErr = err instanceof AppError ? err : null;
          if (!appErr) this.log.error({ err, spreadsheetId }, 'Failed to apply sheet ops');
          sendJson(conn.socket, {
            type: 'rejected',
            clientOpId: message.clientOpId,
            code: appErr?.code ?? (err instanceof z.ZodError ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'),
            message: appErr?.message ?? (err instanceof z.ZodError ? 'Invalid operation.' : 'The change could not be saved.'),
          });
        }
        return;
      }
    }
  }

  private async recheckAccess(): Promise<void> {
    for (const [spreadsheetId, room] of this.rooms) {
      for (const conn of [...room.values()]) {
        try {
          const { access } = await this.sheets.access(conn.userId, spreadsheetId, 'VIEWER');
          conn.role = access.role;
        } catch {
          conn.socket.close(CLOSE_FORBIDDEN, 'Access revoked');
        }
      }
    }
  }

  closeAll(): void {
    clearInterval(this.timer);
    for (const room of this.rooms.values()) for (const c of room.values()) c.socket.close(1012, 'Server restarting');
    this.rooms.clear();
  }
}
