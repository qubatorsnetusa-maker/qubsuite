import { createFileRoute } from '@tanstack/react-router';
import { driveQuerySearchSchema } from '@/features/drive/route-search';
import { SearchPage } from '@/features/drive/search-page';

export const Route = createFileRoute('/_authenticated/drive/search')({
  validateSearch: driveQuerySearchSchema,
  component: SearchPage,
});
