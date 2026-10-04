import { createFileRoute } from '@tanstack/react-router';
import { FolderPage } from '@/features/drive/drive-pages';
import { driveSearchSchema } from '@/features/drive/route-search';

export const Route = createFileRoute('/_authenticated/drive/folder/$folderId')({
  validateSearch: driveSearchSchema,
  component: FolderPage,
});
