import { ADMIN_CONTENT_TYPES } from '@qub/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AdminContentPage } from '@/features/admin/content-page';

export const Route = createFileRoute('/_authenticated/admin/content')({
  validateSearch: z.object({ type: z.enum(ADMIN_CONTENT_TYPES).default('DOCUMENT') }),
  component: Content,
});

function Content() {
  return <AdminContentPage type={Route.useSearch().type} />;
}
