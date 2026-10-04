import { createFileRoute } from '@tanstack/react-router';
import { SharedPage } from '@/features/drive/drive-pages';
import { driveSearchSchema } from '@/features/drive/route-search';

export const Route = createFileRoute('/_authenticated/drive/shared')({
  validateSearch: driveSearchSchema,
  component: SharedPage,
});
