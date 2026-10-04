import { createFileRoute, notFound } from '@tanstack/react-router';
import { FileQuestion } from 'lucide-react';
import { FormRespondent } from '@/formsV3/components/FormRespondent';
import { submitPublicFormFn } from '@/formsV3/api/forms';
import { incrementPublicFormStartFn } from '@/formsV3/api/workspaces';
import { publicFormQuery } from '@/formsV3/api/queries';
import { ApiError } from '@/formsV3/services/api';
import { useEffect } from 'react';

export const Route = createFileRoute('/formsv3/f/$formId')({
  loader: async ({ params, context: { queryClient } }) => {
    try {
      const { form } = await queryClient.fetchQuery(publicFormQuery(params.formId));
      return { form };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) throw notFound();
      throw err;
    }
  },
  notFoundComponent: FormNotFound,
  component: PublicRespondentRoute,
});

function FormNotFound() {
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-zinc-50">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500">
        <FileQuestion className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">This form isn't available</h1>
      <p className="text-zinc-500 max-w-sm text-sm">
        The link you followed may be broken, or this form may have been closed or removed by its owner.
      </p>
      <a
        href="/formsv3"
        className="mt-2 inline-flex items-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
      >
        Return to Forms
      </a>
    </main>
  );
}

function PublicRespondentRoute() {
  const { form } = Route.useLoaderData();

  useEffect(() => {
    void incrementPublicFormStartFn({ data: { id: form.id } });
  }, [form.id]);

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <FormRespondent
        form={form}
        onComplete={async (answers: Record<string, any>) => {
          await submitPublicFormFn({
            data: {
              formId: form.id,
              answers: answers as Record<string, string>,
              completionTimeSeconds: 0,
            },
          });
        }}
      />
    </div>
  );
}
