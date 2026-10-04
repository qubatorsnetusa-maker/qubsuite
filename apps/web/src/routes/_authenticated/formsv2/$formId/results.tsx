import { createFileRoute } from '@tanstack/react-router';
import { ResultsTab } from '@/features/formsv2/results/results-tab';

export const Route = createFileRoute('/_authenticated/formsv2/$formId/results')({
  component: ResultsTab,
});
