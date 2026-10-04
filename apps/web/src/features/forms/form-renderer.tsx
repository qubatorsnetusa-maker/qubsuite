import type { AnswerValue, FormFieldDto, FormThemeDto, PublicFormDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import type { ReactNode } from 'react';
import { RespondentView } from './renderer/respondent-view';

/** Legacy props kept for existing callers and tests; new code uses RespondentView directly. */
export interface FormRendererProps {
  title: string;
  description: string | null;
  fields: FormFieldDto[];
  theme: FormThemeDto;
  settings: Partial<PublicFormDto['settings']>;
  signedInEmail?: string | null;
  mode: 'preview' | 'fill';
  onSubmit(answers: Record<string, AnswerValue>, email?: string): Promise<{ confirmationMessage: string }>;
  upload?(fieldId: string, file: File, onProgress: (f: number) => void): Promise<{ id: string; name: string; size: number }>;
  banner?: ReactNode;
}

export function FormRenderer(props: FormRendererProps) {
  return (
    <RespondentView
      form={{ title: props.title, description: props.description, fields: props.fields, variables: [], theme: props.theme, settings: { ...DEFAULT_FORM_SETTINGS, ...props.settings }, signedInEmail: props.signedInEmail }}
      mode={props.mode}
      storageKey={null}
      banner={props.banner}
      upload={props.upload}
      submit={async (payload) => {
        const r = await props.onSubmit(payload.answers, payload.email);
        return { id: '', confirmationMessage: r.confirmationMessage, message: r.confirmationMessage, endingId: null, title: null, redirectUrl: null, score: null };
      }}
    />
  );
}
