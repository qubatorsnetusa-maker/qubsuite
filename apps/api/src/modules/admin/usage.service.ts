import type { QuotaMode } from '@qub/shared';
import { sql, type SQL } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import { AppError } from '../../utils/errors';
import type { PolicyService } from './policy.service';

const GB = 1024 ** 3;

/**
 * Bytes stored for each owner: every version of their uploaded files (trashed ones included, as in Google Drive),
 * images embedded in their Docs, and files respondents uploaded to their Forms.
 */
export const OWNER_USAGE_SQL = (ownerFilter: SQL = sql`true`) => sql`
  select owner_id, sum(bytes)::bigint as bytes from (
    select f.owner_id, v.size as bytes
      from file_versions v join drive_files f on f.id = v.file_id where ${ownerFilter}
    union all
    select f.owner_id, a.size
      from document_assets a join documents d on d.id = a.document_id join drive_files f on f.id = d.file_id where ${ownerFilter}
    union all
    select f.owner_id, u.size
      from form_uploads u join forms fm on fm.id = u.form_id join drive_files f on f.id = fm.file_id where ${ownerFilter}
  ) stored group by owner_id`;

export interface UploadBudget {
  maxBytes: number;
  limitError?: () => AppError;
}

/** Storage accounting and quota enforcement for every path that stores bytes on someone's behalf. */
export class UsageService {
  constructor(
    private readonly db: Database,
    private readonly policies: PolicyService,
  ) {}

  async usageFor(userIds: string[], tx: Executor = this.db): Promise<Map<string, number>> {
    const ids = [...new Set(userIds)];
    if (!ids.length) return new Map();
    const rows = (await tx.execute(OWNER_USAGE_SQL(sql`f.owner_id in ${ids}`))) as unknown as { owner_id: string; bytes: string }[];
    return new Map(ids.map((id) => [id, Number(rows.find((r) => r.owner_id === id)?.bytes ?? 0)]));
  }

  /** The quota that applies to a user: none if unlimited, else their own size, else the organization default. */
  async quotaFor(user: { storageQuotaBytes: number | null; storageUnlimited: boolean }): Promise<{ bytes: number | null; source: QuotaMode }> {
    if (user.storageUnlimited) return { bytes: null, source: 'unlimited' };
    if (user.storageQuotaBytes != null) return { bytes: user.storageQuotaBytes, source: 'custom' };
    const p = await this.policies.get();
    return { bytes: p.storage.defaultQuotaGb == null ? null : Math.round(p.storage.defaultQuotaGb * GB), source: 'default' };
  }

  async quotaOf(userId: string): Promise<{ bytes: number | null; source: QuotaMode }> {
    const [row] = (await this.db.execute(sql`select storage_quota_bytes, storage_unlimited from users where id = ${userId}`)) as unknown as { storage_quota_bytes: string | null; storage_unlimited: boolean }[];
    return this.quotaFor({ storageQuotaBytes: row?.storage_quota_bytes == null ? null : Number(row.storage_quota_bytes), storageUnlimited: !!row?.storage_unlimited });
  }

  /**
   * How much a new upload charged to `ownerId` may be: the smaller of the per-file limit and the owner's remaining
   * quota. Passed to the streaming ingest, which stops the upload as soon as it goes over.
   */
  async uploadBudget(ownerId: string, fileLimitBytes: number, who: 'self' | 'owner' = 'self'): Promise<UploadBudget> {
    const quota = (await this.quotaOf(ownerId)).bytes;
    if (quota == null) return { maxBytes: fileLimitBytes };
    const used = (await this.usageFor([ownerId])).get(ownerId) ?? 0;
    const remaining = Math.max(0, quota - used);
    if (remaining >= fileLimitBytes) return { maxBytes: fileLimitBytes };
    const message =
      who === 'self'
        ? `You're out of storage (${formatGb(used)} of ${formatGb(quota)} used). Delete files or ask your administrator for more space.`
        : "The owner of this item is out of storage, so the file can't be added.";
    return { maxBytes: remaining, limitError: () => new AppError('STORAGE_QUOTA_EXCEEDED', message) };
  }
}

export function formatGb(bytes: number): string {
  const gb = bytes / GB;
  if (gb >= 10) return `${Math.round(gb)} GB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
