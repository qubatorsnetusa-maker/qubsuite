import type { CollaboratorDto, CreateDocumentInput, DocumentDto, DocumentVersionDto, Role } from '@qub/shared';
import { presenceColor } from '@qub/shared';
import { findTemplate } from '@qub/shared/templates';
import { countWords, documentExtensions, EMPTY_DOCUMENT, extractMentions, extractPlainText, type JSONContent } from '@qub/editor-schema';
import { getSchema } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { prosemirrorJSONToYDoc } from '@tiptap/y-tiptap';
import type { Readable } from 'node:stream';
import { and, desc, eq, inArray } from 'drizzle-orm';
import * as Y from 'yjs';
import type { Database, Executor } from '../../db';
import { documentAssets, documentCollaborators, documents, documentVersions, driveFiles } from '../../db/schema';
import type { StorageService } from '../../services/storage';
import { AppError, badRequest, notFound } from '../../utils/errors';
import type { NativeResourceRegistry } from '../drive/native-registry';
import type { UsageService } from '../admin/usage.service';
import type { FileService } from '../files/file.service';
import type { NotificationService } from '../notifications/notification.service';
import { toCapabilities, type Access, type PermissionService } from '../permissions/permission.service';
import type { SharingService } from '../sharing/sharing.service';
import { UserRepository } from '../users/user.repository';
import { DocumentRepository } from './document.repository';

/** Name of the Y.XmlFragment that holds the document body (Tiptap's Collaboration default). */
export const DOC_FRAGMENT = 'default';
/** Automatic versions are captured at most this often while a document is being edited. */
const AUTO_VERSION_INTERVAL_MS = 30 * 60 * 1000;

/** Lets the service push restored content into a live collaboration room. */
export interface LiveDocumentRooms {
  replaceContent(documentId: string, content: JSONContent): Promise<boolean>;
  flush(documentId: string): Promise<void>;
}

export class DocumentService {
  readonly schema: Schema = getSchema(documentExtensions({ collaborative: true }));
  private rooms: LiveDocumentRooms | null = null;

  constructor(
    private readonly db: Database,
    private readonly files: FileService,
    private readonly permissions: PermissionService,
    private readonly notifications: NotificationService,
    private readonly sharing: SharingService,
    private readonly storage: StorageService,
    natives: NativeResourceRegistry,
    private readonly usage: UsageService,
  ) {
    natives.register('DOCUMENT', {
      copy: async (tx, sourceFileId, targetFileId, userId) => {
        const source = await DocumentRepository.findByFileId(tx, sourceFileId);
        if (!source) return;
        const [copy] = await tx
          .insert(documents)
          .values({
            fileId: targetFileId,
            content: source.content,
            ydocState: source.ydocState,
            plainText: source.plainText,
            wordCount: source.wordCount,
            createdBy: userId,
            lastEditedBy: userId,
          })
          .returning();
        // Images are shared by reference: the copy gets its own asset rows pointing at copied objects.
        const assets = await tx.select().from(documentAssets).where(eq(documentAssets.documentId, source.id));
        let content = JSON.stringify(source.content);
        for (const a of assets) {
          const key = this.storage.newKey('files', userId);
          await this.storage.copy(a.storageKey, key);
          const [created] = await tx
            .insert(documentAssets)
            .values({ documentId: copy!.id, storageKey: key, mimeType: a.mimeType, size: a.size, checksum: a.checksum, createdBy: userId })
            .returning();
          content = content.replaceAll(`/api/docs/${source.id}/assets/${a.id}`, `/api/docs/${copy!.id}/assets/${created!.id}`);
        }
        if (assets.length) {
          const json = JSON.parse(content) as JSONContent;
          await tx.update(documents).set({ content: json, ydocState: this.encodeContent(json) }).where(eq(documents.id, copy!.id));
        }
      },
      storageKeys: async (tx, fileIds) => {
        const rows = await tx
          .select({ key: documentAssets.storageKey })
          .from(documentAssets)
          .innerJoin(documents, eq(documents.id, documentAssets.documentId))
          .where(inArray(documents.fileId, fileIds));
        return rows.map((r) => r.key);
      },
    });
  }

