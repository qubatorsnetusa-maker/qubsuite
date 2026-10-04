import { z } from 'zod';

/** Search params shared by the Drive listing routes. */
export const driveSearchSchema = z.object({
  sort: z.enum(['name', 'updatedAt', 'createdAt', 'size']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  type: z.string().optional(),
  owner: z.enum(['me', 'not_me']).optional(),
  person: z.uuid().optional(),
  modified: z.enum(['today', 'week', 'month', 'year', 'lastYear']).optional(),
  /** File open in the full-screen viewer, so the viewer is linkable and Back closes it. */
  preview: z.uuid().optional(),
});

export const trashSearchSchema = driveSearchSchema.extend({ folder: z.string().optional() });

export const driveQuerySearchSchema = z.object({
  q: z.string().default(''),
  type: z.string().optional(),
  owner: z.enum(['anyone', 'me', 'not_me']).optional(),
  modified: z.enum(['today', 'week', 'month', 'year']).optional(),
});
