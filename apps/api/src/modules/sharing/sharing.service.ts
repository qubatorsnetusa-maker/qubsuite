import {
  deriveVisibility,
  roleAtLeast,
  type GeneralAccessInput,
  type PermissionDto,
  type ResourceType,
  type ShareInput,
  type SharingStateDto,
  type UpdatePermissionInput,
} from '@qub/shared';
import { generalAccessSchema, shareSchema } from '@qub/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Env } from '../../config/env';
import type { Database, Executor } from '../../db';
import { driveFiles, driveFolders, filePermissions, fileShares, folderPermissions, shareLinks } from '../../db/schema';
import type { Mailer } from '../../services/mailer';
import { hashPassword, randomToken } from '../../utils/crypto';
import { AppError, badRequest, conflict, forbidden, notFound, policyViolation } from '../../utils/errors';
import type { ActivityService, AuditContext, AuditService } from '../activity/activity.service';
import type { PolicyService } from '../admin/policy.service';
import type { NotificationService } from '../notifications/notification.service';
import { PermissionRepository } from '../permissions/permission.repository';
import { toCapabilities, type PermissionService } from '../permissions/permission.service';
import { hasBlocked } from '../spam/spam-sql';
import { UserRepository, toUserSummary } from '../users/user.repository';

export interface ResourceRef {
  type: ResourceType;
  id: string;
}

interface ResourceInfo {
  id: string;
  name: string;
  ownerId: string;
  generalAccess: 'RESTRICTED' | 'ANYONE_WITH_LINK';
  /** Parent folder for inheritance lookup. */
  parentFolderId: string | null;
  isTrashed: boolean;
  fileType?: string;
}

/**
 * The single sharing system for Drive files and folders. Docs, Sheets and Forms share through their Drive file,
 * so there is exactly one permission model in the platform.
 */
export class SharingService {
  constructor(
    private readonly db: Database,
    private readonly env: Env,
    private readonly permissions: PermissionService,
    private readonly notifications: NotificationService,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    private readonly policies: PolicyService,
  ) {}

  private async resource(ref: ResourceRef, tx: Executor = this.db): Promise<ResourceInfo> {
    if (ref.type === 'FILE') {
      const [f] = await tx.select().from(driveFiles).where(eq(driveFiles.id, ref.id)).limit(1);
      if (!f) throw notFound('file');
      return { id: f.id, name: f.name, ownerId: f.ownerId, generalAccess: f.generalAccess, parentFolderId: f.folderId, isTrashed: f.isTrashed, fileType: f.fileType };
    }
    const [f] = await tx.select().from(driveFolders).where(eq(driveFolders.id, ref.id)).limit(1);
    if (!f) throw notFound('folder');
    if (f.isRoot) throw badRequest('My Drive cannot be shared. Share a folder inside it instead.');
    return { id: f.id, name: f.name, ownerId: f.ownerId, generalAccess: f.generalAccess, parentFolderId: f.parentId, isTrashed: f.isTrashed };
  }

  /** In-app link to open the resource. */
  linkFor(ref: ResourceRef, info: ResourceInfo, resourceId?: string | null): string {
    if (ref.type === 'FOLDER') return `/drive/folder/${ref.id}`;
    switch (info.fileType) {
      case 'DOCUMENT':
        return resourceId ? `/docs/${resourceId}` : `/drive/file/${ref.id}`;
      case 'SPREADSHEET':
        return resourceId ? `/sheets/${resourceId}` : `/drive/file/${ref.id}`;
      case 'FORM':
        return resourceId ? `/forms/${resourceId}/edit` : `/drive/file/${ref.id}`;
      default:
        return `/drive/file/${ref.id}`;
    }
  }

  private async resourceIdFor(ref: ResourceRef): Promise<string | null> {
    if (ref.type !== 'FILE') return null;
    const rows = (await this.db.execute(sql`
      select id from documents where file_id = ${ref.id}
      union all select id from spreadsheets where file_id = ${ref.id}
      union all select id from forms where file_id = ${ref.id}`)) as unknown as { id: string }[];
    return rows[0]?.id ?? null;
  }

  /** What the organization allows, so share dialogs only offer permitted options. */
  private async sharingPolicy(): Promise<SharingStateDto['policy']> {
    const p = (await this.policies.get()).sharing;
    return { allowPublicLinks: p.allowPublicLinks, maxLinkRole: p.maxLinkRole, allowExternalInvites: p.allowExternalInvites, allowedDomains: p.allowedDomains };
  }

