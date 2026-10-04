import { createFileRoute } from '@tanstack/react-router';
import { WorkflowTab } from '@/features/formsv2/workflow/workflow-tab';

export const Route = createFileRoute('/_authenticated/formsv2/$formId/workflow')({
  component: WorkflowTab,
});
