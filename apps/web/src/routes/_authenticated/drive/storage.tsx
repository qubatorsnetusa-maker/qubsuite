import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { StoragePage } from '@/features/drive/storage-page';

export const Route = createFileRoute('/_authenticated/drive/storage')({
  validateSearch: z.object({ preview: z.uuid().optional() }),
  component: StoragePage,
});
