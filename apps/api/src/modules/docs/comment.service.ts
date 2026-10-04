import type { CommentDto, CreateCommentInput, CreateSuggestionInput, SuggestionDto, UpdateCommentInput } from '@qub/shared';
import { createCommentSchema, updateCommentSchema } from '@qub/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db';
import { documentCommentReplies, documentComments, documentSuggestions } from '../../db/schema';
import { forbidden, notFound } from '../../utils/errors';
import type { ActivityService } from '../activity/activity.service';
import type { NotificationService, NotifyInput } from '../notifications/notification.service';
import type { SharingService } from '../sharing/sharing.service';
import { UserRepository } from '../users/user.repository';
import type { DocumentService } from './document.service';

type CommentRow = typeof documentComments.$inferSelect;
type ReplyRow = typeof documentCommentReplies.$inferSelect;

/** Realtime fan-out so open editors refresh their comment threads. */
export interface CommentBroadcaster {
  commentsChanged(documentId: string): void;
}

/**
 * Comment threads anchored to ranges of a real document. The anchor position lives in the collaborative
 * Yjs document; the thread content, authorship and resolution state live here.
 */
export class CommentService {
  private broadcaster: CommentBroadcaster | null = null;

  constructor(
    private readonly db: Database,
    private readonly docs: DocumentService,
    private readonly sharing: SharingService,
    private readonly notifications: NotificationService,
    private readonly activity: ActivityService,
  ) {}

  attachBroadcaster(b: CommentBroadcaster): void {
    this.broadcaster = b;
  }

  async list(userId: string, documentId: string): Promise<CommentDto[]> {
    await this.docs.access(userId, documentId, 'VIEWER');
    const comments = await this.db.select().from(documentComments).where(eq(documentComments.documentId, documentId)).orderBy(asc(documentComments.createdAt));
    const replies = comments.length
      ? await this.db
          .select()
          .from(documentCommentReplies)
          .where(inArray(documentCommentReplies.commentId, comments.map((c) => c.id)))
          .orderBy(asc(documentCommentReplies.createdAt))
      : [];
    return this.toDtos(comments, replies);
  }

  private async toDtos(comments: CommentRow[], replies: ReplyRow[]): Promise<CommentDto[]> {
    const users = await UserRepository.summaries(this.db, [
      ...comments.map((c) => c.authorId),
      ...comments.map((c) => c.resolvedBy!).filter(Boolean),
      ...replies.map((r) => r.authorId),
    ]);
    const deleted = { id: '', email: '', name: 'Deleted user', avatarUrl: null };
    return comments.map((c) => ({
      id: c.id,
      anchorId: c.anchorId,
      quotedText: c.quotedText,
      body: c.body,
      mentions: c.mentionedUserIds,
      author: users.get(c.authorId) ?? deleted,
      resolved: c.resolved,
      resolvedBy: c.resolvedBy ? (users.get(c.resolvedBy) ?? null) : null,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      editedAt: c.editedAt?.toISOString() ?? null,
      replies: replies
        .filter((r) => r.commentId === c.id)
        .map((r) => ({
          id: r.id,
          author: users.get(r.authorId) ?? deleted,
          body: r.body,
          mentions: r.mentionedUserIds,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          editedAt: r.editedAt?.toISOString() ?? null,
        })),
    }));
  }

  /** Only users who can actually open the document may be mentioned. */
  private async validMentions(fileId: string, ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    const allowed = new Set(await this.sharing.usersWithAccess(fileId));
    return [...new Set(ids)].filter((id) => allowed.has(id));
  }

  async create(userId: string, documentId: string, raw: CreateCommentInput): Promise<CommentDto> {
    const input = createCommentSchema.parse(raw);
    const { file } = await this.docs.access(userId, documentId, 'COMMENTER');
    const mentions = await this.validMentions(file.id, input.mentions);
    const [row] = await this.db
      .insert(documentComments)
      .values({ documentId, authorId: userId, anchorId: input.anchorId, quotedText: input.quotedText, body: input.body, mentionedUserIds: mentions })
      .returning();
    await this.activity.record({ userId, action: 'COMMENT_ADDED', resourceType: 'FILE', resourceId: file.id, resourceName: file.name, metadata: { commentId: row!.id } });

    const actor = await UserRepository.findById(this.db, userId);
    const link = `/docs/${documentId}?comment=${row!.id}`;
    const notes: NotifyInput[] = mentions.map((id) => ({
      userId: id,
      actorId: userId,
      type: 'MENTIONED',
      title: `${actor?.name} mentioned you in a comment on "${file.name}"`,
      body: input.body.slice(0, 280),
      link,
      resourceType: 'FILE',
      resourceId: file.id,
    }));
    if (file.ownerId !== userId && !mentions.includes(file.ownerId)) {
      notes.push({ userId: file.ownerId, actorId: userId, type: 'COMMENTED', title: `${actor?.name} commented on "${file.name}"`, body: input.body.slice(0, 280), link, resourceType: 'FILE', resourceId: file.id });
    }
    await this.notifications.notify(notes);
    this.broadcaster?.commentsChanged(documentId);
    return (await this.toDtos([row!], []))[0]!;
  }

