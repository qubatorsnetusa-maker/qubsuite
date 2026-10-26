import { createFileRoute, redirect } from '@tanstack/react-router';
import { appHomeSearch } from '@/features/drive/create-actions';

export const Route = createFileRoute('/_authenticated/formsv2/templates')({
  validateSearch: appHomeSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/forms/templates', search, replace: true });
  },
});
