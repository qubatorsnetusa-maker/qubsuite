import {
  adminBulkUsersSchema,
  adminCreateUserSchema,
  adminDeleteUserSchema,
  adminStorageQuotaSchema,
  adminUpdateUserSchema,
  MAX_QUOTA_GB,
  MIN_QUOTA_GB,
  type AdminCreateUserInput,
  type AdminStorageQuotaInput,
  type AdminDeleteUserInput,
  type AdminUpdateUserInput,
  type AdminUserDto,
  type AdminUsersQuery,
  type Paginated,
} from '@qub/shared';
import { and, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import { driveFiles, driveFolders, filePermissions, sessions, users, type UserRow } from '../../db/schema';
import type { StorageService } from '../../services/storage';
import { hashPassword, randomToken } from '../../utils/crypto';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors';
import { nextDuplicateName } from '../../utils/filename';
import { decodeOffsetCursor, escapeLike, pageOf } from '../../utils/pagination';
import type { ActivityService, AuditContext, AuditService } from '../activity/activity.service';
import type { AuthService } from '../auth/auth.service';
import type { NativeResourceRegistry } from '../drive/native-registry';
import { DriveFileRepository } from '../files/file.repository';
import { FolderRepository } from '../folders/folder.repository';
import type { NotificationService } from '../notifications/notification.service';
import { UserRepository } from '../users/user.repository';
import type { PolicyService } from './policy.service';
import { formatGb, OWNER_USAGE_SQL } from './usage.service';

const GB = 1024 ** 3;
const gbToBytes = (gb: number | null) => (gb == null ? null : Math.round(gb * GB));

/** Column values for a quota given in GB: null = organization default, 'unlimited' = no limit. */
function quotaColumns(gb: number | 'unlimited' | null): { storageQuotaBytes: number | null; storageUnlimited: boolean } {
  if (gb === 'unlimited') return { storageQuotaBytes: null, storageUnlimited: true };
  return { storageQuotaBytes: gbToBytes(gb), storageUnlimited: false };
}

interface UserListRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  platform_role: AdminUserDto['platformRole'];
  status: AdminUserDto['status'];
  email_verified: boolean;
  created_at: Date;
  last_login_at: Date | null;
  storage_quota_bytes: string | null;
  storage_unlimited: boolean;
  storage_used: string;
  owned_files: string;
  active_sessions: string;
}

const SORTS: Record<string, SQL> = {
  name: sql`lower(u.name)`,
  createdAt: sql`u.created_at`,
  lastLoginAt: sql`u.last_login_at`,
  storage: sql`coalesce(usage.bytes, 0)`,
};

/**
 * Directory management for super admins. Guards keep the organization administrable: admins can't change their
 * own role or status, and the last active super admin can't be demoted, suspended or deleted.
 */
