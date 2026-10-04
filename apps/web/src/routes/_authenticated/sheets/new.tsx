import { createFileRoute, redirect } from '@tanstack/react-router';
import { announceDriveChange, newNativeSearch } from '@/features/drive/create-actions';
import { sheetsService } from '@/services/sheets';

/** Creates a spreadsheet, then replaces this history entry with the editor (reloading won't create another). */
export const Route = createFileRoute('/_authenticated/sheets/new')({
  validateSearch: newNativeSearch,
  pendingMs: 0,
  beforeLoad: async ({ search, preload }) => {
    if (preload) return;
    const sheet = await sheetsService.create({ folderId: search.folder, templateId: search.template });
    announceDriveChange();
    throw redirect({ to: '/sheets/$spreadsheetId', params: { spreadsheetId: sheet.id }, replace: true });
  },
});