  /** Stores an image for the document. Only images are accepted (sniffed server-side). */
  async uploadAsset(userId: string, documentId: string, source: { stream: Readable; filename: string }) {
    const { file } = await this.access(userId, documentId, 'EDITOR');
    const key = this.storage.newKey('files', userId);
    // Images count toward the document owner's storage.
    const budget = await this.usage.uploadBudget(file.ownerId, 20 * 1024 * 1024, file.ownerId === userId ? 'self' : 'owner');
    const stored = await this.storage.ingest(source.stream, { filename: source.filename, key, ...budget });
    if (!stored.mimeType.startsWith('image/') || stored.mimeType === 'image/svg+xml') {
      await this.storage.safeDelete(stored.key);
      throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Only PNG, JPEG, GIF, WebP or AVIF images can be inserted.');
    }
    const [asset] = await this.db
      .insert(documentAssets)
      .values({ documentId, storageKey: stored.key, mimeType: stored.mimeType, size: stored.size, checksum: stored.checksum, createdBy: userId })
      .returning();
    return { id: asset!.id, url: `/api/docs/${documentId}/assets/${asset!.id}` };
  }

  async assetForDownload(userId: string, documentId: string, assetId: string) {
    await this.access(userId, documentId, 'VIEWER');
    const [asset] = await this.db
      .select()
      .from(documentAssets)
      .where(and(eq(documentAssets.id, assetId), eq(documentAssets.documentId, documentId)))
      .limit(1);
    if (!asset) throw notFound('image');
    return asset;
  }

  attachRooms(rooms: LiveDocumentRooms): void {
    this.rooms = rooms;
  }

  encodeContent(content: JSONContent): Buffer {
    const ydoc = prosemirrorJSONToYDoc(this.schema, content, DOC_FRAGMENT);
    return Buffer.from(Y.encodeStateAsUpdate(ydoc));
  }

  /** Validates arbitrary JSON against the document schema (throws on invalid content). */
  normalizeContent(content: unknown): JSONContent {
    return this.schema.nodeFromJSON(content).toJSON() as JSONContent;
  }

  /**
   * The Docs creation flow: authenticate (route) → resolve My Drive → create drive_files (DOCUMENT)
   * → create documents referencing it → activity log → return. One transaction; any failure rolls back.
   */
  async create(userId: string, input: CreateDocumentInput, content?: JSONContent, tx?: Executor): Promise<DocumentDto> {
    let title = input.title;
    let initial = content ?? EMPTY_DOCUMENT;
    if (input.templateId) {
      const template = findTemplate('DOCUMENT', input.templateId);
      if (!template) throw badRequest('That template doesn’t exist.');
      title ??= template.name;
      initial = template.content as JSONContent;
    }
    const run = async (t: Executor) => {
      const file = await this.files.createNative(t, userId, 'DOCUMENT', title ?? 'Untitled document', input.folderId);
      const normalized = this.normalizeContent(initial);
      const text = extractPlainText(normalized);
      const [doc] = await t
        .insert(documents)
        .values({
          fileId: file.id,
          content: normalized,
          ydocState: this.encodeContent(normalized),
          plainText: text,
          wordCount: countWords(text),
          createdBy: userId,
          lastEditedBy: userId,
        })
        .returning();
      return doc!;
    };
    const doc = tx ? await run(tx) : await this.db.transaction(run);
    return this.get(userId, doc.id, { recordOpen: false }, tx);
  }

  /** Resolves a document and the caller's access via its Drive file. */
  async access(userId: string, documentId: string, requirement: Role = 'VIEWER', tx: Executor = this.db) {
    const row = await DocumentRepository.findById(tx, documentId);
    if (!row) throw notFound('document');
    const access = await this.permissions.requireFile(userId, row.file.id, requirement, tx);
    return { ...row, access };
  }

  async get(userId: string, documentId: string, opts: { recordOpen?: boolean } = {}, tx: Executor = this.db): Promise<DocumentDto> {
    const { doc, file, access } = await this.access(userId, documentId, 'VIEWER', tx);
    if (opts.recordOpen !== false) await this.files.recordOpened(userId, file);
    return this.toDto(doc, file, access, tx);
  }

