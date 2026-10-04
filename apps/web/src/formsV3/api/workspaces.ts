import type {
  CreateWorkspaceInput,
  FormConfig,
  FormStats,
  FormSubmission,
  UpdateWorkspaceInput,
  Workspace,
} from '@/formsV3/types';
import { requestJson } from '@/formsV3/services/api';

type WorkspaceForms = { forms: FormConfig[]; formStats: Record<string, FormStats> };

export const listWorkspacesFn = () =>
  requestJson<{ workspaces: Workspace[] }>('/workspaces');

export const createWorkspaceFn = ({ data }: { data: CreateWorkspaceInput }) =>
  requestJson<{ workspace: Workspace }>('/workspaces', { method: 'POST', body: data });

export const updateWorkspaceFn = ({ data: { id, ...rest } }: { data: UpdateWorkspaceInput }) =>
  requestJson<{ workspace: Workspace }>(`/workspaces/${encodeURIComponent(id)}`, { method: 'PUT', body: rest });

export const listWorkspaceFormsFn = ({ data }: { data: { workspaceId: string } }) =>
  requestJson<WorkspaceForms>(`/workspaces/${encodeURIComponent(data.workspaceId)}/forms`);

export const getFormConfigFn = ({ data }: { data: { formId: string } }) =>
  requestJson<{ form: FormConfig }>(`/forms/${encodeURIComponent(data.formId)}`);

export const createFormFn = ({ data }: { data: FormConfig & { workspaceId: string } }) =>
  requestJson<{ form: FormConfig }>(`/workspaces/${encodeURIComponent(data.workspaceId)}/forms`, {
    method: 'POST',
    body: data,
  });

export const updateFormFn = ({ data }: { data: FormConfig }) =>
  requestJson<{ form: FormConfig }>(`/forms/${encodeURIComponent(data.id)}`, {
    method: 'PUT',
    body: data,
  });

export const deleteFormFn = ({ data }: { data: { id: string } }) =>
  requestJson<Record<string, never>>(`/forms/${encodeURIComponent(data.id)}`, { method: 'DELETE' });

export const duplicateFormFn = ({ data }: { data: { id: string } }) =>
  requestJson<{ form: FormConfig }>(`/forms/${encodeURIComponent(data.id)}/duplicate`, { method: 'POST' });

export const resetWorkspaceFormsFn = ({ data }: { data: { workspaceId: string } }) =>
  requestJson<WorkspaceForms>(`/workspaces/${encodeURIComponent(data.workspaceId)}/forms/reset`, { method: 'POST' });

export const seedWorkspaceTemplatesFn = ({ data }: { data: { workspaceId: string } }) =>
  requestJson<WorkspaceForms & { folders: string[] }>(
    `/workspaces/${encodeURIComponent(data.workspaceId)}/forms/seed-templates`,
    { method: 'POST' }
  );

export const incrementFormStartFn = ({ data }: { data: { id: string } }) =>
  requestJson<{ stats: { starts: number; completions: number } }>(
    `/forms/${encodeURIComponent(data.id)}/starts`,
    { method: 'POST' }
  );

export const getPublicFormConfigFn = ({ data }: { data: { formId: string } }) =>
  requestJson<{ form: FormConfig }>(`/public/forms/${encodeURIComponent(data.formId)}`);

export const incrementPublicFormStartFn = ({ data }: { data: { id: string } }) =>
  requestJson<Record<string, never>>(`/public/forms/${encodeURIComponent(data.id)}/starts`, { method: 'POST' });

export const listWorkspaceSubmissionsFn = ({ data }: { data: { workspaceId: string } }) =>
  requestJson<{ submissions: FormSubmission[] }>(`/workspaces/${encodeURIComponent(data.workspaceId)}/submissions`);

export const clearWorkspaceSubmissionsFn = ({ data }: { data: { workspaceId: string } }) =>
  requestJson<Record<string, never>>(`/workspaces/${encodeURIComponent(data.workspaceId)}/submissions`, {
    method: 'DELETE',
  });
