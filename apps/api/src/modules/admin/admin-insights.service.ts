import type {
  AdminActivityDto,
  AdminActivityQuery,
  AdminAlertDto,
  AdminAuditEventDto,
  AdminAuditQuery,
  AdminContentItemDto,
  AdminContentQuery,
  AdminOverviewDto,
  AdminSecurityDto,
  AdminSessionDto,
  AdminStorageDto,
  AdminSystemDto,
  AdminUserDto,
  FileType,
  Paginated,
} from '@qub/shared';
import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { Env } from '../../config/env';
import type { Database } from '../../db';
import { driveFiles, shareLinks } from '../../db/schema';
import { csvRow } from '../../utils/csv';
import { badRequest, notFound } from '../../utils/errors';
import { decodeOffsetCursor, escapeLike, pageOf } from '../../utils/pagination';
import type { ActivityService, AuditContext, AuditService } from '../activity/activity.service';
import { DriveFileRepository } from '../files/file.repository';
import { UserRepository } from '../users/user.repository';
import type { AdminUserService } from './admin-users.service';
import type { PolicyService } from './policy.service';
import { OWNER_USAGE_SQL } from './usage.service';

const GB = 1024 ** 3;
const DAY = 86_400_000;

/** Audit events worth highlighting. Everything else is informational. */
const CRITICAL_EVENTS = ['auth.refresh_token_reuse', 'admin.user_deleted', 'admin.sessions_revoked_all'];
const WARNING_EVENTS = [
  'auth.login_failed',
  'auth.password_reset',
  'admin.role_changed',
  'admin.user_suspended',
  'admin.policies_updated',
  'admin.link_revoked',
  'admin.ownership_transferred',
  'admin.user_signed_out',
  'admin.session_revoked',
  'sharing.link_changed',
];

function severityOf(event: string): AdminAuditEventDto['severity'] {
  if (CRITICAL_EVENTS.includes(event)) return 'critical';
  if (WARNING_EVENTS.includes(event)) return 'warning';
  return 'info';
}

