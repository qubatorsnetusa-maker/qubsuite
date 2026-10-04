import { createFileRoute } from '@tanstack/react-router';
import { RecentPage } from '@/features/drive/drive-pages';
import { driveSearchSchema } from '@/features/drive/route-search';

export const Route = createFileRoute('/_authenticated/drive/recent')({
  validateSearch: driveSearchSchema,
  component: RecentPage,
});
