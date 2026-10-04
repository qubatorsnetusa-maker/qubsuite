import type { AIWelcomeCopy, GenerateWelcomeCopyInput } from '@/formsV3/types';
import { requestJson } from '@/formsV3/services/api';

export type { AIWelcomeCopy } from '@/formsV3/types';

export const generateWelcomeCopyFn = ({ data }: { data: GenerateWelcomeCopyInput }) =>
  requestJson<{ copy: AIWelcomeCopy }>('/ai/welcome-copy', { method: 'POST', body: data });
