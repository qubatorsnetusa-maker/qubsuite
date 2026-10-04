import { createFileRoute } from '@tanstack/react-router';
import { DriveLayout } from '@/features/drive/drive-layout';

export const Route = createFileRoute('/_authenticated/drive')({
  component: DriveLayout,
});
