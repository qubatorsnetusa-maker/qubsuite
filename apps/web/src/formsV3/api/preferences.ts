import type { UpdateUserPreferencesInput, UserPreferences } from '@/formsV3/types';
import { requestJson } from '@/formsV3/services/api';

export type { UserPreferences } from '@/formsV3/types';

export const getUserPreferencesFn = () =>
  requestJson<{ preferences: UserPreferences }>('/preferences');

export const updateUserPreferencesFn = ({ data }: { data: UpdateUserPreferencesInput }) =>
  requestJson<Record<string, never>>('/preferences', { method: 'PATCH', body: data });
