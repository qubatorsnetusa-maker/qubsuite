import { z } from 'zod';

export const uuidSchema = z.uuid();
export const idParamsSchema = z.object({ id: uuidSchema });

/** Names for files and folders. Path separators and control characters are rejected. */
export const itemNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(255, 'Name is too long')
  .refine((v) => !/[\\/\u0000-\u001f]/.test(v), 'Name cannot contain slashes or control characters')
  .refine((v) => v !== '.' && v !== '..', 'Invalid name');

/** Template ids are resolved server-side against the app's gallery; this only bounds the input. */
export const templateIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/, 'Invalid template');

export const paginationQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');
