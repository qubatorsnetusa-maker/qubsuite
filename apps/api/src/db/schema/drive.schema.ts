import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './_types';
import { fileTypeEnum, generalAccessEnum } from './enums';
import { users } from './users.schema';

/**
 * Folders form a tree through parent_id. Every user has exactly one root folder ("My Drive").
 * Trash keeps parent_id so a restore returns items to their original location.
 * `trashed_by_parent` marks descendants hidden because an ancestor folder was trashed.
 */
export const driveFolders = pgTable(
  'drive_folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => driveFolders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isRoot: boolean('is_root').notNull().default(false),
    isTrashed: boolean('is_trashed').notNull().default(false),
    trashedAt: timestamp('trashed_at', { withTimezone: true }),
    trashedByParent: boolean('trashed_by_parent').notNull().default(false),
    generalAccess: generalAccessEnum('general_access').notNull().default('RESTRICTED'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('drive_folders_owner_id_idx').on(t.ownerId),
    index('drive_folders_parent_id_idx').on(t.parentId),
    index('drive_folders_parent_trashed_name_idx').on(t.parentId, t.isTrashed, t.name),
    index('drive_folders_owner_trashed_idx').on(t.ownerId, t.isTrashed, t.trashedAt),
    index('drive_folders_name_trgm_idx').using('gin', sql`lower(${t.name}) gin_trgm_ops`),
    uniqueIndex('drive_folders_one_root_per_owner').on(t.ownerId).where(sql`${t.isRoot}`),
    check('drive_folders_root_shape', sql`(${t.isRoot} and ${t.parentId} is null) or (not ${t.isRoot} and ${t.parentId} is not null)`),
    check('drive_folders_not_own_parent', sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
    check('drive_folders_name_length', sql`char_length(${t.name}) between 1 and 255`),
    check('drive_folders_trash_consistency', sql`(${t.isTrashed} and ${t.trashedAt} is not null) or (not ${t.isTrashed} and not ${t.trashedByParent})`),
  ],
);

export const driveFiles = pgTable(
  'drive_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id')
      .notNull()
      .references(() => driveFolders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileType: fileTypeEnum('file_type').notNull(),
    size: bigint('size', { mode: 'number' }).notNull().default(0),
    storageKey: text('storage_key'),
    checksum: text('checksum'),
    description: text('description'),
    currentVersion: integer('current_version').notNull().default(1),
    isTrashed: boolean('is_trashed').notNull().default(false),
    trashedAt: timestamp('trashed_at', { withTimezone: true }),
    trashedByParent: boolean('trashed_by_parent').notNull().default(false),
    generalAccess: generalAccessEnum('general_access').notNull().default('RESTRICTED'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('drive_files_owner_id_idx').on(t.ownerId),
    index('drive_files_folder_id_idx').on(t.folderId),
    index('drive_files_is_trashed_idx').on(t.isTrashed),
    index('drive_files_updated_at_idx').on(t.updatedAt),
    index('drive_files_folder_trashed_name_idx').on(t.folderId, t.isTrashed, t.name),
    index('drive_files_owner_trashed_updated_idx').on(t.ownerId, t.isTrashed, t.updatedAt),
    index('drive_files_mime_type_idx').on(t.mimeType),
    index('drive_files_name_trgm_idx').using('gin', sql`lower(${t.name}) gin_trgm_ops`),
    check('drive_files_size_non_negative', sql`${t.size} >= 0`),
    check('drive_files_name_length', sql`char_length(${t.name}) between 1 and 255`),
    check(
      'drive_files_blob_has_storage',
      sql`${t.fileType} in ('DOCUMENT', 'SPREADSHEET', 'FORM') or ${t.storageKey} is not null`,
    ),
    check('drive_files_trash_consistency', sql`(${t.isTrashed} and ${t.trashedAt} is not null) or (not ${t.isTrashed} and not ${t.trashedByParent})`),
  ],
);

export const fileVersions = pgTable(
  'file_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => driveFiles.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    checksum: text('checksum').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('file_versions_file_version_unique').on(t.fileId, t.versionNumber),
    check('file_versions_number_positive', sql`${t.versionNumber} > 0`),
  ],
);

/** Per-user stars, so collaborators can star shared items independently. */
export const stars = pgTable(
  'stars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id').references(() => driveFiles.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => driveFolders.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('stars_user_file_unique').on(t.userId, t.fileId).where(sql`${t.fileId} is not null`),
    uniqueIndex('stars_user_folder_unique').on(t.userId, t.folderId).where(sql`${t.folderId} is not null`),
    check('stars_exactly_one_target', sql`num_nonnulls(${t.fileId}, ${t.folderId}) = 1`),
  ],
);

/**
 * Items someone shared with a user that the user moved to Spam. They're hidden from every view except Spam, and the
 * user's access is removed when they delete them (or automatically after 30 days).
 */
export const spamItems = pgTable(
  'spam_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id').references(() => driveFiles.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => driveFolders.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('spam_user_file_unique').on(t.userId, t.fileId).where(sql`${t.fileId} is not null`),
    uniqueIndex('spam_user_folder_unique').on(t.userId, t.folderId).where(sql`${t.folderId} is not null`),
    index('spam_created_idx').on(t.createdAt),
    check('spam_exactly_one_target', sql`num_nonnulls(${t.fileId}, ${t.folderId}) = 1`),
  ],
);

/** People a user has blocked: they can't share with the user or notify them. */
export const userBlocks = pgTable(
  'user_blocks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedUserId: uuid('blocked_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.blockedUserId] }), index('user_blocks_blocked_idx').on(t.blockedUserId), check('user_blocks_not_self', sql`${t.userId} <> ${t.blockedUserId}`)],
);
