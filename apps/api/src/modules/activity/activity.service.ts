import {
  DRIVE_ACTIVITY_GROUPS,
  type ActivityAction,
  type ActivityDto,
  type DriveActivityItemDto,
  type driveActivityQuerySchema,
  type FileType,
  type Paginated,
} from '@qub/shared';
import { and, desc, eq, gt, lt, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database, Executor } from '../../db';
import { activityLogs, auditLogs } from '../../db/schema';
import { decodeKeysetCursor, encodeKeysetCursor, escapeLike } from '../../utils/pagination';
import { accessibleFoldersCte, notSpamFile, notSpamFolder } from '../spam/spam-sql';
import { UserRepository } from '../users/user.repository';

export interface ActivityInput {
  userId: string | null;
  action: ActivityAction;
  resourceType: 'FILE' | 'FOLDER';
  resourceId: string;
  resourceName?: string | null;
  metadata?: Record<string, unknown>;
}

/** Records user-visible activity; also the source of the "Recent" view. */
export class ActivityService {
  constructor(private readonly db: Database) {}

  async record(input: ActivityInput, tx: Executor = this.db): Promise<void> {
    await tx.insert(activityLogs).values({
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceName: input.resourceName ?? null,
      metadata: input.metadata ?? {},
    });
  }

