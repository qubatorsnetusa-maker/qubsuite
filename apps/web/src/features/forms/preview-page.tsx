import { evaluateForm, resolveOutcome, validateFieldAnswer } from '@qub/shared/forms';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Eye } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';
import { respondentFormFromDto } from './renderer/respondent-form';
import { RespondentView } from './renderer/respondent-view';

/** Editor preview: runs the real rendering, navigation and validation, but never records a response. */
export function PreviewPage() {
  const { formId } = useParams({ from: '/_authenticated/forms/$formId/preview' });
  return (
    <FormPreview
      formId={formId}
      backLink={
        <Link to="/forms/$formId/edit" params={{ formId }} className="underline">
          Back to editing
        </Link>
      }
    />
  );
}

/** The preview itself; `backLink` returns to whichever builder opened it. */
export function FormPreview({ formId, backLink, bare }: { formId: string; backLink: ReactNode; bare?: boolean }) {
  const form = useQuery({ queryKey: qk.forms.one(formId), queryFn: () => formsService.get(formId) });
  if (form.isLoading) return <FullPageSpinner />;
  if (form.error) return <ErrorState error={form.error} />;
  const f = form.data!;
  const respondent = respondentFormFromDto(f);
  return (
    <RespondentView
      form={respondent}
      mode="preview"
      storageKey={null}
      banner={
        bare ? undefined : (
          <div className="flex items-center justify-between rounded-lg bg-[#3c4043] px-4 py-2 text-sm text-white">
            <span className="flex items-center gap-2">
              <Eye className="size-4" /> Preview — responses are not recorded
            </span>
            {backLink}
          </div>
        )
      }
      submit={async (payload) => {
        // Same engine and validation as the server, run locally so the preview behaves exactly like the live form.
        const def = { fields: f.fields, variables: f.variables };
        const result = evaluateForm(def, payload.answers);
        for (const id of result.path) {
          const field = f.fields.find((x) => x.id === id)!;
          const problem = validateFieldAnswer(field, payload.answers[id]);
          if (problem) throw new Error(`${field.label}: ${problem.message}`);
        }
        const outcome = resolveOutcome(def, payload.answers, result, f.settings.confirmationMessage);
        return { id: 'preview', ...outcome, confirmationMessage: outcome.message, message: `${outcome.message} (Preview — nothing was saved.)`, score: f.settings.quiz.showScore ? result.score : null };
      }}
    />
  );
}
