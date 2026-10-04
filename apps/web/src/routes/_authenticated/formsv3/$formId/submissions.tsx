import { createFileRoute } from '@tanstack/react-router';
import SubmissionsPage from '@/formsV3/pages/SubmissionsView';
import {
  formQuery,
  workspaceFormsQuery,
  workspaceSubmissionsQuery,
  workspacesQuery,
} from '@/formsV3/api/queries';

export const Route = createFileRoute('/_authenticated/formsv3/$formId/submissions')({
  loader: async ({ params, context: { queryClient } }) => {
    const { form } = await queryClient.fetchQuery(formQuery(params.formId));
    let workspaceId = form.workspaceId;
    if (!workspaceId) {
      const { workspaces } = await queryClient.fetchQuery(workspacesQuery);
      workspaceId = workspaces[0]?.id ?? '';
    }

    const [{ forms, formStats }, { submissions }] = await Promise.all([
      queryClient.fetchQuery(workspaceFormsQuery(workspaceId)),
      queryClient.fetchQuery(workspaceSubmissionsQuery(workspaceId)),
    ]);

    return {
      workspaceId,
      forms,
      formStats,
      submissions,
      activeFormId: params.formId,
    };
  },
  component: FormsV3SubmissionsComponent,
});

function FormsV3SubmissionsComponent() {
  const data = Route.useLoaderData();
  return <SubmissionsPage {...data} />;
}
