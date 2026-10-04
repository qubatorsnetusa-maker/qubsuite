import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';
import { respondentFormFromPublic } from './renderer/respondent-form';
import { RespondentView } from './renderer/respondent-view';

/** Respondent view (public route). The URL carries the form's random public id, never its database id. */
export function FillPage() {
  const { formId: publicId } = useParams({ from: '/forms/$formId/fill' });
  return <FillForm publicId={publicId} />;
}

/** The respondent page for one form by its public id; also behind Forms v2's public link. */
export function FillForm({ publicId }: { publicId: string }) {
  const counted = useRef(false);
  const form = useQuery({
    queryKey: qk.forms.public(publicId),
    queryFn: () => {
      // Count one view per page load for the response-rate metric.
      const count = !counted.current;
      counted.current = true;
      return formsService.getPublic(publicId, count);
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (form.data) document.title = form.data.title;
  }, [form.data]);

  if (form.isLoading) return <FullPageSpinner />;
  if (form.error instanceof ApiError && form.error.status === 401) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface-2 p-4">
        <div className="max-w-md rounded-xl bg-background p-8 text-center shadow-card">
          <Lock className="mx-auto size-10 text-muted" />
          <h1 className="mt-4 text-xl">Sign in to continue</h1>
          <p className="mt-2 text-sm text-muted">This form only accepts responses from signed-in users.</p>
          <Button asChild className="mt-6">
            <Link to="/login" search={{ redirect: window.location.pathname }}>
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  if (form.error) return <ErrorState error={form.error} title="This form can’t be opened" />;
  const f = form.data!;
  if (!f.acceptingResponses || f.alreadyResponded) {
    return (
      <div className="flex min-h-full items-start justify-center px-4 py-10" style={{ background: f.theme.backgroundColor }}>
        <div className="w-full max-w-[640px] overflow-hidden rounded-lg bg-white shadow-card">
          <div className="h-2.5" style={{ background: f.theme.primaryColor }} />
          <div className="p-8">
            <h1 className="text-3xl">{f.title}</h1>
            <p className="mt-4">{f.alreadyResponded ? 'You’ve already responded to this form.' : 'This form is no longer accepting responses.'}</p>
          </div>
        </div>
      </div>
    );
  }
  const hidden = Object.fromEntries(new URLSearchParams(window.location.search));
  return (
    <RespondentView
      form={respondentFormFromPublic(f)}
      mode="fill"
      storageKey={`qub-form-progress:${publicId}`}
      hidden={hidden}
      submit={(payload) => formsService.submit(publicId, payload)}
      upload={(fieldId, file, onProgress) => formsService.uploadAnswer(publicId, fieldId, file, onProgress)}
    />
  );
}
