import { createFileRoute, redirect } from '@tanstack/react-router';
import { startPagePath } from '@/features/drive/drive-prefs';

function resolveSubdomainDestination(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.startsWith('docs.')) return '/docs';
    if (host.startsWith('sheets.')) return '/sheets';
    if (host.startsWith('forms.')) return '/forms';
    if (host.startsWith('drive.')) return '/drive';
    if (host.startsWith('pdf.')) return '/drive?filter=pdf';
  }
  return startPagePath();
}

export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: () => {
    // If accessing via dedicated service subdomain (docs., sheets., drive., pdf.), land directly in that service.
    // Otherwise fallback to the start page chosen in Drive settings.
    throw redirect({ to: resolveSubdomainDestination() });
  },
});
