import type { Readable } from 'node:stream';
import type { DriveFileDto, FileVersionDto, NativeFileType, UpdateItemInput } from '@qub/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import { driveFiles, fileVersions, users } from '../../db/schema';
import type { StorageService } from '../../services/storage';
import { AppError, badRequest, forbidden, notFound } from '../../utils/errors';
import { nextDuplicateName, sanitizeFilename } from '../../utils/filename';
import { fileTypeFromMime, NATIVE_MIME } from '../../utils/mime';
import type { ActivityService } from '../activity/activity.service';
import type { PolicyService } from '../admin/policy.service';
import type { UsageService } from '../admin/usage.service';
import { toFileDtos } from '../drive/drive.mapper';
import type { NativeResourceRegistry } from '../drive/native-registry';
import type { FolderService } from '../folders/folder.service';
import { FolderRepository } from '../folders/folder.repository';
import type { NotificationService } from '../notifications/notification.service';
import type { PermissionService } from '../permissions/permission.service';
import { UserRepository } from '../users/user.repository';
import { DriveFileRepository, type DriveFileRow } from './file.repository';

export interface UploadSource {
  stream: Readable;
  filename: string;
}

/**
 * The one file service for the platform. Docs, Sheets and Forms create, rename, move, trash and copy their
 * resources through it, so Drive semantics (names, trash, activity, permissions) are identical everywhere.
 */
export class FileService {
  constructor(
    private readonly db: Database,
    private readonly permissions: PermissionService,
    private readonly folders: FolderService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationService,
    private readonly natives: NativeResourceRegistry,
    private readonly policies: PolicyService,
    private readonly usage: UsageService,
  ) {}

  async get(userId: string, fileId: string): Promise<DriveFileDto> {
    const access = await this.permissions.requireFile(userId, fileId, 'VIEWER');
    const row = await DriveFileRepository.findById(this.db, fileId);
    if (!row) throw notFound('file');
    const [dto] = await toFileDtos(this.db, userId, [row], new Map([[fileId, access]]));
    return dto!;
  }

  /** Step 3-4 of the creation flow for Docs/Sheets/Forms: a Drive file of the native type, in My Drive by default. */
  async createNative(tx: Executor, userId: string, type: NativeFileType, name: string, folderId?: string): Promise<DriveFileRow> {
    const folder = await this.folders.resolveTarget(userId, folderId, tx);
    const file = await DriveFileRepository.insert(tx, {
      ownerId: userId,
      folderId: folder.id,
      name: sanitizeFilename(name, 'Untitled'),
      mimeType: NATIVE_MIME[type],
      fileType: type,
      size: 0,
    });
    await this.activity.record(
      { userId, action: 'FILE_CREATED', resourceType: 'FILE', resourceId: file.id, resourceName: file.name, metadata: { fileType: type, folderId: folder.id } },
      tx,
    );
    return file;
  }

  /** Per-file size limit, the owner's remaining storage quota and blocked extensions, from organization policy. */
  private async uploadLimits(uploaderId: string, ownerId: string) {
    const p = await this.policies.get();
    const budget = await this.usage.uploadBudget(ownerId, this.policies.maxUploadBytes(p), ownerId === uploaderId ? 'self' : 'owner');
    return { ...budget, blockedExtensions: p.uploads.blockedExtensions };
  }

