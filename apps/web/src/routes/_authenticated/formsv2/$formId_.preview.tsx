import { createFileRoute, Link } from '@tanstack/react-router';
import { FormPreview } from '@/features/forms/preview-page';
import { V2Preview } from '@/features/formsv2/preview/v2-preview';

/** Full-screen preview, outside the builder frame. Responses are not recorded. */
export const Route = createFileRoute('/_authenticated/formsv2/$formId_/preview')({
  validateSearch: (search: Record<string, unknown>) => ({
    frame: search.frame === '1' || search.frame === true,
    device: search.device === 'phone' ? ('phone' as const) : ('desktop' as const),
  }),
  component: Preview,
});

function Preview() {
  const { formId } = Route.useParams();
  const { frame, device } = Route.useSearch();

  // When frame=1 or device=phone (i.e. we are inside an iframe), show the bare form without toggle or banner.
  const inFrame = frame || device === 'phone';

  const formPreviewUrl = `${window.location.pathname}`;

  return (
    <div className="flex flex-col gap-4 p-4">
      {!inFrame && (
        <V2Preview formUrl={formPreviewUrl} frame={false} />
      )}
      <FormPreview
        formId={formId}
        bare={inFrame}
        backLink={
          <Link to="/formsv2/$formId/content" params={{ formId }} className="underline">
            Back to editing
          </Link>
        }
      />
    </div>
  );
}
