import { PLATFORM_ROLES } from '@qub/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AdminUsersPage } from '@/features/admin/users-page';

export const Route = createFileRoute('/_authenticated/admin/users')({
  validateSearch: z.object({
    q: z.string().max(200).optional(),
    role: z.enum(PLATFORM_ROLES).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    /** Opens the "Add person" dialog. */
    new: z.boolean().optional(),
  }),
  component: Users,
});

function Users() {
  return <AdminUsersPage search={Route.useSearch()} />;
}
