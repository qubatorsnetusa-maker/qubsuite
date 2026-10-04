import { createFileRoute } from '@tanstack/react-router';
import { StarredPage } from '@/features/drive/drive-pages';
import { driveSearchSchema } from '@/features/drive/route-search';

export const Route = createFileRoute('/_authenticated/drive/starred')({
  validateSearch: driveSearchSchema,
  component: StarredPage,
});
