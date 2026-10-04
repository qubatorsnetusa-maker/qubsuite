import { createFileRoute } from '@tanstack/react-router';
import { MyDrivePage } from '@/features/drive/drive-pages';
import { driveSearchSchema } from '@/features/drive/route-search';

export const Route = createFileRoute('/_authenticated/drive/')({
  validateSearch: driveSearchSchema,
  component: MyDrivePage,
});
