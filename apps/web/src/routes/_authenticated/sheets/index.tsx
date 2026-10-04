import { createFileRoute } from '@tanstack/react-router';
import { AppHomePage } from '@/features/app-home/home-page';
import { appHomeSearch } from '@/features/drive/create-actions';

export const Route = createFileRoute('/_authenticated/sheets/')({
  validateSearch: appHomeSearch,
  component: Home,
});

function Home() {
  const { folder } = Route.useSearch();
  return <AppHomePage type="SPREADSHEET" folderId={folder} />;
}