  async upload(userId: string, folderId: string | undefined, source: UploadSource): Promise<DriveFileDto> {
    const folder = await this.folders.resolveTarget(userId, folderId);
    const [user] = await this.db.select({ isPro: users.isPro, storageUnlimited: users.storageUnlimited, platformRole: users.platformRole }).from(users).where(eq(users.id, userId)).limit(1);
    const isPro = Boolean(user?.isPro || user?.storageUnlimited || user?.platformRole === 'SUPERADMIN' || user?.platformRole === 'ADMIN');
    // WeTransfer-style 7-day retention for free users; permanent for Pro users
    const expiresAt = isPro ? null : new Date(Date.now() + 7 * 86_400_000);

    const filename = sanitizeFilename(source.filename, 'Untitled file');
    const key = this.storage.newKey('files', userId);
    const stored = await this.storage.ingest(source.stream, { filename, key, ...(await this.uploadLimits(userId, userId)) });
    try {
      const file = await this.db.transaction(async (tx) => {
        const name = nextDuplicateName(filename, await DriveFileRepository.namesInFolder(tx, folder.id));
        const created = await DriveFileRepository.insert(tx, {
          ownerId: userId,
          folderId: folder.id,
          name,
          mimeType: stored.mimeType,
          fileType: fileTypeFromMime(stored.mimeType),
          size: stored.size,
          storageKey: stored.key,
          checksum: stored.checksum,
          currentVersion: 1,
          expiresAt,
        });
        await tx.insert(fileVersions).values({
          fileId: created.id,
          versionNumber: 1,
          storageKey: stored.key,
          mimeType: stored.mimeType,
          size: stored.size,
          checksum: stored.checksum,
          createdBy: userId,
        });
        await this.activity.record(
          { userId, action: 'FILE_CREATED', resourceType: 'FILE', resourceId: created.id, resourceName: name, metadata: { upload: true, size: stored.size } },
          tx,
        );
        return created;
      });
      return this.get(userId, file.id);
    } catch (err) {
      await this.storage.safeDelete(stored.key);
      throw err;
    }
  }

  async uploadVersion(userId: string, fileId: string, source: UploadSource): Promise<DriveFileDto> {
    await this.permissions.requireFile(userId, fileId, 'EDITOR');
    const file = await DriveFileRepository.findById(this.db, fileId);
    if (!file) throw notFound('file');
    if (!file.storageKey) throw badRequest('Versions of Docs, Sheets and Forms are managed inside the app.');
    const key = this.storage.newKey('files', file.ownerId);
    const stored = await this.storage.ingest(source.stream, { filename: sanitizeFilename(source.filename, file.name), key, ...(await this.uploadLimits(userId, file.ownerId)) });
    try {
      await this.db.transaction(async (tx) => {
        const versionNumber = await DriveFileRepository.nextVersionNumber(tx, fileId);
        await tx.insert(fileVersions).values({ fileId, versionNumber, storageKey: stored.key, mimeType: stored.mimeType, size: stored.size, checksum: stored.checksum, createdBy: userId });
        await DriveFileRepository.update(tx, fileId, {
          storageKey: stored.key,
          mimeType: stored.mimeType,
          fileType: fileTypeFromMime(stored.mimeType),
          size: stored.size,
          checksum: stored.checksum,
          currentVersion: versionNumber,
        });
        await this.activity.record({ userId, action: 'FILE_VERSION_UPLOADED', resourceType: 'FILE', resourceId: fileId, resourceName: file.name, metadata: { versionNumber } }, tx);
      });
    } catch (err) {
      await this.storage.safeDelete(stored.key);
      throw err;
    }
    return this.get(userId, fileId);
  }

  async listVersions(userId: string, fileId: string): Promise<FileVersionDto[]> {
    await this.permissions.requireFile(userId, fileId, 'VIEWER');
    const file = await DriveFileRepository.findById(this.db, fileId);
    if (!file) throw notFound('file');
    const rows = await DriveFileRepository.versions(this.db, fileId);
    const users = await UserRepository.summaries(this.db, rows.map((r) => r.createdBy!).filter(Boolean));
    const unknownUser = { id: '', email: '', name: 'Deleted user', avatarUrl: null };
    return rows
      .map((r) => ({
        id: r.id,
        versionNumber: r.versionNumber,
        size: r.size,
        checksum: r.checksum,
        mimeType: r.mimeType,
        createdBy: (r.createdBy && users.get(r.createdBy)) || unknownUser,
        createdAt: r.createdAt.toISOString(),
        isCurrent: r.versionNumber === file.currentVersion,
      }))
      .reverse();
  }

