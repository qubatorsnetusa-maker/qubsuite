import type { PublicShareDto } from '@qub/shared';
import { roleAtLeast } from '@qub/shared';
import { and, eq, isNull, not, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../db';
import { driveFiles, driveFolders, filePermissions, folderPermissions, shareLinks } from '../../db/schema';
import { verifyPassword } from '../../utils/crypto';
import { AppError, notFound } from '../../utils/errors';
import type { ActivityService } from '../activity/activity.service';
import type { PolicyService } from '../admin/policy.service';
import { DocumentRepository } from '../docs/document.repository';
import { DriveFileRepository } from '../files/file.repository';
import { PermissionRepository } from '../permissions/permission.repository';
import type { PermissionService } from '../permissions/permission.service';
import type { SpreadsheetService } from '../sheets/spreadsheet.service';
import { UserRepository } from '../users/user.repository';

type LinkRow = typeof shareLinks.$inferSelect;

const ACCESS_TTL = '2h';

/**
 * "Anyone with the link" access. Tokens are random strings unrelated to database ids. Password-protected links
 * require the password once; the client then uses a short-lived signed access token scoped to that one link.
 */
export class PublicShareService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly db: Database,
    private readonly permissions: PermissionService,
    private readonly sheets: SpreadsheetService,
    private readonly activity: ActivityService,
    private readonly policies: PolicyService,
  ) {}

  private async activeLink(token: string): Promise<LinkRow> {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw notFound('link');
    const policy = (await this.policies.get()).sharing;
    // Turning public links off in the admin console disables links that already exist, too.
    if (!policy.allowPublicLinks) throw notFound('link');
    const [link] = await this.db.select().from(shareLinks).where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt))).limit(1);
    if (!link || (link.expiresAt && link.expiresAt.getTime() < Date.now())) throw notFound('link');
    // The resource must still be shared by link and not in the trash.
    if (link.fileId) {
      const f = await DriveFileRepository.findById(this.db, link.fileId);
      if (!f || f.isTrashed || f.generalAccess !== 'ANYONE_WITH_LINK') throw notFound('link');
    } else {
      const [f] = await this.db.select().from(driveFolders).where(eq(driveFolders.id, link.folderId!)).limit(1);
      if (!f || f.isTrashed || f.generalAccess !== 'ANYONE_WITH_LINK') throw notFound('link');
    }
    // Links never grant more than the organization currently allows.
    return roleAtLeast(policy.maxLinkRole, link.permission) ? link : { ...link, permission: policy.maxLinkRole };
  }

  private sign(link: LinkRow): string {
    return this.app.jwt.sign({ typ: 'share', lid: link.id }, { expiresIn: ACCESS_TTL });
  }

  /** Validates a link access token issued by `resolve`. */
  async authorize(token: string, accessToken: string | undefined): Promise<LinkRow> {
    const link = await this.activeLink(token);
    if (!accessToken) throw new AppError('UNAUTHENTICATED', 'Link access token required.');
    try {
      const claims = this.app.jwt.verify<{ typ: string; lid: string }>(accessToken);
      if (claims.typ !== 'share' || claims.lid !== link.id) throw new Error('mismatch');
    } catch {
      throw new AppError('UNAUTHENTICATED', 'Link access expired. Open the link again.');
    }
    return link;
  }

  async resolve(token: string, password: string | undefined): Promise<PublicShareDto> {
    const link = await this.activeLink(token);
    let accessToken: string | null = null;
    if (!link.passwordHash) accessToken = this.sign(link);
    else if (password !== undefined) {
      if (!(await verifyPassword(link.passwordHash, password))) throw new AppError('FORBIDDEN', 'Incorrect password.');
      accessToken = this.sign(link);
    }
    const role = link.permission as PublicShareDto['role'];
    if (link.fileId) {
      const f = (await DriveFileRepository.findById(this.db, link.fileId))!;
      const owner = (await UserRepository.summaries(this.db, [f.ownerId])).get(f.ownerId)!;
      const resources = await DriveFileRepository.resourceIds(this.db, [f.id]);
      const expiresAt = f.expiresAt ? f.expiresAt.toISOString() : null;
      const isPermanent = !f.expiresAt;
      return {
        resourceType: 'FILE',
        role,
        name: f.name,
        owner,
        requiresPassword: !!link.passwordHash && !accessToken,
        accessToken,
        expiresAt,
        isPermanent,
        file: accessToken ? { id: f.id, fileType: f.fileType, mimeType: f.mimeType, size: f.size, resourceId: resources.get(f.id) ?? null, updatedAt: f.updatedAt.toISOString(), expiresAt } : undefined,
      };
    }
    const [folder] = await this.db.select().from(driveFolders).where(eq(driveFolders.id, link.folderId!)).limit(1);
    const owner = (await UserRepository.summaries(this.db, [folder!.ownerId])).get(folder!.ownerId)!;
    return {
      resourceType: 'FOLDER',
      role,
      name: folder!.name,
      owner,
      requiresPassword: !!link.passwordHash && !accessToken,
      accessToken,
      folder: accessToken ? { id: folder!.id, items: await this.folderItems(folder!.id) } : undefined,
    };
  }

  private async folderItems(folderId: string) {
    const rows = (await this.db.execute(sql`
      select 'folder' as kind, id, name, 'FOLDER' as file_type, 0::bigint as size from drive_folders where parent_id = ${folderId} and not is_trashed
      union all
      select 'file', id, name, file_type::text, size from drive_files where folder_id = ${folderId} and not is_trashed
      order by 1 desc, 3 limit 500`)) as unknown as { kind: 'file' | 'folder'; id: string; name: string; file_type: string; size: string }[];
    return rows.map((r) => ({ kind: r.kind, id: r.id, name: r.name, fileType: r.file_type as 'FOLDER', size: Number(r.size) }));
  }

  /** A folder link grants access to everything beneath the folder — but nothing outside it. */
  private async assertWithinLink(link: LinkRow, target: { fileId?: string; folderId?: string }): Promise<void> {
    if (link.fileId) {
      if (target.fileId !== link.fileId) throw notFound('file');
      return;
    }
    let startFolder = target.folderId;
    if (target.fileId) {
      const f = await DriveFileRepository.findById(this.db, target.fileId);
      if (!f || f.isTrashed) throw notFound('file');
      startFolder = f.folderId;
    }
    if (!startFolder) throw notFound('item');
    const ancestors = await PermissionRepository.folderAncestors(this.db, startFolder);
    if (!ancestors.some((a) => a.id === link.folderId)) throw notFound('item');
  }

  async listFolder(token: string, accessToken: string | undefined, folderId: string) {
    const link = await this.authorize(token, accessToken);
    await this.assertWithinLink(link, { folderId });
    const [folder] = await this.db.select().from(driveFolders).where(and(eq(driveFolders.id, folderId), not(driveFolders.isTrashed))).limit(1);
    if (!folder) throw notFound('folder');
    return { id: folder.id, name: folder.name, items: await this.folderItems(folderId) };
  }

  async fileForDownload(token: string, accessToken: string | undefined, fileId: string) {
    const link = await this.authorize(token, accessToken);
    await this.assertWithinLink(link, { fileId });
    const file = await DriveFileRepository.findById(this.db, fileId);
    if (!file?.storageKey) throw notFound('file');
    await this.activity.record({ userId: null, action: 'FILE_DOWNLOADED', resourceType: 'FILE', resourceId: file.id, resourceName: file.name, metadata: { via: 'link' } });
    return file;
  }

  async documentContent(token: string, accessToken: string | undefined, fileId: string) {
    const link = await this.authorize(token, accessToken);
    await this.assertWithinLink(link, { fileId });
    const doc = await DocumentRepository.findByFileId(this.db, fileId);
    const file = await DriveFileRepository.findById(this.db, fileId);
    if (!doc || !file) throw notFound('document');
    return { id: doc.id, title: file.name, content: doc.content, updatedAt: doc.updatedAt.toISOString() };
  }

  async spreadsheet(token: string, accessToken: string | undefined, fileId: string) {
    const link = await this.authorize(token, accessToken);
    await this.assertWithinLink(link, { fileId });
    const resources = await DriveFileRepository.resourceIds(this.db, [fileId]);
    const id = resources.get(fileId);
    if (!id) throw notFound('spreadsheet');
    return this.sheets.publicView(id);
  }

  async spreadsheetCells(token: string, accessToken: string | undefined, fileId: string, sheetId: string, range: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }) {
    const link = await this.authorize(token, accessToken);
    await this.assertWithinLink(link, { fileId });
    const id = (await DriveFileRepository.resourceIds(this.db, [fileId])).get(fileId);
    if (!id) throw notFound('spreadsheet');
    return this.sheets.publicCells(id, sheetId, range);
  }

  /**
   * A signed-in user opening a link gets a real permission (source = LINK) at the link's role,
   * so the item appears in "Shared with me" and collaboration works through the normal permission checks.
   */
  async redeem(userId: string, token: string, password?: string): Promise<{ resourceType: 'FILE' | 'FOLDER'; id: string; fileType?: string; resourceId?: string | null }> {
    const link = await this.activeLink(token);
    if (link.passwordHash && !(password !== undefined && (await verifyPassword(link.passwordHash, password)))) {
      throw new AppError('FORBIDDEN', 'This link requires a password.');
    }
    const ref = link.fileId ? ({ type: 'FILE', id: link.fileId } as const) : ({ type: 'FOLDER', id: link.folderId! } as const);
    const current = ref.type === 'FILE' ? await this.permissions.fileAccess(userId, ref.id) : await this.permissions.folderAccess(userId, ref.id);
    if (!current || !roleAtLeast(current.role, link.permission)) {
      const values = { userId, role: link.permission, canShare: false, canDownload: true, canCopy: true, source: 'LINK' as const, grantedBy: link.createdBy };
      if (ref.type === 'FILE') {
        await this.db
          .insert(filePermissions)
          .values({ ...values, fileId: ref.id })
          .onConflictDoUpdate({ target: [filePermissions.fileId, filePermissions.userId], set: { role: link.permission, updatedAt: new Date() } });
      } else {
        await this.db
          .insert(folderPermissions)
          .values({ ...values, folderId: ref.id })
          .onConflictDoUpdate({ target: [folderPermissions.folderId, folderPermissions.userId], set: { role: link.permission, updatedAt: new Date() } });
      }
    }
    if (ref.type === 'FILE') {
      const [f] = await this.db.select().from(driveFiles).where(eq(driveFiles.id, ref.id)).limit(1);
      const resourceId = (await DriveFileRepository.resourceIds(this.db, [ref.id])).get(ref.id) ?? null;
      return { resourceType: 'FILE', id: ref.id, fileType: f?.fileType, resourceId };
    }
    return { resourceType: 'FOLDER', id: ref.id };
  }
}
