import type {
  AdminActivityDto,
  AdminAlertDto,
  AdminAuditEventDto,
  AdminContentItemDto,
  AdminContentType,
  AdminCreateUserInput,
  AdminDeleteUserInput,
  AdminOverviewDto,
  AdminSecurityDto,
  AdminSessionDto,
  AdminStorageDto,
  AdminStorageQuotaInput,
  AdminSystemDto,
  EmailSettingsDto,
  EmailSettingsInput,
  AdminUpdateUserInput,
  AdminUserDto,
  AuditCategory,
  OrgPolicies,
  OrgPoliciesInput,
  Paginated,
  PlatformRole,
} from '@qub/shared';
import { api, buildUrl } from '@/lib/api';

export interface AdminUsersParams {
  q?: string;
  role?: PlatformRole;
  status?: 'ACTIVE' | 'SUSPENDED';
  sort?: 'name' | 'createdAt' | 'lastLoginAt' | 'storage';
  order?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}

export interface AdminAuditParams {
  q?: string;
  category?: AuditCategory;
  severity?: 'info' | 'warning' | 'critical';
  actorId?: string;
  /** ISO timestamps. */
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface AdminActivityParams {
  q?: string;
  app?: 'DOCUMENT' | 'SPREADSHEET' | 'FORM' | 'DRIVE';
  userId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface AdminContentParams {
  type: AdminContentType;
  q?: string;
  ownerId?: string;
  publicOnly?: boolean;
  includeTrashed?: boolean;
  sort?: 'updatedAt' | 'name' | 'size';
  cursor?: string;
  limit?: number;
}

export interface PoliciesResult {
  policies: OrgPolicies;
  serverMaxUploadMb: number;
}

export const adminService = {
  overview: () => api<AdminOverviewDto>('/admin/overview'),
  alerts: () => api<AdminAlertDto[]>('/admin/alerts'),

  users: (q: AdminUsersParams) => api<Paginated<AdminUserDto>>('/admin/users', { query: { ...q } }),
  user: (id: string) => api<AdminUserDto>(`/admin/users/${id}`),
  createUser: (input: AdminCreateUserInput) => api<AdminUserDto>('/admin/users', { method: 'POST', body: input }),
  updateUser: (id: string, input: AdminUpdateUserInput) => api<AdminUserDto>(`/admin/users/${id}`, { method: 'PATCH', body: input }),
  bulkUsers: (userIds: string[], action: 'suspend' | 'activate' | 'signOut') =>
    api<{ updated: string[]; skipped: { id: string; reason: string }[] }>('/admin/users/bulk', { method: 'POST', body: { userIds, action } }),
  signOutUser: (id: string) => api(`/admin/users/${id}/sign-out`, { method: 'POST' }),
  sendPasswordLink: (id: string) => api(`/admin/users/${id}/password-link`, { method: 'POST' }),
  setStorage: (id: string, input: AdminStorageQuotaInput) => api<AdminUserDto>(`/admin/users/${id}/storage`, { method: 'PUT', body: input }),
  deleteUser: (id: string, input: AdminDeleteUserInput) => api<{ transferredTo: string | null; deletedFiles: number }>(`/admin/users/${id}/delete`, { method: 'POST', body: input }),
  /** Same-origin download authorised by the media cookie. */
  usersExportUrl: (q: Omit<AdminUsersParams, 'cursor' | 'limit'>) => buildUrl('/admin/users/export', { ...q }),

  policies: () => api<PoliciesResult>('/admin/policies'),
  savePolicies: (policies: OrgPoliciesInput) => api<PoliciesResult>('/admin/policies', { method: 'PUT', body: policies }),

  storage: () => api<AdminStorageDto>('/admin/storage'),
  content: (q: AdminContentParams) => api<Paginated<AdminContentItemDto>>('/admin/content', { query: { ...q } }),
  revokeLink: (fileId: string) => api(`/admin/content/${fileId}/revoke-link`, { method: 'POST' }),
  transferFile: (fileId: string, toUserId: string) => api(`/admin/content/${fileId}/transfer`, { method: 'POST', body: { toUserId } }),

  audit: (q: AdminAuditParams) => api<Paginated<AdminAuditEventDto>>('/admin/audit', { query: { ...q } }),
  auditExportUrl: (q: Omit<AdminAuditParams, 'cursor' | 'limit'>) => buildUrl('/admin/audit/export', { ...q }),
  activity: (q: AdminActivityParams) => api<Paginated<AdminActivityDto>>('/admin/activity', { query: { ...q } }),

  security: () => api<AdminSecurityDto>('/admin/security'),
  sessions: (q: { userId?: string; cursor?: string; limit?: number }) => api<Paginated<AdminSessionDto>>('/admin/sessions', { query: { ...q } }),
  revokeSession: (id: string) => api(`/admin/sessions/${id}`, { method: 'DELETE' }),
  revokeAllSessions: () => api<{ revoked: number }>('/admin/sessions/revoke-all', { method: 'POST' }),

  system: () => api<AdminSystemDto>('/admin/system'),

  email: () => api<EmailSettingsDto>('/admin/email'),
  saveEmail: (settings: EmailSettingsInput) => api<EmailSettingsDto>('/admin/email', { method: 'PUT', body: settings }),
  /** Tests the saved settings, or a draft when given. */
  testEmail: (to: string, settings?: EmailSettingsInput) => api<{ provider: string }>('/admin/email/test', { method: 'POST', body: { to, settings } }),
};
