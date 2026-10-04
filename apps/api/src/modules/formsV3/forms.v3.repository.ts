import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db';
import {
  formsv3Forms,
  formsv3Submissions,
  formsv3UserPreferences,
  formsv3Workspaces,
  type Formsv3FormRow,
  type Formsv3SubmissionRow,
  type Formsv3WorkspaceRow,
} from './forms.v3.schema';
import type {
  CreateWorkspaceInput,
  FormConfig,
  FormSubmission,
  UpdateUserPreferencesInput,
  UpdateWorkspaceInput,
  UserPreferences,
  Workspace,
} from './forms.v3.types';
import { FORM_TEMPLATE_PRESETS, buildFormFromTemplate } from './forms.v3.templates';
import { notFound } from '../../utils/errors';

export function rowToWorkspace(row: Formsv3WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    icon: row.icon ?? undefined,
    createdAt: row.createdAt.toISOString(),
    folders: row.folders,
  };
}

export function rowToFormConfig(row: Formsv3FormRow): FormConfig {
  return {
    ...(row.data as Omit<FormConfig, 'id' | 'title' | 'status' | 'folder' | 'isFavorite' | 'workspaceId' | 'updatedAt' | 'createdAt'>),
    id: row.id,
    title: row.title,
    status: row.status as 'draft' | 'published' | 'closed',
    folder: row.folder ?? undefined,
    isFavorite: row.isFavorite,
    workspaceId: row.workspaceId,
    updatedAt: row.updatedAt.toISOString(),
    updatedAtMs: row.updatedAt.getTime(),
    createdAt: row.createdAt.toISOString(),
  };
}

function formToJsonbData(form: FormConfig) {
  const { id, title, status, folder, isFavorite, workspaceId, updatedAt, updatedAtMs, createdAt, ...rest } = form;
  return rest;
}

export function rowToSubmission(row: Formsv3SubmissionRow): FormSubmission {
  return {
    id: row.id,
    formId: row.formId,
    formTitle: row.formTitle,
    submittedAt: row.submittedAt.toISOString(),
    responses: row.responses as Record<string, string>,
    completionTimeSeconds: row.completionTimeSeconds,
    notificationSentTo: row.notificationSentTo ?? undefined,
  };
}

export async function assertWorkspaceOwnership(db: Database, workspaceId: string, userId: string): Promise<void> {
  const [workspace] = await db
    .select({ id: formsv3Workspaces.id })
    .from(formsv3Workspaces)
    .where(and(eq(formsv3Workspaces.id, workspaceId), eq(formsv3Workspaces.ownerId, userId)));
  if (!workspace) throw notFound('Workspace not found');
}

export async function listWorkspacesInDb(db: Database, userId: string): Promise<Workspace[]> {
  const rows = await db.select().from(formsv3Workspaces).where(eq(formsv3Workspaces.ownerId, userId));
  return rows.map(rowToWorkspace);
}

export async function createWorkspaceInDb(db: Database, data: CreateWorkspaceInput, userId: string): Promise<Workspace> {
  const id = randomUUID();
  const [workspace] = await db
    .insert(formsv3Workspaces)
    .values({ id, ownerId: userId, name: data.name, description: data.description, folders: [] })
    .returning();
  return rowToWorkspace(workspace!);
}

export async function updateWorkspaceInDb(db: Database, data: UpdateWorkspaceInput, userId: string): Promise<Workspace> {
  const [updated] = await db
    .update(formsv3Workspaces)
    .set({
      name: data.name,
      description: data.description,
      icon: data.icon,
      folders: data.folders,
      updatedAt: new Date(),
    })
    .where(and(eq(formsv3Workspaces.id, data.id), eq(formsv3Workspaces.ownerId, userId)))
    .returning();
  if (!updated) throw notFound('Workspace not found');
  return rowToWorkspace(updated);
}

export async function listWorkspaceFormsInDb(
  db: Database,
  workspaceId: string,
  userId: string
): Promise<{ forms: FormConfig[]; formStats: Record<string, { starts: number; completions: number }> }> {
  await assertWorkspaceOwnership(db, workspaceId, userId);
  const rows = await db.select().from(formsv3Forms).where(eq(formsv3Forms.workspaceId, workspaceId));
  const formStats: Record<string, { starts: number; completions: number }> = {};
  for (const row of rows) formStats[row.id] = { starts: row.starts, completions: row.completions };
  return { forms: rows.map(rowToFormConfig), formStats };
}