function categoryOf(event: string): AdminAuditEventDto['category'] {
  const prefix = event.slice(0, event.indexOf('.'));
  return prefix === 'auth' || prefix === 'sharing' || prefix === 'admin' ? prefix : 'other';
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

const UPLOAD_TYPE_LABELS: Partial<Record<FileType, string>> = {
  PDF: 'PDFs',
  IMAGE: 'Images',
  VIDEO: 'Videos',
  AUDIO: 'Audio',
  TEXT: 'Text files',
  ARCHIVE: 'Archives',
  OTHER: 'Other files',
};

/** Read-mostly views for the admin console, computed from the platform's own tables. */
export class AdminInsightsService {
  constructor(
    private readonly db: Database,
    private readonly env: Env,
    private readonly policies: PolicyService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
    private readonly users: AdminUserService,
  ) {}

  // ---------- overview ----------

  async overview(): Promise<AdminOverviewDto> {
    const [counts] = (await this.db.execute(sql`
      select
        (select count(*) from users where status <> 'DELETED') as users_total,
        (select count(*) from users where status = 'ACTIVE') as users_active,
        (select count(*) from users where status = 'SUSPENDED') as users_suspended,
        (select count(*) from users where platform_role = 'SUPER_ADMIN' and status = 'ACTIVE') as super_admins,
        (select count(*) from users where created_at > now() - interval '30 days') as users_new,
        (select count(*) from users where last_login_at > now() - interval '7 days') as users_signed_in,
        (select count(*) from drive_files where file_type = 'DOCUMENT' and not is_trashed) as documents,
        (select count(*) from drive_files where file_type = 'SPREADSHEET' and not is_trashed) as spreadsheets,
        (select count(*) from drive_files where file_type = 'FORM' and not is_trashed) as forms,
        (select count(*) from drive_files where file_type not in ('DOCUMENT', 'SPREADSHEET', 'FORM') and not is_trashed) as uploads,
        (select count(*) from drive_folders where not is_root and not is_trashed) as folders,
        (select count(*) from drive_files where is_trashed) + (select count(*) from drive_folders where is_trashed) as trashed,
        (select count(*) from forms fm join drive_files f on f.id = fm.file_id where fm.is_published and not f.is_trashed) as published_forms,
        (select count(*) from form_responses) as responses,
        (select count(*) from form_responses where submitted_at > now() - interval '7 days') as responses_7d,
        (select count(*) from share_links where revoked_at is null and (expires_at is null or expires_at > now())) as public_links,
        (select count(*) from file_permissions) + (select count(*) from folder_permissions) as direct_shares,
        (select count(*) from file_shares where accepted_at is null) as pending_invites,
        (select coalesce(sum(bytes), 0) from (${OWNER_USAGE_SQL()}) u) as used_bytes`)) as unknown as Record<string, string>[];
    const c = (k: string) => Number(counts?.[k] ?? 0);
    const [storage, activity, recentAudit, alerts] = await Promise.all([this.allocated(), this.activitySeries(), this.auditPage({ limit: 8 }), this.alerts()]);
    return {
      users: { total: c('users_total'), active: c('users_active'), suspended: c('users_suspended'), superAdmins: c('super_admins'), newLast30Days: c('users_new'), signedInLast7Days: c('users_signed_in') },
      content: { documents: c('documents'), spreadsheets: c('spreadsheets'), forms: c('forms'), uploads: c('uploads'), folders: c('folders'), trashed: c('trashed') },
      forms: { published: c('published_forms'), responses: c('responses'), responsesLast7Days: c('responses_7d') },
      sharing: { publicLinks: c('public_links'), directShares: c('direct_shares'), pendingInvites: c('pending_invites') },
      storage: { usedBytes: c('used_bytes'), quotaBytes: storage },
      activity,
      recentAudit: recentAudit.items,
      alerts,
    };
  }

  /** Activity per day and app for the last 14 days (UTC), zero-filled. */
  private async activitySeries(): Promise<AdminOverviewDto['activity']> {
    const rows = (await this.db.execute(sql`
      select to_char((a.created_at at time zone 'UTC')::date, 'YYYY-MM-DD') as day,
             case when f.file_type in ('DOCUMENT', 'SPREADSHEET', 'FORM') then f.file_type::text else 'DRIVE' end as app,
             count(*) as n
      from activity_logs a
      left join drive_files f on a.resource_type = 'FILE' and f.id = a.resource_id
      where a.created_at >= (now() at time zone 'UTC')::date - 13
      group by 1, 2`)) as unknown as { day: string; app: 'DOCUMENT' | 'SPREADSHEET' | 'FORM' | 'DRIVE'; n: string }[];
    const today = new Date(new Date().toISOString().slice(0, 10));
    return Array.from({ length: 14 }, (_, i) => {
      const date = new Date(today.getTime() - (13 - i) * DAY).toISOString().slice(0, 10);
      const at = (app: string) => Number(rows.find((r) => r.day === date && r.app === app)?.n ?? 0);
      return { date, DOCUMENT: at('DOCUMENT'), SPREADSHEET: at('SPREADSHEET'), FORM: at('FORM'), DRIVE: at('DRIVE') };
    });
  }

  /** Sum of every account's effective quota; null when anyone is unlimited. */
  private async allocated(): Promise<number | null> {
    const defaultGb = (await this.policies.get()).storage.defaultQuotaGb;
    const [row] = (await this.db.execute(sql`
      select count(*) filter (where storage_quota_bytes is null and not storage_unlimited) as unset,
             count(*) filter (where storage_unlimited) as unlimited,
             coalesce(sum(storage_quota_bytes), 0) as set_total
      from users where status <> 'DELETED'`)) as unknown as { unset: string; unlimited: string; set_total: string }[];
    const unset = Number(row?.unset ?? 0);
    if (Number(row?.unlimited ?? 0) || (unset && defaultGb == null)) return null;
    return Number(row?.set_total ?? 0) + unset * Math.round((defaultGb ?? 0) * GB);
  }

  // ---------- alerts ----------

  /** Conditions that need an admin's attention, derived from current data (they clear when resolved). */
  async alerts(): Promise<AdminAlertDto[]> {
    const p = await this.policies.get();
    const defaultBytes = p.storage.defaultQuotaGb == null ? null : Math.round(p.storage.defaultQuotaGb * GB);
    const [nearQuota, reuse, failed, admins, publicLinks] = await Promise.all([
      this.db.execute(sql`
        with usage as (${OWNER_USAGE_SQL()}),
             quotas as (
               select u.id, u.email, case when u.storage_unlimited then null else coalesce(u.storage_quota_bytes, ${defaultBytes}::bigint) end as quota
               from users u where u.status = 'ACTIVE'
             )
        select q.email, usage.bytes, q.quota
        from quotas q join usage on usage.owner_id = q.id
        where q.quota is not null and usage.bytes >= 0.9 * q.quota
        order by usage.bytes::float / q.quota desc`) as unknown as Promise<{ email: string; bytes: string; quota: string }[]>,
      this.db.execute(sql`select count(*) as n, max(created_at) as at from audit_logs where event = 'auth.refresh_token_reuse' and created_at > now() - interval '7 days'`) as unknown as Promise<{ n: string; at: Date | null }[]>,
      this.failedLoginAccounts(),
      this.db.execute(sql`select count(*) as n from users where platform_role = 'SUPER_ADMIN' and status = 'ACTIVE'`) as unknown as Promise<{ n: string }[]>,
      this.db.execute(sql`select count(*) as n, max(created_at) as at from share_links where revoked_at is null and (expires_at is null or expires_at > now())`) as unknown as Promise<{ n: string; at: Date | null }[]>,
    ]);
    const now = new Date().toISOString();
    const alerts: AdminAlertDto[] = [];
    const full = nearQuota.filter((r) => Number(r.bytes) >= Number(r.quota));
    if (full.length) {
      alerts.push({ id: 'storage-full', severity: 'critical', section: 'storage', at: now, title: `${full.length} ${full.length === 1 ? 'person is' : 'people are'} out of storage`, description: `${full.map((r) => r.email).slice(0, 3).join(', ')}${full.length > 3 ? '…' : ''} can't upload until space is freed or their quota is raised.` });
    }
    const near = nearQuota.length - full.length;
    if (near > 0) {
      alerts.push({ id: 'storage-near', severity: 'warning', section: 'storage', at: now, title: `${near} ${near === 1 ? 'person is' : 'people are'} over 90% of their storage`, description: 'Raise their quota or ask them to clean up before uploads start failing.' });
    }
    const reuseCount = Number(reuse[0]?.n ?? 0);
    if (reuseCount) {
      alerts.push({ id: 'token-reuse', severity: 'critical', section: 'security', at: iso(reuse[0]!.at) ?? now, title: `${reuseCount} possible session ${reuseCount === 1 ? 'theft' : 'thefts'} this week`, description: 'A refresh token was reused after rotation, so the session was revoked. Review the audit log.' });
    }
    if (failed.length) {
      alerts.push({ id: 'failed-logins', severity: 'warning', section: 'security', at: failed[0]!.lastAt, title: `Repeated failed sign-ins for ${failed.length} ${failed.length === 1 ? 'account' : 'accounts'}`, description: `${failed.map((f) => `${f.email} (${f.attempts})`).slice(0, 3).join(', ')} in the last 24 hours.` });
    }
    if (Number(admins[0]?.n ?? 0) < 2) {
      alerts.push({ id: 'single-admin', severity: 'info', section: 'users', at: now, title: 'Only one super admin', description: 'Add a second super admin so the organization stays manageable if this account is unavailable.' });
    }
    const links = Number(publicLinks[0]?.n ?? 0);
    if (links && p.sharing.allowPublicLinks) {
      alerts.push({ id: 'public-links', severity: 'info', section: 'content', at: iso(publicLinks[0]!.at) ?? now, title: `${links} ${links === 1 ? 'item is' : 'items are'} shared with anyone who has the link`, description: 'Review public items in Content, or turn public links off in Drive policies.' });
    }
    return alerts;
  }

  private async failedLoginAccounts(): Promise<AdminSecurityDto['failedLoginAccounts']> {
    const rows = (await this.db.execute(sql`
      select lower(metadata->>'email') as email, count(*) as attempts, max(created_at) as last_at
      from audit_logs
      where event = 'auth.login_failed' and created_at > now() - interval '24 hours' and metadata ? 'email'
      group by 1 having count(*) >= 5 order by count(*) desc limit 20`)) as unknown as { email: string; attempts: string; last_at: Date }[];
    return rows.map((r) => ({ email: r.email, attempts: Number(r.attempts), lastAt: new Date(r.last_at).toISOString() }));
  }

  // ---------- storage ----------

  async storage(): Promise<AdminStorageDto> {
    const [byType, other, used, allocated, top, largest] = await Promise.all([
      this.db.execute(sql`
        select f.file_type::text as type, sum(v.size) as bytes
        from file_versions v join drive_files f on f.id = v.file_id
        where v.version_number = f.current_version and not f.is_trashed
        group by 1`) as unknown as Promise<{ type: FileType; bytes: string }[]>,
      this.db.execute(sql`
        select
          (select coalesce(sum(v.size), 0) from file_versions v join drive_files f on f.id = v.file_id where v.version_number <> f.current_version and not f.is_trashed) as older_versions,
          (select coalesce(sum(v.size), 0) from file_versions v join drive_files f on f.id = v.file_id where f.is_trashed) as trash,
          (select coalesce(sum(size), 0) from document_assets) as doc_images,
          (select coalesce(sum(size), 0) from form_uploads) as form_uploads`) as unknown as Promise<Record<string, string>[]>,
      this.db.execute(sql`select coalesce(sum(bytes), 0) as n from (${OWNER_USAGE_SQL()}) u`) as unknown as Promise<{ n: string }[]>,
      this.allocated(),
      this.users.list({ q: '', sort: 'storage', order: 'desc', limit: 10 }),
      this.db.execute(sql`
        select f.id, f.name, f.file_type, f.owner_id, f.is_trashed, sum(v.size) as bytes, count(v.id) as versions
        from drive_files f join file_versions v on v.file_id = f.id
        group by f.id order by sum(v.size) desc limit 10`) as unknown as Promise<{ id: string; name: string; file_type: FileType; owner_id: string; is_trashed: boolean; bytes: string; versions: string }[]>,
    ]);
    const owners = await UserRepository.summaries(this.db, largest.map((r) => r.owner_id));
    const o = other[0] ?? {};
    const breakdown = [
      ...byType.map((r) => ({ key: `type:${r.type}`, label: UPLOAD_TYPE_LABELS[r.type] ?? r.type, bytes: Number(r.bytes) })),
      { key: 'older_versions', label: 'Older file versions', bytes: Number(o.older_versions ?? 0) },
      { key: 'doc_images', label: 'Images in Docs', bytes: Number(o.doc_images ?? 0) },
      { key: 'form_uploads', label: 'Form uploads', bytes: Number(o.form_uploads ?? 0) },
      { key: 'trash', label: 'Trash', bytes: Number(o.trash ?? 0) },
    ]
      .filter((b) => b.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes);
    return {
      usedBytes: Number(used[0]?.n ?? 0),
      allocatedBytes: allocated,
      breakdown,
      topUsers: top.items.filter((u: AdminUserDto) => u.storageUsed > 0),
      largestFiles: largest.map((r) => ({ id: r.id, name: r.name, fileType: r.file_type, owner: owners.get(r.owner_id)!, bytes: Number(r.bytes), versions: Number(r.versions), isTrashed: r.is_trashed })),
    };
  }

  // ---------- content (Docs, Sheets, Forms, uploads) ----------

  async content(q: Required<Pick<AdminContentQuery, 'type' | 'q' | 'publicOnly' | 'includeTrashed' | 'sort' | 'limit'>> & AdminContentQuery): Promise<Paginated<AdminContentItemDto>> {
    const offset = decodeOffsetCursor(q.cursor);
    const filters: SQL[] = [q.type === 'UPLOAD' ? sql`f.file_type not in ('DOCUMENT', 'SPREADSHEET', 'FORM')` : sql`f.file_type = ${q.type}`];
    if (!q.includeTrashed) filters.push(sql`not f.is_trashed`);
    if (q.publicOnly) filters.push(sql`f.general_access = 'ANYONE_WITH_LINK'`);
    if (q.ownerId) filters.push(sql`f.owner_id = ${q.ownerId}`);
    const term = q.q.toLowerCase();
    if (term) filters.push(sql`(lower(f.name) like ${`%${escapeLike(term)}%`} or ow.email like ${`%${escapeLike(term)}%`})`);
    const bytes = sql`(
      coalesce((select sum(size) from file_versions where file_id = f.id), 0)
      + coalesce((select sum(a.size) from document_assets a where a.document_id = d.id), 0)
      + coalesce((select sum(u.size) from form_uploads u where u.form_id = fm.id), 0))`;
    const order = q.sort === 'name' ? sql`lower(f.name) asc` : q.sort === 'size' ? sql`${bytes} desc` : sql`f.updated_at desc`;
    const rows = (await this.db.execute(sql`
      select f.id, f.name, f.file_type, f.mime_type, f.owner_id, f.is_trashed, f.general_access, f.created_at, f.updated_at,
             p.name as folder_name, p.is_root as folder_is_root,
             ${bytes} as bytes,
             (select count(*) from file_permissions fp where fp.file_id = f.id) as shared_with,
             d.word_count,
             (select count(*) from spreadsheet_sheets sh where sh.spreadsheet_id = s.id) as sheets,
             (select count(*) from spreadsheet_cells c join spreadsheet_sheets sh on sh.id = c.sheet_id where sh.spreadsheet_id = s.id and c.input <> '') as cells,
             fm.is_published,
             (select count(*) from form_responses r where r.form_id = fm.id) as responses,
             (select count(*) from form_fields ff where ff.form_id = fm.id and ff.type <> 'SECTION') as questions,
             (select count(*) from file_versions v where v.file_id = f.id) as versions
      from drive_files f
      join users ow on ow.id = f.owner_id
      left join drive_folders p on p.id = f.folder_id
      left join documents d on d.file_id = f.id
      left join spreadsheets s on s.file_id = f.id
      left join forms fm on fm.file_id = f.id
      where ${sql.join(filters, sql` and `)}
      order by ${order}, f.id
      limit ${q.limit + 1} offset ${offset}`)) as unknown as Record<string, unknown>[];
    const page = pageOf(rows, q.limit, offset);
    const owners = await UserRepository.summaries(this.db, page.items.map((r) => r.owner_id as string));
    const n = (v: unknown) => Number(v ?? 0);
    return {
      items: page.items.map((r) => {
        const type = r.file_type as FileType;
        const details: AdminContentItemDto['details'] =
          type === 'DOCUMENT'
            ? { wordCount: n(r.word_count) }
            : type === 'SPREADSHEET'
              ? { sheets: n(r.sheets), cells: n(r.cells) }
              : type === 'FORM'
                ? { published: !!r.is_published, responses: n(r.responses), questions: n(r.questions) }
                : { versions: n(r.versions) };
        return {
          id: r.id as string,
          name: r.name as string,
          fileType: type,
          mimeType: r.mime_type as string,
          owner: owners.get(r.owner_id as string)!,
          bytes: n(r.bytes),
          isTrashed: !!r.is_trashed,
          generalAccess: r.general_access as AdminContentItemDto['generalAccess'],
          sharedWith: n(r.shared_with),
          createdAt: iso(r.created_at as Date)!,
          updatedAt: iso(r.updated_at as Date)!,
          location: r.folder_is_root ? 'My Drive' : ((r.folder_name as string | null) ?? null),
          details,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  /** Turns off "Anyone with the link" for an item (the old URL stops working). */
  async revokeLink(fileId: string, ctx: AuditContext): Promise<void> {
    const file = await DriveFileRepository.findById(this.db, fileId);
    if (!file) throw notFound('file');
    if (file.generalAccess !== 'ANYONE_WITH_LINK') throw badRequest('This item is not shared by link.');
    await this.db.transaction(async (tx) => {
      await tx.update(driveFiles).set({ generalAccess: 'RESTRICTED' }).where(eq(driveFiles.id, fileId));
      await tx.update(shareLinks).set({ revokedAt: new Date() }).where(and(eq(shareLinks.fileId, fileId), isNull(shareLinks.revokedAt)));
      await this.activity.record(
        { userId: ctx.actorId, action: 'LINK_SHARING_CHANGED', resourceType: 'FILE', resourceId: fileId, resourceName: file.name, metadata: { access: 'RESTRICTED', byAdmin: true } },
        tx,
      );
      await this.audit.log(ctx, 'admin.link_revoked', { type: 'FILE', id: fileId }, { name: file.name, ownerId: file.ownerId }, tx);
    });
  }

  // ---------- audit & activity ----------

  private auditFilters(q: AdminAuditQuery): SQL {
    const filters: SQL[] = [sql`true`];
    const term = (q.q ?? '').trim().toLowerCase();
    if (term) {
      const like = `%${escapeLike(term)}%`;
      filters.push(sql`(l.event like ${like} or lower(coalesce(u.email, '')) like ${like} or lower(coalesce(u.name, '')) like ${like} or coalesce(l.target_id, '') like ${like} or coalesce(l.ip_address, '') like ${like} or lower(l.metadata::text) like ${like})`);
    }
    if (q.category) filters.push(sql`l.event like ${`${q.category}.%`}`);
    if (q.severity === 'critical') filters.push(sql`l.event in ${CRITICAL_EVENTS}`);
    if (q.severity === 'warning') filters.push(sql`l.event in ${WARNING_EVENTS}`);
    if (q.severity === 'info') filters.push(sql`l.event not in ${[...CRITICAL_EVENTS, ...WARNING_EVENTS]}`);
    if (q.actorId) filters.push(sql`l.actor_id = ${q.actorId}`);
    if (q.from) filters.push(sql`l.created_at >= ${q.from.toISOString()}::timestamptz`);
    if (q.to) filters.push(sql`l.created_at <= ${q.to.toISOString()}::timestamptz`);
    return sql.join(filters, sql` and `);
  }

  async auditPage(q: AdminAuditQuery): Promise<Paginated<AdminAuditEventDto>> {
    const limit = q.limit ?? 50;
    const offset = decodeOffsetCursor(q.cursor);
    const rows = (await this.db.execute(sql`
      select l.* from audit_logs l left join users u on u.id = l.actor_id
      where ${this.auditFilters(q)}
      order by l.created_at desc, l.id limit ${limit + 1} offset ${offset}`)) as unknown as {
      id: string;
      actor_id: string | null;
      event: string;
      target_type: string | null;
      target_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
      metadata: Record<string, unknown>;
      created_at: Date;
    }[];
    const page = pageOf(rows, limit, offset);
    const actors = await UserRepository.summaries(this.db, page.items.map((r) => r.actor_id!).filter(Boolean));
    const labels = await this.targetLabels(page.items);
    return {
      items: page.items.map((r) => ({
        id: r.id,
        createdAt: new Date(r.created_at).toISOString(),
        actor: r.actor_id ? (actors.get(r.actor_id) ?? null) : null,
        event: r.event,
        category: categoryOf(r.event),
        severity: severityOf(r.event),
        targetType: r.target_type,
        targetId: r.target_id,
        targetLabel:
          r.target_type === 'org'
            ? 'Organization policies'
            : (labels.get(`${r.target_type}:${r.target_id}`) ?? (typeof r.metadata?.email === 'string' ? r.metadata.email : typeof r.metadata?.name === 'string' ? r.metadata.name : null)),
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        metadata: r.metadata ?? {},
      })),
      nextCursor: page.nextCursor,
    };
  }

  /** Current names for audit targets (users by email, files and folders by name). */
  private async targetLabels(rows: { target_type: string | null; target_id: string | null }[]): Promise<Map<string, string>> {
    const uuid = /^[0-9a-f-]{36}$/;
    const ids = (type: string[]) => [...new Set(rows.filter((r) => r.target_id && uuid.test(r.target_id) && type.includes(r.target_type ?? '')).map((r) => r.target_id!))];
    const [userRows, fileRows, folderRows] = await Promise.all([
      ids(['user']).length ? (this.db.execute(sql`select id, email as label from users where id in ${ids(['user'])}`) as unknown as Promise<{ id: string; label: string }[]>) : [],
      ids(['FILE', 'file']).length ? (this.db.execute(sql`select id, name as label from drive_files where id in ${ids(['FILE', 'file'])}`) as unknown as Promise<{ id: string; label: string }[]>) : [],
      ids(['FOLDER', 'folder']).length ? (this.db.execute(sql`select id, name as label from drive_folders where id in ${ids(['FOLDER', 'folder'])}`) as unknown as Promise<{ id: string; label: string }[]>) : [],
    ]);
    const out = new Map<string, string>();
    for (const r of userRows) out.set(`user:${r.id}`, r.label);
    for (const r of fileRows) (out.set(`FILE:${r.id}`, r.label), out.set(`file:${r.id}`, r.label));
    for (const r of folderRows) (out.set(`FOLDER:${r.id}`, r.label), out.set(`folder:${r.id}`, r.label));
    return out;
  }

  /** Streams up to 10,000 matching audit events as CSV. */
  async *auditCsv(q: AdminAuditQuery): AsyncGenerator<string> {
    yield csvRow(['Time (UTC)', 'Actor', 'Actor email', 'Event', 'Category', 'Severity', 'Target', 'Target type', 'Target id', 'IP address', 'User agent', 'Details']);
    let cursor: string | undefined;
    let written = 0;
    do {
      const page = await this.auditPage({ ...q, cursor, limit: 200 });
      for (const e of page.items) {
        yield csvRow([e.createdAt, e.actor?.name ?? '', e.actor?.email ?? '', e.event, e.category, e.severity, e.targetLabel ?? '', e.targetType ?? '', e.targetId ?? '', e.ipAddress ?? '', e.userAgent ?? '', JSON.stringify(e.metadata)]);
      }
      written += page.items.length;
      cursor = page.nextCursor ?? undefined;
    } while (cursor && written < 10_000);
  }

  async activityPage(q: AdminActivityQuery): Promise<Paginated<AdminActivityDto>> {
    const limit = q.limit ?? 50;
    const offset = decodeOffsetCursor(q.cursor);
    const app = sql`case when f.file_type in ('DOCUMENT', 'SPREADSHEET', 'FORM') then f.file_type::text else 'DRIVE' end`;
    const filters: SQL[] = [sql`true`];
    const term = (q.q ?? '').trim().toLowerCase();
    if (term) filters.push(sql`(lower(coalesce(a.resource_name, '')) like ${`%${escapeLike(term)}%`} or lower(coalesce(u.email, '')) like ${`%${escapeLike(term)}%`} or lower(a.action::text) like ${`%${escapeLike(term)}%`})`);
    if (q.app) filters.push(sql`${app} = ${q.app}`);
    if (q.userId) filters.push(sql`a.user_id = ${q.userId}`);
    if (q.from) filters.push(sql`a.created_at >= ${q.from.toISOString()}::timestamptz`);
    if (q.to) filters.push(sql`a.created_at <= ${q.to.toISOString()}::timestamptz`);
    const rows = (await this.db.execute(sql`
      select a.id, a.user_id, a.action, a.resource_type, a.resource_id, a.resource_name, a.metadata, a.created_at, ${app} as app
      from activity_logs a
      left join users u on u.id = a.user_id
      left join drive_files f on a.resource_type = 'FILE' and f.id = a.resource_id
      where ${sql.join(filters, sql` and `)}
      order by a.created_at desc, a.id limit ${limit + 1} offset ${offset}`)) as unknown as {
      id: string;
      user_id: string | null;
      action: string;
      resource_type: string;
      resource_id: string;
      resource_name: string | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      app: AdminActivityDto['app'];
    }[];
    const page = pageOf(rows, limit, offset);
    const people = await UserRepository.summaries(this.db, page.items.map((r) => r.user_id!).filter(Boolean));
    return {
      items: page.items.map((r) => ({
        id: r.id,
        createdAt: new Date(r.created_at).toISOString(),
        user: r.user_id ? (people.get(r.user_id) ?? null) : null,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        resourceName: r.resource_name,
        app: r.app,
        metadata: r.metadata ?? {},
      })),
      nextCursor: page.nextCursor,
    };
  }

  // ---------- security ----------

  async security(): Promise<AdminSecurityDto> {
    const [[live], [failed], [reuse], failedAccounts, p] = await Promise.all([
      this.db.execute(sql`select count(*) as sessions, count(distinct user_id) as users from sessions where revoked_at is null and expires_at > now()`) as unknown as Promise<{ sessions: string; users: string }[]>,
      this.db.execute(sql`select count(*) as n from audit_logs where event = 'auth.login_failed' and created_at > now() - interval '24 hours'`) as unknown as Promise<{ n: string }[]>,
      this.db.execute(sql`select count(*) as n from audit_logs where event = 'auth.refresh_token_reuse' and created_at > now() - interval '7 days'`) as unknown as Promise<{ n: string }[]>,
      this.failedLoginAccounts(),
      this.policies.get(),
    ]);
    return {
      activeSessions: Number(live?.sessions ?? 0),
      usersWithSessions: Number(live?.users ?? 0),
      failedLogins24h: Number(failed?.n ?? 0),
      failedLoginAccounts: failedAccounts,
      tokenReuse7d: Number(reuse?.n ?? 0),
      policies: p.security,
    };
  }

  async sessions(currentSessionId: string, q: { userId?: string; cursor?: string; limit: number }): Promise<Paginated<AdminSessionDto>> {
    const offset = decodeOffsetCursor(q.cursor);
    const rows = (await this.db.execute(sql`
      select id, user_id, user_agent, ip_address, created_at, last_used_at, expires_at from sessions
      where revoked_at is null and expires_at > now() ${q.userId ? sql`and user_id = ${q.userId}` : sql``}
      order by last_used_at desc, id limit ${q.limit + 1} offset ${offset}`)) as unknown as {
      id: string;
      user_id: string;
      user_agent: string | null;
      ip_address: string | null;
      created_at: Date;
      last_used_at: Date;
      expires_at: Date;
    }[];
    const page = pageOf(rows, q.limit, offset);
    const people = await UserRepository.summaries(this.db, page.items.map((r) => r.user_id));
    return {
      items: page.items.map((r) => ({
        id: r.id,
        user: people.get(r.user_id)!,
        userAgent: r.user_agent,
        ipAddress: r.ip_address,
        createdAt: new Date(r.created_at).toISOString(),
        lastUsedAt: new Date(r.last_used_at).toISOString(),
        expiresAt: new Date(r.expires_at).toISOString(),
        current: r.id === currentSessionId,
      })),
      nextCursor: page.nextCursor,
    };
  }

  // ---------- system ----------

  async system(): Promise<AdminSystemDto> {
    const [[pg], p] = await Promise.all([
      this.db.execute(sql`select current_setting('server_version') as version, pg_database_size(current_database()) as bytes`) as unknown as Promise<{ version: string; bytes: string }[]>,
      this.policies.get(),
    ]);
    return {
      organizationName: p.organizationName,
      appUrl: this.env.APP_URL,
      environment: this.env.NODE_ENV,
      storageProvider: this.env.STORAGE_PROVIDER,
      mailTransport: this.env.MAIL_TRANSPORT,
      serverMaxUploadMb: this.env.MAX_UPLOAD_MB,
      trashJobIntervalMinutes: this.env.TRASH_PURGE_INTERVAL_MINUTES,
      nodeVersion: process.version,
      postgresVersion: pg?.version ?? '',
      databaseBytes: Number(pg?.bytes ?? 0),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
