import { accessCache } from '../../utils/fast-cache';
import { maxRole, roleAtLeast, type Capabilities, type Role } from '@qub/shared';
import type { Database, Executor } from '../../db';
import { forbidden, notFound } from '../../utils/errors';
import { PermissionRepository, type DirectGrantRow, type GrantRow, type ItemRow } from './permission.repository';

export interface Access {
  role: Role;
  isOwner: boolean;
  canShare: boolean;
  canDownload: boolean;
  canCopy: boolean;
}

export type Requirement = Role | 'SHARE' | 'DOWNLOAD' | 'COPY';

export function toCapabilities(access: Access): Capabilities {
  return {
    role: access.role,
    canEdit: roleAtLeast(access.role, 'EDITOR'),
    canComment: roleAtLeast(access.role, 'COMMENTER'),
    canShare: access.canShare,
    canDownload: access.canDownload,
    canCopy: access.canCopy,
    canTrash: access.isOwner,
  };
}

function satisfies(access: Access, requirement: Requirement): boolean {
  switch (requirement) {
    case 'SHARE':
      return access.canShare;
    case 'DOWNLOAD':
      return access.canDownload;
    case 'COPY':
      return access.canCopy;
    default:
      return roleAtLeast(access.role, requirement);
  }
}

/** Merges grants: highest role wins, capability flags are OR-ed. Editors can always download and copy. */
function combine(owner: boolean, grants: { role: Role | null; can_share: boolean | null; can_download: boolean | null; can_copy: boolean | null }[]): Access | null {
  if (owner) return { role: 'OWNER', isOwner: true, canShare: true, canDownload: true, canCopy: true };
  let role: Role | null = null;
  let canShare = false;
  let canDownload = false;
  let canCopy = false;
  for (const g of grants) {
    role = maxRole(role, g.role);
    canShare ||= !!g.can_share;
    canDownload ||= !!g.can_download;
    canCopy ||= !!g.can_copy;
  }
  if (!role) return null;
  if (roleAtLeast(role, 'EDITOR')) {
    canDownload = true;
    canCopy = true;
  }
  return { role, isOwner: false, canShare, canDownload, canCopy };
}

/** Owning an ancestor folder gives editor rights over everything inside it (like Google Drive). */
function ancestorGrants(rows: GrantRow[], userId: string, skipSelf: boolean) {
  return rows
    .filter((r) => !(skipSelf && r.depth === 0))
    .map((r) =>
      r.folder_owner === userId
        ? { role: maxRole('EDITOR', r.role), can_share: true, can_download: true, can_copy: true }
        : { role: r.role, can_share: r.can_share, can_download: r.can_download, can_copy: r.can_copy },
    );
}

/**
 * Every resource access in the platform goes through this service: Drive items directly, and
 * Docs/Sheets/Forms through their backing Drive file. Nothing supplied by the client is trusted.
 */
/** Organization rule applied on top of grants: viewers/commenters lose download and copy when it's off. */
export interface ContentPolicySource {
  get(): Promise<{ content: { viewersCanDownload: boolean } }>;
}

export class PermissionService {
  constructor(
    private readonly db: Database,
    private readonly policies: ContentPolicySource,
  ) {}

  private async applyContentPolicy(out: Map<string, Access>): Promise<Map<string, Access>> {
    if (!out.size || (await this.policies.get()).content.viewersCanDownload) return out;
    for (const [id, a] of out) {
      if (!a.isOwner && !roleAtLeast(a.role, 'EDITOR')) out.set(id, { ...a, canDownload: false, canCopy: false });
    }
    return out;
  }