  /**
   * Records an event unless the same user recorded the same action on the resource within `windowMs`.
   * Keeps OPENED/EDITED from flooding history during editing sessions.
   */
  async recordThrottled(input: ActivityInput, windowMs: number, tx: Executor = this.db): Promise<void> {
    const since = new Date(Date.now() - windowMs);
    const [recent] = await tx
      .select({ id: activityLogs.id })
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.resourceId, input.resourceId),
          eq(activityLogs.action, input.action),
          input.userId ? eq(activityLogs.userId, input.userId) : undefined,
          gt(activityLogs.createdAt, since),
        ),
      )
      .limit(1);
    if (!recent) await this.record(input, tx);
  }

  /**
   * Activity across everything the user can reach: items they own, items shared with them (directly or through a
   * folder), and anything they did themselves. Opens and downloads appear only under "views", and only to the
   * item's owner or the person who did it.
   */
  async feed(userId: string, q: z.output<typeof driveActivityQuerySchema>): Promise<Paginated<DriveActivityItemDto>> {
    const after = decodeKeysetCursor(q.cursor);
    const filters: SQL[] = [sql`(a.action not in ('FILE_OPENED', 'FILE_DOWNLOADED') or a.user_id = ${userId} or f.owner_id = ${userId})`];
    // Opens and downloads are frequent and only interesting on their own, so they're kept to the Views category.
    if (q.category === 'all') filters.push(sql`a.action not in ('FILE_OPENED', 'FILE_DOWNLOADED')`);
    else filters.push(sql`a.action in ${[...DRIVE_ACTIVITY_GROUPS[q.category]]}`);
    if (q.actor === 'me') filters.push(sql`a.user_id = ${userId}`);
    else if (q.actor === 'others') filters.push(sql`a.user_id is distinct from ${userId}`);
    const term = q.q.toLowerCase();
    if (term) {
      const like = `%${escapeLike(term)}%`;
      filters.push(sql`(lower(coalesce(f.name, d.name, a.resource_name, '')) like ${like} or a.user_id in (select id from users where lower(name) like ${like} or email like ${like}))`);
    }
    if (after) filters.push(sql`(a.created_at, a.id) < (${after.at.toISOString()}::timestamptz, ${after.id}::uuid)`);

    const rows = (await this.db.execute(sql`
      with recursive ${accessibleFoldersCte(userId)}
      select a.id, a.action, a.user_id, a.resource_type, a.resource_id, a.resource_name, a.metadata, a.created_at,
             coalesce(f.name, d.name) as current_name, f.file_type::text as file_type, f.is_trashed as file_trashed, d.is_trashed as folder_trashed,
             coalesce(doc.id, s.id, fm.id) as native_id
      from activity_logs a
      left join drive_files f on a.resource_type = 'FILE' and f.id = a.resource_id
      left join drive_folders d on a.resource_type = 'FOLDER' and d.id = a.resource_id
      left join documents doc on doc.file_id = f.id
      left join spreadsheets s on s.file_id = f.id
      left join forms fm on fm.file_id = f.id
      where (a.user_id = ${userId}
             or (f.id is not null and (f.owner_id = ${userId} or f.folder_id in (select id from accessible)
                                       or f.id in (select file_id from file_permissions where user_id = ${userId})))
             or (d.id is not null and d.id in (select id from accessible)))
        -- Nothing about items in the user's Spam.
        and (f.id is null or ${notSpamFile(userId, sql`f.id`)})
        and (d.id is null or ${notSpamFolder(userId, sql`d.id`)})
        and ${sql.join(filters, sql` and `)}
      order by a.created_at desc, a.id desc
      limit ${q.limit + 1}`)) as unknown as {
      id: string;
      action: ActivityAction;
      user_id: string | null;
      resource_type: 'FILE' | 'FOLDER';
      resource_id: string;
      resource_name: string | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      current_name: string | null;
      file_type: FileType | null;
      file_trashed: boolean | null;
      folder_trashed: boolean | null;
      native_id: string | null;
    }[];
    const page = rows.slice(0, q.limit);
    const actors = await UserRepository.summaries(this.db, page.map((r) => r.user_id).filter((id): id is string => !!id));
    return {
      items: page.map((r) => {
        const exists = r.current_name != null;
        return {
          id: r.id,
          action: r.action,
          actor: r.user_id ? (actors.get(r.user_id) ?? null) : null,
          resourceType: r.resource_type,
          resourceId: r.resource_id,
          resourceName: r.resource_name,
          metadata: r.metadata,
          createdAt: new Date(r.created_at).toISOString(),
          item: {
            kind: r.resource_type === 'FILE' ? 'file' : 'folder',
            id: r.resource_id,
            name: r.current_name ?? r.resource_name ?? 'Deleted item',
            fileType: r.resource_type === 'FOLDER' ? 'FOLDER' : (r.file_type ?? 'OTHER'),
            resourceId: r.native_id,
            available: exists && !(r.file_trashed ?? r.folder_trashed ?? false),
          },
        };
      }),
      nextCursor: rows.length > q.limit ? encodeKeysetCursor(new Date(page.at(-1)!.created_at), page.at(-1)!.id) : null,
    };
  }

  async listForResource(resourceIds: string[], cursor: string | undefined, limit: number): Promise<{ items: ActivityDto[]; nextCursor: string | null }> {
    const after = decodeKeysetCursor(cursor);
    const rows = await this.db
      .select()
      .from(activityLogs)
      .where(
        and(
          or(...resourceIds.map((id) => eq(activityLogs.resourceId, id))),
          after
            ? or(lt(activityLogs.createdAt, after.at), and(eq(activityLogs.createdAt, after.at), lt(activityLogs.id, after.id)))
            : undefined,
        ),
      )
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const actors = await UserRepository.summaries(this.db, page.map((r) => r.userId!).filter(Boolean));
    return {
      items: page.map((r) => ({
        id: r.id,
        action: r.action,
        actor: r.userId ? (actors.get(r.userId) ?? null) : null,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        resourceName: r.resourceName,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: rows.length > limit ? encodeKeysetCursor(page.at(-1)!.createdAt, page.at(-1)!.id) : null,
    };
  }
}

export interface AuditContext {
  actorId: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Security audit trail. Never stores secrets. */
export class AuditService {
  constructor(private readonly db: Database) {}

  async log(
    ctx: AuditContext,
    event: string,
    target?: { type: string; id: string } | null,
    metadata: Record<string, unknown> = {},
    tx: Executor = this.db,
  ): Promise<void> {
    await tx.insert(auditLogs).values({
      actorId: ctx.actorId,
      event,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      ipAddress: ctx.ip ?? null,
      userAgent: ctx.userAgent?.slice(0, 500) ?? null,
      requestId: ctx.requestId ?? null,
      metadata,
    });
  }
}
