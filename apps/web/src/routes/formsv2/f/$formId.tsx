import { createFileRoute } from '@tanstack/react-router';
import { FillV2Page } from '@/features/formsv2/public/fill-v2-page';
import { ensureSession } from '@/hooks/use-auth';

/** Forms v2 respondent page. `$formId` here is the form's public id, never its database id. */
export const Route = createFileRoute('/formsv2/f/$formId')({
  beforeLoad: () => ensureSession(),
  component: FillV2Page,
});
