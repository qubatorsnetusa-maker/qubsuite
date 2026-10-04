import type { DriveItemDto, DriveListResult, Paginated } from '@qub/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';
import { driveService, type ListingQuery } from '@/services/drive';
import { qk } from '@/services/query-keys';

export type DriveView = 'shared' | 'recent' | 'starred' | 'trash' | 'spam';
export type ModifiedPreset = 'today' | 'week' | 'month' | 'year' | 'lastYear';
export interface SortState {
  sort?: 'name' | 'updatedAt' | 'createdAt' | 'size';
  order?: 'asc' | 'desc';
  type?: string;
  /** "People" filter: owned by me / not by me, or one person's id. */
  owner?: 'me' | 'not_me';
  person?: string;
  modified?: ModifiedPreset;
}

type Page = Paginated<DriveItemDto> | DriveListResult;

// Docs/Sheets/Forms open in their own tabs, where files get renamed, moved and shared; returning to a Drive tab
// always refreshes its listing instead of waiting for the data to go stale.
const REFETCH_ON_RETURN = { refetchOnWindowFocus: 'always' } as const;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Date range for a "Modified" preset, in the viewer's time zone; ranges start at midnight so query keys are stable. */
export function modifiedRange(m: ModifiedPreset | undefined): Pick<ListingQuery, 'modifiedAfter' | 'modifiedBefore'> {
  if (!m) return {};
  const today = startOfDay(new Date());
  const daysAgo = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n).toISOString();
  switch (m) {
    case 'today':
      return { modifiedAfter: today.toISOString() };
    case 'week':
      return { modifiedAfter: daysAgo(7) };
    case 'month':
      return { modifiedAfter: daysAgo(30) };
    case 'year':
      return { modifiedAfter: new Date(today.getFullYear(), 0, 1).toISOString() };
    case 'lastYear':
      return { modifiedAfter: new Date(today.getFullYear() - 1, 0, 1).toISOString(), modifiedBefore: new Date(today.getFullYear(), 0, 1).toISOString() };
  }
}

/** The API query for a listing's sort and filter state. */
function listingQuery(s: SortState): ListingQuery {
  return {
    sort: s.sort,
    order: s.order,
    type: s.type as ListingQuery['type'],
    owner: s.owner,
    ownerId: s.person,
    ...modifiedRange(s.modified),
  };
}

/** Children of a folder (or My Drive), paginated server-side. */
export function useDriveFiles(folderId: string | undefined, s: SortState) {
  const q = { ...listingQuery(s), sort: s.sort ?? 'name', order: s.order ?? 'asc' };
  return useInfiniteQuery({
    queryKey: qk.drive.list(folderId, q),
    queryFn: ({ pageParam }) => driveService.list({ ...q, folderId, cursor: pageParam, limit: 100 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    ...REFETCH_ON_RETURN,
  });
}

function viewQuery(view: DriveView, s: SortState) {
  const fetcher = { shared: driveService.shared, recent: driveService.recent, starred: driveService.starred, trash: driveService.trash, spam: driveService.spam }[view];
  const q = listingQuery(s);
  return {
    queryKey: qk.drive.view(view, q),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetcher({ ...q, cursor: pageParam, limit: 100 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Paginated<DriveItemDto>) => last.nextCursor ?? undefined,
    ...REFETCH_ON_RETURN,
  };
}

export const useSharedFiles = (s: SortState) => useInfiniteQuery(viewQuery('shared', s));
export const useRecentFiles = (s: SortState) => useInfiniteQuery(viewQuery('recent', s));
export const useStarredFiles = (s: SortState) => useInfiniteQuery(viewQuery('starred', s));
export const useTrashFiles = (s: SortState) => useInfiniteQuery(viewQuery('trash', s));
export const useSpamFiles = (s: SortState) => useInfiniteQuery(viewQuery('spam', s));

/** Moves items to Spam (optionally blocking the owner); they leave every other view at once. */
export function useReportSpam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item, blockOwner }: { item: DriveItemDto; blockOwner: boolean }) => driveService.reportSpam(item.kind, item.id, blockOwner),
    onMutate: ({ item }) => ({ rollback: patchListings(qc, (list) => list.filter((i) => i.id !== item.id)) }),
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (_r, { item, blockOwner }) =>
      toast.success(blockOwner ? `${item.owner.name} is blocked. Everything they shared with you is in Spam.` : `"${item.name}" moved to Spam`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export function useNotSpam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: DriveItemDto[]) => {
      for (const i of items) await driveService.notSpam(i.kind, i.id);
      return items;
    },
    onMutate: (items) => {
      const ids = new Set(items.map((i) => i.id));
      return { rollback: patchListings(qc, (list) => list.filter((i) => !(i.isSpam && ids.has(i.id)))) };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (items) => toast.success(items.length === 1 ? `"${items[0]!.name}" moved back to Shared with me` : `${items.length} items moved back to Shared with me`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

/** Removes the viewer's access to items shared with them (the owner's copies are untouched). */
export function useRemoveAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: DriveItemDto[]) => {
      for (const i of items) await driveService.removeAccess(i.kind, i.id);
      return items;
    },
    onMutate: (items) => {
      const ids = new Set(items.map((i) => i.id));
      return { rollback: patchListings(qc, (list) => list.filter((i) => !ids.has(i.id))) };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (items) => toast.success(items.length === 1 ? `"${items[0]!.name}" removed from your Drive` : `${items.length} items removed from your Drive`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export function useEmptySpam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: driveService.emptySpam,
    onSuccess: (r) => toast.success(`${r.removed} item${r.removed === 1 ? '' : 's'} removed from Spam`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export const useBlockedPeople = (enabled = true) => useQuery({ queryKey: qk.drive.blocked, queryFn: driveService.blocked, enabled });

export function useUnblock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user: { id: string; name: string }) => driveService.unblock(user.id),
    onSuccess: (_r, user) => toast.success(`${user.name} is unblocked`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.blocked }),
  });
}