  private async toDto(doc: typeof documents.$inferSelect, file: typeof driveFiles.$inferSelect, access: Access, tx: Executor = this.db): Promise<DocumentDto> {
    const owners = await UserRepository.summaries(tx, [file.ownerId]);
    return {
      id: doc.id,
      fileId: file.id,
      title: file.name,
      folderId: file.folderId,
      owner: owners.get(file.ownerId)!,
      content: doc.content,
      isTrashed: file.isTrashed,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      capabilities: toCapabilities(access),
    };
  }

  async rename(userId: string, documentId: string, title: string): Promise<DocumentDto> {
    const { file } = await this.access(userId, documentId, 'EDITOR');
    await this.files.update(userId, file.id, { name: title });
    return this.get(userId, documentId, { recordOpen: false });
  }

  async trash(userId: string, documentId: string): Promise<void> {
    const { file } = await this.access(userId, documentId);
    await this.files.trash(userId, file.id);
  }

  // ---------- collaboration persistence ----------

  /** Initial Yjs state for a room: the stored update, or one built from the canonical JSON. */
  async loadState(documentId: string): Promise<{ state: Uint8Array; fileId: string }> {
    const row = await DocumentRepository.findById(this.db, documentId);
    if (!row) throw notFound('document');
    const state = row.doc.ydocState ?? this.encodeContent(row.doc.content as JSONContent);
    return { state: new Uint8Array(state), fileId: row.file.id };
  }

  /**
   * Called (debounced) by the collaboration room. Stores Yjs state and the derived Tiptap JSON, updates search text,
   * records edit activity, snapshots automatic versions and notifies newly mentioned users.
   */
  async persistFromCollaboration(documentId: string, input: { state: Uint8Array; content: JSONContent; editorIds: string[] }): Promise<Date> {
    const text = extractPlainText(input.content);
    const lastEditor = input.editorIds.at(-1) ?? null;
    const savedAt = new Date();
    const newMentions: string[] = [];
    let meta: { fileId: string; name: string } | null = null;
    await this.db.transaction(async (tx) => {
      const row = await DocumentRepository.findById(tx, documentId);
      if (!row) throw notFound('document');
      meta = { fileId: row.file.id, name: row.file.name };
      const before = extractMentions(row.doc.content as JSONContent);
      for (const id of extractMentions(input.content)) if (!before.has(id)) newMentions.push(id);

      await tx
        .update(documents)
        .set({
          content: input.content,
          ydocState: Buffer.from(input.state),
          plainText: text,
          wordCount: countWords(text),
          lastEditedBy: lastEditor,
          updatedAt: savedAt,
        })
        .where(eq(documents.id, documentId));
      await tx.update(driveFiles).set({ updatedAt: savedAt, size: Buffer.byteLength(JSON.stringify(input.content)) }).where(eq(driveFiles.id, row.file.id));
      for (const editor of new Set(input.editorIds)) await this.files.recordEdited(editor, row.file, tx);

      const latest = await DocumentRepository.latestVersion(tx, documentId);
      if (!latest || savedAt.getTime() - latest.createdAt.getTime() > AUTO_VERSION_INTERVAL_MS) {
        await tx.insert(documentVersions).values({
          documentId,
          versionNumber: await DocumentRepository.nextVersionNumber(tx, documentId),
          content: input.content,
          ydocState: Buffer.from(input.state),
          wordCount: countWords(text),
          isAuto: true,
          createdBy: lastEditor,
        });
      }
    });

    if (newMentions.length && lastEditor && meta) {
      const m = meta as { fileId: string; name: string };
      const allowed = new Set(await this.sharing.usersWithAccess(m.fileId));
      const actor = await UserRepository.findById(this.db, lastEditor);
      await this.notifications.notify(
        newMentions
          .filter((id) => allowed.has(id))
          .map((id) => ({
            userId: id,
            actorId: lastEditor,
            type: 'MENTIONED' as const,
            title: `${actor?.name ?? 'Someone'} mentioned you in "${m.name}"`,
            link: `/docs/${documentId}`,
            resourceType: 'FILE',
            resourceId: m.fileId,
          })),
      );
    }
    return savedAt;
  }