  /** Restoring creates a new version that points at the old bytes, so history is never rewritten. */
  async restoreVersion(userId: string, fileId: string, versionId: string): Promise<DriveFileDto> {
    await this.permissions.requireFile(userId, fileId, 'EDITOR');
    await this.db.transaction(async (tx) => {
      const [version] = await tx.select().from(fileVersions).where(and(eq(fileVersions.id, versionId), eq(fileVersions.fileId, fileId))).limit(1);
      if (!version) throw notFound('version');
      const file = await DriveFileRepository.findById(tx, fileId);
      const versionNumber = await DriveFileRepository.nextVersionNumber(tx, fileId);
      await tx.insert(fileVersions).values({
        fileId,
        versionNumber,
        storageKey: version.storageKey,
        mimeType: version.mimeType,
        size: version.size,
        checksum: version.checksum,
        createdBy: userId,
      });
      await DriveFileRepository.update(tx, fileId, {
        storageKey: version.storageKey,
        mimeType: version.mimeType,
        fileType: fileTypeFromMime(version.mimeType),
        size: version.size,
        checksum: version.checksum,
        currentVersion: versionNumber,
      });
      await this.activity.record(
        { userId, action: 'FILE_VERSION_RESTORED', resourceType: 'FILE', resourceId: fileId, resourceName: file?.name, metadata: { restoredFrom: version.versionNumber, versionNumber } },
        tx,
      );
    });
    return this.get(userId, fileId);
  }

  /**
   * Deletes an older version to free space. The current version can't be deleted. Restored versions share bytes
   * with the version they came from, so the stored object is removed only once nothing refers to it.
   */
  async deleteVersion(userId: string, fileId: string, versionId: string): Promise<{ freedBytes: number }> {
    await this.permissions.requireFile(userId, fileId, 'EDITOR');
    const orphaned = await this.db.transaction(async (tx) => {
      const file = await DriveFileRepository.findById(tx, fileId);
      const [version] = await tx.select().from(fileVersions).where(and(eq(fileVersions.id, versionId), eq(fileVersions.fileId, fileId))).limit(1);
      if (!file || !version) throw notFound('version');
      if (version.versionNumber === file.currentVersion) throw badRequest("The current version can't be deleted. Restore another version first, or delete the file.");
      await tx.delete(fileVersions).where(eq(fileVersions.id, versionId));
      const [stillUsed] = (await tx.execute(sql`
        select 1 from file_versions where storage_key = ${version.storageKey}
        union all select 1 from drive_files where storage_key = ${version.storageKey}
        limit 1`)) as unknown as unknown[];
      await this.activity.record(
        { userId, action: 'FILE_VERSION_DELETED', resourceType: 'FILE', resourceId: fileId, resourceName: file.name, metadata: { versionNumber: version.versionNumber, size: version.size } },
        tx,
      );
      return { key: stillUsed ? null : version.storageKey, size: version.size };
    });
    if (orphaned.key) await this.storage.safeDelete(orphaned.key);
    return { freedBytes: orphaned.size };
  }

  async versionForDownload(userId: string, fileId: string, versionId: string) {
    await this.permissions.requireFile(userId, fileId, 'DOWNLOAD');
    const [version] = await this.db.select().from(fileVersions).where(and(eq(fileVersions.id, versionId), eq(fileVersions.fileId, fileId))).limit(1);
    const file = await DriveFileRepository.findById(this.db, fileId);
    if (!version || !file) throw notFound('version');
    return { file, version };
  }

