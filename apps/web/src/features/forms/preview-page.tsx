import { evaluateForm, resolveOutcome, validateFieldAnswer } from '@qub/shared/forms';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Eye, LayoutList, PanelsTopLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { cn } from '@/lib/utils';
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
        <Link to="/forms/$formId/edit" params={{ formId }} className="underline font-medium">
          Back to editing
        </Link>
      }
    />
  );
}

/** The preview itself; `backLink` returns to whichever builder opened it. */
export function FormPreview({
  formId,
  backLink,
  bare,
  defaultLayout,
}: {
  formId: string;
  backLink: ReactNode;
  bare?: boolean;
  defaultLayout?: 'classic' | 'conversational';
}) {
  const form = useQuery({ queryKey: qk.forms.one(formId), queryFn: () => formsService.get(formId) });
  const [layoutOverride, setLayoutOverride] = useState<'classic' | 'conversational' | null>(defaultLayout ?? null);

  if (form.isLoading) return <FullPageSpinner />;
  if (form.error) return <ErrorState error={form.error} />;
  const f = form.data!;
  const baseRespondent = respondentFormFromDto(f);
  const activeLayout = layoutOverride ?? baseRespondent.settings.layout ?? 'classic';
  const respondent = {
    ...baseRespondent,
    settings: {
      ...baseRespondent.settings,
      layout: activeLayout,
    },
  };

  return (
    <RespondentView
      form={respondent}
      mode="preview"
      storageKey={null}
      banner={
        bare ? undefined : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm">
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <Eye className="size-4 text-blue-600" /> Preview — responses are not recorded
            </span>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLayoutOverride('classic')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
                    activeLayout === 'classic' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <LayoutList className="size-3.5" />
                  Classic
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutOverride('conversational')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
                    activeLayout === 'conversational' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <PanelsTopLeft className="size-3.5" />
                  Typeform
                </button>
              </div>
              <div className="text-blue-600 hover:text-blue-700">{backLink}</div>
            </div>
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
