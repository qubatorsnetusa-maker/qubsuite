import { randomUUID } from 'node:crypto';
import type { FormServerMessage, PresenceUser } from '@qub/shared';
import type { WebSocket } from 'ws';
import type { Database } from '../db';
import type { FormBroadcaster, FormService } from '../modules/forms/form.service';
import type { ResponseBroadcaster } from '../modules/forms/response.service';
import { UserRepository } from '../modules/users/user.repository';
import { sendJson } from './socket-utils';

interface FormConn {
  socket: WebSocket;
  user: PresenceUser;
}

/** Builder presence plus live "form changed" and "response received" events, scoped per form. */
export class FormRoomHub implements FormBroadcaster, ResponseBroadcaster {
  private readonly rooms = new Map<string, Map<WebSocket, FormConn>>();

  constructor(
    private readonly db: Database,
    private readonly forms: FormService,
  ) {}

  private send(formId: string, message: FormServerMessage, except?: WebSocket) {
    for (const c of this.rooms.get(formId)?.values() ?? []) if (c.socket !== except) sendJson(c.socket, message);
  }

  private presence(formId: string) {
    this.send(formId, { type: 'presence', users: [...(this.rooms.get(formId)?.values() ?? [])].map((c) => c.user) });
  }

  async connect(socket: WebSocket, userId: string, formId: string): Promise<void> {
    await this.forms.access(userId, formId, 'VIEWER');
    const color = await this.forms.touchCollaborator(formId, userId);
    const summary = (await UserRepository.summaries(this.db, [userId])).get(userId)!;
    let room = this.rooms.get(formId);
    if (!room) this.rooms.set(formId, (room = new Map()));
    room.set(socket, { socket, user: { ...summary, color, clientId: randomUUID() } });
    this.presence(formId);
    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString('utf8')) as { type?: string };
        if (msg.type === 'ping') sendJson(socket, { type: 'pong' });
      } catch {
        // ignore malformed frames
      }
    });
    socket.on('close', () => {
      room!.delete(socket);
      if (room!.size === 0) this.rooms.delete(formId);
      else this.presence(formId);
    });
  }

  formChanged(formId: string, byUserId: string, meta: { txId?: string; revision?: number } = {}): void {
    this.send(formId, { type: 'formUpdated', by: byUserId, ...meta });
  }

  responseReceived(formId: string, responseCount: number, submittedAt: string): void {
    this.send(formId, { type: 'response', responseCount, submittedAt });
  }

  closeAll(): void {
    for (const room of this.rooms.values()) for (const c of room.values()) c.socket.close(1012, 'Server restarting');
    this.rooms.clear();
  }
}
