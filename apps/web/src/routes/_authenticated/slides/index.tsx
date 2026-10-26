import { createFileRoute } from '@tanstack/react-router';
import { SlidesHome } from '@/features/slides/slides-home';

export const Route = createFileRoute('/_authenticated/slides/')({
  component: SlidesHome,
});
