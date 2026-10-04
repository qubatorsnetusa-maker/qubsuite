import type { FormFieldDto } from '@qub/shared';
import { QUESTION_TYPES } from '@qub/shared/forms';

/**
 * The respondent's question number for each field, in order, counted the way the conversational renderer counts:
 * every step (questions and content blocks) takes a number, but only input questions that are steps display it.
 * Welcome, endings, sections, content blocks and hidden fields (an input, but never a step) get `null`.
 * The Content tab's list and canvas and the Workflow tab all number from this, so they always agree.
 */
export function questionNumbers(fields: readonly Pick<FormFieldDto, 'type'>[]): (number | null)[] {
  let step = 0;
  return fields.map((f) => {
    const def = QUESTION_TYPES[f.type];
    if (def.isStep) step++;
    return def.isInput && def.isStep ? step : null;
  });
}

/** `questionNumbers` for one field: its displayed number, or `null` when it's unnumbered or not on the form. */
export function questionNumber(form: { fields: readonly Pick<FormFieldDto, 'id' | 'type'>[] }, fieldId: string): number | null {
  const i = form.fields.findIndex((f) => f.id === fieldId);
  return i < 0 ? null : (questionNumbers(form.fields)[i] ?? null);
}
