import { reportSpamSchema, SPAM_RETENTION_DAYS, type BlockedUserDto, type DriveItemDto, type DriveViewQuery, type ReportSpamInput } from '@qub/shared';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import { filePermissions, folderPermissions, spamItems, stars, userBlocks } from '../../db/schema';
import { badRequest, notFound } from '../../utils/errors';
import { decodeOffsetCursor, pageOf } from '../../utils/pagination';
import type { DriveService } from '../drive/drive.service';
import { DriveFileRepository } from '../files/file.repository';
import { FolderRepository } from '../folders/folder.repository';
import { UserRepository } from '../users/user.repository';

type Kind = 'file' | 'folder';

/**
 * Spam and blocking. Only items someone shared directly with the user can be reported; they disappear from every view
 * except Spam. Removing one (or leaving it in Spam for 30 days) deletes the user's grant, so it's gone from their
 * Drive — the owner's file is untouched. Blocking someone moves everything they've shared with the user to Spam, and
 * they can no longer share with or notify the user.
 */
export class SpamService {
  constructor(
    private readonly db: Database,
    private readonly drive: DriveService,
  ) {}

  private async ownerOf(kind: Kind, id: string, tx: Executor = this.db): Promise<string> {
    const row = kind === 'file' ? await DriveFileRepository.findById(tx, id) : await FolderRepository.findById(tx, id);
    if (!row) throw notFound(kind);
    return row.ownerId;
  }

  private async hasDirectGrant(userId: string, kind: Kind, id: string, tx: Executor = this.db): Promise<boolean> {
    const rows =
      kind === 'file'
        ? await tx.select({ id: filePermissions.id }).from(filePermissions).where(and(eq(filePermissions.userId, userId), eq(filePermissions.fileId, id))).limit(1)
        : await tx.select({ id: folderPermissions.id }).from(folderPermissions).where(and(eq(folderPermissions.userId, userId), eq(folderPermissions.folderId, id))).limit(1);
    return rows.length > 0;
  }

  /** Throws unless the item is someone else's and shared directly with the user. Returns its owner. */
  private async requireSharedWith(userId: string, kind: Kind, id: string, tx: Executor = this.db): Promise<string> {
    const ownerId = await this.ownerOf(kind, id, tx);
    // Same answer whether the item doesn't exist or isn't shared with the user.
    if (ownerId === userId || !(await this.hasDirectGrant(userId, kind, id, tx))) throw notFound(kind);
    return ownerId;
  }

  async report(userId: string, kind: Kind, id: string, raw: ReportSpamInput = {}): Promise<{ blocked: boolean }> {
    const input = reportSpamSchema.parse(raw);
    const ownerId = await this.db.transaction(async (tx) => {
      const owner = await this.requireSharedWith(userId, kind, id, tx);
      await tx
        .insert(spamItems)
        .values(kind === 'file' ? { userId, fileId: id } : { userId, folderId: id })
        .onConflictDoNothing();
      return owner;
    });
    if (input.blockOwner) await this.block(userId, ownerId);
    return { blocked: input.blockOwner };
  }

  async notSpam(userId: string, kind: Kind, id: string): Promise<void> {
    const column = kind === 'file' ? spamItems.fileId : spamItems.folderId;
    const removed = await this.db.delete(spamItems).where(and(eq(spamItems.userId, userId), eq(column, id))).returning({ id: spamItems.id });
    if (!removed.length) throw notFound(kind);
  }

  /** Removes the user's own access to something shared with them (it leaves "Shared with me", Spam, stars…). */
  async removeAccess(userId: string, kind: Kind, id: string, tx?: Executor): Promise<void> {
    const run = async (t: Executor) => {
      await this.requireSharedWith(userId, kind, id, t);
      if (kind === 'file') {
        await t.delete(filePermissions).where(and(eq(filePermissions.userId, userId), eq(filePermissions.fileId, id)));
        await t.delete(spamItems).where(and(eq(spamItems.userId, userId), eq(spamItems.fileId, id)));
        await t.delete(stars).where(and(eq(stars.userId, userId), eq(stars.fileId, id)));
      } else {
        await t.delete(folderPermissions).where(and(eq(folderPermissions.userId, userId), eq(folderPermissions.folderId, id)));
        await t.delete(spamItems).where(and(eq(spamItems.userId, userId), eq(spamItems.folderId, id)));
        await t.delete(stars).where(and(eq(stars.userId, userId), eq(stars.folderId, id)));
      }
    };
    if (tx) return run(tx);
    await this.db.transaction(run);
  }

  /** "Delete all spam": removes the user's access to everything in their Spam. */
  async empty(userId: string): Promise<{ removed: number }> {
    const rows = await this.db.select().from(spamItems).where(eq(spamItems.userId, userId));
    return { removed: await this.removeRows(rows) };
  }

