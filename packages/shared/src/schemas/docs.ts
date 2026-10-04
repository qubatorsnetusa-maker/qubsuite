import { z } from 'zod';
import { itemNameSchema, templateIdSchema, uuidSchema } from './common';

export const createDocumentSchema = z.object({
  title: itemNameSchema.optional(),
  folderId: uuidSchema.optional(),
  /** Start from a template in the Docs gallery (`@qub/shared/templates`). */
  templateId: templateIdSchema.optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const renameResourceSchema = z.object({ title: itemNameSchema });
export type RenameResourceInput = z.infer<typeof renameResourceSchema>;

export const createVersionSchema = z.object({ name: z.string().trim().max(200).optional() });

export const mentionsSchema = z.array(uuidSchema).max(50).default([]);

export const createCommentSchema = z.object({
  anchorId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  quotedText: z.string().max(2000).default(''),
  body: z.string().trim().min(1).max(10_000),
  mentions: mentionsSchema,
});
export type CreateCommentInput = z.input<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  mentions: mentionsSchema,
});
export type UpdateCommentInput = z.input<typeof updateCommentSchema>;

export const createReplySchema = updateCommentSchema;

export const createSuggestionSchema = z.object({
  anchorId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  originalText: z.string().max(10_000),
  suggestedText: z.string().max(10_000),
});
export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;

export const mentionInDocumentSchema = z.object({ userIds: z.array(uuidSchema).min(1).max(50) });
