import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AdminAuditPage } from '@/features/admin/audit-page';

export const Route = createFileRoute('/_authenticated/admin/audit')({
  validateSearch: z.object({ tab: z.enum(['audit', 'activity']).default('audit') }),
  component: Audit,
});

function Audit() {
  return <AdminAuditPage tab={Route.useSearch().tab} />;
}
