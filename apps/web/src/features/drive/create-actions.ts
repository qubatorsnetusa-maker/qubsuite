import { templateIdSchema, type NativeFileType } from '@qub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import { qk } from '@/services/query-keys';

/** `/docs/new`, `/sheets/new`, `/forms/new` take the destination folder (default: My Drive) and an optional template. */
export const newNativeSearch = z.object({ folder: z.uuid().optional(), template: templateIdSchema.optional() });

/** App home pages and galleries (`/docs`, `/docs/templates`, …) carry the folder a "New" came from. */
export const appHomeSearch = z.object({ folder: z.uuid().optional() });

const HOME_PATHS: Record<NativeFileType, string> = { DOCUMENT: '/docs', SPREADSHEET: '/sheets', FORM: '/forms' };

/**
 * "New → Qub Docs/Sheets/Forms": opens the app's home page (blank + templates + recent files) in a new tab.
 * Anything created from there lands in `folderId`. The tab is opened synchronously from the click, so popup
 * blockers allow it.
 */
export function openAppHome(type: NativeFileType, folderId?: string) {
  const base = window.location.pathname.startsWith('/qubsuite') ? '/qubsuite' : '';
  const url = new URL(base + HOME_PATHS[type], window.location.origin);
  if (folderId) url.searchParams.set('folder', folderId);
  window.open(url.href, '_blank', 'noopener');
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('qub-drive') : null;

/** Tells other open tabs that Drive contents changed (e.g. a file was created in a new tab). */
export function announceDriveChange() {
  channel?.postMessage('changed');
}

/** Refreshes Drive listings when another tab changes Drive contents. */
export function useDriveChangesFromOtherTabs() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!channel) return;
    const onMessage = () => void qc.invalidateQueries({ queryKey: qk.drive.all });
    channel.addEventListener('message', onMessage);
    return () => channel.removeEventListener('message', onMessage);
  }, [qc]);
}
