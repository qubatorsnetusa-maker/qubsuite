import type {
  DriveFileDto,
  DriveFolderDto,
  DriveItemDto,
  DriveListingFilters,
  DriveListQuery,
  DriveListResult,
  DriveStorageDto,
  DriveViewQuery,
  FileType,
  UserSummary,
} from '@qub/shared';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Database, Executor } from '../../db';
import { driveFiles, driveFolders, stars } from '../../db/schema';
import type { StorageService } from '../../services/storage';
import { AppError, notFound } from '../../utils/errors';
import { nextDuplicateName } from '../../utils/filename';
import { decodeOffsetCursor, pageOf } from '../../utils/pagination';
import type { ActivityService } from '../activity/activity.service';
import type { UsageService } from '../admin/usage.service';
import { notSpamFile, notSpamFolder } from '../spam/spam-sql';
import { UserRepository } from '../users/user.repository';
import { DriveFileRepository } from '../files/file.repository';
import type { FileService } from '../files/file.service';
import { FolderRepository } from '../folders/folder.repository';
import type { FolderService } from '../folders/folder.service';
import type { NotificationService } from '../notifications/notification.service';
import type { PermissionService } from '../permissions/permission.service';
import { toFileDtos, toFolderDtos } from './drive.mapper';

interface ListingRow {
  kind: 'file' | 'folder';
  id: string;
  sort_at?: Date;
}

const SORT_SQL: Record<string, SQL> = {
  name: sql`lower(name)`,
  updatedAt: sql`updated_at`,
  createdAt: sql`created_at`,
  size: sql`size`,
};

const STORAGE_LABELS: Partial<Record<FileType, string>> = {
  PDF: 'PDFs',
  IMAGE: 'Images',
  VIDEO: 'Videos',
  AUDIO: 'Audio',
  TEXT: 'Text files',
  ARCHIVE: 'Archives',
  OTHER: 'Other files',
};

/** Folder copies above this many items run in the background and notify the user when done. */
const BACKGROUND_COPY_THRESHOLD = 200;

