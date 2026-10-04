import { createFileRoute } from '@tanstack/react-router';
import { ShareTab } from '@/features/formsv2/share/share-tab';

export const Route = createFileRoute('/_authenticated/formsv2/$formId/share')({
  component: ShareTab,
});
