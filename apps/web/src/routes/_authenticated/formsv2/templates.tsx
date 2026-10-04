import { createFileRoute } from '@tanstack/react-router';
import { appHomeSearch } from '@/features/drive/create-actions';
import { FormsV2Gallery } from '@/features/formsv2/home/formsv2-home';

export const Route = createFileRoute('/_authenticated/formsv2/templates')({
  validateSearch: appHomeSearch,
  component: Gallery,
});

function Gallery() {
  const { folder } = Route.useSearch();
  return <FormsV2Gallery folderId={folder} />;
}
