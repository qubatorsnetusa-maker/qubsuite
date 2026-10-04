import type { Role } from '@qub/shared';
import { sql } from 'drizzle-orm';
import type { Executor } from '../../db';

export type GrantRow = {
  item_id: string;
  folder_id: string;
  depth: number;
  folder_owner: string;
  role: Role | null;
  can_share: boolean | null;
  can_download: boolean | null;
  can_copy: boolean | null;
}

export type ItemRow = {
  id: string;
  owner_id: string;
  is_trashed: boolean;
}

export type DirectGrantRow = {
  item_id: string;
  role: Role;
  can_share: boolean;
  can_download: boolean;
  can_copy: boolean;
}

/**
 * Raw access facts. Folder grants are inherited by everything beneath the folder,
 * so these queries walk the ancestor chain with recursive CTEs.
 */
export const PermissionRepository = {
  async files(db: Executor, ids: string[]): Promise<ItemRow[]> {
    if (!ids.length) return [];
    return db.execute<ItemRow>(sql`select id, owner_id, is_trashed from drive_files where id in ${ids}`) as unknown as ItemRow[];
  },

  async folders(db: Executor, ids: string[]): Promise<ItemRow[]> {
    if (!ids.length) return [];
    return db.execute<ItemRow>(sql`select id, owner_id, is_trashed from drive_folders where id in ${ids}`) as unknown as ItemRow[];
  },

  async directFileGrants(db: Executor, userId: string, ids: string[]): Promise<DirectGrantRow[]> {
    if (!ids.length) return [];
    return db.execute<DirectGrantRow>(sql`
      select file_id as item_id, role, can_share, can_download, can_copy
      from file_permissions where user_id = ${userId} and file_id in ${ids}`) as unknown as DirectGrantRow[];
  },

  /**
   * For each file: every ancestor folder (depth 0 = the containing folder) that the user owns or has a grant on.
   */
  async fileAncestorGrants(db: Executor, userId: string, ids: string[]): Promise<GrantRow[]> {
    if (!ids.length) return [];
    return db.execute<GrantRow>(sql`
      with recursive chain as (
        select f.id as item_id, f.folder_id as folder_id, 0 as depth from drive_files f where f.id in ${ids}
        union all
        select c.item_id, p.parent_id, c.depth + 1
        from chain c join drive_folders p on p.id = c.folder_id
        where p.parent_id is not null
      )
      select c.item_id, c.folder_id, c.depth, fo.owner_id as folder_owner,
             fp.role, fp.can_share, fp.can_download, fp.can_copy
      from chain c
      join drive_folders fo on fo.id = c.folder_id
      left join folder_permissions fp on fp.folder_id = c.folder_id and fp.user_id = ${userId}
      where fo.owner_id = ${userId} or fp.id is not null`) as unknown as GrantRow[];
  },

  /** For each folder: itself (depth 0) and every ancestor the user owns or has a grant on. */
  async folderChainGrants(db: Executor, userId: string, ids: string[]): Promise<GrantRow[]> {
    if (!ids.length) return [];
    return db.execute<GrantRow>(sql`
      with recursive chain as (
        select f.id as item_id, f.id as folder_id, 0 as depth from drive_folders f where f.id in ${ids}
        union all
        select c.item_id, p.parent_id, c.depth + 1
        from chain c join drive_folders p on p.id = c.folder_id
        where p.parent_id is not null
      )
      select c.item_id, c.folder_id, c.depth, fo.owner_id as folder_owner,
             fp.role, fp.can_share, fp.can_download, fp.can_copy
      from chain c
      join drive_folders fo on fo.id = c.folder_id
      left join folder_permissions fp on fp.folder_id = c.folder_id and fp.user_id = ${userId}
      where fo.owner_id = ${userId} or fp.id is not null`) as unknown as GrantRow[];
  },

  /** Ancestor ids of a folder, nearest first, including the folder itself. */
  async folderAncestors(db: Executor, folderId: string): Promise<{ id: string; name: string; parent_id: string | null; owner_id: string; is_root: boolean; depth: number }[]> {
    return db.execute(sql`
      with recursive chain as (
        select id, name, parent_id, owner_id, is_root, 0 as depth from drive_folders where id = ${folderId}
        union all
        select p.id, p.name, p.parent_id, p.owner_id, p.is_root, c.depth + 1
        from drive_folders p join chain c on p.id = c.parent_id
      )
      select * from chain order by depth`) as never;
  },

  /** Ids of a folder and all its descendants. */
  async folderSubtree(db: Executor, folderId: string): Promise<string[]> {
    const rows = (await db.execute(sql`
      with recursive sub as (
        select id from drive_folders where id = ${folderId}
        union all
        select f.id from drive_folders f join sub on f.parent_id = sub.id
      )
      select id from sub`)) as unknown as { id: string }[];
    return rows.map((r) => r.id);
  },
};
