import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../../db';
import { userBlocks } from '../../db/schema';

/** True when `recipientId` has blocked `actorId`. */
export async function hasBlocked(db: Executor, recipientId: string, actorId: string): Promise<boolean> {
  const rows = await db
    .select({ u: userBlocks.userId })
    .from(userBlocks)
    .where(and(eq(userBlocks.userId, recipientId), eq(userBlocks.blockedUserId, actorId)))
    .limit(1);
  return rows.length > 0;
}

/** "recipient:actor" pairs among the given people where the recipient blocked the actor. */
export async function blockedPairs(db: Executor, recipientIds: string[], actorIds: string[]): Promise<Set<string>> {
  if (!recipientIds.length || !actorIds.length) return new Set();
  const rows = await db
    .select()
    .from(userBlocks)
    .where(and(inArray(userBlocks.userId, [...new Set(recipientIds)]), inArray(userBlocks.blockedUserId, [...new Set(actorIds)])));
  return new Set(rows.map((r) => `${r.userId}:${r.blockedUserId}`));
}

/** `column` (a file id) is not in the user's Spam. */
export const notSpamFile = (userId: string, column: SQL): SQL => sql`${column} not in (select file_id from spam_items where user_id = ${userId} and file_id is not null)`;

/** `column` (a folder id) is not in the user's Spam. */
export const notSpamFolder = (userId: string, column: SQL): SQL => sql`${column} not in (select folder_id from spam_items where user_id = ${userId} and folder_id is not null)`;

/**
 * The recursive CTE body `accessible as (…)`: every folder the user can reach — their own, folders shared with them
 * (except ones they moved to Spam), and everything below those. Use inside `with recursive`.
 */
export const accessibleFoldersCte = (userId: string): SQL => sql`
  accessible as (
    select id from drive_folders where owner_id = ${userId}
    union
    select folder_id from folder_permissions where user_id = ${userId} and ${notSpamFolder(userId, sql`folder_id`)}
    union
    select f.id from drive_folders f join accessible a on f.parent_id = a.id
  )`;