  async getState(userId: string, ref: ResourceRef): Promise<SharingStateDto> {
    const access = await this.permissions.require(userId, ref, 'VIEWER');
    const info = await this.resource(ref);
    const table = ref.type === 'FILE' ? filePermissions : folderPermissions;
    const column = ref.type === 'FILE' ? filePermissions.fileId : folderPermissions.folderId;
    const direct = await this.db.select().from(table).where(eq(column, ref.id));

    // Grants inherited from ancestor folders.
    const inherited: { user_id: string; role: string; can_share: boolean; can_download: boolean; can_copy: boolean; folder_id: string; folder_name: string; created_at: Date; id: string }[] =
      info.parentFolderId
        ? ((await this.db.execute(sql`
            with recursive chain as (
              select id, parent_id, name from drive_folders where id = ${info.parentFolderId}
              union all select p.id, p.parent_id, p.name from drive_folders p join chain c on p.id = c.parent_id
            )
            select fp.id, fp.user_id, fp.role, fp.can_share, fp.can_download, fp.can_copy, fp.created_at, c.id as folder_id, c.name as folder_name
            from chain c join folder_permissions fp on fp.folder_id = c.id`)) as never)
        : [];

    const users = await UserRepository.summaries(this.db, [info.ownerId, ...direct.map((d) => d.userId), ...inherited.map((i) => i.user_id)]);
    const permissions: PermissionDto[] = [
      ...direct.map((d) => ({
        id: d.id,
        user: users.get(d.userId)!,
        role: d.role,
        canShare: d.canShare,
        canDownload: d.canDownload,
        canCopy: d.canCopy,
        inheritedFrom: null,
        createdAt: d.createdAt.toISOString(),
      })),
      ...inherited
        .filter((i) => i.user_id !== info.ownerId && !direct.some((d) => d.userId === i.user_id))
        .map((i) => ({
          id: i.id,
          user: users.get(i.user_id)!,
          role: i.role as PermissionDto['role'],
          canShare: i.can_share,
          canDownload: i.can_download,
          canCopy: i.can_copy,
          inheritedFrom: { id: i.folder_id, name: i.folder_name },
          createdAt: new Date(i.created_at).toISOString(),
        })),
    ];

    const canManage = access.canShare;
    const pending = canManage
      ? await this.db
          .select()
          .from(fileShares)
          .where(and(ref.type === 'FILE' ? eq(fileShares.fileId, ref.id) : eq(fileShares.folderId, ref.id), isNull(fileShares.acceptedAt)))
      : [];
    const link = canManage ? await this.activeLink(ref) : null;

    return {
      resourceType: ref.type,
      resourceId: ref.id,
      owner: users.get(info.ownerId)!,
      generalAccess: info.generalAccess,
      visibility: deriveVisibility(info.generalAccess, permissions.length + pending.length),
      permissions,
      pendingInvites: pending.map((p) => ({ id: p.id, email: p.email, role: p.role as 'EDITOR', createdAt: p.createdAt.toISOString() })),
      link: link
        ? {
            id: link.id,
            token: link.token,
            url: `${this.env.APP_URL}/share/${link.token}`,
            role: link.permission as 'VIEWER',
            hasPassword: !!link.passwordHash,
            expiresAt: link.expiresAt?.toISOString() ?? null,
            createdAt: link.createdAt.toISOString(),
          }
        : null,
      capabilities: toCapabilities(access),
      policy: await this.sharingPolicy(),
    };
  }

  private async activeLink(ref: ResourceRef, tx: Executor = this.db) {
    const [link] = await tx
      .select()
      .from(shareLinks)
      .where(and(ref.type === 'FILE' ? eq(shareLinks.fileId, ref.id) : eq(shareLinks.folderId, ref.id), isNull(shareLinks.revokedAt)))
      .limit(1);
    return link ?? null;
  }