  async fileAccessMany(userId: string, fileIds: string[], tx: Executor = this.db): Promise<Map<string, Access>> {
    const allIds = [...new Set(fileIds)];
    const out = new Map<string, Access>();
    if (!allIds.length) return out;
    const ids: string[] = [];
    for (const id of allIds) {
      const cached = accessCache.get(`file:${userId}:${id}`);
      if (cached !== undefined) out.set(id, cached);
      else ids.push(id);
    }
    if (!ids.length) return out;
    const [files, direct, ancestors] = await Promise.all([
      PermissionRepository.files(tx, ids),
      PermissionRepository.directFileGrants(tx, userId, ids),
      PermissionRepository.fileAncestorGrants(tx, userId, ids),
    ]);
    const directBy = groupBy(direct, (d) => d.item_id);
    const ancBy = groupBy(ancestors, (a) => a.item_id);
    for (const f of files as ItemRow[]) {
      const isOwner = f.owner_id === userId;
      // Trashed items are visible to their owner only.
      if (f.is_trashed && !isOwner) continue;
      const access = combine(isOwner, [...(directBy.get(f.id) ?? []), ...ancestorGrants(ancBy.get(f.id) ?? [], userId, false)] as DirectGrantRow[]);
      if (access) {
        accessCache.set(`file:${userId}:${f.id}`, access);
        out.set(f.id, access);
      }
    }
    return this.applyContentPolicy(out);
  }

  async folderAccessMany(userId: string, folderIds: string[], tx: Executor = this.db): Promise<Map<string, Access>> {
    const allIds = [...new Set(folderIds)];
    const out = new Map<string, Access>();
    if (!allIds.length) return out;
    const ids: string[] = [];
    for (const id of allIds) {
      const cached = accessCache.get(`folder:${userId}:${id}`);
      if (cached !== undefined) out.set(id, cached);
      else ids.push(id);
    }
    if (!ids.length) return out;
    const [folders, chain] = await Promise.all([
      PermissionRepository.folders(tx, ids),
      PermissionRepository.folderChainGrants(tx, userId, ids),
    ]);
    const chainBy = groupBy(chain, (c) => c.item_id);
    for (const f of folders as ItemRow[]) {
      const isOwner = f.owner_id === userId;
      if (f.is_trashed && !isOwner) continue;
      const rows = chainBy.get(f.id) ?? [];
      const self = rows.filter((r) => r.depth === 0 && r.role).map((r) => ({ role: r.role, can_share: r.can_share, can_download: r.can_download, can_copy: r.can_copy }));
      const access = combine(isOwner, [...self, ...ancestorGrants(rows, userId, true)]);
      if (access) {
        accessCache.set(`file:${userId}:${f.id}`, access);
        out.set(f.id, access);
      }
    }
    return this.applyContentPolicy(out);
  }

  async fileAccess(userId: string, fileId: string, tx?: Executor): Promise<Access | null> {
    return (await this.fileAccessMany(userId, [fileId], tx)).get(fileId) ?? null;
  }

  async folderAccess(userId: string, folderId: string, tx?: Executor): Promise<Access | null> {
    return (await this.folderAccessMany(userId, [folderId], tx)).get(folderId) ?? null;
  }

  /**
   * Throws 404 when the user has no access at all (existence is not revealed) and 403 when access is insufficient.
   */
  async requireFile(userId: string, fileId: string, requirement: Requirement, tx?: Executor): Promise<Access> {
    const access = await this.fileAccess(userId, fileId, tx);
    if (!access) throw notFound('file');
    if (!satisfies(access, requirement)) throw forbidden();
    return access;
  }

  async requireFolder(userId: string, folderId: string, requirement: Requirement, tx?: Executor): Promise<Access> {
    const access = await this.folderAccess(userId, folderId, tx);
    if (!access) throw notFound('folder');
    if (!satisfies(access, requirement)) throw forbidden();
    return access;
  }

  async require(userId: string, resource: { type: 'FILE' | 'FOLDER'; id: string }, requirement: Requirement, tx?: Executor): Promise<Access> {
    return resource.type === 'FILE'
      ? this.requireFile(userId, resource.id, requirement, tx)
      : this.requireFolder(userId, resource.id, requirement, tx);
  }
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
