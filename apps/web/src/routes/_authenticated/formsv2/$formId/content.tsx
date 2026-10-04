import { createFileRoute } from '@tanstack/react-router';
import { ContentTab } from '@/features/formsv2/content/content-tab';

export const Route = createFileRoute('/_authenticated/formsv2/$formId/content')({
  component: ContentTab,
});
