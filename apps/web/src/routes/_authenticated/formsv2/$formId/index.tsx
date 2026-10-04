import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/formsv2/$formId/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/formsv2/$formId/content', params, replace: true });
  },
});
