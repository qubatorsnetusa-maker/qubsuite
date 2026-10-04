import { createFileRoute } from '@tanstack/react-router';
import { SpamPage } from '@/features/drive/drive-pages';
import { driveSearchSchema } from '@/features/drive/route-search';

export const Route = createFileRoute('/_authenticated/drive/spam')({
  validateSearch: driveSearchSchema,
  component: SpamPage,
});
