import type { FormFieldDto } from '@qub/shared';
import { QUESTION_TYPES } from '@qub/shared/forms';

/**
 * Whether a field can carry "after this question" logic rules: questions and content blocks can; the welcome screen,
 * endings, sections and hidden fields can't.
 */
export function canBranch(field: Pick<FormFieldDto, 'type'>): boolean {
  const def = QUESTION_TYPES[field.type];
  const isScreen = field.type === 'WELCOME' || field.type === 'ENDING';
  return field.type !== 'SECTION' && !isScreen && field.type !== 'HIDDEN' && (def.isStep || def.isInput);
}