  async touchCollaborator(documentId: string, userId: string): Promise<string> {
    const color = presenceColor(userId);
    await this.db
      .insert(documentCollaborators)
      .values({ documentId, userId, color })
      .onConflictDoUpdate({ target: [documentCollaborators.documentId, documentCollaborators.userId], set: { lastSeenAt: new Date() } });
    return color;
  }

  /** Everyone who can access the document (for @mentions and the share dialog). */
  async collaborators(userId: string, documentId: string): Promise<CollaboratorDto[]> {
    const { file } = await this.access(userId, documentId);
    const ids = await this.sharing.usersWithAccess(file.id);
    const users = await UserRepository.summaries(this.db, ids);
    const out: CollaboratorDto[] = [];
    for (const id of ids) {
      const a = await this.permissions.fileAccess(id, file.id);
      const u = users.get(id);
      if (a && u) out.push({ user: u, role: a.role, color: presenceColor(id) });
    }
    return out.sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  // ---------- versions ----------

  async listVersions(userId: string, documentId: string): Promise<DocumentVersionDto[]> {
    await this.access(userId, documentId, 'VIEWER');
    const rows = await this.db
      .select({
        id: documentVersions.id,
        versionNumber: documentVersions.versionNumber,
        name: documentVersions.name,
        createdBy: documentVersions.createdBy,
        createdAt: documentVersions.createdAt,
        wordCount: documentVersions.wordCount,
      })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber))
      .limit(200);
    const users = await UserRepository.summaries(this.db, rows.map((r) => r.createdBy!).filter(Boolean));
    return rows.map((r) => ({
      id: r.id,
      versionNumber: r.versionNumber,
      name: r.name,
      createdBy: r.createdBy ? (users.get(r.createdBy) ?? null) : null,
      createdAt: r.createdAt.toISOString(),
      wordCount: r.wordCount,
    }));
  }

  async getVersion(userId: string, documentId: string, versionId: string) {
    await this.access(userId, documentId, 'VIEWER');
    const [row] = await this.db
      .select()
      .from(documentVersions)
      .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, documentId)))
      .limit(1);
    if (!row) throw notFound('version');
    return { id: row.id, versionNumber: row.versionNumber, name: row.name, content: row.content, createdAt: row.createdAt.toISOString() };
  }

  /** Named snapshot of the current state (flushes the live room first so it includes unsaved edits). */
  async createVersion(userId: string, documentId: string, name?: string): Promise<DocumentVersionDto> {
    await this.access(userId, documentId, 'EDITOR');
    await this.rooms?.flush(documentId);
    const row = await DocumentRepository.findById(this.db, documentId);
    if (!row) throw notFound('document');
    const [version] = await this.db
      .insert(documentVersions)
      .values({
        documentId,
        versionNumber: await DocumentRepository.nextVersionNumber(this.db, documentId),
        name: name?.trim() || null,
        content: row.doc.content,
        ydocState: row.doc.ydocState,
        wordCount: row.doc.wordCount,
        isAuto: false,
        createdBy: userId,
      })
      .returning();
    return (await this.listVersions(userId, documentId)).find((v) => v.id === version!.id)!;
  }

  /**
   * Restores a version. If people are editing, the content is replaced inside the live Yjs document so every client
   * converges; otherwise the stored state is replaced directly. The current state is snapshotted first.
   */
  async restoreVersion(userId: string, documentId: string, versionId: string): Promise<DocumentDto> {
    await this.access(userId, documentId, 'EDITOR');
    const [version] = await this.db
      .select()
      .from(documentVersions)
      .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, documentId)))
      .limit(1);
    if (!version) throw notFound('version');
    await this.createVersion(userId, documentId, `Before restoring version ${version.versionNumber}`);
    const content = version.content as JSONContent;
    const live = (await this.rooms?.replaceContent(documentId, content)) ?? false;
    if (!live) {
      const text = extractPlainText(content);
      await this.db
        .update(documents)
        .set({ content, ydocState: this.encodeContent(content), plainText: text, wordCount: countWords(text), lastEditedBy: userId })
        .where(eq(documents.id, documentId));
    } else {
      await this.rooms?.flush(documentId);
    }
    return this.get(userId, documentId, { recordOpen: false });
  }
}