  private async removeRows(rows: (typeof spamItems.$inferSelect)[]): Promise<number> {
    let removed = 0;
    for (const r of rows) {
      const kind: Kind = r.fileId ? 'file' : 'folder';
      await this.db.transaction(async (tx) => {
        // The grant may already be gone (the owner unshared it); the spam row still needs clearing.
        if (await this.hasDirectGrant(r.userId, kind, (r.fileId ?? r.folderId)!, tx)) await this.removeAccess(r.userId, kind, (r.fileId ?? r.folderId)!, tx);
        else await tx.delete(spamItems).where(eq(spamItems.id, r.id));
      });
      removed++;
    }
    return removed;
  }

  /** Retention job: access to items left in Spam past the retention period is removed. */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - SPAM_RETENTION_DAYS * 86_400_000);
    const rows = await this.db.select().from(spamItems).where(lt(spamItems.createdAt, cutoff)).limit(2000);
    return this.removeRows(rows);
  }

  /** The Spam view: newest first unless sorted, with the same filters as other listings. */
  async list(userId: string, query: DriveViewQuery): Promise<{ items: DriveItemDto[]; nextCursor: string | null }> {
    const offset = decodeOffsetCursor(query.cursor);
    const order = query.sort ? sql`${sql.raw({ name: 'lower(name)', updatedAt: 'updated_at', createdAt: 'created_at', size: 'size' }[query.sort])} ${sql.raw(query.order === 'desc' ? 'desc' : 'asc')}` : sql`spammed_at desc`;
    const filters: ReturnType<typeof sql>[] = [sql`true`];
    if (query.type === 'FOLDER') filters.push(sql`kind = 'folder'`);
    else if (query.type) filters.push(sql`kind = 'file' and file_type = ${query.type}`);
    if (query.ownerId) filters.push(sql`owner_id = ${query.ownerId}`);
    if (query.modifiedAfter) filters.push(sql`updated_at >= ${query.modifiedAfter.toISOString()}::timestamptz`);
    if (query.modifiedBefore) filters.push(sql`updated_at < ${query.modifiedBefore.toISOString()}::timestamptz`);
    const rows = (await this.db.execute(sql`
      select kind, id from (
        select 'file' as kind, f.id, f.name, f.owner_id, f.updated_at, f.created_at, f.size, f.file_type::text as file_type, s.created_at as spammed_at
          from spam_items s join drive_files f on f.id = s.file_id where s.user_id = ${userId}
        union all
        select 'folder', d.id, d.name, d.owner_id, d.updated_at, d.created_at, 0::bigint, null::text, s.created_at
          from spam_items s join drive_folders d on d.id = s.folder_id where s.user_id = ${userId}
      ) items
      where ${sql.join(filters, sql` and `)}
      order by ${order}, id
      limit ${query.limit + 1} offset ${offset}`)) as unknown as { kind: Kind; id: string }[];
    const page = pageOf(rows, query.limit, offset);
    return { items: await this.drive.hydrate(userId, page.items), nextCursor: page.nextCursor };
  }

  // ---------- blocking ----------

  async block(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) throw badRequest("You can't block yourself.");
    const target = await UserRepository.findById(this.db, targetId);
    if (!target || target.status === 'DELETED') throw notFound('user');
    await this.db.transaction(async (tx) => {
      await tx.insert(userBlocks).values({ userId, blockedUserId: targetId }).onConflictDoNothing();
      // Everything they've already shared with the user goes to Spam.
      await tx.execute(sql`
        insert into spam_items (user_id, file_id)
        select ${userId}, f.id from file_permissions p join drive_files f on f.id = p.file_id
        where p.user_id = ${userId} and f.owner_id = ${targetId}
        on conflict do nothing`);
      await tx.execute(sql`
        insert into spam_items (user_id, folder_id)
        select ${userId}, d.id from folder_permissions p join drive_folders d on d.id = p.folder_id
        where p.user_id = ${userId} and d.owner_id = ${targetId}
        on conflict do nothing`);
    });
  }

  async unblock(userId: string, targetId: string): Promise<void> {
    await this.db.delete(userBlocks).where(and(eq(userBlocks.userId, userId), eq(userBlocks.blockedUserId, targetId)));
  }

  async blocked(userId: string): Promise<BlockedUserDto[]> {
    const rows = await this.db.select().from(userBlocks).where(eq(userBlocks.userId, userId)).orderBy(desc(userBlocks.createdAt));
    const people = await UserRepository.summaries(this.db, rows.map((r) => r.blockedUserId));
    return rows.flatMap((r) => {
      const p = people.get(r.blockedUserId);
      return p ? [{ ...p, blockedAt: r.createdAt.toISOString() }] : [];
    });
  }

}
