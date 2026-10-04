import { createFileRoute, redirect } from '@tanstack/react-router';
import { startPagePath } from '@/features/drive/drive-prefs';

export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: () => {
    // The start page chosen in Drive settings (My Drive unless changed).
    throw redirect({ to: startPagePath() });
  },
});
