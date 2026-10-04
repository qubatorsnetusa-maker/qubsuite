import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { bytea, createdAt, tsvector, updatedAt } from './_types';
import { driveFiles } from './drive.schema';
import { suggestionStatusEnum } from './enums';
import { users } from './users.schema';

/**
 * A Qub document. The title is the Drive file name (no duplication).
 * `content` is the canonical Tiptap JSON; `ydoc_state` is the Yjs update used to seed collaboration rooms.
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => driveFiles.id, { onDelete: 'cascade' }),
    content: jsonb('content').notNull(),
    ydocState: bytea('ydoc_state'),
    plainText: text('plain_text').notNull().default(''),
    wordCount: integer('word_count').notNull().default(0),
    searchVector: tsvector('search_vector').generatedAlwaysAs(sql`to_tsvector('simple', coalesce(plain_text, ''))`),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    lastEditedBy: uuid('last_edited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('documents_file_id_unique').on(t.fileId), index('documents_search_idx').using('gin', t.searchVector)],
);

export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    name: text('name'),
    content: jsonb('content').notNull(),
    ydocState: bytea('ydoc_state'),
    wordCount: integer('word_count').notNull().default(0),
    isAuto: boolean('is_auto').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('document_versions_doc_version_unique').on(t.documentId, t.versionNumber),
    index('document_versions_doc_created_idx').on(t.documentId, t.createdAt),
  ],
);

/** People who have participated in a document (presence color, last seen). Access itself comes from Drive permissions. */
export const documentCollaborators = pgTable(
  'document_collaborators',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    color: text('color').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.userId] })],
);

export const documentComments = pgTable(
  'document_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    anchorId: text('anchor_id').notNull(),
    quotedText: text('quoted_text').notNull().default(''),
    body: text('body').notNull(),
    mentionedUserIds: uuid('mentioned_user_ids').array().notNull().default(sql`'{}'::uuid[]`),
    resolved: boolean('resolved').notNull().default(false),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('document_comments_document_idx').on(t.documentId, t.createdAt),
    check('document_comments_body_length', sql`char_length(${t.body}) between 1 and 10000`),
  ],
);

export const documentCommentReplies = pgTable(
  'document_comment_replies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => documentComments.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    mentionedUserIds: uuid('mentioned_user_ids').array().notNull().default(sql`'{}'::uuid[]`),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('document_comment_replies_comment_idx').on(t.commentId, t.createdAt),
    check('document_comment_replies_body_length', sql`char_length(${t.body}) between 1 and 10000`),
  ],
);

/** Images uploaded into a document. Bytes live in object storage; access follows the document's permissions. */
export const documentAssets = pgTable(
  'document_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    checksum: text('checksum').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('document_assets_document_idx').on(t.documentId)],
);

export const documentSuggestions = pgTable(
  'document_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    anchorId: text('anchor_id').notNull(),
    originalText: text('original_text').notNull(),
    suggestedText: text('suggested_text').notNull(),
    status: suggestionStatusEnum('status').notNull().default('PENDING'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('document_suggestions_document_idx').on(t.documentId, t.status)],
);
