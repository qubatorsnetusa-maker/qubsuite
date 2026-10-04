import { createFileRoute } from '@tanstack/react-router';
import { AppHomePage } from '@/features/app-home/home-page';
import { appHomeSearch } from '@/features/drive/create-actions';

export const Route = createFileRoute('/_authenticated/docs/')({
  validateSearch: appHomeSearch,
  component: Home,
});

function Home() {
  const { folder } = Route.useSearch();
  return <AppHomePage type="DOCUMENT" folderId={folder} />;
}