async function findOwnedFormRow(db: Database, formId: string, userId: string): Promise<Formsv3FormRow> {
  const [row] = await db
    .select({ form: formsv3Forms })
    .from(formsv3Forms)
    .innerJoin(formsv3Workspaces, eq(formsv3Workspaces.id, formsv3Forms.workspaceId))
    .where(and(eq(formsv3Forms.id, formId), eq(formsv3Workspaces.ownerId, userId)));
  if (!row) throw notFound('Form not found');
  return row.form;
}

export async function getFormInDb(db: Database, formId: string, userId: string): Promise<{ form: FormConfig }> {
  const row = await findOwnedFormRow(db, formId, userId);
  return { form: rowToFormConfig(row) };
}

export async function createFormInDb(
  db: Database,
  data: FormConfig & { workspaceId: string },
  userId: string
): Promise<{ form: FormConfig }> {
  await assertWorkspaceOwnership(db, data.workspaceId, userId);
  const id = randomUUID();
  const [row] = await db
    .insert(formsv3Forms)
    .values({
      id,
      workspaceId: data.workspaceId,
      title: data.title,
      status: (data.status as 'draft' | 'published' | 'closed') ?? 'draft',
      folder: data.folder,
      isFavorite: data.isFavorite ?? false,
      data: formToJsonbData(data),
    })
    .returning();
  return { form: rowToFormConfig(row!) };
}

export async function updateFormInDb(db: Database, data: FormConfig, userId: string): Promise<{ form: FormConfig }> {
  await findOwnedFormRow(db, data.id, userId);
  const [row] = await db
    .update(formsv3Forms)
    .set({
      title: data.title,
      status: (data.status as 'draft' | 'published' | 'closed') ?? 'draft',
      folder: data.folder,
      isFavorite: data.isFavorite ?? false,
      data: formToJsonbData(data),
      updatedAt: new Date(),
    })
    .where(eq(formsv3Forms.id, data.id))
    .returning();
  return { form: rowToFormConfig(row!) };
}

export async function deleteFormInDb(db: Database, formId: string, userId: string): Promise<void> {
  await findOwnedFormRow(db, formId, userId);
  await db.delete(formsv3Forms).where(eq(formsv3Forms.id, formId));
}

export async function duplicateFormInDb(db: Database, formId: string, userId: string): Promise<{ form: FormConfig }> {
  const source = await findOwnedFormRow(db, formId, userId);
  const id = randomUUID();
  const [row] = await db
    .insert(formsv3Forms)
    .values({
      id,
      workspaceId: source.workspaceId,
      title: `${source.title} (Copy)`,
      status: 'draft',
      folder: source.folder,
      isFavorite: false,
      data: { ...(source.data as object), title: `${source.title} (Copy)` },
    })
    .returning();
  return { form: rowToFormConfig(row!) };
}

export async function resetWorkspaceFormsInDb(
  db: Database,
  workspaceId: string,
  userId: string
): Promise<{ forms: FormConfig[]; formStats: Record<string, { starts: number; completions: number }> }> {
  await assertWorkspaceOwnership(db, workspaceId, userId);
  await db.delete(formsv3Forms).where(eq(formsv3Forms.workspaceId, workspaceId));
  return { forms: [], formStats: {} };
}

export async function seedWorkspaceTemplatesInDb(
  db: Database,
  workspaceId: string,
  userId: string
): Promise<{ forms: FormConfig[]; formStats: Record<string, { starts: number; completions: number }>; folders: string[] }> {
  await assertWorkspaceOwnership(db, workspaceId, userId);
  const templateFolders = Array.from(new Set(FORM_TEMPLATE_PRESETS.map((p) => p.folder)));

  const [ws] = await db.select().from(formsv3Workspaces).where(eq(formsv3Workspaces.id, workspaceId));
  const combinedFolders = Array.from(new Set([...(ws?.folders || []), ...templateFolders]));
  await db.update(formsv3Workspaces).set({ folders: combinedFolders, updatedAt: new Date() }).where(eq(formsv3Workspaces.id, workspaceId));

  for (const preset of FORM_TEMPLATE_PRESETS) {
    const formConfig = buildFormFromTemplate(preset, workspaceId);
    await createFormInDb(db, { ...formConfig, workspaceId }, userId);
  }

  const result = await listWorkspaceFormsInDb(db, workspaceId, userId);
  return { ...result, folders: combinedFolders };
}

