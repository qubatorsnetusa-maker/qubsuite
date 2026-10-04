import { createFileRoute } from '@tanstack/react-router';
import { FillPage } from '@/features/forms/fill-page';
import { ensureSession } from '@/hooks/use-auth';

/** Respondent view. `$formId` here is the form's public id, never its database id. */
export const Route = createFileRoute('/forms/$formId/fill')({
  beforeLoad: () => ensureSession(),
  component: FillPage,
});
