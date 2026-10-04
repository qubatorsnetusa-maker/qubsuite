import { and, eq, inArray, not } from 'drizzle-orm';
import type { Executor } from '../../db';
import { driveFolders } from '../../db/schema';

export type FolderRow = typeof driveFolders.$inferSelect;

export const FolderRepository = {
  async findById(db: Executor, id: string): Promise<FolderRow | undefined> {
    const [row] = await db.select().from(driveFolders).where(eq(driveFolders.id, id)).limit(1);
    return row;
  },

  async findByIds(db: Executor, ids: string[]): Promise<FolderRow[]> {
    if (!ids.length) return [];
    return db.select().from(driveFolders).where(inArray(driveFolders.id, ids));
  },

  async root(db: Executor, ownerId: string): Promise<FolderRow | undefined> {
    const [row] = await db
      .select()
      .from(driveFolders)
      .where(and(eq(driveFolders.ownerId, ownerId), eq(driveFolders.isRoot, true)))
      .limit(1);
    return row;
  },

  async childNames(db: Executor, parentId: string): Promise<Set<string>> {
    const rows = await db
      .select({ name: driveFolders.name })
      .from(driveFolders)
      .where(and(eq(driveFolders.parentId, parentId), not(driveFolders.isTrashed)));
    return new Set(rows.map((r) => r.name.toLowerCase()));
  },

  async insert(db: Executor, values: typeof driveFolders.$inferInsert): Promise<FolderRow> {
    const [row] = await db.insert(driveFolders).values(values).returning();
    return row!;
  },

  async update(db: Executor, id: string, values: Partial<typeof driveFolders.$inferInsert>): Promise<FolderRow> {
    const [row] = await db.update(driveFolders).set(values).where(eq(driveFolders.id, id)).returning();
    return row!;
  },
};