export function useTrashedFolder(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.drive.trashedFolder(id ?? ''),
    enabled: !!id,
    queryFn: ({ pageParam }) => driveService.trashedFolder(id!, { cursor: pageParam, limit: 100 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export const useDriveFolders = (folderId: string | undefined) =>
  useQuery({ queryKey: qk.drive.folder(folderId ?? 'root'), queryFn: () => (folderId ? driveService.folder(folderId) : driveService.root()) });
export const useDriveFile = (id: string) => useQuery({ queryKey: qk.drive.file(id), queryFn: () => driveService.file(id) });
export const useFileVersions = (id: string, enabled = true) => useQuery({ queryKey: qk.drive.versions(id), queryFn: () => driveService.versions(id), enabled });

export function flattenPages(data: InfiniteData<Page> | undefined): DriveItemDto[] {
  return data?.pages.flatMap((p) => p.items) ?? [];
}

/** Applies `fn` to every cached Drive listing (all folders and views) for optimistic updates. */
function patchListings(qc: ReturnType<typeof useQueryClient>, fn: (items: DriveItemDto[]) => DriveItemDto[]) {
  const snapshots: [QueryKey, unknown][] = qc.getQueriesData({ queryKey: ['drive'] });
  for (const [key, value] of snapshots) {
    const data = value as InfiniteData<Page> | undefined;
    if (!data?.pages?.[0] || !('items' in data.pages[0])) continue;
    qc.setQueryData(key, { ...data, pages: data.pages.map((p) => ({ ...p, items: fn(p.items) })) });
  }
  return () => {
    for (const [key, value] of snapshots) qc.setQueryData(key, value);
  };
}

export function useInvalidateDrive() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.drive.all });
}

export function useStarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item, starred }: { item: DriveItemDto; starred: boolean }) => driveService.star(item.kind, item.id, starred),
    onMutate: ({ item, starred }) => ({ rollback: patchListings(qc, (items) => items.map((i) => (i.id === item.id ? { ...i, isStarred: starred } : i))) }),
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.view('starred').slice(0, 3) }),
  });
}

export function useTrashItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: DriveItemDto[]) => {
      for (const item of items) await driveService.trashItem(item.kind, item.id);
      return items;
    },
    onMutate: (items) => {
      const ids = new Set(items.map((i) => i.id));
      return { rollback: patchListings(qc, (list) => list.filter((i) => !ids.has(i.id))) };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (items) => toast.success(items.length === 1 ? `"${items[0]!.name}" moved to trash` : `${items.length} items moved to trash`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export function useMoveItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ items, folderId }: { items: Pick<DriveItemDto, 'kind' | 'id' | 'name'>[]; folderId: string; folderName?: string }) => {
      for (const item of items) await driveService.move(item.kind, item.id, folderId);
    },
    onMutate: ({ items, folderId }) => {
      const ids = new Set(items.filter((i) => i.id !== folderId).map((i) => i.id));
      return { rollback: patchListings(qc, (list) => list.filter((i) => !ids.has(i.id))) };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (_d, { items, folderName }) => toast.success(`Moved ${items.length === 1 ? `"${items[0]!.name}"` : `${items.length} items`}${folderName ? ` to "${folderName}"` : ''}`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export function useRestoreItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: DriveItemDto[]) => {
      for (const item of items) await driveService.restore(item.kind, item.id);
      return items;
    },
    onSuccess: (items) => toast.success(items.length === 1 ? `"${items[0]!.name}" restored` : `${items.length} items restored`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export function useDeleteForever() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: DriveItemDto[]) => {
      for (const item of items) await driveService.deleteForever(item.kind, item.id);
      return items;
    },
    onSuccess: (items) => toast.success(items.length === 1 ? `"${items[0]!.name}" deleted forever` : `${items.length} items deleted forever`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export function useRenameItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item, name }: { item: Pick<DriveItemDto, 'kind' | 'id'>; name: string }) => driveService.update(item.kind, item.id, { name }),
    onMutate: ({ item, name }) => ({ rollback: patchListings(qc, (items) => items.map((i) => (i.id === item.id ? { ...i, name } : i))) }),
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export function useCopyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: DriveItemDto) => driveService.copy(item.kind, item.id, {}),
    onSuccess: (result) => {
      if ('status' in result && result.status === 'queued') toast.info('Copying in the background. We’ll notify you when it’s ready.');
      else toast.success('Copy created');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: driveService.createFolder,
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

/** The signed-in user's storage (sidebar meter and Storage page). Refreshed with every Drive change. */
export const useMyStorage = () => useQuery({ queryKey: qk.drive.storage, queryFn: driveService.storage, staleTime: 30_000 });

export const usePeople = (enabled = true) => useQuery({ queryKey: qk.drive.people, queryFn: driveService.people, staleTime: 5 * 60_000, enabled });

export function useDeleteVersion(fileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => driveService.deleteVersion(fileId, versionId),
    onSuccess: (r) => toast.success(`Version deleted. ${formatBytes(r.freedBytes)} freed.`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}

export function useEmptyTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: driveService.emptyTrash,
    onSuccess: (r) => toast.success(`${r.deleted} item${r.deleted === 1 ? '' : 's'} permanently deleted`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.drive.all }),
  });
}
