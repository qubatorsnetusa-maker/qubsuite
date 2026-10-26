import { createFileRoute } from '@tanstack/react-router';
import { PdfHome } from '@/features/pdf/pdf-home';

export const Route = createFileRoute('/_authenticated/pdf/')({
  component: PdfHome,
});
