import { FORM_FIELD_TYPES, type FormFieldType } from '../../enums';
import type { AnswerValue, FieldValidation } from '../../schemas/forms';
import { isAnswered } from '../conditions';
import type { EngineField } from '../types';
import { ADVANCED_TYPES } from './advanced';
import { BASIC_TYPES } from './basic';
import { CHOICE_TYPES } from './choice';
import { CONTENT_TYPES } from './content';
import { RATING_TYPES } from './rating';
import type { QuestionTypeDef } from './types';

export * from './types';
export * from './basic';
export * from './choice';
export * from './rating';
export * from './advanced';
export * from './content';

const RANGE_KEYS = new Set<string>(['min', 'max', 'minDate', 'maxDate', 'minSelected', 'maxSelected']);

/** Every answerable question can override its error messages; which ones depends on the limits it supports. */
function withMessageKeys(d: QuestionTypeDef): QuestionTypeDef {
  if (!d.isInput || d.type === 'HIDDEN') return d;
  const vk = d.validationKeys as readonly string[];
  const keys: (keyof FieldValidation)[] = [...(d.validationKeys as (keyof FieldValidation)[]), 'requiredMessage'];
  if (vk.includes('minLength')) keys.push('lengthMessage');
  if (d.type === 'SLIDER' || vk.some((k) => RANGE_KEYS.has(k))) keys.push('rangeMessage');
  return { ...d, validationKeys: keys };
}

const ALL = [...BASIC_TYPES, ...CHOICE_TYPES, ...RATING_TYPES, ...ADVANCED_TYPES, ...CONTENT_TYPES].map(withMessageKeys);

export const QUESTION_TYPES = Object.fromEntries(ALL.map((d) => [d.type, d])) as Record<FormFieldType, QuestionTypeDef>;

/** Definitions in enum order (the order the builder's type picker groups from). */
export const QUESTION_TYPE_LIST: QuestionTypeDef[] = FORM_FIELD_TYPES.map((t) => QUESTION_TYPES[t]);

export function displayAnswer(field: EngineField, value: AnswerValue | undefined): string {
  return isAnswered(value) ? QUESTION_TYPES[field.type].display(field, value as AnswerValue) : '';
}
