import { createFileRoute, redirect } from '@tanstack/react-router';
import { announceDriveChange, newNativeSearch } from '@/features/drive/create-actions';
import { formsService } from '@/services/forms';

/** Creates a form, then replaces this history entry with the builder (reloading won't create another). */
export const Route = createFileRoute('/_authenticated/forms/new')({
  validateSearch: newNativeSearch,
  pendingMs: 0,
  beforeLoad: async ({ search, preload }) => {
    if (preload) return;
    const form = await formsService.create({ folderId: search.folder, templateId: search.template });
    announceDriveChange();
    throw redirect({ to: '/forms/$formId/edit', params: { formId: form.id }, replace: true });
  },
});
