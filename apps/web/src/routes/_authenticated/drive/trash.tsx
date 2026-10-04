import { createFileRoute } from '@tanstack/react-router';
import { TrashPage } from '@/features/drive/drive-pages';
import { trashSearchSchema } from '@/features/drive/route-search';

export const Route = createFileRoute('/_authenticated/drive/trash')({
  validateSearch: trashSearchSchema,
  component: TrashPage,
});