export class DriveService {
  constructor(
    private readonly db: Database,
    private readonly permissions: PermissionService,
    private readonly files: FileService,
    private readonly folders: FolderService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationService,
    private readonly usage: UsageService,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** Hydrates ordered (kind, id) rows into DTOs, keeping order and dropping anything the user cannot access. */
  async hydrate(userId: string, rows: ListingRow[], extra: { lastOpened?: Map<string, Date> } = {}): Promise<DriveItemDto[]> {
    const fileIds = rows.filter((r) => r.kind === 'file').map((r) => r.id);
    const folderIds = rows.filter((r) => r.kind === 'folder').map((r) => r.id);
    const [fileRows, folderRows, fileAccess, folderAccess] = await Promise.all([
      DriveFileRepository.findByIds(this.db, fileIds),
      FolderRepository.findByIds(this.db, folderIds),
      this.permissions.fileAccessMany(userId, fileIds),
      this.permissions.folderAccessMany(userId, folderIds),
    ]);
    const [fileDtos, folderDtos] = await Promise.all([
      toFileDtos(this.db, userId, fileRows, fileAccess, extra),
      toFolderDtos(this.db, userId, folderRows, folderAccess),
    ]);
    const byKey = new Map<string, DriveItemDto>();
    for (const d of fileDtos) byKey.set(`file:${d.id}`, d);
    for (const d of folderDtos) byKey.set(`folder:${d.id}`, d);
    return rows.map((r) => byKey.get(`${r.kind}:${r.id}`)).filter((d): d is DriveItemDto => !!d);
  }

  private orderBy(sort: string | undefined, order: 'asc' | 'desc' | undefined): SQL {
    const expr = SORT_SQL[sort ?? 'name'] ?? SORT_SQL.name!;
    return sql`${expr} ${order === 'desc' ? sql`desc` : sql`asc`}`;
  }

  /** Type, People and Modified filters over a listing's `items` (columns kind, file_type, owner_id, updated_at). */
  private filters(userId: string, q: DriveListingFilters): SQL {
    const parts: SQL[] = [sql`true`];
    if (q.type === 'FOLDER') parts.push(sql`kind = 'folder'`);
    else if (q.type) parts.push(sql`kind = 'file' and file_type = ${q.type}`);
    if (q.owner === 'me') parts.push(sql`owner_id = ${userId}`);
    else if (q.owner === 'not_me') parts.push(sql`owner_id <> ${userId}`);
    if (q.ownerId) parts.push(sql`owner_id = ${q.ownerId}`);
    if (q.modifiedAfter) parts.push(sql`updated_at >= ${q.modifiedAfter.toISOString()}::timestamptz`);
    if (q.modifiedBefore) parts.push(sql`updated_at < ${q.modifiedBefore.toISOString()}::timestamptz`);
    return sql.join(parts, sql` and `);
  }

  /** Children of a folder (folders first), sorted and paginated in SQL. */
  async list(userId: string, query: DriveListQuery): Promise<DriveListResult> {
    const folderId = query.folderId ?? (await this.folders.rootOf(userId)).id;
    const folder = await this.folders.get(userId, folderId);
    if (folder.isTrashed) throw new AppError('RESOURCE_NOT_FOUND', 'This folder is in the trash.');
    const offset = decodeOffsetCursor(query.cursor);
    const rows = (await this.db.execute(sql`
      select kind, id from (
        select 'folder' as kind, id, name, owner_id, updated_at, created_at, 0::bigint as size, null::text as file_type
          from drive_folders where parent_id = ${folderId} and not is_trashed
        union all
        select 'file' as kind, id, name, owner_id, updated_at, created_at, size, file_type::text
          from drive_files where folder_id = ${folderId} and not is_trashed
      ) items
      where ${this.filters(userId, query)}
      order by (kind = 'folder') desc, ${this.orderBy(query.sort, query.order)}, id
      limit ${query.limit + 1} offset ${offset}`)) as unknown as ListingRow[];
    const page = pageOf(rows, query.limit, offset);
    return { folder, items: await this.hydrate(userId, page.items), nextCursor: page.nextCursor };
  }

  /** Items shared directly with the user by someone else. */
  async sharedWithMe(userId: string, query: DriveViewQuery) {
    const offset = decodeOffsetCursor(query.cursor);
    const order = query.sort ? this.orderBy(query.sort, query.order) : sql`shared_at desc`;
    const rows = (await this.db.execute(sql`
      select kind, id from (
        select 'file' as kind, f.id, f.name, f.owner_id, f.updated_at, f.created_at, f.size, f.file_type::text as file_type, p.created_at as shared_at
          from file_permissions p join drive_files f on f.id = p.file_id
          where p.user_id = ${userId} and f.owner_id <> ${userId} and not f.is_trashed and ${notSpamFile(userId, sql`f.id`)}
        union all
        select 'folder', d.id, d.name, d.owner_id, d.updated_at, d.created_at, 0::bigint, null::text, p.created_at
          from folder_permissions p join drive_folders d on d.id = p.folder_id
          where p.user_id = ${userId} and d.owner_id <> ${userId} and not d.is_trashed and ${notSpamFolder(userId, sql`d.id`)}
      ) items
      where ${this.filters(userId, query)}
      order by ${order}, id
      limit ${query.limit + 1} offset ${offset}`)) as unknown as ListingRow[];
    const page = pageOf(rows, query.limit, offset);
    return { items: await this.hydrate(userId, page.items), nextCursor: page.nextCursor };
  }

  /** Files the user recently opened, edited, created or uploaded, from the activity log. */
  async recent(userId: string, query: DriveViewQuery) {
    const offset = decodeOffsetCursor(query.cursor);
    const rows = (await this.db.execute(sql`
      select kind, id, sort_at from (
        select 'file' as kind, f.id, f.owner_id, f.updated_at, f.file_type::text as file_type, max(a.created_at) as sort_at
        from activity_logs a join drive_files f on f.id = a.resource_id
        where a.user_id = ${userId} and a.resource_type = 'FILE'
          and a.action in ('FILE_OPENED', 'FILE_EDITED', 'FILE_CREATED', 'FILE_VERSION_UPLOADED')
          and not f.is_trashed and ${notSpamFile(userId, sql`f.id`)}
        group by f.id
      ) items
      where ${this.filters(userId, query)}
      order by sort_at desc, id
      limit ${query.limit + 1} offset ${offset}`)) as unknown as ListingRow[];
    const page = pageOf(rows, query.limit, offset);
    const lastOpened = new Map(page.items.map((r) => [r.id, new Date(r.sort_at!)]));
    return { items: await this.hydrate(userId, page.items, { lastOpened }), nextCursor: page.nextCursor };
  }

  async starred(userId: string, query: DriveViewQuery) {
    const offset = decodeOffsetCursor(query.cursor);
    const rows = (await this.db.execute(sql`
      select kind, id from (
        select 'file' as kind, f.id, f.name, f.owner_id, f.updated_at, f.created_at, f.size, f.file_type::text as file_type, s.created_at as starred_at
          from stars s join drive_files f on f.id = s.file_id
          where s.user_id = ${userId} and not f.is_trashed and ${notSpamFile(userId, sql`f.id`)}
        union all
        select 'folder', d.id, d.name, d.owner_id, d.updated_at, d.created_at, 0::bigint, null::text, s.created_at
          from stars s join drive_folders d on d.id = s.folder_id
          where s.user_id = ${userId} and not d.is_trashed and ${notSpamFolder(userId, sql`d.id`)}
      ) items
      where ${this.filters(userId, query)}
      order by ${query.sort ? this.orderBy(query.sort, query.order) : sql`starred_at desc`}, id
      limit ${query.limit + 1} offset ${offset}`)) as unknown as ListingRow[];
    const page = pageOf(rows, query.limit, offset);
    return { items: await this.hydrate(userId, page.items), nextCursor: page.nextCursor };
  }

  /** Items the user explicitly trashed (contents of trashed folders are shown inside their folder). */
  async trash(userId: string, query: DriveViewQuery) {
    const offset = decodeOffsetCursor(query.cursor);
    const rows = (await this.db.execute(sql`
      select kind, id from (
        select 'file' as kind, id, name, owner_id, updated_at, created_at, size, file_type::text as file_type, trashed_at
          from drive_files where owner_id = ${userId} and is_trashed and not trashed_by_parent
        union all
        select 'folder', id, name, owner_id, updated_at, created_at, 0::bigint, null::text, trashed_at
          from drive_folders where owner_id = ${userId} and is_trashed and not trashed_by_parent
      ) items
      where ${this.filters(userId, query)}
      order by ${query.sort ? this.orderBy(query.sort, query.order) : sql`trashed_at desc`}, id
      limit ${query.limit + 1} offset ${offset}`)) as unknown as ListingRow[];
    const page = pageOf(rows, query.limit, offset);
    return { items: await this.hydrate(userId, page.items), nextCursor: page.nextCursor };
  }

  /** Lists a trashed folder's contents (owner only), so users can inspect before restoring. */
  async listTrashedFolder(userId: string, folderId: string, query: DriveViewQuery) {
    const access = await this.permissions.requireFolder(userId, folderId, 'VIEWER');
    if (!access.isOwner) throw notFound('folder');
    const offset = decodeOffsetCursor(query.cursor);
    const rows = (await this.db.execute(sql`
      select kind, id from (
        select 'folder' as kind, id, name from drive_folders where parent_id = ${folderId}
        union all
        select 'file', id, name from drive_files where folder_id = ${folderId}
      ) items order by (kind = 'folder') desc, lower(name), id
      limit ${query.limit + 1} offset ${offset}`)) as unknown as ListingRow[];
    const page = pageOf(rows, query.limit, offset);
    return { items: await this.hydrate(userId, page.items), nextCursor: page.nextCursor };
  }

  async emptyTrash(userId: string): Promise<{ deleted: number }> {
    const [files, folders] = await Promise.all([
      this.db.select({ id: driveFiles.id }).from(driveFiles).where(and(eq(driveFiles.ownerId, userId), eq(driveFiles.isTrashed, true), eq(driveFiles.trashedByParent, false))),
      this.db.select({ id: driveFolders.id }).from(driveFolders).where(and(eq(driveFolders.ownerId, userId), eq(driveFolders.isTrashed, true), eq(driveFolders.trashedByParent, false))),
    ]);
    for (const f of folders) await this.folders.deletePermanently(userId, f.id);
    for (const f of files) {
      // A file may already be gone if it lived in a folder deleted above.
      if (await DriveFileRepository.findById(this.db, f.id)) await this.files.deletePermanently(userId, f.id);
    }
    return { deleted: files.length + folders.length };
  }

  async setStar(userId: string, kind: 'file' | 'folder', id: string, starred: boolean): Promise<void> {
    if (kind === 'file') await this.permissions.requireFile(userId, id, 'VIEWER');
    else await this.permissions.requireFolder(userId, id, 'VIEWER');
    const column = kind === 'file' ? stars.fileId : stars.folderId;
    if (starred) {
      await this.db
        .insert(stars)
        .values(kind === 'file' ? { userId, fileId: id } : { userId, folderId: id })
        .onConflictDoNothing();
    } else {
      await this.db.delete(stars).where(and(eq(stars.userId, userId), eq(column, id)));
    }
  }

  /** Copies a folder tree. Small trees copy synchronously; large ones continue in the background. */
  async copyFolder(userId: string, folderId: string, input: { name?: string; folderId?: string }): Promise<{ status: 'completed'; folder: DriveFolderDto } | { status: 'queued' }> {
    await this.permissions.requireFolder(userId, folderId, 'COPY');
    const source = await FolderRepository.findById(this.db, folderId);
    if (!source || source.isTrashed) throw notFound('folder');
    const target = await this.folders.resolveTarget(userId, input.folderId ?? (source.parentId && (await this.canAddTo(userId, source.parentId)) ? source.parentId : undefined));
    const size = await this.subtreeSize(folderId);
    const run = () => this.copyTree(userId, source.id, target.id, input.name ?? `Copy of ${source.name}`);
    if (size <= BACKGROUND_COPY_THRESHOLD) {
      const newId = await run();
      return { status: 'completed', folder: await this.folders.get(userId, newId) };
    }
    setImmediate(() => {
      run()
        .then((newId) =>
          this.notifications.notify([
            { userId, actorId: null, type: 'COPY_COMPLETED', title: `Your copy of "${source.name}" is ready`, link: `/drive/folder/${newId}`, resourceType: 'FOLDER', resourceId: newId },
          ]),
        )
        .catch((err) => {
          this.log.error({ err, folderId }, 'Background folder copy failed');
          void this.notifications.notify([
            { userId, actorId: null, type: 'COPY_COMPLETED', title: `Copying "${source.name}" failed`, body: 'Nothing was created. Please try again.', resourceType: 'FOLDER', resourceId: folderId },
          ]);
        });
    });
    return { status: 'queued' };
  }

  private async canAddTo(userId: string, folderId: string): Promise<boolean> {
    const access = await this.permissions.folderAccess(userId, folderId);
    return !!access && (access.role === 'EDITOR' || access.role === 'OWNER');
  }

  private async subtreeSize(folderId: string): Promise<number> {
    const [row] = (await this.db.execute(sql`
      with recursive sub as (
        select id from drive_folders where id = ${folderId}
        union all select f.id from drive_folders f join sub on f.parent_id = sub.id where not f.is_trashed
      )
      select (select count(*) from sub) + (select count(*) from drive_files where folder_id in (select id from sub) and not is_trashed) as n`)) as unknown as { n: string }[];
    return Number(row?.n ?? 0);
  }

  /** Copies the whole tree in one transaction; storage objects created are removed if it rolls back. */
  private async copyTree(userId: string, sourceRootId: string, targetParentId: string, rootName: string): Promise<string> {
    const createdKeys: string[] = [];
    try {
      return await this.db.transaction(async (tx) => {
        const folders = (await tx.execute(sql`
          with recursive sub as (
            select id, parent_id, name, description, 0 as depth from drive_folders where id = ${sourceRootId}
            union all
            select f.id, f.parent_id, f.name, f.description, sub.depth + 1
            from drive_folders f join sub on f.parent_id = sub.id where not f.is_trashed
          )
          select * from sub order by depth`)) as unknown as { id: string; parent_id: string; name: string; description: string | null }[];
        const idMap = new Map<string, string>();
        for (const f of folders) {
          const isRoot = f.id === sourceRootId;
          const parentId = isRoot ? targetParentId : idMap.get(f.parent_id)!;
          const name = isRoot ? nextDuplicateName(rootName, await FolderRepository.childNames(tx, targetParentId)) : f.name;
          const created = await FolderRepository.insert(tx, { ownerId: userId, parentId, name, description: f.description });
          idMap.set(f.id, created.id);
        }
        const files = await tx
          .select()
          .from(driveFiles)
          .where(and(inArray(driveFiles.folderId, [...idMap.keys()]), eq(driveFiles.isTrashed, false)));
        for (const file of files) {
          const result = await this.files.copyWithin(tx as Executor, userId, file, idMap.get(file.folderId)!, file.name);
          createdKeys.push(...result.createdKeys);
        }
        const newRootId = idMap.get(sourceRootId)!;
        await this.activity.record(
          { userId, action: 'FOLDER_COPIED', resourceType: 'FOLDER', resourceId: newRootId, resourceName: rootName, metadata: { sourceId: sourceRootId, folders: folders.length, files: files.length } },
          tx,
        );
        return newRootId;
      });
    } catch (err) {
      await this.storage.safeDelete(...createdKeys);
      throw err;
    }
  }

  /** People the user shares with in either direction, for the "People" filter. Never lists the whole directory. */
  async people(userId: string): Promise<UserSummary[]> {
    const rows = (await this.db.execute(sql`
      select u.id from users u
      where u.status = 'ACTIVE' and u.id <> ${userId} and u.id in (
        select f.owner_id from file_permissions p join drive_files f on f.id = p.file_id where p.user_id = ${userId}
        union select d.owner_id from folder_permissions p join drive_folders d on d.id = p.folder_id where p.user_id = ${userId}
        union select p.user_id from file_permissions p join drive_files f on f.id = p.file_id where f.owner_id = ${userId}
        union select p.user_id from folder_permissions p join drive_folders d on d.id = p.folder_id where d.owner_id = ${userId}
      )
      order by lower(u.name) limit 50`)) as unknown as { id: string }[];
    const people = await UserRepository.summaries(this.db, rows.map((r) => r.id));
    return rows.map((r) => people.get(r.id)!).filter(Boolean);
  }

  /** The user's own storage: usage by category, quota, and what can be cleaned up. */
  async storageSummary(userId: string): Promise<DriveStorageDto> {
    const [quota, usage, [byType, other, largest]] = await Promise.all([
      this.usage.quotaOf(userId),
      this.usage.usageFor([userId]),
      Promise.all([
        this.db.execute(sql`
          select f.file_type::text as type, sum(v.size) as bytes
          from file_versions v join drive_files f on f.id = v.file_id
          where f.owner_id = ${userId} and v.version_number = f.current_version and not f.is_trashed
          group by 1`) as unknown as Promise<{ type: FileType; bytes: string }[]>,
        this.db.execute(sql`
          select
            (select coalesce(sum(v.size), 0) from file_versions v join drive_files f on f.id = v.file_id
              where f.owner_id = ${userId} and v.version_number <> f.current_version and not f.is_trashed) as older_bytes,
            (select count(distinct f.id) from file_versions v join drive_files f on f.id = v.file_id
              where f.owner_id = ${userId} and v.version_number <> f.current_version and not f.is_trashed) as older_files,
            (select coalesce(sum(v.size), 0) from file_versions v join drive_files f on f.id = v.file_id
              where f.owner_id = ${userId} and f.is_trashed) as trash_bytes,
            (select count(*) from drive_files where owner_id = ${userId} and is_trashed and not trashed_by_parent)
              + (select count(*) from drive_folders where owner_id = ${userId} and is_trashed and not trashed_by_parent) as trash_items,
            (select coalesce(sum(a.size), 0) from document_assets a join documents d on d.id = a.document_id
              join drive_files f on f.id = d.file_id where f.owner_id = ${userId}) as doc_images,
            (select coalesce(sum(u.size), 0) from form_uploads u join forms fm on fm.id = u.form_id
              join drive_files f on f.id = fm.file_id where f.owner_id = ${userId}) as form_uploads`) as unknown as Promise<Record<string, string>[]>,
        this.db.execute(sql`
          select f.id, sum(v.size) as bytes, count(v.id) as versions
          from drive_files f join file_versions v on v.file_id = f.id
          where f.owner_id = ${userId} and not f.is_trashed
          group by f.id order by sum(v.size) desc, f.id limit 20`) as unknown as Promise<{ id: string; bytes: string; versions: string }[]>,
      ]),
    ]);
    const o = other[0] ?? {};
    const n = (k: string) => Number(o[k] ?? 0);
    const breakdown = [
      ...byType.map((r) => ({ key: `type:${r.type}`, label: STORAGE_LABELS[r.type] ?? r.type, bytes: Number(r.bytes) })),
      { key: 'older_versions', label: 'Older file versions', bytes: n('older_bytes') },
      { key: 'doc_images', label: 'Images in Docs', bytes: n('doc_images') },
      { key: 'form_uploads', label: 'Files uploaded to your Forms', bytes: n('form_uploads') },
      { key: 'trash', label: 'Trash', bytes: n('trash_bytes') },
    ]
      .filter((b) => b.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes);
    const files = await this.hydrate(userId, largest.map((r) => ({ kind: 'file' as const, id: r.id })));
    const stats = new Map(largest.map((r) => [r.id, r]));
    return {
      usedBytes: usage.get(userId) ?? 0,
      quotaBytes: quota.bytes,
      quotaSource: quota.source,
      breakdown,
      trash: { bytes: n('trash_bytes'), items: n('trash_items') },
      olderVersions: { bytes: n('older_bytes'), files: n('older_files') },
      largestFiles: files.flatMap((f) => (f.kind === 'file' ? [{ ...f, storedBytes: Number(stats.get(f.id)!.bytes), versions: Number(stats.get(f.id)!.versions) }] : [])),
    };
  }

  async fileDto(userId: string, fileId: string): Promise<DriveFileDto> {
    return this.files.get(userId, fileId);
  }
}
