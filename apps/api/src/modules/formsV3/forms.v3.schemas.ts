// Request schemas shared by the API (validation) and the web client (types).
// Moved from the forms app's server repositories / server functions.
import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
})
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>

export const updateWorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  icon: z.string().max(50).optional(),
  folders: z.array(z.string()),
})
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>

export const updateUserPreferencesSchema = z.object({
  defaultViewMode: z.enum(['grid', 'table']).optional(),
  defaultSortOption: z
    .enum(['updated_desc', 'title_asc', 'responses_desc', 'completion_desc', 'steps_desc'])
    .optional(),
  notifyOnSubmission: z.boolean().optional(),
})
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>

export interface UserPreferences {
  defaultViewMode: 'grid' | 'table'
  defaultSortOption: 'updated_desc' | 'title_asc' | 'responses_desc' | 'completion_desc' | 'steps_desc'
  notifyOnSubmission: boolean
}

export const submitPublicFormSchema = z.object({
  formId: z.string().min(1),
  answers: z.record(z.string(), z.string()),
  completionTimeSeconds: z.number().min(0),
})
export type SubmitPublicFormInput = z.infer<typeof submitPublicFormSchema>

export const generateWelcomeCopySchema = z.object({
  formTitle: z.string(),
  formDescription: z.string().optional(),
})
export type GenerateWelcomeCopyInput = z.infer<typeof generateWelcomeCopySchema>

export interface AIWelcomeCopy {
  title: string
  description: string
  tagline: string
  timeEstimate: string
  buttonLabel: string
  suggestedHeroPrompt: string
}

export interface SessionUser {
  id: string
  email: string
  name: string
}

export type FormStats = Record<string, { starts: number; completions: number }>
