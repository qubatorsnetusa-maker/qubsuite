import { createFileRoute } from '@tanstack/react-router';
import { PublicSharePage } from '@/features/sharing/public-share-page';
import { ensureSession } from '@/hooks/use-auth';

export const Route = createFileRoute('/share/$token')({
  beforeLoad: () => ensureSession(),
  component: PublicSharePage,
});
