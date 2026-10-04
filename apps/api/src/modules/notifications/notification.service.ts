import type { NotificationDto, NotificationServerMessage, NotificationType } from '@qub/shared';
import { and, count, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import { notifications } from '../../db/schema';
import { decodeKeysetCursor, encodeKeysetCursor } from '../../utils/pagination';
import { blockedPairs, hasBlocked } from '../spam/spam-sql';
import { UserRepository } from '../users/user.repository';

/** Delivers messages to a user's open sockets (implemented by the WebSocket hub). */
export interface UserChannel {
  publish(userId: string, message: NotificationServerMessage): void;
}

export interface NotifyInput {
  userId: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
}

export class NotificationService {
  private channel: UserChannel | null = null;

  constructor(private readonly db: Database) {}

  attachChannel(channel: UserChannel): void {
    this.channel = channel;
  }

  /**
   * Creates notifications. When called inside a transaction, pass `tx` and call the returned `deliver`
   * after commit so users never receive a notification for a rolled-back change.
   */
  async create(inputs: NotifyInput[], tx: Executor = this.db): Promise<{ deliver: () => Promise<void> }> {
    const notSelf = inputs.filter((n) => n.userId !== n.actorId);
    // People never hear from someone they've blocked.
    const blocked = await blockedPairs(tx, notSelf.map((n) => n.userId), notSelf.map((n) => n.actorId!).filter(Boolean));
    const valid = notSelf.filter((n) => !n.actorId || !blocked.has(`${n.userId}:${n.actorId}`));
    if (valid.length === 0) return { deliver: async () => {} };
    const rows = await tx
      .insert(notifications)
      .values(
        valid.map((n) => ({
          userId: n.userId,
          actorId: n.actorId,
          type: n.type,
          title: n.title,
          body: n.body ?? null,
          link: n.link ?? null,
          resourceType: n.resourceType ?? null,
          resourceId: n.resourceId ?? null,
        })),
      )
      .returning();
    return {
      deliver: async () => {
        if (!this.channel) return;
        const dtos = await this.toDtos(rows);
        for (const dto of dtos) {
          const row = rows.find((r) => r.id === dto.id)!;
          this.channel.publish(row.userId, { type: 'notification', notification: dto, unreadCount: await this.unreadCount(row.userId) });
        }
      },
    };
  }

  /** Convenience for non-transactional callers. */
  async notify(inputs: NotifyInput[]): Promise<void> {
    const { deliver } = await this.create(inputs);
    await deliver();
  }

  /**
   * Collapses repeated notifications about the same resource (e.g. many form responses) into one unread item.
   */
  async upsertUnread(input: NotifyInput & { resourceId: string }, title: (existingCount: number) => string): Promise<void> {
    if (input.actorId && (await hasBlocked(this.db, input.userId, input.actorId))) return;
    const [existing] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          eq(notifications.type, input.type),
          eq(notifications.resourceId, input.resourceId),
          isNull(notifications.readAt),
        ),
      )
      .limit(1);
    if (!existing) {
      await this.notify([{ ...input, title: title(0) }]);
      return;
    }
    const prior = Number(/^(\d+)/.exec(existing.title)?.[1] ?? 1);
    const [row] = await this.db
      .update(notifications)
      .set({ title: title(prior), createdAt: new Date(), actorId: input.actorId })
      .where(eq(notifications.id, existing.id))
      .returning();
    if (this.channel && row) {
      const [dto] = await this.toDtos([row]);
      this.channel.publish(input.userId, { type: 'notification', notification: dto!, unreadCount: await this.unreadCount(input.userId) });
    }
  }

  async list(userId: string, opts: { cursor?: string; limit: number; unreadOnly?: boolean }) {
    const after = decodeKeysetCursor(opts.cursor);
    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          opts.unreadOnly ? isNull(notifications.readAt) : undefined,
          after
            ? or(lt(notifications.createdAt, after.at), and(eq(notifications.createdAt, after.at), lt(notifications.id, after.id)))
            : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(opts.limit + 1);
    const page = rows.slice(0, opts.limit);
    return {
      items: await this.toDtos(page),
      nextCursor: rows.length > opts.limit ? encodeKeysetCursor(page.at(-1)!.createdAt, page.at(-1)!.id) : null,
      unreadCount: await this.unreadCount(userId),
    };
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.n ?? 0;
  }

  async markRead(userId: string, ids: string[] | 'all'): Promise<number> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          ids === 'all' ? undefined : inArray(notifications.id, ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
        ),
      );
    const unread = await this.unreadCount(userId);
    this.channel?.publish(userId, { type: 'unreadCount', unreadCount: unread });
    return unread;
  }

  private async toDtos(rows: (typeof notifications.$inferSelect)[]): Promise<NotificationDto[]> {
    const actors = await UserRepository.summaries(this.db, rows.map((r) => r.actorId!).filter(Boolean));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      actor: r.actorId ? (actors.get(r.actorId) ?? null) : null,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
