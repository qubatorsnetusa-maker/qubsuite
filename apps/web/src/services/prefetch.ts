import type { DriveItemDto, NativeFileType } from '@qub/shared';
import type { QueryClient } from '@tanstack/react-query';
import { docsService } from './docs';
import { formsService } from './forms';
import { qk } from './query-keys';
import { sheetsService } from './sheets';

/**
 * Optimistically prefetches document, spreadsheet, or form data when the user hovers or focuses
 * an item card or row. By the time the user clicks or double-clicks, the data is already resident
 * in TanStack Query cache, making transitions feel instantaneous.
 */
export function prefetchItemResource(
  qc: QueryClient,
  item: { kind: 'file' | 'folder'; fileType?: string; resourceId?: string | null }
) {
  if (item.kind !== 'file' || !item.resourceId) return;

  const staleTime = 60_000;

  switch (item.fileType) {
    case 'DOCUMENT':
      void qc.prefetchQuery({
        queryKey: qk.docs.one(item.resourceId),
        queryFn: () => docsService.get(item.resourceId!),
        staleTime,
      });
      void qc.prefetchQuery({
        queryKey: qk.docs.collaborators(item.resourceId),
        queryFn: () => docsService.collaborators(item.resourceId!),
        staleTime,
      });
      break;

    case 'SPREADSHEET':
      void qc.prefetchQuery({
        queryKey: qk.sheets.one(item.resourceId),
        queryFn: () => sheetsService.get(item.resourceId!),
        staleTime,
      });
      break;

    case 'FORM':
      void qc.prefetchQuery({
        queryKey: qk.forms.one(item.resourceId),
        queryFn: () => formsService.get(item.resourceId!),
        staleTime,
      });
      break;
  }
}
