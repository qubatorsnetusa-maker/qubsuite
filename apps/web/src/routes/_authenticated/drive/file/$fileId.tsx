import { createFileRoute } from '@tanstack/react-router';
import { FilePage } from '@/features/drive/file-page';

export const Route = createFileRoute('/_authenticated/drive/file/$fileId')({
  component: FilePage,
});
