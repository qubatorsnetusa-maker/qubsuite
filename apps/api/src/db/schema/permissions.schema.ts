import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './_types';
import { driveFiles, driveFolders } from './drive.schema';
import { grantSourceEnum, resourceTypeEnum, roleEnum } from './enums';
import { users } from './users.schema';

const grantColumns = {
  role: roleEnum('role').notNull(),
  canShare: boolean('can_share').notNull().default(false),
  canDownload: boolean('can_download').notNull().default(true),
  canCopy: boolean('can_copy').notNull().default(true),
  source: grantSourceEnum('source').notNull().default('DIRECT'),
};

export const filePermissions = pgTable(
  'file_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => driveFiles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...grantColumns,
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('file_permissions_file_user_unique').on(t.fileId, t.userId),
    index('file_permissions_file_id_idx').on(t.fileId),
    index('file_permissions_user_id_idx').on(t.userId),
    // The owner is drive_files.owner_id; grants are never OWNER.
    check('file_permissions_not_owner', sql`${t.role} <> 'OWNER'`),
  ],
);

export const folderPermissions = pgTable(
  'folder_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    folderId: uuid('folder_id')
      .notNull()
      .references(() => driveFolders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...grantColumns,
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('folder_permissions_folder_user_unique').on(t.folderId, t.userId),
    index('folder_permissions_folder_id_idx').on(t.folderId),
    index('folder_permissions_user_id_idx').on(t.userId),
    check('folder_permissions_not_owner', sql`${t.role} <> 'OWNER'`),
  ],
);

/** Shares addressed to an email that has no account yet; converted into permissions on registration. */
export const fileShares = pgTable(
  'file_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceType: resourceTypeEnum('resource_type').notNull(),
    fileId: uuid('file_id').references(() => driveFiles.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => driveFolders.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    ...grantColumns,
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('file_shares_email_idx').on(t.email),
    uniqueIndex('file_shares_file_email_unique').on(t.fileId, t.email).where(sql`${t.fileId} is not null and ${t.acceptedAt} is null`),
    uniqueIndex('file_shares_folder_email_unique').on(t.folderId, t.email).where(sql`${t.folderId} is not null and ${t.acceptedAt} is null`),
    check(
      'file_shares_target_matches_type',
      sql`(${t.resourceType} = 'FILE' and ${t.fileId} is not null and ${t.folderId} is null) or (${t.resourceType} = 'FOLDER' and ${t.folderId} is not null and ${t.fileId} is null)`,
    ),
    check('file_shares_not_owner', sql`${t.role} <> 'OWNER'`),
  ],
);

/** "Anyone with the link" access. Tokens are random, never database ids. */
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceType: resourceTypeEnum('resource_type').notNull(),
    fileId: uuid('file_id').references(() => driveFiles.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => driveFolders.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    permission: roleEnum('permission').notNull().default('VIEWER'),
    passwordHash: text('password_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('share_links_token_unique').on(t.token),
    uniqueIndex('share_links_active_file_unique').on(t.fileId).where(sql`${t.fileId} is not null and ${t.revokedAt} is null`),
    uniqueIndex('share_links_active_folder_unique').on(t.folderId).where(sql`${t.folderId} is not null and ${t.revokedAt} is null`),
    check(
      'share_links_target_matches_type',
      sql`(${t.resourceType} = 'FILE' and ${t.fileId} is not null and ${t.folderId} is null) or (${t.resourceType} = 'FOLDER' and ${t.folderId} is not null and ${t.fileId} is null)`,
    ),
    check('share_links_not_owner', sql`${t.permission} <> 'OWNER'`),
    check('share_links_token_length', sql`char_length(${t.token}) >= 32`),
  ],
);
