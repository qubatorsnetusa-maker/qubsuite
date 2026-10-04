import { createFileRoute } from '@tanstack/react-router';
import { FormV2Frame } from '@/features/formsv2/layout/formv2-frame';

/** Frame (top bar, tabs, builder operations) shared by the Content, Workflow, Share and Results tabs. */
export const Route = createFileRoute('/_authenticated/formsv2/$formId')({
  component: Layout,
});

function Layout() {
  const { formId } = Route.useParams();
  return <FormV2Frame formId={formId} />;
}
