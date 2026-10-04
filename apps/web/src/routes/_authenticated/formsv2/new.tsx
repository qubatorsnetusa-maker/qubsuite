import { createFileRoute, redirect } from '@tanstack/react-router';
import { newNativeSearch } from '@/features/drive/create-actions';
import { createV2Form } from '@/features/formsv2/home/create-v2-form';

/** Creates a one-question-at-a-time form, then replaces this history entry with the builder (reloading won't create another). */
export const Route = createFileRoute('/_authenticated/formsv2/new')({
  validateSearch: newNativeSearch,
  pendingMs: 0,
  beforeLoad: async ({ search, preload }) => {
    if (preload) return;
    const formId = await createV2Form(search);
    throw redirect({ to: '/formsv2/$formId/content', params: { formId }, replace: true });
  },
});
