import { createFileRoute } from '@tanstack/react-router';
import { TemplateGalleryPage } from '@/features/app-home/gallery-page';
import { appHomeSearch } from '@/features/drive/create-actions';

export const Route = createFileRoute('/_authenticated/sheets/templates')({
  validateSearch: appHomeSearch,
  component: Gallery,
});

function Gallery() {
  const { folder } = Route.useSearch();
  return <TemplateGalleryPage type="SPREADSHEET" folderId={folder} />;
}
