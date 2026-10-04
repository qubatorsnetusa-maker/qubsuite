import { z } from 'zod';
import { DRIVE_SORT_FIELDS, FILE_TYPES, GENERAL_ACCESS, GRANTABLE_ROLES, NATIVE_FILE_TYPES, type ActivityAction } from '../enums';
import { emailSchema } from './auth';
import { itemNameSchema, paginationQuerySchema, sortOrderSchema, uuidSchema } from './common';

/** Filters shared by every Drive listing: type, owner ("People") and last-modified range. */
const listingFilters = {
  type: z.enum([...FILE_TYPES, 'FOLDER']).optional(),
  owner: z.enum(['anyone', 'me', 'not_me']).default('anyone'),
  ownerId: uuidSchema.optional(),
  modifiedAfter: z.coerce.date().optional(),
  modifiedBefore: z.coerce.date().optional(),
};

export const driveListQuerySchema = paginationQuerySchema.extend({
  folderId: uuidSchema.optional(),
  sort: z.enum(DRIVE_SORT_FIELDS).default('name'),
  order: sortOrderSchema,
  ...listingFilters,
});
export type DriveListQuery = z.infer<typeof driveListQuerySchema>;

export const driveViewQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(DRIVE_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  ...listingFilters,
});
export type DriveViewQuery = z.infer<typeof driveViewQuerySchema>;
/** What clients send; the service applies defaults. */
export type DriveListingFilters = Partial<Pick<DriveViewQuery, 'type' | 'owner' | 'ownerId' | 'modifiedAfter' | 'modifiedBefore'>>;

/** Groups of Drive activity shown in the activity panel. */
export const DRIVE_ACTIVITY_CATEGORIES = ['all', 'edits', 'sharing', 'comments', 'trash', 'views'] as const;
export type DriveActivityCategory = (typeof DRIVE_ACTIVITY_CATEGORIES)[number];

/** The actions in each activity category ("all" is everything the user may see except views). */
export const DRIVE_ACTIVITY_GROUPS: Record<Exclude<DriveActivityCategory, 'all'>, readonly ActivityAction[]> = {
  edits: [
    'FILE_CREATED',
    'FILE_EDITED',
    'FILE_RENAMED',
    'FILE_MOVED',
    'FILE_COPIED',
    'FILE_VERSION_UPLOADED',
    'FILE_VERSION_RESTORED',
    'FILE_VERSION_DELETED',
    'FOLDER_CREATED',
    'FOLDER_RENAMED',
    'FOLDER_MOVED',
    'FOLDER_COPIED',
    'FORM_PUBLISHED',
    'FORM_UNPUBLISHED',
  ],
  sharing: ['FILE_SHARED', 'FOLDER_SHARED', 'PERMISSION_CHANGED', 'PERMISSION_REMOVED', 'LINK_SHARING_CHANGED'],
  comments: ['COMMENT_ADDED', 'FORM_RESPONSE_SUBMITTED'],
  trash: ['FILE_DELETED', 'FILE_RESTORED', 'FILE_PERMANENTLY_DELETED', 'FOLDER_DELETED', 'FOLDER_RESTORED', 'FOLDER_PERMANENTLY_DELETED'],
  views: ['FILE_OPENED', 'FILE_DOWNLOADED'],
};

export const driveActivityQuerySchema = paginationQuerySchema.extend({
  category: z.enum(DRIVE_ACTIVITY_CATEGORIES).default('all'),
  actor: z.enum(['anyone', 'me', 'others']).default('anyone'),
  q: z.string().trim().max(200).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type DriveActivityQuery = Partial<z.output<typeof driveActivityQuerySchema>>;

/** Items left in Spam longer than this lose the user's access automatically. */
export const SPAM_RETENTION_DAYS = 30;

/** Reporting an item shared with you as spam; optionally blocks its owner too. */
export const reportSpamSchema = z.object({ blockOwner: z.boolean().default(false) });
export type ReportSpamInput = z.input<typeof reportSpamSchema>;

export const blockUserSchema = z.object({ userId: uuidSchema });

/** Folder upload: every folder path to create under `parentId`, e.g. ["Trip", "Trip/Photos"]. */
export const createFolderTreeSchema = z.object({
  parentId: uuidSchema.optional(),
  paths: z
    .array(
      z
        .string()
        .max(4096)
        .transform((p) => p.split('/').filter(Boolean))
        .pipe(z.array(itemNameSchema).min(1).max(64)),
    )
    .min(1)
    .max(2000),
});
export type CreateFolderTreeInput = z.input<typeof createFolderTreeSchema>;

export const driveSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).default(''),
  type: z.enum([...FILE_TYPES, 'FOLDER']).optional(),
  owner: z.enum(['anyone', 'me', 'not_me']).default('anyone'),
  ownerEmail: z.string().trim().max(254).optional(),
  folderId: uuidSchema.optional(),
  mimeType: z.string().trim().max(255).optional(),
  modifiedAfter: z.coerce.date().optional(),
  modifiedBefore: z.coerce.date().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  starred: z.stringbool().optional(),
});
export type DriveSearchQuery = z.infer<typeof driveSearchQuerySchema>;

export const LIBRARY_SORTS = ['lastOpened', 'updatedAt', 'name'] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

/** An app's home page: every file of one Qub type the user can open, with a content preview. */
export const libraryQuerySchema = paginationQuerySchema.extend({
  type: z.enum(NATIVE_FILE_TYPES),
  owner: z.enum(['anyone', 'me', 'not_me']).default('anyone'),
  sort: z.enum(LIBRARY_SORTS).default('lastOpened'),
  q: z.string().trim().max(200).default(''),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});
export type ParsedLibraryQuery = z.output<typeof libraryQuerySchema>;
/** What clients send: the type, plus any of the defaulted fields. */
export type LibraryQuery = Partial<ParsedLibraryQuery> & Pick<ParsedLibraryQuery, 'type'>;

export const createFolderSchema = z.object({
  name: itemNameSchema,
  parentId: uuidSchema.optional(),
  description: z.string().max(2000).optional(),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateItemSchema = z
  .object({
    name: itemNameSchema.optional(),
    description: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, 'Nothing to update');
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const moveItemSchema = z.object({ folderId: uuidSchema });
export type MoveItemInput = z.infer<typeof moveItemSchema>;

export const copyItemSchema = z.object({
  name: itemNameSchema.optional(),
  folderId: uuidSchema.optional(),
});
export type CopyItemInput = z.infer<typeof copyItemSchema>;

export const shareSchema = z.object({
  email: emailSchema,
  role: z.enum(GRANTABLE_ROLES),
  canShare: z.boolean().default(false),
  canDownload: z.boolean().default(true),
  canCopy: z.boolean().default(true),
  notify: z.boolean().default(true),
  message: z.string().max(1000).optional(),
});
export type ShareInput = z.input<typeof shareSchema>;

export const updatePermissionSchema = z.object({
  role: z.enum(GRANTABLE_ROLES).optional(),
  canShare: z.boolean().optional(),
  canDownload: z.boolean().optional(),
  canCopy: z.boolean().optional(),
});
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;

export const generalAccessSchema = z.object({
  access: z.enum(GENERAL_ACCESS),
  linkRole: z.enum(GRANTABLE_ROLES).default('VIEWER'),
  password: z.string().min(4).max(128).nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});
export type GeneralAccessInput = z.input<typeof generalAccessSchema>;

export const bulkIdsSchema = z.object({
  fileIds: z.array(uuidSchema).max(500).default([]),
  folderIds: z.array(uuidSchema).max(500).default([]),
});
