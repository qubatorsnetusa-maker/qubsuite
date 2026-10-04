import type { NotificationServerMessage } from '@qub/shared';
import type { WebSocket } from 'ws';
import type { NotificationService, UserChannel } from '../modules/notifications/notification.service';
import { sendJson } from './socket-utils';

/** Per-user channel: every open tab of a user receives their notifications in real time. */
export class NotificationHub implements UserChannel {
  private readonly sockets = new Map<string, Set<WebSocket>>();

  constructor(private readonly notifications: NotificationService) {}

  async connect(socket: WebSocket, userId: string): Promise<void> {
    let set = this.sockets.get(userId);
    if (!set) this.sockets.set(userId, (set = new Set()));
    set.add(socket);
    sendJson(socket, { type: 'unreadCount', unreadCount: await this.notifications.unreadCount(userId) } satisfies NotificationServerMessage);
    socket.on('message', (raw: Buffer) => {
      try {
        if ((JSON.parse(raw.toString('utf8')) as { type?: string }).type === 'ping') sendJson(socket, { type: 'pong' });
      } catch {
        // ignore malformed frames
      }
    });
    socket.on('close', () => {
      set!.delete(socket);
      if (set!.size === 0) this.sockets.delete(userId);
    });
  }

  publish(userId: string, message: NotificationServerMessage): void {
    for (const socket of this.sockets.get(userId) ?? []) sendJson(socket, message);
  }

  closeAll(): void {
    for (const set of this.sockets.values()) for (const s of set) s.close(1012, 'Server restarting');
    this.sockets.clear();
  }
}
