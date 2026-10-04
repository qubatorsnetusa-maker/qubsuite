import type { SubmitPublicFormInput } from '@/formsV3/types';
import { requestJson } from '@/formsV3/services/api';

export const submitPublicFormFn = ({ data: { formId, ...body } }: { data: SubmitPublicFormInput }) =>
  requestJson<Record<string, never>>(`/public/forms/${encodeURIComponent(formId)}/submissions`, {
    method: 'POST',
    body,
  });
