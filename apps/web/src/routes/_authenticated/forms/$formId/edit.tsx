import { createFileRoute } from '@tanstack/react-router';
import { BuilderPage } from '@/features/forms/builder-page';

export const Route = createFileRoute('/_authenticated/forms/$formId/edit')({
  component: BuilderPage,
});
