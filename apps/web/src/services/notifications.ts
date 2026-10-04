import type { NotificationDto, PublicShareDto } from '@qub/shared';
import { api, buildUrl } from '@/lib/api';

export const notificationsService = {
  list: (cursor?: string) => api<{ items: NotificationDto[]; nextCursor: string | null; unreadCount: number }>('/notifications', { query: { cursor, limit: 20 } }),
  unreadCount: () => api<{ unreadCount: number }>('/notifications/unread-count'),
  markRead: (ids: string[]) => api<{ unreadCount: number }>('/notifications/read', { method: 'POST', body: { ids } }),
  markAllRead: () => api<{ unreadCount: number }>('/notifications/read-all', { method: 'POST' }),
};

export const shareService = {
  resolve: (token: string) => api<PublicShareDto>(`/share/${token}`, { anonymous: true }),
  unlock: (token: string, password: string) => api<PublicShareDto>(`/share/${token}/access`, { method: 'POST', body: { password }, anonymous: true }),
  folder: (token: string, access: string, folderId: string) =>
    api<{ id: string; name: string; items: NonNullable<PublicShareDto['folder']>['items'] }>(`/share/${token}/folders/${folderId}`, { query: { access }, anonymous: true }),
  document: (token: string, access: string, fileId: string) =>
    api<{ id: string; title: string; content: unknown; updatedAt: string }>(`/share/${token}/files/${fileId}/document`, { query: { access }, anonymous: true }),
  spreadsheet: (token: string, access: string, fileId: string) =>
    api<{ id: string; title: string; revision: number; sheets: import('@qub/shared').WorksheetDto[] }>(`/share/${token}/files/${fileId}/spreadsheet`, { query: { access }, anonymous: true }),
  spreadsheetCells: (token: string, access: string, fileId: string, sheetId: string) =>
    api<import('@qub/shared').CellsResult>(`/share/${token}/files/${fileId}/spreadsheet/${sheetId}/cells`, { query: { access, rowStart: 0, rowEnd: 199, colStart: 0, colEnd: 25 }, anonymous: true }),
  downloadUrl: (token: string, access: string, fileId: string, inline = false) => buildUrl(`/share/${token}/files/${fileId}/download`, { access, inline: inline ? '1' : '0' }),
  redeem: (token: string, password?: string) =>
    api<{ resourceType: 'FILE' | 'FOLDER'; id: string; fileType?: string; resourceId?: string | null }>(`/share/${token}/redeem`, { method: 'POST', body: { password } }),
};
