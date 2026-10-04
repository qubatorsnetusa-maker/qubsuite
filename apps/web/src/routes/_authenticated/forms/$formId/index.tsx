import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/forms/$formId/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/forms/$formId/edit', params });
  },
});