export class AdminUserService {
  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
    private readonly policies: PolicyService,
    private readonly storage: StorageService,
    private readonly natives: NativeResourceRegistry,
    private readonly notifications: NotificationService,
  ) {}

  // ---------- reading ----------

  async list(q: Required<Pick<AdminUsersQuery, 'q' | 'sort' | 'order' | 'limit'>> & AdminUsersQuery): Promise<Paginated<AdminUserDto>> {
    const offset = decodeOffsetCursor(q.cursor);
    const term = q.q.trim().toLowerCase();
    const filters: SQL[] = [sql`u.status <> 'DELETED'`];
    if (term) filters.push(sql`(lower(u.name) like ${`%${escapeLike(term)}%`} or u.email like ${`%${escapeLike(term)}%`})`);
    if (q.role) filters.push(sql`u.platform_role = ${q.role}`);
    if (q.status) filters.push(sql`u.status = ${q.status}`);
    const rows = await this.query(sql.join(filters, sql` and `), sql`${SORTS[q.sort] ?? SORTS.name!} ${q.order === 'desc' ? sql`desc nulls last` : sql`asc nulls last`}, u.id`, q.limit + 1, offset);
    const page = pageOf(rows, q.limit, offset);
    return { items: await this.toDtos(page.items), nextCursor: page.nextCursor };
  }

  async get(id: string): Promise<AdminUserDto> {
    const [row] = await this.query(sql`u.id = ${id} and u.status <> 'DELETED'`, sql`u.id`, 1, 0);
    if (!row) throw notFound('user');
    return (await this.toDtos([row]))[0]!;
  }

  private async query(where: SQL, order: SQL, limit: number, offset: number): Promise<UserListRow[]> {
    return (await this.db.execute(sql`
      with usage as (${OWNER_USAGE_SQL()}),
           owned as (select owner_id, count(*) as n from drive_files group by owner_id),
           live as (select user_id, count(*) as n from sessions where revoked_at is null and expires_at > now() group by user_id)
      select u.id, u.email, u.name, u.avatar_url, u.platform_role, u.status, u.email_verified, u.created_at, u.last_login_at,
             u.storage_quota_bytes, u.storage_unlimited, coalesce(usage.bytes, 0) as storage_used, coalesce(owned.n, 0) as owned_files, coalesce(live.n, 0) as active_sessions
      from users u
      left join usage on usage.owner_id = u.id
      left join owned on owned.owner_id = u.id
      left join live on live.user_id = u.id
      where ${where}
      order by ${order}
      limit ${limit} offset ${offset}`)) as unknown as UserListRow[];
  }

  private async toDtos(rows: UserListRow[]): Promise<AdminUserDto[]> {
    const defaultGb = (await this.policies.get()).storage.defaultQuotaGb;
    return rows.map((r) => {
      const override = r.storage_quota_bytes == null ? null : Number(r.storage_quota_bytes);
      return {
        id: r.id,
        email: r.email,
        name: r.name,
        avatarUrl: r.avatar_url,
        platformRole: r.platform_role,
        status: r.status,
        emailVerified: r.email_verified,
        createdAt: new Date(r.created_at).toISOString(),
        lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
        storageUsed: Number(r.storage_used),
        storageQuota: r.storage_unlimited ? null : (override ?? gbToBytes(defaultGb)),
        quotaOverride: override,
        quotaMode: r.storage_unlimited ? 'unlimited' : override != null ? 'custom' : 'default',
        ownedFiles: Number(r.owned_files),
        activeSessions: Number(r.active_sessions),
      };
    });
  }

  private async require(id: string, tx: Executor = this.db): Promise<UserRow> {
    const user = await UserRepository.findById(tx, id);
    if (!user || user.status === 'DELETED') throw notFound('user');
    return user;
  }

  /** True when `userId` is the only active super admin. */
  private async isLastSuperAdmin(userId: string, tx: Executor): Promise<boolean> {
    const others = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.platformRole, 'SUPER_ADMIN'), eq(users.status, 'ACTIVE'), ne(users.id, userId)))
      .limit(1);
    return others.length === 0;
  }

  // ---------- changes ----------

  async create(actor: { userId: string; name: string }, raw: AdminCreateUserInput, ctx: AuditContext): Promise<AdminUserDto> {
    const input = adminCreateUserSchema.parse(raw);
    if (await UserRepository.findByEmail(this.db, input.email)) throw conflict('An account with this email already exists.');
    // Unusable until the person sets a password through the emailed link.
    const passwordHash = await hashPassword(randomToken(32));
    const user = await this.db.transaction(async (tx) => {
      const created = await this.auth.provisionUser(tx, { email: input.email, name: input.name, passwordHash });
      await tx.update(users).set({ platformRole: input.platformRole, ...quotaColumns(input.quotaGb) }).where(eq(users.id, created.id));
      await this.audit.log(ctx, 'admin.user_created', { type: 'user', id: created.id }, { email: created.email, platformRole: input.platformRole, quotaGb: input.quotaGb });
      return created;
    });
    await this.auth.sendPasswordLink(user, 'setup', actor.name);
    return this.get(user.id);
  }

  async update(actorId: string, id: string, raw: AdminUpdateUserInput, ctx: AuditContext): Promise<AdminUserDto> {
    const input = adminUpdateUserSchema.parse(raw);
    await this.db.transaction(async (tx) => {
      const user = await this.require(id, tx);
      const self = id === actorId;
      if (self && input.platformRole && input.platformRole !== user.platformRole) throw badRequest("You can't change your own role.");
      if (self && input.status === 'SUSPENDED') throw badRequest("You can't suspend your own account.");
      const losesAdmin =
        user.platformRole === 'SUPER_ADMIN' && user.status === 'ACTIVE' && ((input.platformRole && input.platformRole !== 'SUPER_ADMIN') || input.status === 'SUSPENDED');
      if (losesAdmin && (await this.isLastSuperAdmin(id, tx))) throw conflict('This is the only active super admin. Make someone else a super admin first.');

      const patch: Partial<typeof users.$inferInsert> = {};
      if (input.name !== undefined && input.name !== user.name) patch.name = input.name;
      if (input.platformRole !== undefined && input.platformRole !== user.platformRole) patch.platformRole = input.platformRole;
      if (input.status !== undefined && input.status !== user.status) patch.status = input.status;
      if (input.quotaGb !== undefined) Object.assign(patch, quotaColumns(input.quotaGb));
      if (!Object.keys(patch).length) return;
      await tx.update(users).set(patch).where(eq(users.id, id));

      const target = { type: 'user', id };
      if (patch.platformRole) await this.audit.log(ctx, 'admin.role_changed', target, { email: user.email, from: user.platformRole, to: patch.platformRole }, tx);
      if (patch.status === 'SUSPENDED') {
        // Suspension signs the person out everywhere immediately.
        await this.auth.revokeAllSessions(id, 'suspended', undefined, tx);
        await this.audit.log(ctx, 'admin.user_suspended', target, { email: user.email }, tx);
      }
      if (patch.status === 'ACTIVE') await this.audit.log(ctx, 'admin.user_activated', target, { email: user.email }, tx);
      if (patch.name !== undefined || 'storageQuotaBytes' in patch) {
        await this.audit.log(ctx, 'admin.user_updated', target, { email: user.email, name: patch.name, quotaGb: input.quotaGb }, tx);
      }
    });
    return this.get(id);
  }

  /**
   * Sets or adjusts one person's storage. `adjust` is applied to the quota in effect when the row is locked, so
   * concurrent increases all count. The person is notified when the amount they can use changes.
   */
  async setStorage(actor: { userId: string; name: string }, id: string, raw: AdminStorageQuotaInput, ctx: AuditContext): Promise<AdminUserDto> {
    const input = adminStorageQuotaSchema.parse(raw);
    const defaultBytes = gbToBytes((await this.policies.get()).storage.defaultQuotaGb);
    const deliver = await this.db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, id)).for('update');
      if (!user || user.status === 'DELETED') throw notFound('user');
      const effective = (c: { storageQuotaBytes: number | null; storageUnlimited: boolean }) => (c.storageUnlimited ? null : (c.storageQuotaBytes ?? defaultBytes));
      const before = effective(user);

      let next: { storageQuotaBytes: number | null; storageUnlimited: boolean };
      switch (input.mode) {
        case 'default':
          next = quotaColumns(null);
          break;
        case 'unlimited':
          next = quotaColumns('unlimited');
          break;
        case 'custom':
          next = quotaColumns(input.gb);
          break;
        case 'adjust': {
          if (before == null) throw badRequest(`${user.name} has unlimited storage. Choose a size instead of adding or removing space.`);
          const bytes = before + Math.round(input.deltaGb * GB);
          if (bytes < MIN_QUOTA_GB * GB) throw unprocessable(`Storage can't go below ${MIN_QUOTA_GB} GB.`, { path: 'deltaGb' });
          if (bytes > MAX_QUOTA_GB * GB) throw unprocessable('That is more storage than a quota can hold.', { path: 'deltaGb' });
          next = { storageQuotaBytes: bytes, storageUnlimited: false };
          break;
        }
      }
      await tx.update(users).set(next).where(eq(users.id, id));
      const after = effective(next);
      await this.audit.log(ctx, 'admin.storage_changed', { type: 'user', id }, { email: user.email, mode: input.mode, fromBytes: before, toBytes: after }, tx);
      if (before === after) return null;
      const title =
        after == null ? 'You now have unlimited storage' : before != null && after < before ? `Your storage was reduced to ${formatGb(after)}` : `Your storage was increased to ${formatGb(after)}`;
      const { deliver } = await this.notifications.create(
        [{ userId: id, actorId: actor.userId, type: 'STORAGE_CHANGED', title, body: `Changed by ${actor.name}, an administrator.`, link: '/drive/storage' }],
        tx,
      );
      return deliver;
    });
    if (deliver) queueMicrotask(() => void deliver());
    return this.get(id);
  }

  async bulk(actorId: string, raw: unknown, ctx: AuditContext): Promise<{ updated: string[]; skipped: { id: string; reason: string }[] }> {
    const input = adminBulkUsersSchema.parse(raw);
    const updated: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    for (const id of [...new Set(input.userIds)]) {
      try {
        if (input.action === 'signOut') await this.signOut(actorId, id, ctx);
        else await this.update(actorId, id, { status: input.action === 'suspend' ? 'SUSPENDED' : 'ACTIVE' }, ctx);
        updated.push(id);
      } catch (err) {
        skipped.push({ id, reason: (err as Error).message });
      }
    }
    return { updated, skipped };
  }

  async signOut(actorId: string, id: string, ctx: AuditContext): Promise<void> {
    if (id === actorId) throw badRequest('Manage your own sessions in Account settings.');
    const user = await this.require(id);
    await this.db.transaction(async (tx) => {
      await this.auth.revokeAllSessions(id, 'admin_signout', undefined, tx);
      await this.audit.log(ctx, 'admin.user_signed_out', { type: 'user', id }, { email: user.email }, tx);
    });
  }

  async sendPasswordReset(actor: { userId: string; name: string }, id: string, ctx: AuditContext): Promise<void> {
    const user = await this.require(id);
    if (user.status !== 'ACTIVE') throw badRequest('Activate the account before sending a password link.');
    const neverSignedIn = !user.lastLoginAt;
    await this.auth.sendPasswordLink(user, neverSignedIn ? 'setup' : 'reset', actor.name);
    await this.audit.log(ctx, 'admin.password_link_sent', { type: 'user', id }, { email: user.email, kind: neverSignedIn ? 'setup' : 'reset' });
  }

  /**
   * Removes an account. Its files are either transferred (everything it owns moves to the other person, and the
   * contents of its My Drive land in a "<name>'s files" folder in theirs) or permanently deleted with their bytes.
   */
  async delete(actorId: string, id: string, raw: AdminDeleteUserInput, ctx: AuditContext): Promise<{ transferredTo: string | null; deletedFiles: number }> {
    const input = adminDeleteUserSchema.parse(raw);
    if (id === actorId) throw badRequest("You can't delete your own account here.");
    let keys: string[] = [];
    const result = await this.db.transaction(async (tx) => {
      const user = await this.require(id, tx);
      if (user.platformRole === 'SUPER_ADMIN' && user.status === 'ACTIVE' && (await this.isLastSuperAdmin(id, tx))) {
        throw conflict('This is the only active super admin. Make someone else a super admin first.');
      }
      let transferredTo: string | null = null;
      let deletedFiles = 0;
      if ('transferToUserId' in input) {
        if (input.transferToUserId === id) throw badRequest('Choose someone else to receive the files.');
        const to = await this.require(input.transferToUserId, tx);
        if (to.status !== 'ACTIVE') throw badRequest('Files can only be transferred to an active account.');
        await this.transferAllData(tx, user, to, actorId);
        transferredTo = to.id;
      } else {
        // Every file the person owns, plus everything inside folders they own (deleting a folder deletes its contents).
        const ownedFolders = await tx.select({ id: driveFolders.id }).from(driveFolders).where(eq(driveFolders.ownerId, id));
        const inFolders = ownedFolders.length
          ? await tx.select({ id: driveFiles.id }).from(driveFiles).where(inArray(driveFiles.folderId, ownedFolders.map((f) => f.id)))
          : [];
        const ownedFiles = await tx.select({ id: driveFiles.id }).from(driveFiles).where(eq(driveFiles.ownerId, id));
        const fileIds = [...new Set([...inFolders, ...ownedFiles].map((f) => f.id))];
        keys = [...(await DriveFileRepository.storageKeysForFiles(tx, fileIds)), ...(await this.natives.storageKeys(tx, fileIds))];
        deletedFiles = fileIds.length;
        if (fileIds.length) await tx.delete(driveFiles).where(inArray(driveFiles.id, fileIds));
      }
      await this.audit.log(ctx, 'admin.user_deleted', { type: 'user', id }, { email: user.email, name: user.name, transferredTo, deletedFiles }, tx);
      // Cascades remove the account's sessions, My Drive, folders, grants, stars and notifications.
      await tx.delete(users).where(eq(users.id, id));
      return { transferredTo, deletedFiles };
    });
    // Bytes are removed only after the database commit.
    await this.storage.safeDelete(...keys);
    return result;
  }

  /** Moves ownership of everything `from` owns to `to` (inside the caller's transaction). */
  private async transferAllData(tx: Executor, from: UserRow, to: UserRow, actorId: string): Promise<void> {
    const fromRoot = await UserRepository.rootFolderId(tx, from.id);
    const toRoot = await UserRepository.rootFolderId(tx, to.id);
    if (!fromRoot || !toRoot) throw conflict('My Drive is missing for one of the accounts.');
    const name = nextDuplicateName(`${from.name}'s files`, await FolderRepository.childNames(tx, toRoot));
    const holder = await FolderRepository.insert(tx, { ownerId: to.id, parentId: toRoot, name });
    await tx.update(driveFolders).set({ parentId: holder.id }).where(and(eq(driveFolders.parentId, fromRoot), ne(driveFolders.id, holder.id)));
    await tx.update(driveFiles).set({ folderId: holder.id }).where(eq(driveFiles.folderId, fromRoot));
    await tx.update(driveFolders).set({ ownerId: to.id }).where(and(eq(driveFolders.ownerId, from.id), eq(driveFolders.isRoot, false)));
    await tx.update(driveFiles).set({ ownerId: to.id }).where(eq(driveFiles.ownerId, from.id));
    // Grants the new owner had on these items are now redundant.
    await tx.execute(sql`delete from file_permissions where user_id = ${to.id} and file_id in (select id from drive_files where owner_id = ${to.id})`);
    await tx.execute(sql`delete from folder_permissions where user_id = ${to.id} and folder_id in (select id from drive_folders where owner_id = ${to.id})`);
    await this.activity.record(
      { userId: actorId, action: 'FOLDER_CREATED', resourceType: 'FOLDER', resourceId: holder.id, resourceName: name, metadata: { transferredFrom: from.email } },
      tx,
    );
  }

  /** Transfers one file to another person; the previous owner keeps editor access. */
  async transferFile(fileId: string, toUserId: string, ctx: AuditContext): Promise<void> {
    await this.db.transaction(async (tx) => {
      const file = await DriveFileRepository.findById(tx, fileId);
      if (!file) throw notFound('file');
      if (file.isTrashed) throw badRequest('Restore the item from the trash first.');
      const to = await this.require(toUserId, tx);
      if (to.status !== 'ACTIVE') throw badRequest('Files can only be transferred to an active account.');
      if (to.id === file.ownerId) throw badRequest('This person already owns the file.');
      await tx.update(driveFiles).set({ ownerId: to.id }).where(eq(driveFiles.id, fileId));
      await tx.delete(filePermissions).where(and(eq(filePermissions.fileId, fileId), eq(filePermissions.userId, to.id)));
      await tx
        .insert(filePermissions)
        .values({ fileId, userId: file.ownerId, role: 'EDITOR', canShare: true, canDownload: true, canCopy: true, grantedBy: ctx.actorId })
        .onConflictDoUpdate({ target: [filePermissions.fileId, filePermissions.userId], set: { role: 'EDITOR', canShare: true, canDownload: true, canCopy: true } });
      await this.audit.log(ctx, 'admin.ownership_transferred', { type: 'FILE', id: fileId }, { name: file.name, from: file.ownerId, to: to.id, toEmail: to.email }, tx);
    });
  }

  /** Revokes one session, or every session except the admin's own. */
  async revokeSession(sessionId: string, ctx: AuditContext): Promise<void> {
    const [s] = await this.db.select({ id: sessions.id, userId: sessions.userId }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!s) throw notFound('session');
    await this.auth.revokeSession(sessionId, 'admin_revoked');
    await this.audit.log(ctx, 'admin.session_revoked', { type: 'session', id: sessionId }, { userId: s.userId });
  }

  async revokeAllSessions(currentSessionId: string, ctx: AuditContext): Promise<{ revoked: number }> {
    return this.db.transaction(async (tx) => {
      const live = await tx.execute(sql`select id from sessions where revoked_at is null and id <> ${currentSessionId}`);
      const ids = (live as unknown as { id: string }[]).map((r) => r.id);
      for (const id of ids) await this.auth.revokeSession(id, 'admin_revoked_all', tx);
      await this.audit.log(ctx, 'admin.sessions_revoked_all', null, { revoked: ids.length }, tx);
      return { revoked: ids.length };
    });
  }
}
