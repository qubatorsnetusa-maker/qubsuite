import type { DriveSearchQuery, SearchResultDto } from '@qub/shared';
import { sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../db';
import { decodeOffsetCursor, escapeLike, pageOf } from '../../utils/pagination';
import type { PermissionService } from '../permissions/permission.service';
import { accessibleFoldersCte, notSpamFile } from '../spam/spam-sql';
import { UserRepository } from '../users/user.repository';

interface SearchRow {
  kind: 'file' | 'folder';
  id: string;
  name: string;
  file_type: string;
  mime_type: string | null;
  owner_id: string;
  location_id: string | null;
  location_name: string | null;
  resource_id: string | null;
  updated_at: Date;
  rank: number;
}

/**
 * Server-side Drive search. Candidate items are restricted in SQL to what the user can reach
 * (owned, shared directly, or inside an owned/shared folder tree) and never trashed.
 * Names are matched with trigram similarity / substring, Docs content with full-text search.
 */
export class SearchService {
  constructor(
    private readonly db: Database,
    private readonly permissions: PermissionService,
  ) {}

  async search(userId: string, q: DriveSearchQuery): Promise<{ items: SearchResultDto[]; nextCursor: string | null }> {
    const offset = decodeOffsetCursor(q.cursor);
    const term = q.q.trim().toLowerCase();
    const like = `%${escapeLike(term)}%`;

    const nameMatch = (col: SQL) =>
      term ? sql`(lower(${col}) like ${like} or similarity(lower(${col}), ${term}) > 0.3)` : sql`true`;
    const nameRank = (col: SQL) => (term ? sql`greatest(similarity(lower(${col}), ${term}), case when lower(${col}) like ${like} then 0.5 else 0 end)` : sql`0`);
    const contentMatch = term ? sql`d.search_vector @@ plainto_tsquery('simple', ${term})` : sql`false`;

    const ownerFilter = (col: SQL): SQL => {
      if (q.owner === 'me') return sql`${col} = ${userId}`;
      if (q.owner === 'not_me') return sql`${col} <> ${userId}`;
      return sql`true`;
    };
    const ownerEmail = q.ownerEmail?.trim().toLowerCase();
    const ownerEmailFilter = (col: SQL): SQL =>
      ownerEmail ? sql`${col} in (select id from users where email = ${ownerEmail})` : sql`true`;
    const dateFilters = (updated: SQL, created: SQL): SQL => {
      const parts: SQL[] = [sql`true`];
      if (q.modifiedAfter) parts.push(sql`${updated} >= ${q.modifiedAfter}`);
      if (q.modifiedBefore) parts.push(sql`${updated} <= ${q.modifiedBefore}`);
      if (q.createdAfter) parts.push(sql`${created} >= ${q.createdAfter}`);
      if (q.createdBefore) parts.push(sql`${created} <= ${q.createdBefore}`);
      return sql.join(parts, sql` and `);
    };
    // "Within folder" searches the whole subtree.
    const withinFolder = q.folderId
      ? sql`with recursive scope as (select id from drive_folders where id = ${q.folderId} union select f.id from drive_folders f join scope on f.parent_id = scope.id)`
      : sql``;
    if (q.folderId) await this.permissions.requireFolder(userId, q.folderId, 'VIEWER');

    const includeFolders = !q.type || q.type === 'FOLDER';
    const includeFiles = q.type !== 'FOLDER';
    const starredFiles = q.starred ? sql`and f.id in (select file_id from stars where user_id = ${userId} and file_id is not null)` : sql``;
    const starredFolders = q.starred ? sql`and fo.id in (select folder_id from stars where user_id = ${userId} and folder_id is not null)` : sql``;

    const parts: SQL[] = [];
    if (includeFolders && !q.mimeType) {
      parts.push(sql`
        select 'folder' as kind, fo.id, fo.name, 'FOLDER' as file_type, null::text as mime_type, fo.owner_id,
               fo.parent_id as location_id, p.name as location_name, null::uuid as resource_id, fo.updated_at,
               ${nameRank(sql`fo.name`)}::float as rank
        from drive_folders fo left join drive_folders p on p.id = fo.parent_id
        where fo.id in (select id from accessible) and not fo.is_root and not fo.is_trashed
          and ${nameMatch(sql`fo.name`)} and ${ownerFilter(sql`fo.owner_id`)} and ${ownerEmailFilter(sql`fo.owner_id`)}
          and ${dateFilters(sql`fo.updated_at`, sql`fo.created_at`)}
          ${q.folderId ? sql`and fo.parent_id in (select id from scope)` : sql``}
          ${starredFolders}`);
    }
    if (includeFiles) {
      parts.push(sql`
        select 'file' as kind, f.id, f.name, f.file_type::text, f.mime_type, f.owner_id,
               f.folder_id as location_id, p.name as location_name,
               coalesce(d.id, s.id, fm.id) as resource_id, f.updated_at,
               greatest(${nameRank(sql`f.name`)}, case when ${contentMatch} then 0.4 + ts_rank(d.search_vector, plainto_tsquery('simple', ${term})) else 0 end)::float as rank
        from drive_files f
        join drive_folders p on p.id = f.folder_id
        left join documents d on d.file_id = f.id
        left join spreadsheets s on s.file_id = f.id
        left join forms fm on fm.file_id = f.id
        where (f.owner_id = ${userId}
               or f.folder_id in (select id from accessible)
               or f.id in (select file_id from file_permissions where user_id = ${userId}))
          and not f.is_trashed and ${notSpamFile(userId, sql`f.id`)}
          and (${nameMatch(sql`f.name`)} or ${contentMatch})
          and ${ownerFilter(sql`f.owner_id`)} and ${ownerEmailFilter(sql`f.owner_id`)}
          and ${dateFilters(sql`f.updated_at`, sql`f.created_at`)}
          ${q.type && q.type !== 'FOLDER' ? sql`and f.file_type = ${q.type}` : sql``}
          ${q.mimeType ? sql`and f.mime_type = ${q.mimeType}` : sql``}
          ${q.folderId ? sql`and f.folder_id in (select id from scope)` : sql``}
          ${starredFiles}`);
    }
    if (!parts.length) return { items: [], nextCursor: null };

    // Folders and files in the user's Spam (and everything inside spam folders) don't appear in search.
    const accessible = accessibleFoldersCte(userId);
    const prefix = q.folderId ? sql`${withinFolder}, ${accessible}` : sql`with recursive ${accessible}`;
    const rows = (await this.db.execute(sql`
      ${prefix}
      select * from (${sql.join(parts, sql` union all `)}) results
      order by ${term ? sql`rank desc,` : sql``} updated_at desc, id
      limit ${q.limit + 1} offset ${offset}`)) as unknown as SearchRow[];

    const page = pageOf(rows, q.limit, offset);
    const owners = await UserRepository.summaries(this.db, page.items.map((r) => r.owner_id));
    return {
      items: page.items.map((r) => ({
        kind: r.kind,
        id: r.id,
        name: r.name,
        fileType: r.file_type as SearchResultDto['fileType'],
        mimeType: r.mime_type,
        owner: owners.get(r.owner_id)!,
        location: r.location_id ? { id: r.location_id, name: r.location_name ?? '' } : null,
        resourceId: r.resource_id,
        updatedAt: new Date(r.updated_at).toISOString(),
        rank: Number(r.rank),
      })),
      nextCursor: page.nextCursor,
    };
  }
}
