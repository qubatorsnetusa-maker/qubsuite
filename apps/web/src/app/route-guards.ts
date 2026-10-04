import { redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { ensureSession } from '@/hooks/use-auth';

/** Signed-in users visiting /login go straight to their Drive. */
export async function guestOnly() {
  const s = await ensureSession();
  if (s.status === 'authenticated') throw redirect({ to: '/drive' });
}

export const redirectSearch = z.object({ redirect: z.string().optional(), email: z.string().optional() });

export const tokenSearch = z.object({ token: z.string().default('') });
