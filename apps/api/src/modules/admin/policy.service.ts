import { orgPoliciesSchema, type OrgPolicies, type OrgPoliciesInput } from '@qub/shared';
import { eq } from 'drizzle-orm';
import type { Env } from '../../config/env';
import type { Database } from '../../db';
import { orgSettings } from '../../db/schema';
import { unprocessable } from '../../utils/errors';
import type { AuditContext, AuditService } from '../activity/activity.service';

const ROW_ID = 'org';
/** Policies are read on hot paths (every share, upload, permission check); a short cache bounds staleness across instances. */
const CACHE_MS = 5_000;
const MB = 1024 * 1024;

/** Dotted paths whose values differ, for the audit trail. */
function changedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (typeof before !== 'object' || typeof after !== 'object' || before === null || after === null || Array.isArray(before) || Array.isArray(after)) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix];
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].flatMap((k) => changedPaths((before as Record<string, unknown>)[k], (after as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k));
}

/** Organization policies: stored once, validated on read, enforced by the services that consult them. */
export class PolicyService {
  private cache: { value: OrgPolicies; at: number } | null = null;

  constructor(
    private readonly db: Database,
    private readonly env: Env,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<OrgPolicies> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const [row] = await this.db.select({ policies: orgSettings.policies }).from(orgSettings).where(eq(orgSettings.id, ROW_ID)).limit(1);
    // Until an admin saves policies, limits that used to be environment settings keep their configured values.
    const initial: OrgPoliciesInput = { trash: { retentionDays: this.env.TRASH_RETENTION_DAYS }, uploads: { maxFileSizeMb: this.env.MAX_UPLOAD_MB } };
    // Stored values are re-validated so a hand-edited or older row can never disable enforcement by being malformed.
    const parsed = orgPoliciesSchema.safeParse(row?.policies ?? initial);
    const value = parsed.success ? parsed.data : orgPoliciesSchema.parse(initial);
    this.cache = { value, at: Date.now() };
    return value;
  }

  async update(input: OrgPoliciesInput, ctx: AuditContext): Promise<OrgPolicies> {
    const next = orgPoliciesSchema.parse(input);
    if (next.uploads.maxFileSizeMb > this.env.MAX_UPLOAD_MB) {
      throw unprocessable(`The server accepts files up to ${this.env.MAX_UPLOAD_MB} MB (MAX_UPLOAD_MB).`, { path: 'uploads.maxFileSizeMb' });
    }
    next.sharing.allowedDomains = [...new Set(next.sharing.allowedDomains)].sort();
    next.uploads.blockedExtensions = [...new Set(next.uploads.blockedExtensions)].sort();
    const before = await this.get();
    await this.db.transaction(async (tx) => {
      await tx
        .insert(orgSettings)
        .values({ id: ROW_ID, policies: next, updatedBy: ctx.actorId })
        .onConflictDoUpdate({ target: orgSettings.id, set: { policies: next, updatedBy: ctx.actorId, updatedAt: new Date() } });
      await this.audit.log(ctx, 'admin.policies_updated', { type: 'org', id: ROW_ID }, { changed: changedPaths(before, next) }, tx);
    });
    this.cache = { value: next, at: Date.now() };
    return next;
  }

  /** Effective per-file upload limit: the policy, never above the server's configured maximum. */
  maxUploadBytes(p: OrgPolicies): number {
    return Math.min(p.uploads.maxFileSizeMb, this.env.MAX_UPLOAD_MB) * MB;
  }

  /** Test hook: forget the cached value. */
  invalidate(): void {
    this.cache = null;
  }
}
