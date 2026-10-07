import { getServiceUrl } from '@/lib/ecosystem-urls';
import type {
  ActivityDto,
  BlockedUserDto,
  CopyItemInput,
  CreateFolderInput,
  DriveActivityItemDto,
  DriveActivityQuery,
  DriveFileDto,
  DriveFolderDto,
  DriveItemDto,
  DriveListQuery,
  DriveListResult,
  DriveSearchQuery,
  DriveStorageDto,
  DriveViewQuery,
  FileVersionDto,
  FolderDetailDto,
  FolderTreeResult,
  SuggestedItemDto,
  UserSummary,
  GeneralAccessInput,
  LibraryQuery,
  LibraryResult,
  Paginated,
  SearchResultDto,
  ShareInput,
  SharingStateDto,
  UpdateItemInput,
  UpdatePermissionInput,
} from '@qub/shared';
import { api, buildUrl, uploadFile } from '@/lib/api';

type Kind = 'file' | 'folder';
const seg = (k: Kind) => (k === 'file' ? 'files' : 'folders');

/** Query for any Drive listing; dates are ISO strings. */
export interface ListingQuery {
  folderId?: string;
  sort?: DriveListQuery['sort'];
  order?: 'asc' | 'desc';
  type?: DriveViewQuery['type'];
  owner?: DriveViewQuery['owner'];
  ownerId?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  cursor?: string;
  limit?: number;
}

