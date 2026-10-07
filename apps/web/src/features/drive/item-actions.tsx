import type { DriveItemDto, FileType } from '@qub/shared';
import { useNavigate } from '@tanstack/react-router';
import { CircleMinus, Copy, Download, ExternalLink, Eye, FolderInput, Info, OctagonAlert, Pencil, RotateCcw, ShieldCheck, Star, StarOff, Trash, Trash2, UserPlus } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/dialog';
import { driveService, openPath, openServiceUrl } from '@/services/drive';
import { ShareDialog, type ShareTarget } from '../sharing/share-dialog';
import { MoveDialog, RenameDialog } from './dialogs';
import { useCopyItem, useDeleteForever, useNotSpam, useRemoveAccess, useRestoreItems, useStarItem, useTrashItems } from './queries';
import { ReportSpamDialog } from './spam-dialogs';
import { useOptionalTransfers } from './transfer-manager';

export interface ItemActionsApi {
  open(item: DriveItemDto): void;
  /** Full-screen viewer for uploaded images, PDFs, video, audio and text. */
  preview(item: DriveItemDto): void;
  share(item: DriveItemDto): void;
  rename(item: DriveItemDto): void;
  move(items: DriveItemDto[]): void;
  copy(item: DriveItemDto): void;
  star(items: DriveItemDto[], starred: boolean): void;
  download(items: DriveItemDto[]): void;
  details(item: DriveItemDto | null): void;
  trash(items: DriveItemDto[]): void;
  restore(items: DriveItemDto[]): void;
  deleteForever(items: DriveItemDto[]): void;
  /** Report something shared with you as spam (optionally blocking its owner). */
  reportSpam(item: DriveItemDto): void;
  notSpam(items: DriveItemDto[]): void;
  /** Remove items shared with you from your Drive (your access only). */
  removeAccess(items: DriveItemDto[]): void;
  detailsItem: DriveItemDto | null;
}

const NATIVE = ['DOCUMENT', 'SPREADSHEET', 'FORM'];
/** Uploaded file types the viewer can show. */
export const PREVIEWABLE: readonly FileType[] = ['IMAGE', 'PDF', 'VIDEO', 'AUDIO', 'TEXT'];
export const isPreviewable = (f: { kind: string; fileType?: FileType; isTrashed?: boolean }) => f.kind === 'file' && !f.isTrashed && PREVIEWABLE.includes(f.fileType!);
export const isDownloadable = (i: DriveItemDto) => i.kind === 'file' && i.capabilities.canDownload && !NATIVE.includes(i.fileType);

const Ctx = createContext<ItemActionsApi | null>(null);

export function useItemActions(): ItemActionsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useItemActions outside ItemActionsProvider');
  return ctx;
}

/**
 * Owns the dialogs for Drive item actions so every view (grid, list, search, details) shares one implementation.
 * With `inlinePreview`, opening an uploaded file shows it in the listing's viewer (`?preview=<id>`) instead of
 * navigating away.
 */
export function ItemActionsProvider({ children, inlinePreview = false }: { children: ReactNode; inlinePreview?: boolean }) {
  const navigate = useNavigate();
  const transfers = useOptionalTransfers();
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [renameItem, setRenameItem] = useState<DriveItemDto | null>(null);
  const [moveItems, setMoveItems] = useState<DriveItemDto[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DriveItemDto[] | null>(null);
  const [detailsItem, setDetailsItem] = useState<DriveItemDto | null>(null);
  const starMut = useStarItem();
  const trashMut = useTrashItems();
  const restoreMut = useRestoreItems();
  const deleteMut = useDeleteForever();
  const copyMut = useCopyItem();
  const [spamItem, setSpamItem] = useState<DriveItemDto | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<DriveItemDto[] | null>(null);
  const notSpamMut = useNotSpam();
  const removeMut = useRemoveAccess();

  const preview = (item: DriveItemDto) => {
    if (inlinePreview) void navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...prev, preview: item.id }) } as never);
    else void navigate({ to: '/drive/file/$fileId', params: { fileId: item.id } });
  };

  const api: ItemActionsApi = {
    open: (item) => {
      if (item.isTrashed) {
        if (item.kind === 'folder') void navigate({ to: '/drive/trash', search: { folder: item.id } });
        return;
      }
      if (inlinePreview && item.kind === 'file' && !NATIVE.includes(item.fileType)) return preview(item);
      if (item.kind === 'file' && NATIVE.includes(item.fileType)) {
        window.open(openServiceUrl({ kind: item.kind, id: item.id, fileType: item.fileType, resourceId: item.resourceId }), '_blank', 'noopener');
        return;
      }
      void navigate({ href: openPath({ kind: item.kind, id: item.id, fileType: item.kind === 'file' ? item.fileType : undefined, resourceId: item.kind === 'file' ? item.resourceId : undefined }) });
    },
    preview,
    share: (item) => setShareTarget({ kind: item.kind, id: item.id, name: item.name }),
    rename: setRenameItem,
    move: setMoveItems,
    copy: (item) => copyMut.mutate(item),
    star: (items, starred) => items.forEach((item) => starMut.mutate({ item, starred })),
    download: (items) => {
      const files = items.filter(isDownloadable);
      if (transfers) return transfers.download(files);
      for (const item of files) {
        const a = document.createElement('a');
        a.href = driveService.downloadUrl(item.id);
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    },
    details: setDetailsItem,
    trash: (items) => trashMut.mutate(items),
    restore: (items) => restoreMut.mutate(items),
    deleteForever: setConfirmDelete,
    reportSpam: setSpamItem,
    notSpam: (items) => notSpamMut.mutate(items),
    removeAccess: setConfirmRemove,
    detailsItem,
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <ShareDialog target={shareTarget} onOpenChange={(o) => !o && setShareTarget(null)} />
      <RenameDialog item={renameItem} onOpenChange={(o) => !o && setRenameItem(null)} />
      <MoveDialog items={moveItems} onOpenChange={(o) => !o && setMoveItems(null)} />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete forever?"
        description={`${confirmDelete?.length === 1 ? `"${confirmDelete[0]!.name}"` : `${confirmDelete?.length} items`} will be deleted forever and can’t be restored.`}
        confirmLabel="Delete forever"
        destructive
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMut.mutate(confirmDelete, { onSettled: () => setConfirmDelete(null) });
        }}
      />
      <ReportSpamDialog item={spamItem} onOpenChange={(o) => !o && setSpamItem(null)} />
      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
        title={confirmRemove?.length === 1 ? `Remove “${confirmRemove[0]!.name}”?` : `Remove ${confirmRemove?.length} items?`}
        description="You’ll lose access and it disappears from your Drive. The owner’s copy isn’t affected; they can share it with you again."
        confirmLabel="Remove"
        destructive
        loading={removeMut.isPending}
        onConfirm={() => {
          if (confirmRemove) removeMut.mutate(confirmRemove, { onSettled: () => setConfirmRemove(null) });
        }}
      />
    </Ctx.Provider>
  );
}