  async update(userId: string, fileId: string, input: UpdateItemInput): Promise<DriveFileDto> {
    await this.permissions.requireFile(userId, fileId, 'EDITOR');
    await this.db.transaction(async (tx) => {
      const file = await DriveFileRepository.findById(tx, fileId);
      if (!file) throw notFound('file');
      const name = input.name !== undefined ? sanitizeFilename(input.name, file.name) : undefined;
      await DriveFileRepository.update(tx, fileId, {
        ...(name !== undefined ? { name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      });
      if (name !== undefined && name !== file.name) {
        await this.activity.record({ userId, action: 'FILE_RENAMED', resourceType: 'FILE', resourceId: fileId, resourceName: name, metadata: { from: file.name, to: name } }, tx);
      }
    });
    return this.get(userId, fileId);
  }

  /** Moves the Drive file; the linked document/spreadsheet/form is untouched (same row, same id). */
  async move(userId: string, fileId: string, targetFolderId: string): Promise<DriveFileDto> {
    await this.db.transaction(async (tx) => {
      await this.permissions.requireFile(userId, fileId, 'EDITOR', tx);
      const file = await DriveFileRepository.findById(tx, fileId);
      if (!file) throw notFound('file');
      if (file.isTrashed) throw badRequest('Restore the file before moving it.');
      if (file.folderId === targetFolderId) return;
      const target = await this.folders.resolveTarget(userId, targetFolderId, tx);
      await DriveFileRepository.update(tx, fileId, { folderId: target.id });
      await this.activity.record(
        { userId, action: 'FILE_MOVED', resourceType: 'FILE', resourceId: fileId, resourceName: file.name, metadata: { from: file.folderId, to: target.id } },
        tx,
      );
      if (file.ownerId !== userId) {
        const { deliver } = await this.notifications.create(
          [{ userId: file.ownerId, actorId: userId, type: 'FILE_MOVED', title: `"${file.name}" was moved to "${target.name}"`, link: `/drive/folder/${target.id}`, resourceType: 'FILE', resourceId: fileId }],
          tx,
        );
        queueMicrotask(() => void deliver());
      }
    });
    return this.get(userId, fileId);
  }

  async trash(userId: string, fileId: string): Promise<DriveFileDto> {
    const access = await this.permissions.requireFile(userId, fileId, 'VIEWER');
    if (!access.isOwner) throw forbidden('Only the owner can move this file to the trash.');
    await this.db.transaction(async (tx) => {
      const file = await DriveFileRepository.findById(tx, fileId);
      if (!file) throw notFound('file');
      if (file.isTrashed) return;
      await DriveFileRepository.update(tx, fileId, { isTrashed: true, trashedAt: new Date(), trashedByParent: false });
      await this.activity.record({ userId, action: 'FILE_DELETED', resourceType: 'FILE', resourceId: fileId, resourceName: file.name }, tx);
    });
    return this.get(userId, fileId);
  }

  /** Restores to the original folder, or to My Drive if that folder is gone or trashed. */
  async restore(userId: string, fileId: string): Promise<DriveFileDto> {
    const access = await this.permissions.requireFile(userId, fileId, 'VIEWER');
    if (!access.isOwner) throw forbidden();
    await this.db.transaction(async (tx) => {
      const file = await DriveFileRepository.findById(tx, fileId);
      if (!file) throw notFound('file');
      if (!file.isTrashed) return;
      if (file.trashedByParent) throw badRequest('This file is in a trashed folder. Restore the folder instead.');
      const folder = await FolderRepository.findById(tx, file.folderId);
      const folderId = folder && !folder.isTrashed ? folder.id : (await this.folders.rootOf(file.ownerId, tx)).id;
      await DriveFileRepository.update(tx, fileId, { isTrashed: false, trashedAt: null, trashedByParent: false, folderId });
      await this.activity.record({ userId, action: 'FILE_RESTORED', resourceType: 'FILE', resourceId: fileId, resourceName: file.name, metadata: { folderId } }, tx);
    });
    return this.get(userId, fileId);
  }

  async deletePermanently(userId: string, fileId: string, opts: { system?: boolean } = {}): Promise<void> {
    if (!opts.system) {
      const access = await this.permissions.requireFile(userId, fileId, 'VIEWER');
      if (!access.isOwner) throw forbidden('Only the owner can delete this file.');
    }
    const keys = await this.db.transaction(async (tx) => {
      const file = await DriveFileRepository.findById(tx, fileId);
      if (!file) throw notFound('file');
      const storageKeys = [
        ...(await DriveFileRepository.storageKeysForFiles(tx, [fileId])),
        ...(await this.natives.storageKeys(tx, [fileId])),
      ];
      await tx.delete(driveFiles).where(eq(driveFiles.id, fileId));
      await this.activity.record({ userId, action: 'FILE_PERMANENTLY_DELETED', resourceType: 'FILE', resourceId: fileId, resourceName: file.name }, tx);
      return storageKeys;
    });
    await this.storage.safeDelete(...keys);
  }

  /**
   * Copies a file inside an open transaction. Blob files get a new storage object; Docs/Sheets/Forms are copied by
   * their registered handler. Returns the new row and any storage keys created (to clean up if the caller rolls back).
   */
  async copyWithin(tx: Executor, userId: string, source: DriveFileRow, targetFolderId: string, name: string): Promise<{ file: DriveFileRow; createdKeys: string[] }> {
    const createdKeys: string[] = [];
    let storageKey: string | null = null;
    if (source.storageKey) {
      storageKey = this.storage.newKey('files', userId);
      await this.storage.copy(source.storageKey, storageKey);
      createdKeys.push(storageKey);
    }
    const file = await DriveFileRepository.insert(tx, {
      ownerId: userId,
      folderId: targetFolderId,
      name,
      mimeType: source.mimeType,
      fileType: source.fileType,
      size: source.size,
      storageKey,
      checksum: source.checksum,
      description: source.description,
      currentVersion: 1,
    });
    if (storageKey) {
      await tx.insert(fileVersions).values({ fileId: file.id, versionNumber: 1, storageKey, mimeType: source.mimeType, size: source.size, checksum: source.checksum ?? '', createdBy: userId });
    } else if (source.fileType === 'DOCUMENT' || source.fileType === 'SPREADSHEET' || source.fileType === 'FORM') {
      await this.natives.get(source.fileType).copy(tx, source.id, file.id, userId);
    }
    return { file, createdKeys };
  }

  async copy(userId: string, fileId: string, input: { name?: string; folderId?: string }): Promise<DriveFileDto> {
    await this.permissions.requireFile(userId, fileId, 'COPY');
    const source = await DriveFileRepository.findById(this.db, fileId);
    if (!source) throw notFound('file');
    // Default destination: same folder if the user may add to it, otherwise My Drive.
    let folderId = input.folderId;
    if (!folderId) {
      const folderAccess = await this.permissions.folderAccess(userId, source.folderId);
      folderId = folderAccess && folderAccess.role !== 'VIEWER' && folderAccess.role !== 'COMMENTER' ? source.folderId : undefined;
    }
    const created: string[] = [];
    try {
      const file = await this.db.transaction(async (tx) => {
        const target = await this.folders.resolveTarget(userId, folderId, tx);
        const name = nextDuplicateName(input.name ?? `Copy of ${source.name}`, await DriveFileRepository.namesInFolder(tx, target.id));
        const result = await this.copyWithin(tx, userId, source, target.id, name);
        created.push(...result.createdKeys);
        await this.activity.record(
          { userId, action: 'FILE_COPIED', resourceType: 'FILE', resourceId: result.file.id, resourceName: name, metadata: { sourceId: fileId } },
          tx,
        );
        return result.file;
      });
      return this.get(userId, file.id);
    } catch (err) {
      await this.storage.safeDelete(...created);
      throw err;
    }
  }

  /** Access check + metadata for streaming the current bytes. */
  async forDownload(userId: string, fileId: string, mode: 'download' | 'preview'): Promise<DriveFileRow> {
    await this.permissions.requireFile(userId, fileId, mode === 'download' ? 'DOWNLOAD' : 'VIEWER');
    const file = await DriveFileRepository.findById(this.db, fileId);
    if (!file) throw notFound('file');
    if (!file.storageKey) throw new AppError('BAD_REQUEST', 'Open this file in its Qub app instead of downloading it.');
    if (mode === 'download') {
      await this.activity.record({ userId, action: 'FILE_DOWNLOADED', resourceType: 'FILE', resourceId: fileId, resourceName: file.name });
    } else {
      await this.recordOpened(userId, file);
    }
    return file;
  }

  /** Access check for a listing thumbnail: unlike a preview, seeing one in a list isn't recorded as an open. */
  async forThumbnail(userId: string, fileId: string): Promise<DriveFileRow> {
    await this.permissions.requireFile(userId, fileId, 'VIEWER');
    const file = await DriveFileRepository.findById(this.db, fileId);
    if (!file || file.isTrashed) throw notFound('file');
    return file;
  }

  async recordOpened(userId: string, file: Pick<DriveFileRow, 'id' | 'name'>): Promise<void> {
    await this.activity.recordThrottled({ userId, action: 'FILE_OPENED', resourceType: 'FILE', resourceId: file.id, resourceName: file.name }, 60_000);
  }

  async recordEdited(userId: string, file: Pick<DriveFileRow, 'id' | 'name'>, tx?: Executor): Promise<void> {
    await this.activity.recordThrottled({ userId, action: 'FILE_EDITED', resourceType: 'FILE', resourceId: file.id, resourceName: file.name }, 10 * 60_000, tx);
  }
}
