import { createFileRoute } from '@tanstack/react-router';
import { DesignTab } from '@/features/formsv2/design/design-tab';

export const Route = createFileRoute('/_authenticated/formsv2/$formId/design')({
  component: DesignTab,
});
