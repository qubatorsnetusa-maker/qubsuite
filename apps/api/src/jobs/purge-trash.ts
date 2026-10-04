import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { driveFiles, driveFolders, emailVerifications, passwordResetTokens, sessions } from '../db/schema';
import type { Services } from '../services/container';

export interface PurgeResult {
  folders: number;
  files: number;
  orphanUploads: number;
  expiredSpam: number;
  expiredSessions: number;
}

/**
 * Retention policy: items explicitly trashed longer than the organization's retention period are permanently deleted
 * (with their stored bytes). Also clears orphaned form uploads and expired auth records.
 */
export async function purgeTrash(services: Services, log: FastifyBaseLogger): Promise<PurgeResult> {
  const { db } = services;
  // Retention is an organization policy (admin console → Drive policies).
  const retentionDays = (await services.policies.get()).trash.retentionDays;
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const result: PurgeResult = { folders: 0, files: 0, orphanUploads: 0, expiredSpam: 0, expiredSessions: 0 };

  const folders = await db
    .select({ id: driveFolders.id, ownerId: driveFolders.ownerId })
    .from(driveFolders)
    .where(and(eq(driveFolders.isTrashed, true), eq(driveFolders.trashedByParent, false), lt(driveFolders.trashedAt, cutoff)))
    .limit(500);
  for (const f of folders) {
    try {
      await services.folders.deletePermanently(f.ownerId, f.id, { system: true });
      result.folders++;
    } catch (err) {
      log.error({ err, folderId: f.id }, 'Trash purge failed for folder');
    }
  }

  const files = await db
    .select({ id: driveFiles.id, ownerId: driveFiles.ownerId })
    .from(driveFiles)
    .where(and(eq(driveFiles.isTrashed, true), eq(driveFiles.trashedByParent, false), lt(driveFiles.trashedAt, cutoff)))
    .limit(2000);
  for (const f of files) {
    try {
      await services.files.deletePermanently(f.ownerId, f.id, { system: true });
      result.files++;
    } catch (err) {
      log.error({ err, fileId: f.id }, 'Trash purge failed for file');
    }
  }

  result.orphanUploads = await services.responses.purgeOrphanUploads(new Date(Date.now() - 24 * 3600_000));
  // Items left in Spam past the retention period are removed from the user's Drive (their access is revoked).
  result.expiredSpam = await services.spam.purgeExpired();

  const expired = await db.delete(sessions).where(lt(sessions.expiresAt, sql`now() - interval '7 days'`)).returning({ id: sessions.id });
  result.expiredSessions = expired.length;
  await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, sql`now() - interval '7 days'`));
  await db.delete(emailVerifications).where(and(lt(emailVerifications.expiresAt, sql`now() - interval '30 days'`), isNull(emailVerifications.usedAt)));

  log.info({ purge: result }, 'Trash retention job finished');
  return result;
}

/** In-process scheduler. In multi-instance deployments set TRASH_PURGE_INTERVAL_MINUTES=0 and run the CLI from cron. */
export function scheduleTrashPurge(services: Services, log: FastifyBaseLogger): () => void {
  const minutes = services.env.TRASH_PURGE_INTERVAL_MINUTES;
  if (minutes <= 0) return () => {};
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await purgeTrash(services, log);
    } catch (err) {
      log.error({ err }, 'Trash retention job crashed');
    } finally {
      running = false;
    }
  };
  const first = setTimeout(() => void tick(), 30_000);
  const timer = setInterval(() => void tick(), minutes * 60_000);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
