import { createFileRoute } from '@tanstack/react-router';
import { appHomeSearch } from '@/features/drive/create-actions';
import { FormsV2Home } from '@/features/formsv2/home/formsv2-home';

export const Route = createFileRoute('/_authenticated/formsv2/')({
  validateSearch: appHomeSearch,
  component: Home,
});

function Home() {
  const { folder } = Route.useSearch();
  return <FormsV2Home folderId={folder} />;
}
