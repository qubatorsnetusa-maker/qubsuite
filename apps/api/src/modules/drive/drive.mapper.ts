import { folderNameCache } from '../../utils/fast-cache';
import type { DriveFileDto, DriveFolderDto } from '@qub/shared';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Executor } from '../../db';
import { driveFolders, filePermissions, folderPermissions, spamItems, stars } from '../../db/schema';
import { DriveFileRepository, type DriveFileRow } from '../files/file.repository';
import type { FolderRow } from '../folders/folder.repository';
import { toCapabilities, type Access } from '../permissions/permission.service';
import { supportsThumbnail } from '../../services/thumbnails';
import { UserRepository } from '../users/user.repository';

async function starredSet(db: Executor, userId: string, kind: 'file' | 'folder', ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const column = kind === 'file' ? stars.fileId : stars.folderId;
  const rows = await db
    .select({ id: column })
    .from(stars)
    .where(and(eq(stars.userId, userId), isNotNull(column), inArray(column, ids)));
  return new Set(rows.map((r) => r.id!));
}

async function spamSet(db: Executor, userId: string, kind: 'file' | 'folder', ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const column = kind === 'file' ? spamItems.fileId : spamItems.folderId;
  const rows = await db
    .select({ id: column })
    .from(spamItems)
    .where(and(eq(spamItems.userId, userId), isNotNull(column), inArray(column, ids)));
  return new Set(rows.map((r) => r.id!));
}

/** Items the user holds a direct grant on (shared with them, not inherited from a folder). */
async function directGrants(db: Executor, userId: string, kind: 'file' | 'folder', ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows =
    kind === 'file'
      ? await db.select({ id: filePermissions.fileId }).from(filePermissions).where(and(eq(filePermissions.userId, userId), inArray(filePermissions.fileId, ids)))
      : await db.select({ id: folderPermissions.folderId }).from(folderPermissions).where(and(eq(folderPermissions.userId, userId), inArray(folderPermissions.folderId, ids)));
  return new Set(rows.map((r) => r.id));
}

async function folderNames(db: Executor, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const id of unique) {
    const cached = folderNameCache.get(id);
    if (cached !== undefined) out.set(id, cached);
    else missing.push(id);
  }
  if (missing.length > 0) {
    const rows = await db.select({ id: driveFolders.id, name: driveFolders.name }).from(driveFolders).where(inArray(driveFolders.id, missing));
    for (const r of rows) {
      folderNameCache.set(r.id, r.name);
      out.set(r.id, r.name);
    }
  }
  return out;
}

/** Builds file DTOs in batch (owners, stars, resource ids and parent names are fetched with one query each). */
export async function toFileDtos(
  db: Executor,
  userId: string,
  rows: DriveFileRow[],
  access: Map<string, Access>,
  extra: { lastOpened?: Map<string, Date> } = {},
): Promise<DriveFileDto[]> {
  const visible = rows.filter((r) => access.has(r.id));
  const ids = visible.map((r) => r.id);
  const [owners, starred, resources, parents, spam, direct] = await Promise.all([
    UserRepository.summaries(db, visible.map((r) => r.ownerId)),
    starredSet(db, userId, 'file', ids),
    DriveFileRepository.resourceIds(db, ids),
    folderNames(db, visible.map((r) => r.folderId)),
    spamSet(db, userId, 'file', ids),
    directGrants(db, userId, 'file', ids),
  ]);
  return visible.map((r) => ({
    kind: 'file',
    id: r.id,
    name: r.name,
    fileType: r.fileType,
    mimeType: r.mimeType,
    size: r.size,
    description: r.description,
    owner: owners.get(r.ownerId)!,
    folderId: r.folderId,
    folderName: parents.get(r.folderId) ?? null,
    isStarred: starred.has(r.id),
    isTrashed: r.isTrashed,
    trashedAt: r.trashedAt?.toISOString() ?? null,
    isSpam: spam.has(r.id),
    sharedWithMe: r.ownerId !== userId && direct.has(r.id),
    // Versioned by checksum, so browsers can cache it until the content changes.
    thumbnailUrl: !r.isTrashed && supportsThumbnail(r) ? `/drive/files/${r.id}/thumbnail?v=${r.checksum?.slice(0, 16) || r.currentVersion}` : null,
    resourceId: resources.get(r.id) ?? null,
    currentVersion: r.currentVersion,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastOpenedAt: extra.lastOpened?.get(r.id)?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    capabilities: toCapabilities(access.get(r.id)!),
  }));
}

export async function toFolderDtos(db: Executor, userId: string, rows: FolderRow[], access: Map<string, Access>): Promise<DriveFolderDto[]> {
  const visible = rows.filter((r) => access.has(r.id));
  const ids = visible.map((r) => r.id);
  const [owners, starred, parents, spam, direct] = await Promise.all([
    UserRepository.summaries(db, visible.map((r) => r.ownerId)),
    starredSet(db, userId, 'folder', ids),
    folderNames(db, visible.map((r) => r.parentId!).filter(Boolean)),
    spamSet(db, userId, 'folder', ids),
    directGrants(db, userId, 'folder', ids),
  ]);
  return visible.map((r) => ({
    kind: 'folder',
    id: r.id,
    name: r.name,
    description: r.description,
    owner: owners.get(r.ownerId)!,
    parentId: r.parentId,
    parentName: r.parentId ? (parents.get(r.parentId) ?? null) : null,
    isRoot: r.isRoot,
    isStarred: starred.has(r.id),
    isTrashed: r.isTrashed,
    trashedAt: r.trashedAt?.toISOString() ?? null,
    isSpam: spam.has(r.id),
    sharedWithMe: r.ownerId !== userId && direct.has(r.id),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    capabilities: toCapabilities(access.get(r.id)!),
  }));
}
