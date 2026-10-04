import { rootFolderCache, folderDetailCache } from '../../utils/fast-cache';
import type { CreateFolderInput, FolderDetailDto, FolderRef, FolderTreeResult, UpdateItemInput } from '@qub/shared';
import { and, eq, inArray, not, sql } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import { driveFiles, driveFolders } from '../../db/schema';
import type { StorageService } from '../../services/storage';
import { AppError, badRequest, forbidden, notFound } from '../../utils/errors';
import { nextDuplicateName } from '../../utils/filename';
import type { ActivityService } from '../activity/activity.service';
import { toFolderDtos } from '../drive/drive.mapper';
import type { NativeResourceRegistry } from '../drive/native-registry';
import { DriveFileRepository } from '../files/file.repository';
import type { NotificationService } from '../notifications/notification.service';
import { PermissionRepository } from '../permissions/permission.repository';
import type { PermissionService } from '../permissions/permission.service';
import { FolderRepository, type FolderRow } from './folder.repository';

export class FolderService {
  constructor(
    private readonly db: Database,
    private readonly permissions: PermissionService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationService,
    private readonly storage: StorageService,
    private readonly natives: NativeResourceRegistry,
  ) {}

  async rootOf(userId: string, tx: Executor = this.db): Promise<FolderRow> {
    const cached = rootFolderCache.get(userId);
    if (cached) return cached;
    const root = await FolderRepository.root(tx, userId);
    if (!root) throw new AppError('INTERNAL_ERROR', 'User has no root folder');
    rootFolderCache.set(userId, root);
    return root;
  }

  /** Resolves a target folder (default: the user's My Drive) and checks the user may add items to it. */
  async resolveTarget(userId: string, folderId: string | undefined, tx: Executor = this.db): Promise<FolderRow> {
    if (!folderId) return this.rootOf(userId, tx);
    await this.permissions.requireFolder(userId, folderId, 'EDITOR', tx);
    const folder = await FolderRepository.findById(tx, folderId);
    if (!folder) throw notFound('folder');
    if (folder.isTrashed) throw badRequest('Cannot add items to a folder in the trash.');
    return folder;
  }

  async create(userId: string, input: CreateFolderInput): Promise<FolderDetailDto> {
    const folder = await this.db.transaction(async (tx) => {
      const parent = await this.resolveTarget(userId, input.parentId, tx);
      const name = nextDuplicateName(input.name, await FolderRepository.childNames(tx, parent.id));
      const created = await FolderRepository.insert(tx, { ownerId: userId, parentId: parent.id, name, description: input.description ?? null });
      await this.activity.record({ userId, action: 'FOLDER_CREATED', resourceType: 'FOLDER', resourceId: created.id, resourceName: name, metadata: { parentId: parent.id } }, tx);
      return created;
    });
    return this.get(userId, folder.id);
  }

  /**
   * Creates the folders of an uploaded directory in one transaction and returns the new id for every path. Missing
   * parents ("A" for "A/B") are created too; a top-level name already used in the target gets a "(1)" suffix,
   * like any new folder.
   */
  async createTree(userId: string, parentId: string | undefined, paths: string[][]): Promise<FolderTreeResult> {
    const all = new Map<string, string[]>();
    for (const segments of paths) {
      for (let i = 1; i <= segments.length; i++) all.set(segments.slice(0, i).join('/'), segments.slice(0, i));
    }
    if (all.size > 2000) throw badRequest('A folder upload can create at most 2,000 folders.');
    const ordered = [...all.entries()].sort((a, b) => a[1].length - b[1].length);
    return this.db.transaction(async (tx) => {
      const parent = await this.resolveTarget(userId, parentId, tx);
      const ids = new Map<string, string>();
      const topNames = await FolderRepository.childNames(tx, parent.id);
      for (const [path, segments] of ordered) {
        const top = segments.length === 1;
        const name = top ? nextDuplicateName(segments[0]!, topNames) : segments.at(-1)!;
        if (top) topNames.add(name);
        const created = await FolderRepository.insert(tx, { ownerId: userId, parentId: top ? parent.id : ids.get(segments.slice(0, -1).join('/'))!, name });
        ids.set(path, created.id);
        if (top) {
          await this.activity.record({ userId, action: 'FOLDER_CREATED', resourceType: 'FOLDER', resourceId: created.id, resourceName: name, metadata: { parentId: parent.id, upload: true } }, tx);
        }
      }
      return { folders: Object.fromEntries(ids) };
    });
  }

