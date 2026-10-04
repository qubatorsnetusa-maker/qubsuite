import { desc, eq, max } from 'drizzle-orm';
import type { Executor } from '../../db';
import { documents, documentVersions, driveFiles } from '../../db/schema';

export type DocumentRow = typeof documents.$inferSelect;

export const DocumentRepository = {
  async findById(db: Executor, id: string) {
    const [row] = await db
      .select({ doc: documents, file: driveFiles })
      .from(documents)
      .innerJoin(driveFiles, eq(driveFiles.id, documents.fileId))
      .where(eq(documents.id, id))
      .limit(1);
    return row;
  },

  async findByFileId(db: Executor, fileId: string): Promise<DocumentRow | undefined> {
    const [row] = await db.select().from(documents).where(eq(documents.fileId, fileId)).limit(1);
    return row;
  },

  async latestVersion(db: Executor, documentId: string) {
    const [row] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber))
      .limit(1);
    return row;
  },

  async nextVersionNumber(db: Executor, documentId: string): Promise<number> {
    const [row] = await db.select({ n: max(documentVersions.versionNumber) }).from(documentVersions).where(eq(documentVersions.documentId, documentId));
    return (row?.n ?? 0) + 1;
  },
};
