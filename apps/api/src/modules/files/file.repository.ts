import { and, eq, inArray, max, not } from 'drizzle-orm';
import type { Executor } from '../../db';
import { documents, driveFiles, fileVersions, forms, spreadsheets } from '../../db/schema';

export type DriveFileRow = typeof driveFiles.$inferSelect;
export type FileVersionRow = typeof fileVersions.$inferSelect;

export const DriveFileRepository = {
  async findById(db: Executor, id: string): Promise<DriveFileRow | undefined> {
    const [row] = await db.select().from(driveFiles).where(eq(driveFiles.id, id)).limit(1);
    return row;
  },

  async findByIds(db: Executor, ids: string[]): Promise<DriveFileRow[]> {
    if (!ids.length) return [];
    return db.select().from(driveFiles).where(inArray(driveFiles.id, ids));
  },

  /** Lower-cased names of live files in a folder, for duplicate-name handling. */
  async namesInFolder(db: Executor, folderId: string): Promise<Set<string>> {
    const rows = await db
      .select({ name: driveFiles.name })
      .from(driveFiles)
      .where(and(eq(driveFiles.folderId, folderId), not(driveFiles.isTrashed)));
    return new Set(rows.map((r) => r.name.toLowerCase()));
  },

  async insert(db: Executor, values: typeof driveFiles.$inferInsert): Promise<DriveFileRow> {
    const [row] = await db.insert(driveFiles).values(values).returning();
    return row!;
  },

  async update(db: Executor, id: string, values: Partial<typeof driveFiles.$inferInsert>): Promise<DriveFileRow> {
    const [row] = await db.update(driveFiles).set(values).where(eq(driveFiles.id, id)).returning();
    return row!;
  },

  /** Maps Drive file ids to the Docs/Sheets/Forms resource they back. */
  async resourceIds(db: Executor, fileIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!fileIds.length) return out;
    const [d, s, f] = await Promise.all([
      db.select({ id: documents.id, fileId: documents.fileId }).from(documents).where(inArray(documents.fileId, fileIds)),
      db.select({ id: spreadsheets.id, fileId: spreadsheets.fileId }).from(spreadsheets).where(inArray(spreadsheets.fileId, fileIds)),
      db.select({ id: forms.id, fileId: forms.fileId }).from(forms).where(inArray(forms.fileId, fileIds)),
    ]);
    for (const r of [...d, ...s, ...f]) out.set(r.fileId, r.id);
    return out;
  },

  async versions(db: Executor, fileId: string): Promise<FileVersionRow[]> {
    return db.select().from(fileVersions).where(eq(fileVersions.fileId, fileId)).orderBy(fileVersions.versionNumber);
  },

  async nextVersionNumber(db: Executor, fileId: string): Promise<number> {
    const [row] = await db.select({ n: max(fileVersions.versionNumber) }).from(fileVersions).where(eq(fileVersions.fileId, fileId));
    return (row?.n ?? 0) + 1;
  },

  async storageKeysForFiles(db: Executor, fileIds: string[]): Promise<string[]> {
    if (!fileIds.length) return [];
    const [current, versions] = await Promise.all([
      db.select({ key: driveFiles.storageKey }).from(driveFiles).where(inArray(driveFiles.id, fileIds)),
      db.select({ key: fileVersions.storageKey }).from(fileVersions).where(inArray(fileVersions.fileId, fileIds)),
    ]);
    return [...current, ...versions].map((r) => r.key).filter((k): k is string => !!k);
  },
};
