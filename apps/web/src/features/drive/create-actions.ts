import { getServiceUrl, type EcosystemService } from '@/lib/ecosystem-urls';
import { templateIdSchema, type NativeFileType } from '@qub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import { qk } from '@/services/query-keys';

/** `/docs/new`, `/sheets/new`, `/forms/new` take the destination folder (default: My Drive) and an optional template. */
export const newNativeSearch = z.object({ folder: z.uuid().optional().catch(undefined), template: templateIdSchema.optional().catch(undefined) });

/** App home pages and galleries (`/docs`, `/docs/templates`, …) carry the folder a "New" came from. */
export const appHomeSearch = z.object({ folder: z.uuid().optional().catch(undefined) });

const HOME_PATHS: Record<NativeFileType, string> = { DOCUMENT: '/docs', SPREADSHEET: '/sheets', FORM: '/forms' };
const SERVICE_BY_TYPE: Record<NativeFileType, EcosystemService> = {
  DOCUMENT: 'docs',
  SPREADSHEET: 'sheets',
  FORM: 'forms',
};

/**
 * "New → Qub Docs/Sheets/Forms": opens the app's home page (blank + templates + recent files) in a new tab
 * at its canonical subdomain (docs.qubdocs.online, sheet.qubdocs.online, forms.qubdocs.online).
 * Anything created from there lands in folderId.
 */
export function openAppHome(type: NativeFileType, folderId?: string) {
  const path = HOME_PATHS[type];
  const isMobileOrApp = typeof navigator !== 'undefined' && (/QubDocsAndroid|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 1024);
  if (isMobileOrApp) {
    const target = folderId ? `${path}?folder=${encodeURIComponent(folderId)}` : path;
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }
  const service = SERVICE_BY_TYPE[type];
  const url = new URL(getServiceUrl(service, HOME_PATHS[type]));
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
