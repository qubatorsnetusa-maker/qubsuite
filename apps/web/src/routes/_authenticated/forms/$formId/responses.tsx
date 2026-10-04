import { createFileRoute } from '@tanstack/react-router';
import { ResponsesPage } from '@/features/forms/responses-page';

export const Route = createFileRoute('/_authenticated/forms/$formId/responses')({
  component: ResponsesPage,
});
