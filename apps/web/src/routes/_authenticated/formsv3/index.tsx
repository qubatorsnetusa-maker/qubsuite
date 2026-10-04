import { createFileRoute } from '@tanstack/react-router';
import { WorkspacePage } from '@/formsV3/pages/workspace';
import { createWorkspaceFn } from '@/formsV3/api/workspaces';
import {
  preferencesQuery,
  workspaceFormsQuery,
  workspaceSubmissionsQuery,
  workspacesQuery,
} from '@/formsV3/api/queries';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/_authenticated/formsv3/')({
  loader: async ({ context: { queryClient } }) => {
    let { workspaces } = await queryClient.fetchQuery(workspacesQuery);

    if (workspaces.length === 0) {
      const { workspace } = await createWorkspaceFn({ data: { name: 'My Workspace' } });
      workspaces = [workspace];
    }

    const activeWorkspaceId = workspaces[0]!.id;

    const [{ forms, formStats }, { submissions }, { preferences }] = await Promise.all([
      queryClient.fetchQuery(workspaceFormsQuery(activeWorkspaceId)),
      queryClient.fetchQuery(workspaceSubmissionsQuery(activeWorkspaceId)),
      queryClient.fetchQuery(preferencesQuery),
    ]);

    return { workspaces, activeWorkspaceId, forms, formStats, submissions, preferences };
  },
  component: FormsV3HomeComponent,
});

function FormsV3HomeComponent() {
  const data = Route.useLoaderData();
  const { user } = useAuth();
  return (
    <WorkspacePage
      {...data}
      userName={user?.name ?? 'User'}
      userEmail={user?.email ?? ''}
    />
  );
}
