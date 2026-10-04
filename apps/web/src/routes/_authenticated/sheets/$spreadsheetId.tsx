import { createFileRoute } from '@tanstack/react-router';
import { SheetPage } from '@/features/sheets/sheet-page';

export const Route = createFileRoute('/_authenticated/sheets/$spreadsheetId')({
  component: SheetPage,
});
