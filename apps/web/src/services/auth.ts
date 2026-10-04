import type {
  AuthProviders,
  AuthResult,
  ChangePasswordInput,
  CurrentUser,
  LoginInput,
  RegisterInput,
  SessionInfo,
  UpdateProfileInput,
} from '@qub/shared';
import { api, uploadFile } from '@/lib/api';
import { authStore } from '@/lib/auth-store';

export const authService = {
  async login(input: LoginInput) {
    const result = await api<AuthResult>('/auth/login', { method: 'POST', body: input, anonymous: true });
    authStore.setSession(result);
    return result;
  },
  
  async providers() {
    return api<AuthProviders>('/auth/providers', { anonymous: true });
  },

  async kingschat(accessToken: string) {
    const result = await api<AuthResult>('/auth/kingschat', { method: 'POST', body: { accessToken }, anonymous: true });
    authStore.setSession(result);
    return result;
  },

  async addEmail(email: string) {
    return api<{ sent: boolean }>('/auth/add-email', { method: 'POST', body: { email } });
  },

  async register(input: RegisterInput) {
    const result = await api<AuthResult | { requiresVerification: true; email: string }>('/auth/register', { method: 'POST', body: input, anonymous: true });
    if ('accessToken' in result) authStore.setSession(result);
    return result;
  },
  async logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      authStore.clear();
    }
  },
  logoutAll: () => api('/auth/logout-all', { method: 'POST' }).finally(() => authStore.clear()),
  forgotPassword: (email: string) => api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, anonymous: true }),
  resetPassword: (token: string, password: string) => api<{ message: string }>('/auth/reset-password', { method: 'POST', body: { token, password }, anonymous: true }),
  verifyEmail: (token: string) => api<{ verified: boolean }>('/auth/verify-email', { method: 'POST', body: { token }, anonymous: true }),
  resendVerification: () => api('/auth/resend-verification', { method: 'POST' }),
  changePassword: (input: ChangePasswordInput) => api('/auth/change-password', { method: 'POST', body: input }),
  sessions: () => api<SessionInfo[]>('/auth/sessions'),
  revokeSession: (id: string) => api(`/auth/sessions/${id}`, { method: 'DELETE' }),
  async updateProfile(input: UpdateProfileInput) {
    const user = await api<CurrentUser>('/users/me', { method: 'PATCH', body: input });
    authStore.setUser(user);
    return user;
  },
  async uploadAvatar(file: File) {
    const user = await uploadFile<CurrentUser>('/users/me/avatar', file);
    authStore.setUser(user);
    return user;
  },
  lookup: (email: string) => api<{ id: string; email: string; name: string; avatarUrl: string | null } | null>('/users/lookup', { query: { email } }),
};
