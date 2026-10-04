import type { ConditionOp, FormFieldType, OptionKind } from '../../enums';
import type { Scalar } from '../../formula';
import type { AnswerValue, FieldSettings, FieldValidation } from '../../schemas/forms';
import type { EngineField } from '../types';

export interface ValidationIssue {
  code: string;
  message: string;
}

export type StorageColumn = 'text' | 'number' | 'date' | 'json';
export type AnalyticsKind = 'text' | 'numeric' | 'scale' | 'choice' | 'multi' | 'boolean' | 'date' | 'matrix' | 'ranking' | 'file' | 'none';
export type TypeCategory = 'basic' | 'choice' | 'rating' | 'advanced' | 'content' | 'screen' | 'layout';

export interface QuestionTypeDef {
  type: FormFieldType;
  category: TypeCategory;
  label: string;
  /** Collects an answer. */
  isInput: boolean;
  /** Occupies a place on the respondent's path (questions and content blocks; not sections, screens or hidden fields). */
  isStep: boolean;
  /** Which kinds of form_field_options rows this type uses ([] = none). */
  optionKinds: readonly OptionKind[];
  settingsKeys: readonly (keyof FieldSettings)[];
  validationKeys: readonly (keyof FieldValidation)[];
  defaultSettings: FieldSettings;
  defaultLabel: string;
  /** Typed column in form_response_answers; null for non-input types. */
  storage: StorageColumn | null;
  /** Operators offered by the logic editor when this type is the subject. */
  operators: readonly ConditionOp[];
  analyticsKind: AnalyticsKind;
  /** Rough time to answer, for "takes N minutes" estimates. */
  estimateSeconds: number;
  /** Type-specific checks, called only with answered values. */
  validate(field: EngineField, value: AnswerValue): ValidationIssue | null;
  /** Human-readable answer for CSV, piping and the response viewer. */
  display(field: EngineField, value: AnswerValue): string;
  /** Value of the answer inside formulas. */
  toScalar(field: EngineField, value: AnswerValue): Scalar;
}
