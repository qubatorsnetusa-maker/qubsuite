import type {
  AnswerValue,
  ApplyOpsResult,
  CreateFieldInput,
  CreateFormInput,
  CreateVariableInput,
  FormAnalyticsDto,
  FormDto,
  FormResponseDto,
  FormThemeInput,
  Paginated,
  PublicFormDto,
  SetLogicRuleInput,
  SubmitResponseResult,
  UpdateFieldInput,
  UpdateFormInput,
  UpdateVariableInput,
} from '@qub/shared';
import type { OpTx } from '@qub/shared/forms';
import { api, buildUrl, uploadFile } from '@/lib/api';

export interface SubmitPayload {
  answers: Record<string, AnswerValue>;
  email?: string;
  hidden?: Record<string, string>;
  clientSubmissionId?: string;
  startedAt?: string;
}

export const formsService = {
  create: (input: CreateFormInput) => api<FormDto>('/forms', { method: 'POST', body: input }),
  get: (id: string) => api<FormDto>(`/forms/${id}`),
  update: (id: string, input: UpdateFormInput) => api<FormDto>(`/forms/${id}`, { method: 'PATCH', body: input }),
  applyOps: (id: string, tx: OpTx) => api<ApplyOpsResult>(`/forms/${id}/ops`, { method: 'POST', body: tx }),
  trash: (id: string) => api(`/forms/${id}/trash`, { method: 'POST' }),
  addField: (id: string, input: CreateFieldInput) => api<FormDto>(`/forms/${id}/fields`, { method: 'POST', body: input }),
  updateField: (id: string, fieldId: string, input: UpdateFieldInput) => api<FormDto>(`/forms/${id}/fields/${fieldId}`, { method: 'PATCH', body: input }),
  deleteField: (id: string, fieldId: string) => api<FormDto>(`/forms/${id}/fields/${fieldId}`, { method: 'DELETE' }),
  duplicateField: (id: string, fieldId: string) => api<FormDto>(`/forms/${id}/fields/${fieldId}/duplicate`, { method: 'POST' }),
  reorder: (id: string, fieldIds: string[]) => api<FormDto>(`/forms/${id}/fields/order`, { method: 'PUT', body: { fieldIds } }),
  setLogic: (id: string, fieldId: string, rules: SetLogicRuleInput[]) => api<FormDto>(`/forms/${id}/fields/${fieldId}/logic`, { method: 'PUT', body: { rules } }),
  createVariable: (id: string, input: CreateVariableInput) => api<FormDto>(`/forms/${id}/variables`, { method: 'POST', body: input }),
  updateVariable: (id: string, variableId: string, input: UpdateVariableInput) => api<FormDto>(`/forms/${id}/variables/${variableId}`, { method: 'PATCH', body: input }),
  deleteVariable: (id: string, variableId: string) => api<FormDto>(`/forms/${id}/variables/${variableId}`, { method: 'DELETE' }),
  validateFormula: (id: string, formula: string) => api<{ ok: true } | { ok: false; error: string }>(`/forms/${id}/formulas/validate`, { method: 'POST', body: { formula } }),
  setTheme: (id: string, theme: FormThemeInput) => api<FormDto>(`/forms/${id}/theme`, { method: 'PUT', body: theme }),
  publish: (id: string, published: boolean) => api<FormDto>(`/forms/${id}/${published ? 'publish' : 'unpublish'}`, { method: 'POST' }),
  responses: (id: string, cursor?: string) => api<Paginated<FormResponseDto> & { total: number }>(`/forms/${id}/responses`, { query: { cursor, limit: 25 } }),
  deleteResponse: (id: string, responseId: string) => api(`/forms/${id}/responses/${responseId}`, { method: 'DELETE' }),
  analytics: (id: string, days = 30) => api<FormAnalyticsDto>(`/forms/${id}/analytics`, { query: { days } }),
  exportUrl: (id: string) => buildUrl(`/forms/${id}/responses/export`),
  uploadUrl: (id: string, uploadId: string) => buildUrl(`/forms/${id}/uploads/${uploadId}`),

  // respondent side
  getPublic: (publicId: string, countView: boolean) => api<PublicFormDto>(`/public/forms/${publicId}`, { query: { view: countView ? '1' : '0' } }),
  submit: (publicId: string, payload: SubmitPayload) => api<SubmitResponseResult>(`/public/forms/${publicId}/responses`, { method: 'POST', body: payload }),
  uploadAnswer: (publicId: string, fieldId: string, file: File, onProgress?: (f: number) => void) =>
    uploadFile<{ id: string; name: string; size: number; mimeType: string }>(`/public/forms/${publicId}/uploads`, file, { query: { fieldId }, onProgress }),
};