export const driveService = {
  root: () => api<FolderDetailDto>('/drive/root'),
  list: (q: ListingQuery) => api<DriveListResult>('/drive/items', { query: { ...q } }),
  shared: (q: ListingQuery) => api<Paginated<DriveItemDto>>('/drive/shared', { query: { ...q } }),
  recent: (q: ListingQuery) => api<Paginated<DriveItemDto>>('/drive/recent', { query: { ...q } }),
  starred: (q: ListingQuery) => api<Paginated<DriveItemDto>>('/drive/starred', { query: { ...q } }),
  trash: (q: ListingQuery) => api<Paginated<DriveItemDto>>('/drive/trash', { query: { ...q } }),
  trashedFolder: (id: string, q: ListingQuery) => api<Paginated<DriveItemDto>>(`/drive/trash/folders/${id}`, { query: { ...q } }),
  spam: (q: ListingQuery) => api<Paginated<DriveItemDto>>('/drive/spam', { query: { ...q } }),
  emptySpam: () => api<{ removed: number }>('/drive/spam/empty', { method: 'POST' }),
  reportSpam: (kind: Kind, id: string, blockOwner: boolean) => api<{ blocked: boolean }>(`/drive/${seg(kind)}/${id}/spam`, { method: 'POST', body: { blockOwner } }),
  notSpam: (kind: Kind, id: string) => api(`/drive/${seg(kind)}/${id}/spam`, { method: 'DELETE' }),
  /** Removes the viewer's own access to something shared with them. */
  removeAccess: (kind: Kind, id: string) => api(`/drive/${seg(kind)}/${id}/access`, { method: 'DELETE' }),
  blocked: () => api<BlockedUserDto[]>('/users/blocked'),
  block: (userId: string) => api('/users/blocked', { method: 'POST', body: { userId } }),
  unblock: (userId: string) => api(`/users/blocked/${userId}`, { method: 'DELETE' }),
  people: () => api<UserSummary[]>('/drive/people'),
  suggested: () => api<SuggestedItemDto[]>('/drive/suggested'),
  storage: () => api<DriveStorageDto>('/drive/storage'),
  activityFeed: (q: DriveActivityQuery) => api<Paginated<DriveActivityItemDto>>('/drive/activity', { query: { ...q } }),
  createFolderTree: (parentId: string | undefined, paths: string[]) => api<FolderTreeResult>('/drive/folders/tree', { method: 'POST', body: { parentId, paths } }),
  emptyTrash: () => api<{ deleted: number }>('/drive/trash/empty', { method: 'POST' }),
  search: (q: Partial<DriveSearchQuery>, signal?: AbortSignal) =>
    api<Paginated<SearchResultDto>>('/drive/search', {
      query: {
        ...q,
        modifiedAfter: q.modifiedAfter?.toISOString(),
        modifiedBefore: q.modifiedBefore?.toISOString(),
        createdAfter: q.createdAfter?.toISOString(),
        createdBefore: q.createdBefore?.toISOString(),
      },
      signal,
    }),

  /** Docs/Sheets/Forms home pages: every file of one type the user can open, with content previews. */
  library: (q: LibraryQuery, signal?: AbortSignal) => api<LibraryResult>('/drive/library', { query: q, signal }),

  file: (id: string) => api<DriveFileDto>(`/drive/files/${id}`),
  folder: (id: string) => api<FolderDetailDto>(`/drive/folders/${id}`),
  createFolder: (input: CreateFolderInput) => api<FolderDetailDto>('/drive/folders', { method: 'POST', body: input }),
  update: (kind: Kind, id: string, input: UpdateItemInput) => api<DriveItemDto>(`/drive/${seg(kind)}/${id}`, { method: 'PATCH', body: input }),
  move: (kind: Kind, id: string, folderId: string) => api<DriveItemDto>(`/drive/${seg(kind)}/${id}/move`, { method: 'POST', body: { folderId } }),
  trashItem: (kind: Kind, id: string) => api(`/drive/${seg(kind)}/${id}/trash`, { method: 'POST' }),
  restore: (kind: Kind, id: string) => api<DriveItemDto>(`/drive/${seg(kind)}/${id}/restore`, { method: 'POST' }),
  deleteForever: (kind: Kind, id: string) => api(`/drive/${seg(kind)}/${id}`, { method: 'DELETE' }),
  copy: (kind: Kind, id: string, input: CopyItemInput) =>
    api<DriveFileDto | { status: 'completed'; folder: DriveFolderDto } | { status: 'queued' }>(`/drive/${seg(kind)}/${id}/copy`, { method: 'POST', body: input }),
  star: (kind: Kind, id: string, starred: boolean) => api(`/drive/${seg(kind)}/${id}/star`, { method: starred ? 'PUT' : 'DELETE' }),
  activity: (kind: Kind, id: string, cursor?: string) => api<Paginated<ActivityDto>>(`/drive/${seg(kind)}/${id}/activity`, { query: { cursor, limit: 30 } }),

  upload: (file: File, folderId: string | undefined, onProgress?: (f: number) => void, signal?: AbortSignal) =>
    uploadFile<DriveFileDto>('/drive/files/upload', file, { query: { folderId }, onProgress, signal }),
  versions: (id: string) => api<FileVersionDto[]>(`/drive/files/${id}/versions`),
  uploadVersion: (id: string, file: File, onProgress?: (f: number) => void) => uploadFile<DriveFileDto>(`/drive/files/${id}/versions`, file, { onProgress }),
  restoreVersion: (id: string, versionId: string) => api<DriveFileDto>(`/drive/files/${id}/versions/${versionId}/restore`, { method: 'POST' }),
  deleteVersion: (id: string, versionId: string) => api<{ freedBytes: number }>(`/drive/files/${id}/versions/${versionId}`, { method: 'DELETE' }),

  /** Same-origin URLs authorised by the httpOnly media cookie — safe to use in <img>, <video> and <a download>. */
  downloadUrl: (id: string) => buildUrl(`/drive/files/${id}/download`),
  contentUrl: (id: string) => buildUrl(`/drive/files/${id}/content`),
  /** Bytes for a card's thumbnail (a video's first frame, a text file's first lines); not recorded as an open. */
  thumbnailContentUrl: (id: string) => buildUrl(`/drive/files/${id}/content`, { purpose: 'thumbnail' }),
  /** `thumbnailUrl` from a file DTO is an API path. */
  thumbnailUrl: (path: string) => `/api${path}`,
  versionDownloadUrl: (id: string, versionId: string) => buildUrl(`/drive/files/${id}/versions/${versionId}/download`),

  // sharing
  sharing: (kind: Kind, id: string) => api<SharingStateDto>(`/drive/${seg(kind)}/${id}/share`),
  share: (kind: Kind, id: string, input: ShareInput) => api<SharingStateDto>(`/drive/${seg(kind)}/${id}/share`, { method: 'POST', body: input }),
  updatePermission: (kind: Kind, id: string, permissionId: string, input: UpdatePermissionInput) =>
    api<SharingStateDto>(`/drive/${seg(kind)}/${id}/permissions/${permissionId}`, { method: 'PATCH', body: input }),
  removePermission: (kind: Kind, id: string, permissionId: string) => api(`/drive/${seg(kind)}/${id}/permissions/${permissionId}`, { method: 'DELETE' }),
  cancelInvite: (kind: Kind, id: string, inviteId: string) => api(`/drive/${seg(kind)}/${id}/invites/${inviteId}`, { method: 'DELETE' }),
  setGeneralAccess: (kind: Kind, id: string, input: GeneralAccessInput) => api<SharingStateDto>(`/drive/${seg(kind)}/${id}/general-access`, { method: 'PUT', body: input }),
  rotateLink: (kind: Kind, id: string) => api<SharingStateDto>(`/drive/${seg(kind)}/${id}/link/rotate`, { method: 'POST' }),
};

/** In-app route for opening an item. */
export function openPath(item: { kind: 'file' | 'folder'; id: string; fileType?: string; resourceId?: string | null }): string {
  if (item.kind === 'folder') return `/drive/folder/${item.id}`;
  switch (item.fileType) {
    case 'DOCUMENT':
      return `/docs/${item.resourceId}`;
    case 'SPREADSHEET':
      return `/sheets/${item.resourceId}`;
    case 'FORM':
      return `/forms/${item.resourceId}/edit`;
    default:
      return `/drive/file/${item.id}`;
  }
}

/** Canonical ecosystem URL for opening an item at its dedicated subdomain. */
export function openServiceUrl(item: { kind: 'file' | 'folder'; id: string; fileType?: string; resourceId?: string | null }): string {
  if (item.kind === 'folder') return getServiceUrl('drive', '/drive/folder/' + item.id);
  switch (item.fileType) {
    case 'DOCUMENT':
      return getServiceUrl('docs', '/docs/' + item.resourceId);
    case 'SPREADSHEET':
      return getServiceUrl('sheets', '/sheets/' + item.resourceId);
    case 'FORM':
      return getServiceUrl('forms', '/forms/' + item.resourceId + '/edit');
    default:
      return getServiceUrl('drive', '/drive/file/' + item.id);
  }
}
