import { createFileRoute, redirect } from '@tanstack/react-router';
import { announceDriveChange, newNativeSearch } from '@/features/drive/create-actions';
import { docsService } from '@/services/docs';

/** Creates a document, then replaces this history entry with the editor (reloading won't create another). */
export const Route = createFileRoute('/_authenticated/docs/new')({
  validateSearch: newNativeSearch,
  pendingMs: 0,
  beforeLoad: async ({ search, preload }) => {
    if (preload) return;
    const doc = await docsService.create({ folderId: search.folder, templateId: search.template });
    announceDriveChange();
    throw redirect({ to: '/docs/$documentId', params: { documentId: doc.id }, replace: true });
  },
});