  private async loadComment(documentId: string, commentId: string): Promise<CommentRow> {
    const [row] = await this.db
      .select()
      .from(documentComments)
      .where(and(eq(documentComments.id, commentId), eq(documentComments.documentId, documentId)))
      .limit(1);
    if (!row) throw notFound('comment');
    return row;
  }

  async update(userId: string, documentId: string, commentId: string, raw: UpdateCommentInput): Promise<void> {
    const input = updateCommentSchema.parse(raw);
    const { file } = await this.docs.access(userId, documentId, 'COMMENTER');
    const comment = await this.loadComment(documentId, commentId);
    if (comment.authorId !== userId) throw forbidden('Only the author can edit this comment.');
    const mentions = await this.validMentions(file.id, input.mentions);
    await this.db.update(documentComments).set({ body: input.body, mentionedUserIds: mentions, editedAt: new Date() }).where(eq(documentComments.id, commentId));
    await this.notifyNewMentions(userId, file, documentId, commentId, mentions.filter((m) => !comment.mentionedUserIds.includes(m)), input.body);
    this.broadcaster?.commentsChanged(documentId);
  }

  async setResolved(userId: string, documentId: string, commentId: string, resolved: boolean): Promise<void> {
    await this.docs.access(userId, documentId, 'COMMENTER');
    await this.loadComment(documentId, commentId);
    await this.db
      .update(documentComments)
      .set(resolved ? { resolved: true, resolvedBy: userId, resolvedAt: new Date() } : { resolved: false, resolvedBy: null, resolvedAt: null })
      .where(eq(documentComments.id, commentId));
    this.broadcaster?.commentsChanged(documentId);
  }

  /** Authors can delete their comments; editors can delete any comment. */
  async remove(userId: string, documentId: string, commentId: string): Promise<void> {
    const { access } = await this.docs.access(userId, documentId, 'COMMENTER');
    const comment = await this.loadComment(documentId, commentId);
    if (comment.authorId !== userId && access.role !== 'EDITOR' && access.role !== 'OWNER') throw forbidden();
    await this.db.delete(documentComments).where(eq(documentComments.id, commentId));
    this.broadcaster?.commentsChanged(documentId);
  }

  async reply(userId: string, documentId: string, commentId: string, raw: UpdateCommentInput): Promise<void> {
    const input = updateCommentSchema.parse(raw);
    const { file } = await this.docs.access(userId, documentId, 'COMMENTER');
    const comment = await this.loadComment(documentId, commentId);
    const mentions = await this.validMentions(file.id, input.mentions);
    await this.db.insert(documentCommentReplies).values({ commentId, authorId: userId, body: input.body, mentionedUserIds: mentions });
    // Replying reopens a resolved thread, as in Google Docs.
    if (comment.resolved) await this.db.update(documentComments).set({ resolved: false, resolvedBy: null, resolvedAt: null }).where(eq(documentComments.id, commentId));

    const participants = new Set([comment.authorId, ...(await this.db.select({ a: documentCommentReplies.authorId }).from(documentCommentReplies).where(eq(documentCommentReplies.commentId, commentId))).map((r) => r.a)]);
    participants.delete(userId);
    for (const m of mentions) participants.delete(m);
    const actor = await UserRepository.findById(this.db, userId);
    await this.notifications.notify(
      [...participants].map((id) => ({
        userId: id,
        actorId: userId,
        type: 'COMMENT_REPLIED' as const,
        title: `${actor?.name} replied to a comment on "${file.name}"`,
        body: input.body.slice(0, 280),
        link: `/docs/${documentId}?comment=${commentId}`,
        resourceType: 'FILE',
        resourceId: file.id,
      })),
    );
    await this.notifyNewMentions(userId, file, documentId, commentId, mentions, input.body);
    this.broadcaster?.commentsChanged(documentId);
  }