export interface MenuEntry {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
  shortcut?: string;
}

/** Actions available for the current selection, filtered by the server-computed capabilities of each item. */
export function menuEntries(api: ItemActionsApi, selection: DriveItemDto[]): MenuEntry[] {
  if (!selection.length) return [];
  const one = selection.length === 1 ? selection[0]! : null;
  const all = (pred: (i: DriveItemDto) => boolean) => selection.every(pred);
  if (all((i) => i.isTrashed)) {
    return [
      { key: 'restore', label: 'Restore', icon: <RotateCcw />, onSelect: () => api.restore(selection) },
      { key: 'delete', label: 'Delete forever', icon: <Trash />, onSelect: () => api.deleteForever(selection), destructive: true },
    ];
  }
  if (all((i) => i.isSpam)) {
    return [
      ...(one ? [{ key: 'open', label: 'Open', icon: <ExternalLink />, onSelect: () => api.open(one) }] : []),
      { key: 'restore', label: 'Not spam', icon: <ShieldCheck />, onSelect: () => api.notSpam(selection) },
      ...(one ? [{ key: 'details', label: 'File information', icon: <Info />, onSelect: () => api.details(one), separatorBefore: true }] : []),
      { key: 'delete', label: 'Remove forever', icon: <Trash />, onSelect: () => api.removeAccess(selection), destructive: true, separatorBefore: true },
    ];
  }
  const entries: MenuEntry[] = [];
  if (one) entries.push({ key: 'open', label: 'Open', icon: <ExternalLink />, onSelect: () => api.open(one), shortcut: 'Enter' });
  if (one && isPreviewable(one)) entries.push({ key: 'preview', label: 'Preview', icon: <Eye />, onSelect: () => api.preview(one), shortcut: 'P' });
  if (all(isDownloadable)) {
    entries.push({ key: 'download', label: one ? 'Download' : `Download ${selection.length} files`, icon: <Download />, onSelect: () => api.download(selection) });
  }
  if (one && one.capabilities.canEdit) entries.push({ key: 'rename', label: 'Rename', icon: <Pencil />, onSelect: () => api.rename(one), shortcut: 'N' });
  if (one?.capabilities.canCopy) entries.push({ key: 'copy', label: 'Make a copy', icon: <Copy />, onSelect: () => api.copy(one) });
  if (one?.capabilities.canShare) entries.push({ key: 'share', label: 'Share', icon: <UserPlus />, onSelect: () => api.share(one), separatorBefore: true, shortcut: '.' });
  if (all((i) => i.capabilities.canEdit)) entries.push({ key: 'move', label: 'Move', icon: <FolderInput />, onSelect: () => api.move(selection), separatorBefore: !one?.capabilities.canShare, shortcut: 'Z' });
  const starred = all((i) => i.isStarred);
  entries.push({ key: 'star', label: starred ? 'Remove from starred' : 'Add to starred', icon: starred ? <StarOff /> : <Star />, onSelect: () => api.star(selection, !starred), shortcut: 'S' });
  if (one) entries.push({ key: 'details', label: 'File information', icon: <Info />, onSelect: () => api.details(one), separatorBefore: true, shortcut: 'I' });
  if (all((i) => i.capabilities.canTrash)) entries.push({ key: 'trash', label: 'Move to trash', icon: <Trash2 />, onSelect: () => api.trash(selection), separatorBefore: true, shortcut: 'Del' });
  // Items shared with you can be reported or removed from your Drive.
  if (one?.sharedWithMe) entries.push({ key: 'spam', label: 'Report spam or block', icon: <OctagonAlert />, onSelect: () => api.reportSpam(one), separatorBefore: true });
  if (all((i) => i.sharedWithMe)) entries.push({ key: 'remove', label: 'Remove', icon: <CircleMinus />, onSelect: () => api.removeAccess(selection), separatorBefore: !one });
  return entries;
}
