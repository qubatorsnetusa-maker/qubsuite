import { redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { ensureSession } from '@/hooks/use-auth';

/** Signed-in users visiting /login go straight to their Drive. */
function defaultDestination(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.startsWith('docs.')) return '/docs';
    if (host.startsWith('sheets.')) return '/sheets';
    if (host.startsWith('forms.')) return '/forms';
    if (host.startsWith('drive.')) return '/drive';
    if (host.startsWith('pdf.')) return '/drive?filter=pdf';
  }
  return '/drive';
}

export async function guestOnly() {
  const s = await ensureSession();
  if (s.status === 'authenticated') throw redirect({ to: defaultDestination() as any });
}

export const redirectSearch = z.object({ redirect: z.string().optional(), email: z.string().optional() });

export const tokenSearch = z.object({ token: z.string().default('') });
