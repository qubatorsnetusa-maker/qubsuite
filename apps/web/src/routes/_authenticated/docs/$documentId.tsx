import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { DocPage } from '@/features/docs/doc-page';

export const Route = createFileRoute('/_authenticated/docs/$documentId')({
  validateSearch: z.object({ comment: z.string().optional() }),
  component: DocPage,
});
