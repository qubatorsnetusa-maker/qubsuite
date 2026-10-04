import { createFileRoute } from '@tanstack/react-router';
import { PreviewPage } from '@/features/forms/preview-page';

export const Route = createFileRoute('/_authenticated/forms/$formId/preview')({
  component: PreviewPage,
});
