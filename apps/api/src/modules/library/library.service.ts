import {
  NATIVE_FILE_TYPES,
  type CellStyle,
  type DriveFileDto,
  type FormFieldType,
  type LibraryItemDto,
  type LibraryPreview,
  type LibraryResult,
  type NativeFileType,
  type ParsedLibraryQuery,
  type SuggestedItemDto,
} from '@qub/shared';
import { sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../db';
import { decodeOffsetCursor, escapeLike, pageOf } from '../../utils/pagination';
import type { DriveService } from '../drive/drive.service';
import { accessibleFoldersCte, notSpamFile } from '../spam/spam-sql';
import { UserRepository } from '../users/user.repository';

/** Thumbnail sizes: enough content to fill a card, small enough to list dozens of files at once. */
const DOC_PREVIEW_BLOCKS = 12;
const SHEET_PREVIEW_ROWS = 14;
const SHEET_PREVIEW_COLS = 6;
const FORM_PREVIEW_FIELDS = 4;

interface Row {
  id: string;
  last_opened: Date | null;
}

/**
 * App home pages (Docs, Sheets, Forms): every file of one type the user can reach — owned, shared directly, or
 * inside an owned/shared folder tree — ordered by when *they* last opened it, with a preview of the real content.
 */
export class LibraryService {
  constructor(
    private readonly db: Database,
    private readonly drive: DriveService,
  ) {}

  async list(userId: string, q: ParsedLibraryQuery): Promise<LibraryResult> {
    const offset = decodeOffsetCursor(q.cursor);
    const term = q.q.toLowerCase();
    const owner: SQL = q.owner === 'me' ? sql`f.owner_id = ${userId}` : q.owner === 'not_me' ? sql`f.owner_id <> ${userId}` : sql`true`;
    // Documents also match on their text, like Drive search.
    const match: SQL = !term
      ? sql`true`
      : q.type === 'DOCUMENT'
        ? sql`(lower(f.name) like ${`%${escapeLike(term)}%`} or f.id in (select file_id from documents where search_vector @@ plainto_tsquery('simple', ${term})))`
        : sql`lower(f.name) like ${`%${escapeLike(term)}%`}`;
    const order: SQL =
      q.sort === 'name' ? sql`lower(f.name) asc` : q.sort === 'updatedAt' ? sql`f.updated_at desc` : sql`o.at desc nulls last, f.updated_at desc`;

    const rows = (await this.db.execute(sql`
      with recursive ${accessibleFoldersCte(userId)},
      opened as (
        select resource_id as file_id, max(created_at) as at
        from activity_logs
        where user_id = ${userId} and resource_type = 'FILE' and action in ('FILE_OPENED', 'FILE_EDITED', 'FILE_CREATED')
        group by resource_id
      )
      select f.id, o.at as last_opened
      from drive_files f
      left join opened o on o.file_id = f.id
      where f.file_type = ${q.type} and not f.is_trashed
        and (f.owner_id = ${userId}
             or f.folder_id in (select id from accessible)
             or f.id in (select file_id from file_permissions where user_id = ${userId}))
        and ${notSpamFile(userId, sql`f.id`)}
        and ${owner} and ${match}
      order by ${order}, f.id
      limit ${q.limit + 1} offset ${offset}`)) as unknown as Row[];

    const page = pageOf(rows, q.limit, offset);
    const lastOpened = new Map(page.items.filter((r) => r.last_opened).map((r) => [r.id, new Date(r.last_opened!)]));
    const files = await this.drive.hydrate(userId, page.items.map((r) => ({ kind: 'file' as const, id: r.id })), { lastOpened });
    const ids = files.map((f) => f.id);
    const previews = await this.previews(q.type, ids);
    const items: LibraryItemDto[] = files.flatMap((f) => (f.kind === 'file' ? [{ ...f, preview: previews.get(f.id) ?? null }] : []));
    return { items, nextCursor: page.nextCursor };
  }

  /**
   * Files for My Drive's "Suggested" row, ranked by the latest thing that happened to each one in the last 30
   * days: the user opening, editing or creating it, someone else editing or commenting on something the user can
   * reach, or it being shared with the user. Access is enforced again when the rows are hydrated.
   */
  async suggested(userId: string, limit = 8): Promise<SuggestedItemDto[]> {
    const rows = (await this.db.execute(sql`
      with recursive ${accessibleFoldersCte(userId)},
      events as (
        select a.resource_id as file_id, a.action::text as action, a.user_id, a.created_at
        from activity_logs a
        where a.resource_type = 'FILE' and a.created_at > now() - interval '30 days'
          and ((a.user_id = ${userId} and a.action in ('FILE_OPENED', 'FILE_EDITED', 'FILE_CREATED', 'FILE_VERSION_UPLOADED'))
               or (a.user_id <> ${userId} and a.action in ('FILE_EDITED', 'COMMENT_ADDED', 'FILE_VERSION_UPLOADED')))
        union all
        select p.file_id, 'SHARED_WITH_ME', p.granted_by, p.created_at
        from file_permissions p
        where p.user_id = ${userId} and p.created_at > now() - interval '30 days'
      ),
      latest as (
        select distinct on (file_id) file_id, action, user_id, created_at from events order by file_id, created_at desc
      )
      select l.file_id, l.action, l.user_id, l.created_at
      from latest l join drive_files f on f.id = l.file_id
      where not f.is_trashed and ${notSpamFile(userId, sql`f.id`)}
        and (f.owner_id = ${userId} or f.folder_id in (select id from accessible)
             or f.id in (select file_id from file_permissions where user_id = ${userId}))
      order by l.created_at desc
      limit ${limit}`)) as unknown as { file_id: string; action: string; user_id: string | null; created_at: Date }[];

    const [files, actors] = await Promise.all([
      this.drive.hydrate(userId, rows.map((r) => ({ kind: 'file' as const, id: r.file_id }))),
      UserRepository.summaries(this.db, rows.map((r) => r.user_id).filter((id): id is string => !!id && id !== userId)),
    ]);
    const fileRows = files.filter((f): f is DriveFileDto => f.kind === 'file');
    const previews = new Map<string, LibraryPreview>();
    for (const type of NATIVE_FILE_TYPES) {
      const ids = fileRows.filter((f) => f.fileType === type).map((f) => f.id);
      for (const [id, p] of await this.previews(type, ids)) previews.set(id, p);
    }
    const kind: Record<string, SuggestedItemDto['reason']['kind']> = {
      FILE_OPENED: 'opened',
      FILE_EDITED: 'edited',
      FILE_VERSION_UPLOADED: 'edited',
      FILE_CREATED: 'created',
      COMMENT_ADDED: 'commented',
      SHARED_WITH_ME: 'shared',
    };
    const byId = new Map(rows.map((r) => [r.file_id, r]));
    return fileRows.map((f) => {
      const r = byId.get(f.id)!;
      return {
        ...f,
        reason: { kind: kind[r.action] ?? 'opened', actor: r.user_id && r.user_id !== userId ? (actors.get(r.user_id) ?? null) : null, at: new Date(r.created_at).toISOString() },
        preview: previews.get(f.id) ?? null,
      };
    });
  }

  private async previews(type: NativeFileType, fileIds: string[]): Promise<Map<string, LibraryPreview>> {
    const out = new Map<string, LibraryPreview>();
    if (!fileIds.length) return out;
    const ids = sql`array[${sql.join(fileIds.map((id) => sql`${id}::uuid`), sql`, `)}]`;

    if (type === 'DOCUMENT') {
      const rows = (await this.db.execute(sql`
        select d.file_id,
               (select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
                  from jsonb_array_elements(case when jsonb_typeof(d.content->'content') = 'array' then d.content->'content' else '[]'::jsonb end)
                       with ordinality as x(e, i)
                 where i <= ${DOC_PREVIEW_BLOCKS}) as blocks
        from documents d where d.file_id = any(${ids})`)) as unknown as { file_id: string; blocks: unknown[] }[];
      for (const r of rows) out.set(r.file_id, { kind: 'document', blocks: r.blocks });
    } else if (type === 'SPREADSHEET') {
      const rows = (await this.db.execute(sql`
        select s.file_id, c.row, c.col, c.formatted_value, c.style
        from spreadsheets s
        join lateral (select id from spreadsheet_sheets where spreadsheet_id = s.id order by position limit 1) first_sheet on true
        join spreadsheet_cells c on c.sheet_id = first_sheet.id and c.row < ${SHEET_PREVIEW_ROWS} and c.col < ${SHEET_PREVIEW_COLS}
        where s.file_id = any(${ids})`)) as unknown as { file_id: string; row: number; col: number; formatted_value: string; style: CellStyle | null }[];
      for (const id of fileIds) out.set(id, { kind: 'spreadsheet', cells: [] });
      for (const r of rows) {
        const p = out.get(r.file_id);
        if (p?.kind === 'spreadsheet') p.cells.push({ row: r.row, col: r.col, formattedValue: r.formatted_value, style: r.style });
      }
    } else {
      const [forms, fields] = await Promise.all([
        this.db.execute(sql`
          select fm.file_id, fm.description, t.primary_color, t.background_color
          from forms fm left join form_themes t on t.form_id = fm.id
          where fm.file_id = any(${ids})`) as unknown as Promise<{ file_id: string; description: string | null; primary_color: string | null; background_color: string | null }[]>,
        this.db.execute(sql`
          select file_id, type, label from (
            select fm.file_id, ff.type, ff.label, row_number() over (partition by ff.form_id order by ff.position) as n
            from form_fields ff join forms fm on fm.id = ff.form_id
            where fm.file_id = any(${ids})
          ) ranked where n <= ${FORM_PREVIEW_FIELDS} order by file_id, n`) as unknown as Promise<{ file_id: string; type: FormFieldType; label: string }[]>,
      ]);
      for (const f of forms) {
        out.set(f.file_id, {
          kind: 'form',
          description: f.description,
          primaryColor: f.primary_color ?? '#673ab7',
          backgroundColor: f.background_color ?? '#f0ebf8',
          fields: fields.filter((x) => x.file_id === f.file_id).map((x) => ({ type: x.type, label: x.label })),
        });
      }
    }
    return out;
  }
}
