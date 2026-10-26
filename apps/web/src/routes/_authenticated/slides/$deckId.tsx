import { createFileRoute } from '@tanstack/react-router';
import { SlidesPage } from '@/features/slides/slides-page';

export const Route = createFileRoute('/_authenticated/slides/$deckId')({
  component: SlidesPage,
});
