import { createFileRoute } from '@tanstack/react-router';
import { AdminStoragePage } from '@/features/admin/storage-page';

export const Route = createFileRoute('/_authenticated/admin/storage')({
  component: AdminStoragePage,
});