  async get(userId: string, folderId: string): Promise<FolderDetailDto> {
    const cacheKey = `${userId}:${folderId}`;
    const cached = folderDetailCache.get(cacheKey);
    if (cached) return cached;
    const access = await this.permissions.requireFolder(userId, folderId, 'VIEWER');
    const folder = await FolderRepository.findById(this.db, folderId);
    if (!folder) throw notFound('folder');
    const [dto] = await toFolderDtos(this.db, userId, [folder], new Map([[folder.id, access]]));
    const result = { ...dto!, path: await this.path(userId, folderId) };
    folderDetailCache.set(cacheKey, result);
    return result;
  }

  /** Breadcrumb path, truncated at the highest ancestor the user can access (e.g. a folder shared with them). */
  async path(userId: string, folderId: string): Promise<FolderRef[]> {
    const chain = await PermissionRepository.folderAncestors(this.db, folderId);
    const access = await this.permissions.folderAccessMany(userId, chain.map((c) => c.id));
    const path: FolderRef[] = [];
    for (const node of chain) {
      if (!access.has(node.id)) break;
      path.unshift({ id: node.id, name: node.is_root && node.owner_id === userId ? 'My Drive' : node.name });
    }
    return path;
  }

  async update(userId: string, folderId: string, input: UpdateItemInput): Promise<FolderDetailDto> {
    await this.permissions.requireFolder(userId, folderId, 'EDITOR');
    const folder = await FolderRepository.findById(this.db, folderId);
    if (!folder) throw notFound('folder');
    if (folder.isRoot) throw badRequest('My Drive cannot be renamed.');
    await this.db.transaction(async (tx) => {
      await FolderRepository.update(tx, folderId, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      });
      if (input.name !== undefined && input.name !== folder.name) {
        await this.activity.record(
          { userId, action: 'FOLDER_RENAMED', resourceType: 'FOLDER', resourceId: folderId, resourceName: input.name, metadata: { from: folder.name, to: input.name } },
          tx,
        );
      }
    });
    return this.get(userId, folderId);
  }

  /** Moves a folder, refusing moves into itself or any of its descendants. */
  async move(userId: string, folderId: string, targetId: string): Promise<FolderDetailDto> {
    await this.db.transaction(async (tx) => {
      await this.permissions.requireFolder(userId, folderId, 'EDITOR', tx);
      const folder = await FolderRepository.findById(tx, folderId);
      if (!folder) throw notFound('folder');
      if (folder.isRoot) throw new AppError('INVALID_MOVE', 'My Drive cannot be moved.');
      if (folder.parentId === targetId) return;
      const target = await this.resolveTarget(userId, targetId, tx);
      const targetAncestors = await PermissionRepository.folderAncestors(tx, target.id);
      if (targetAncestors.some((a) => a.id === folderId)) {
        throw new AppError('INVALID_MOVE', 'A folder cannot be moved into itself or one of its subfolders.');
      }
      await FolderRepository.update(tx, folderId, { parentId: target.id });
      await this.activity.record(
        { userId, action: 'FOLDER_MOVED', resourceType: 'FOLDER', resourceId: folderId, resourceName: folder.name, metadata: { from: folder.parentId, to: target.id } },
        tx,
      );
      if (folder.ownerId !== userId) {
        const { deliver } = await this.notifications.create(
          [{ userId: folder.ownerId, actorId: userId, type: 'FILE_MOVED', title: `"${folder.name}" was moved to "${target.name}"`, link: `/drive/folder/${folderId}`, resourceType: 'FOLDER', resourceId: folderId }],
          tx,
        );
        queueMicrotask(() => void deliver());
      }
    });
    return this.get(userId, folderId);
  }

  /** Trashes the folder; descendants are hidden with it (trashed_by_parent) and restored together. */
  async trash(userId: string, folderId: string): Promise<void> {
    const access = await this.permissions.requireFolder(userId, folderId, 'VIEWER');
    if (!access.isOwner) throw forbidden('Only the owner can move this folder to the trash.');
    await this.db.transaction(async (tx) => {
      const folder = await FolderRepository.findById(tx, folderId);
      if (!folder) throw notFound('folder');
      if (folder.isRoot) throw badRequest('My Drive cannot be trashed.');
      if (folder.isTrashed) return;
      const now = new Date();
      const subtree = await PermissionRepository.folderSubtree(tx, folderId);
      const descendants = subtree.filter((id) => id !== folderId);
      await tx.update(driveFolders).set({ isTrashed: true, trashedAt: now, trashedByParent: false }).where(eq(driveFolders.id, folderId));
      if (descendants.length) {
        await tx
          .update(driveFolders)
          .set({ isTrashed: true, trashedAt: now, trashedByParent: true })
          .where(and(inArray(driveFolders.id, descendants), not(driveFolders.isTrashed)));
      }
      await tx
        .update(driveFiles)
        .set({ isTrashed: true, trashedAt: now, trashedByParent: true })
        .where(and(inArray(driveFiles.folderId, subtree), not(driveFiles.isTrashed)));
      await this.activity.record({ userId, action: 'FOLDER_DELETED', resourceType: 'FOLDER', resourceId: folderId, resourceName: folder.name }, tx);
    });
  }

  /**
   * Restores the folder to its original parent (or My Drive if that parent is gone or trashed), together with
   * everything that was hidden because of it. Items trashed individually beforehand stay in the trash.
   */
  async restore(userId: string, folderId: string): Promise<FolderDetailDto> {
    const access = await this.permissions.requireFolder(userId, folderId, 'VIEWER');
    if (!access.isOwner) throw forbidden();
    await this.db.transaction(async (tx) => {
      const folder = await FolderRepository.findById(tx, folderId);
      if (!folder) throw notFound('folder');
      if (!folder.isTrashed) return;
      if (folder.trashedByParent) throw badRequest('Restore the parent folder instead.');
      const rows = (await tx.execute(sql`
        with recursive sub as (
          select id from drive_folders where id = ${folderId}
          union all
          select f.id from drive_folders f join sub on f.parent_id = sub.id where f.trashed_by_parent
        )
        select id from sub`)) as unknown as { id: string }[];
      const ids = rows.map((r) => r.id);
      const parent = folder.parentId ? await FolderRepository.findById(tx, folder.parentId) : undefined;
      const parentId = parent && !parent.isTrashed ? parent.id : (await this.rootOf(folder.ownerId, tx)).id;
      await tx.update(driveFolders).set({ isTrashed: false, trashedAt: null, trashedByParent: false, parentId }).where(eq(driveFolders.id, folderId));
      const others = ids.filter((id) => id !== folderId);
      if (others.length) {
        await tx.update(driveFolders).set({ isTrashed: false, trashedAt: null, trashedByParent: false }).where(inArray(driveFolders.id, others));
      }
      await tx
        .update(driveFiles)
        .set({ isTrashed: false, trashedAt: null, trashedByParent: false })
        .where(and(inArray(driveFiles.folderId, ids), eq(driveFiles.trashedByParent, true)));
      await this.activity.record(
        { userId, action: 'FOLDER_RESTORED', resourceType: 'FOLDER', resourceId: folderId, resourceName: folder.name, metadata: { parentId } },
        tx,
      );
    });
    return this.get(userId, folderId);
  }

  /** Permanently deletes the folder subtree, then removes the stored bytes once the transaction has committed. */
  async deletePermanently(userId: string, folderId: string, opts: { system?: boolean } = {}): Promise<void> {
    if (!opts.system) {
      const access = await this.permissions.requireFolder(userId, folderId, 'VIEWER');
      if (!access.isOwner) throw forbidden('Only the owner can delete this folder.');
    }
    const keys = await this.db.transaction(async (tx) => {
      const folder = await FolderRepository.findById(tx, folderId);
      if (!folder) throw notFound('folder');
      if (folder.isRoot) throw badRequest('My Drive cannot be deleted.');
      const subtree = await PermissionRepository.folderSubtree(tx, folderId);
      const files = await tx.select({ id: driveFiles.id }).from(driveFiles).where(inArray(driveFiles.folderId, subtree));
      const fileIds = files.map((f) => f.id);
      const storageKeys = [
        ...(await DriveFileRepository.storageKeysForFiles(tx, fileIds)),
        ...(await this.natives.storageKeys(tx, fileIds)),
      ];
      // FK cascades remove subfolders, files, versions, permissions, links and the Docs/Sheets/Forms resources.
      await tx.delete(driveFolders).where(eq(driveFolders.id, folderId));
      await this.activity.record(
        { userId, action: 'FOLDER_PERMANENTLY_DELETED', resourceType: 'FOLDER', resourceId: folderId, resourceName: folder.name, metadata: { files: fileIds.length } },
        tx,
      );
      return storageKeys;
    });
    await this.storage.safeDelete(...keys);
  }
}
