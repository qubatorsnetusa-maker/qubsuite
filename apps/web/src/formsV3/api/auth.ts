import type { SessionUser } from '@/formsV3/types';
import { requestJson } from '@/formsV3/services/api';
import { ssoLogout } from '@/formsV3/services/sso';
import { authStore } from '@/lib/auth-store';

export const getSessionFn = async (): Promise<{ user: SessionUser | null }> => {
  const current = authStore.get().user;
  if (current) {
    return {
      user: {
        id: current.id,
        email: current.email,
        name: current.name,
      },
    };
  }
  try {
    return await requestJson<{ user: SessionUser | null }>('/auth/session');
  } catch {
    return { user: null };
  }
};

export async function logoutFn(): Promise<Record<string, never>> {
  await ssoLogout();
  return {};
}