  async updateReply(userId: string, documentId: string, commentId: string, replyId: string, raw: UpdateCommentInput): Promise<void> {
    const input = updateCommentSchema.parse(raw);
    const { file } = await this.docs.access(userId, documentId, 'COMMENTER');
    await this.loadComment(documentId, commentId);
    const [reply] = await this.db
      .select()
      .from(documentCommentReplies)
      .where(and(eq(documentCommentReplies.id, replyId), eq(documentCommentReplies.commentId, commentId)))
      .limit(1);
    if (!reply) throw notFound('reply');
    if (reply.authorId !== userId) throw forbidden('Only the author can edit this reply.');
    const mentions = await this.validMentions(file.id, input.mentions);
    await this.db.update(documentCommentReplies).set({ body: input.body, mentionedUserIds: mentions, editedAt: new Date() }).where(eq(documentCommentReplies.id, replyId));
    this.broadcaster?.commentsChanged(documentId);
  }

  async removeReply(userId: string, documentId: string, commentId: string, replyId: string): Promise<void> {
    const { access } = await this.docs.access(userId, documentId, 'COMMENTER');
    await this.loadComment(documentId, commentId);
    const [reply] = await this.db
      .select()
      .from(documentCommentReplies)
      .where(and(eq(documentCommentReplies.id, replyId), eq(documentCommentReplies.commentId, commentId)))
      .limit(1);
    if (!reply) throw notFound('reply');
    if (reply.authorId !== userId && access.role !== 'EDITOR' && access.role !== 'OWNER') throw forbidden();
    await this.db.delete(documentCommentReplies).where(eq(documentCommentReplies.id, replyId));
    this.broadcaster?.commentsChanged(documentId);
  }

  private async notifyNewMentions(userId: string, file: { id: string; name: string }, documentId: string, commentId: string, ids: string[], body: string) {
    if (!ids.length) return;
    const actor = await UserRepository.findById(this.db, userId);
    await this.notifications.notify(
      ids.map((id) => ({
        userId: id,
        actorId: userId,
        type: 'MENTIONED' as const,
        title: `${actor?.name} mentioned you in a comment on "${file.name}"`,
        body: body.slice(0, 280),
        link: `/docs/${documentId}?comment=${commentId}`,
        resourceType: 'FILE',
        resourceId: file.id,
      })),
    );
  }

  // ---------- suggestions ----------

  async listSuggestions(userId: string, documentId: string): Promise<SuggestionDto[]> {
    await this.docs.access(userId, documentId, 'VIEWER');
    const rows = await this.db.select().from(documentSuggestions).where(eq(documentSuggestions.documentId, documentId)).orderBy(asc(documentSuggestions.createdAt));
    const users = await UserRepository.summaries(this.db, [...rows.map((r) => r.authorId), ...rows.map((r) => r.resolvedBy!).filter(Boolean)]);
    return rows.map((r) => ({
      id: r.id,
      anchorId: r.anchorId,
      originalText: r.originalText,
      suggestedText: r.suggestedText,
      status: r.status,
      author: users.get(r.authorId)!,
      resolvedBy: r.resolvedBy ? (users.get(r.resolvedBy) ?? null) : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createSuggestion(userId: string, documentId: string, input: CreateSuggestionInput): Promise<void> {
    const { file } = await this.docs.access(userId, documentId, 'COMMENTER');
    await this.db.insert(documentSuggestions).values({ documentId, authorId: userId, ...input });
    if (file.ownerId !== userId) {
      const actor = await UserRepository.findById(this.db, userId);
      await this.notifications.notify([
        { userId: file.ownerId, actorId: userId, type: 'COMMENTED', title: `${actor?.name} suggested an edit in "${file.name}"`, body: input.suggestedText.slice(0, 280), link: `/docs/${documentId}`, resourceType: 'FILE', resourceId: file.id },
      ]);
    }
    this.broadcaster?.commentsChanged(documentId);
  }

  /**
   * Accepting requires edit access. The text replacement itself is applied by the accepting editor's client inside the
   * collaborative document (so it merges with concurrent edits); the server records the decision.
   */
  async resolveSuggestion(userId: string, documentId: string, suggestionId: string, status: 'ACCEPTED' | 'REJECTED'): Promise<void> {
    const { access } = await this.docs.access(userId, documentId, 'COMMENTER');
    const [row] = await this.db
      .select()
      .from(documentSuggestions)
      .where(and(eq(documentSuggestions.id, suggestionId), eq(documentSuggestions.documentId, documentId)))
      .limit(1);
    if (!row) throw notFound('suggestion');
    const isEditor = access.role === 'EDITOR' || access.role === 'OWNER';
    // Authors may withdraw their own suggestion; only editors may accept.
    if (status === 'ACCEPTED' ? !isEditor : !isEditor && row.authorId !== userId) throw forbidden();
    await this.db.update(documentSuggestions).set({ status, resolvedBy: userId, resolvedAt: new Date() }).where(eq(documentSuggestions.id, suggestionId));
    this.broadcaster?.commentsChanged(documentId);
  }
}
