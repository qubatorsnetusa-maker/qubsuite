import type { FormFieldDto } from '@qub/shared';
import { QUESTION_TYPES } from '@qub/shared/forms';
import type { ReactNode } from 'react';
import { FieldError } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { ContentBlock, FIELD_UI, type UploadFn } from '../registry';
import type { FormSession } from '../session/use-form-session';
import type { RespondentForm } from './respondent-form';

export const labelId = (fieldId: string) => `label-${fieldId}`;

export function QuestionCard({ id, label, description, required, error, children }: { id: string; label: string; description?: string | null; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <section id={`field-${id}`} className={cn('rounded-lg bg-white p-6 shadow-card', error && 'ring-1 ring-danger')} aria-labelledby={labelId(id)}>
      <h3 id={labelId(id)} className="text-base">
        {label || 'Untitled question'} {required && <span className="text-danger" aria-label="required">*</span>}
      </h3>
      {description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
      <FieldError message={error} />
    </section>
  );
}

/** The control for one field (or its content block), wired to the session. */
export function QuestionBody({ field, form, session, upload, variant, onAnswered }: { field: FormFieldDto; form: RespondentForm; session: FormSession; upload?: UploadFn; variant: 'classic' | 'conversational'; onAnswered?(): void }) {
  const ui = FIELD_UI[field.type];
  if (!QUESTION_TYPES[field.type].isInput) return <ContentBlock field={field} pipe={session.pipe} />;
  if (!ui.Input) return null;
  const Input = ui.Input;
  return (
    <Input
      field={field}
      value={session.answers[field.id]}
      onChange={(v) => {
        session.setAnswer(field.id, v);
        onAnswered?.();
      }}
      color={form.theme.primaryColor}
      invalid={!!session.errors[field.id]}
      labelledBy={labelId(field.id)}
      variant={variant}
      uploaded={session.uploads[field.id] ?? []}
      onUploaded={(files) => session.setUploads(field.id, files)}
      upload={upload}
      disabled={session.status === 'submitting' || session.status === 'retrying'}
    />
  );
}