export async function incrementFormStartInDb(
  db: Database,
  formId: string,
  userId: string
): Promise<{ stats: { starts: number; completions: number } }> {
  const row = await findOwnedFormRow(db, formId, userId);
  const [updated] = await db
    .update(formsv3Forms)
    .set({ starts: row.starts + 1 })
    .where(eq(formsv3Forms.id, formId))
    .returning();
  return { stats: { starts: updated!.starts, completions: updated!.completions } };
}

export async function getPublishedFormInDb(db: Database, formId: string): Promise<FormConfig> {
  const [row] = await db.select().from(formsv3Forms).where(eq(formsv3Forms.id, formId));
  if (!row || row.status !== 'published') throw notFound('Form not found');
  return rowToFormConfig(row);
}

export async function incrementPublicFormStartInDb(db: Database, formId: string): Promise<void> {
  const [row] = await db.select({ starts: formsv3Forms.starts }).from(formsv3Forms).where(eq(formsv3Forms.id, formId));
  if (!row) return;
  await db.update(formsv3Forms).set({ starts: row.starts + 1 }).where(eq(formsv3Forms.id, formId));
}

export async function submitPublicFormInDb(
  db: Database,
  formId: string,
  answers: Record<string, string>,
  completionTimeSeconds: number
): Promise<void> {
  const [row] = await db.select().from(formsv3Forms).where(eq(formsv3Forms.id, formId));
  if (!row || row.status !== 'published') throw notFound('Form not found');

  await db.transaction(async (tx) => {
    await tx.insert(formsv3Submissions).values({
      id: randomUUID(),
      formId,
      formTitle: row.title,
      completionTimeSeconds,
      responses: answers,
    });
    await tx.update(formsv3Forms).set({ completions: row.completions + 1 }).where(eq(formsv3Forms.id, formId));
  });
}

export async function listWorkspaceSubmissionsInDb(
  db: Database,
  workspaceId: string,
  userId: string
): Promise<{ submissions: FormSubmission[] }> {
  await assertWorkspaceOwnership(db, workspaceId, userId);
  const rows = await db
    .select({ submission: formsv3Submissions })
    .from(formsv3Submissions)
    .innerJoin(formsv3Forms, eq(formsv3Forms.id, formsv3Submissions.formId))
    .where(eq(formsv3Forms.workspaceId, workspaceId));
  return { submissions: rows.map((r) => rowToSubmission(r.submission)) };
}

export async function clearWorkspaceSubmissionsInDb(db: Database, workspaceId: string, userId: string): Promise<void> {
  await assertWorkspaceOwnership(db, workspaceId, userId);
  const formIds = (await db.select({ id: formsv3Forms.id }).from(formsv3Forms).where(eq(formsv3Forms.workspaceId, workspaceId))).map(
    (f) => f.id
  );
  if (formIds.length === 0) return;
  await db.delete(formsv3Submissions).where(inArray(formsv3Submissions.formId, formIds));
}

export async function getUserPreferencesInDb(db: Database, userId: string): Promise<UserPreferences> {
  const [existing] = await db.select().from(formsv3UserPreferences).where(eq(formsv3UserPreferences.userId, userId));
  if (existing) {
    return {
      defaultViewMode: existing.defaultViewMode as 'grid' | 'table',
      defaultSortOption: existing.defaultSortOption as any,
      notifyOnSubmission: existing.notifyOnSubmission,
    };
  }
  await db.insert(formsv3UserPreferences).values({ userId }).onConflictDoNothing();
  return { defaultViewMode: 'grid', defaultSortOption: 'updated_desc', notifyOnSubmission: true };
}

export async function updateUserPreferencesInDb(
  db: Database,
  patch: UpdateUserPreferencesInput,
  userId: string
): Promise<void> {
  await getUserPreferencesInDb(db, userId);
  await db.update(formsv3UserPreferences).set(patch).where(eq(formsv3UserPreferences.userId, userId));
}