  /**
   * Alice shares with bob@example.com as EDITOR: validate Alice may share, create the permission (or a pending invite
   * if Bob has no account yet), notify Bob, and record the activity — all in one transaction.
   */
  async share(userId: string, ref: ResourceRef, rawInput: ShareInput, audit: AuditContext): Promise<SharingStateDto> {
    const input = shareSchema.parse(rawInput);
    const access = await this.permissions.require(userId, ref, 'SHARE');
    const policy = (await this.policies.get()).sharing;
    const domain = input.email.slice(input.email.lastIndexOf('@') + 1);
    if (policy.allowedDomains.length && !policy.allowedDomains.includes(domain)) {
      throw policyViolation(`Your organization only allows sharing with people at ${policy.allowedDomains.join(', ')}.`);
    }
    // Nobody can grant more than they have.
    if (!access.isOwner && !roleAtLeast(access.role, input.role)) throw forbidden('You cannot grant a higher role than your own.');
    const info = await this.resource(ref);
    if (info.isTrashed) throw badRequest('Items in the trash cannot be shared.');
    const target = await UserRepository.findByEmail(this.db, input.email);
    if (target?.id === info.ownerId) throw conflict('This person is the owner.');
    // Someone who blocked the sharer (or the item's owner) can't be given access by them.
    if (target && ((await hasBlocked(this.db, target.id, userId)) || (await hasBlocked(this.db, target.id, info.ownerId)))) {
      throw forbidden("You can't share with this person.");
    }
    if (!target && !policy.allowExternalInvites) throw policyViolation("Your organization doesn't allow inviting people who don't have a Qub account.");
    const actor = await UserRepository.findById(this.db, userId);
    const resourceId = await this.resourceIdFor(ref);

    await this.db.transaction(async (tx) => {
      const flags = { role: input.role, canShare: input.canShare, canDownload: input.canDownload, canCopy: input.canCopy };
      if (target) {
        if (ref.type === 'FILE') {
          await tx
            .insert(filePermissions)
            .values({ fileId: ref.id, userId: target.id, ...flags, grantedBy: userId })
            .onConflictDoUpdate({ target: [filePermissions.fileId, filePermissions.userId], set: { ...flags, source: 'DIRECT', grantedBy: userId, updatedAt: new Date() } });
        } else {
          await tx
            .insert(folderPermissions)
            .values({ folderId: ref.id, userId: target.id, ...flags, grantedBy: userId })
            .onConflictDoUpdate({ target: [folderPermissions.folderId, folderPermissions.userId], set: { ...flags, source: 'DIRECT', grantedBy: userId, updatedAt: new Date() } });
        }
      } else {
        await tx
          .delete(fileShares)
          .where(and(ref.type === 'FILE' ? eq(fileShares.fileId, ref.id) : eq(fileShares.folderId, ref.id), eq(fileShares.email, input.email), isNull(fileShares.acceptedAt)));
        await tx.insert(fileShares).values({
          resourceType: ref.type,
          fileId: ref.type === 'FILE' ? ref.id : null,
          folderId: ref.type === 'FOLDER' ? ref.id : null,
          email: input.email,
          ...flags,
          invitedBy: userId,
        });
      }
      await this.activity.record(
        {
          userId,
          action: ref.type === 'FILE' ? 'FILE_SHARED' : 'FOLDER_SHARED',
          resourceType: ref.type,
          resourceId: ref.id,
          resourceName: info.name,
          metadata: { email: input.email, role: input.role, pending: !target },
        },
        tx,
      );
      await this.audit.log(audit, 'sharing.granted', { type: ref.type, id: ref.id }, { email: input.email, role: input.role }, tx);
      if (target && input.notify) {
        const { deliver } = await this.notifications.create(
          [
            {
              userId: target.id,
              actorId: userId,
              type: 'SHARED_WITH_YOU',
              title: `${actor?.name ?? 'Someone'} shared "${info.name}" with you`,
              body: input.message ?? null,
              link: this.linkFor(ref, info, resourceId),
              resourceType: ref.type,
              resourceId: ref.id,
            },
          ],
          tx,
        );
        queueMicrotask(() => void deliver());
      }
    });

    if (input.notify) {
      const url = `${this.env.APP_URL}${target ? this.linkFor(ref, info, resourceId) : `/register?email=${encodeURIComponent(input.email)}`}`;
      const roleDisplay = input.role.charAt(0).toUpperCase() + input.role.slice(1).toLowerCase();
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 20px; font-weight: 700; color: #1a56db; letter-spacing: -0.5px;">QubDocs</span>
          </div>
          <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin: 0 0 16px;">
            ${actor?.name ?? 'A collaborator'} shared an item with you
          </h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 20px;">
            <strong>${actor?.name ?? 'Someone'}</strong> (${actor?.email}) invited you to collaborate on <strong>"${info.name}"</strong> as an <strong>${roleDisplay}</strong>.
          </p>
          ${input.message ? `<div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0; font-size: 14px; color: #475569; font-style: italic;">"${input.message}"</div>` : ''}
          <div style="margin: 28px 0;">
            <a href="${url}" style="display: inline-block; background: #1a56db; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(26, 86, 219, 0.2);">
              Open ${info.name}
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            You received this email because someone shared a document, spreadsheet, or folder with you on QubDocs.
          </p>
        </div>
      `;
      await this.mailer.send({
        to: input.email,
        subject: `${actor?.name ?? 'Someone'} shared "${info.name}" with you`,
        text: `${actor?.name ?? 'Someone'} (${actor?.email}) shared "${info.name}" with you as ${input.role.toLowerCase()}.${input.message ? `\n\n"${input.message}"` : ''}\n\nOpen: ${url}`,
        html: htmlBody,
      });
    }
    return this.getState(userId, ref);
  }

  async updatePermission(userId: string, ref: ResourceRef, permissionId: string, input: UpdatePermissionInput, audit: AuditContext): Promise<SharingStateDto> {
    const access = await this.permissions.require(userId, ref, 'SHARE');
    if (input.role && !access.isOwner && !roleAtLeast(access.role, input.role)) throw forbidden('You cannot grant a higher role than your own.');
    const info = await this.resource(ref);
    const table = ref.type === 'FILE' ? filePermissions : folderPermissions;
    const column = ref.type === 'FILE' ? filePermissions.fileId : folderPermissions.folderId;
    const [updated] = await this.db
      .update(table)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(table.id, permissionId), eq(column, ref.id)))
      .returning();
    if (!updated) throw notFound('permission');
    await this.activity.record({ userId, action: 'PERMISSION_CHANGED', resourceType: ref.type, resourceId: ref.id, resourceName: info.name, metadata: { permissionId, ...input } });
    await this.audit.log(audit, 'sharing.updated', { type: ref.type, id: ref.id }, { permissionId, ...input });
    if (input.role) {
      await this.notifications.notify([
        {
          userId: updated.userId,
          actorId: userId,
          type: 'PERMISSION_CHANGED',
          title: `Your access to "${info.name}" changed to ${input.role.toLowerCase()}`,
          link: this.linkFor(ref, info, await this.resourceIdFor(ref)),
          resourceType: ref.type,
          resourceId: ref.id,
        },
      ]);
    }
    return this.getState(userId, ref);
  }

  /** Managers can remove anyone; anyone can remove their own access. */
  async removePermission(userId: string, ref: ResourceRef, permissionId: string, audit: AuditContext): Promise<void> {
    const table = ref.type === 'FILE' ? filePermissions : folderPermissions;
    const column = ref.type === 'FILE' ? filePermissions.fileId : folderPermissions.folderId;
    const [perm] = await this.db.select().from(table).where(and(eq(table.id, permissionId), eq(column, ref.id))).limit(1);
    if (!perm) throw notFound('permission');
    if (perm.userId !== userId) await this.permissions.require(userId, ref, 'SHARE');
    const info = await this.resource(ref);
    await this.db.delete(table).where(eq(table.id, permissionId));
    await this.activity.record({ userId, action: 'PERMISSION_REMOVED', resourceType: ref.type, resourceId: ref.id, resourceName: info.name, metadata: { userId: perm.userId } });
    await this.audit.log(audit, 'sharing.revoked', { type: ref.type, id: ref.id }, { userId: perm.userId });
  }

  async cancelInvite(userId: string, ref: ResourceRef, inviteId: string): Promise<void> {
    await this.permissions.require(userId, ref, 'SHARE');
    await this.db
      .delete(fileShares)
      .where(and(eq(fileShares.id, inviteId), ref.type === 'FILE' ? eq(fileShares.fileId, ref.id) : eq(fileShares.folderId, ref.id)));
  }

  /** Switches between Restricted and "Anyone with the link" (creating/revoking the random link token). */
  async setGeneralAccess(userId: string, ref: ResourceRef, rawInput: GeneralAccessInput, audit: AuditContext): Promise<SharingStateDto> {
    const input = generalAccessSchema.parse(rawInput);
    await this.permissions.require(userId, ref, 'SHARE');
    const info = await this.resource(ref);
    if (info.isTrashed) throw badRequest('Items in the trash cannot be shared.');
    if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) throw new AppError('VALIDATION_ERROR', 'Expiry must be in the future.');
    if (input.access === 'ANYONE_WITH_LINK') {
      const policy = (await this.policies.get()).sharing;
      if (!policy.allowPublicLinks) throw policyViolation("Your organization doesn't allow sharing with anyone who has the link.");
      if (!roleAtLeast(policy.maxLinkRole, input.linkRole)) throw policyViolation(`Links can give at most ${policy.maxLinkRole.toLowerCase()} access in your organization.`);
    }

    await this.db.transaction(async (tx) => {
      const table = ref.type === 'FILE' ? driveFiles : driveFolders;
      await tx.update(table).set({ generalAccess: input.access }).where(eq(table.id, ref.id));
      const existing = await this.activeLink(ref, tx);
      if (input.access === 'RESTRICTED') {
        if (existing) await tx.update(shareLinks).set({ revokedAt: new Date() }).where(eq(shareLinks.id, existing.id));
      } else {
        const passwordHash = input.password === undefined ? existing?.passwordHash ?? null : input.password === null ? null : await hashPassword(input.password);
        const expiresAt = input.expiresAt === undefined ? existing?.expiresAt ?? null : input.expiresAt;
        if (existing) {
          await tx.update(shareLinks).set({ permission: input.linkRole, passwordHash, expiresAt }).where(eq(shareLinks.id, existing.id));
        } else {
          await tx.insert(shareLinks).values({
            resourceType: ref.type,
            fileId: ref.type === 'FILE' ? ref.id : null,
            folderId: ref.type === 'FOLDER' ? ref.id : null,
            token: randomToken(32),
            permission: input.linkRole,
            passwordHash,
            expiresAt,
            createdBy: userId,
          });
        }
      }
      await this.activity.record(
        { userId, action: 'LINK_SHARING_CHANGED', resourceType: ref.type, resourceId: ref.id, resourceName: info.name, metadata: { access: input.access, role: input.linkRole } },
        tx,
      );
      await this.audit.log(audit, 'sharing.link_changed', { type: ref.type, id: ref.id }, { access: input.access, role: input.linkRole, password: !!input.password }, tx);
    });
    return this.getState(userId, ref);
  }

  /** Issues a new token, invalidating the old URL. */
  async rotateLink(userId: string, ref: ResourceRef, audit: AuditContext): Promise<SharingStateDto> {
    await this.permissions.require(userId, ref, 'SHARE');
    await this.db.transaction(async (tx) => {
      const existing = await this.activeLink(ref, tx);
      if (!existing) throw badRequest('Link sharing is off.');
      await tx.update(shareLinks).set({ revokedAt: new Date() }).where(eq(shareLinks.id, existing.id));
      await tx.insert(shareLinks).values({ ...existing, id: undefined, token: randomToken(32), createdAt: new Date(), createdBy: userId });
      await this.audit.log(audit, 'sharing.link_rotated', { type: ref.type, id: ref.id }, {}, tx);
    });
    return this.getState(userId, ref);
  }

  /** Ids of every user with any access to a file (owner, direct, inherited) — for mentions and presence. */
  async usersWithAccess(fileId: string): Promise<string[]> {
    const rows = (await this.db.execute(sql`
      with recursive chain as (
        select f.folder_id as folder_id from drive_files f where f.id = ${fileId}
        union all select p.parent_id from drive_folders p join chain c on p.id = c.folder_id where p.parent_id is not null
      )
      select owner_id as user_id from drive_files where id = ${fileId}
      union select user_id from file_permissions where file_id = ${fileId}
      union select fp.user_id from folder_permissions fp where fp.folder_id in (select folder_id from chain)
      union select fo.owner_id from drive_folders fo where fo.id in (select folder_id from chain)`)) as unknown as { user_id: string }[];
    return rows.map((r) => r.user_id);
  }

  async ancestorsOf(folderId: string) {
    return PermissionRepository.folderAncestors(this.db, folderId);
  }
}
