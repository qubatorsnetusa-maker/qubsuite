import type { ConditionOp } from '../../enums';
import type { AnswerValue } from '../../schemas/forms';
import { dateRangeIssue, isValidDate, isValidDateTime, isValidEmail, isValidHttpUrl, isValidPhone, issue, numberIssue, textIssue, TIME_RE } from '../validation';
import type { EngineField } from '../types';
import type { QuestionTypeDef } from './types';

export const PRESENCE_OPS = ['answered', 'unanswered'] as const satisfies readonly ConditionOp[];
export const TEXT_OPS = ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'ends_with', ...PRESENCE_OPS] as const satisfies readonly ConditionOp[];
export const NUMBER_OPS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', ...PRESENCE_OPS] as const satisfies readonly ConditionOp[];
export const CHOICE_OPS = ['eq', 'neq', ...PRESENCE_OPS] as const satisfies readonly ConditionOp[];
export const MULTI_OPS = ['contains', 'not_contains', 'eq', 'neq', ...PRESENCE_OPS] as const satisfies readonly ConditionOp[];
export const BOOL_OPS = ['eq', 'neq', ...PRESENCE_OPS] as const satisfies readonly ConditionOp[];
export const OBJECT_OPS = ['contains', 'not_contains', ...PRESENCE_OPS] as const satisfies readonly ConditionOp[];

const asText = (_f: EngineField, v: AnswerValue) => (v === null ? '' : String(v));

type Base = Pick<QuestionTypeDef, 'isInput' | 'isStep' | 'optionKinds' | 'settingsKeys' | 'validationKeys' | 'defaultSettings' | 'defaultLabel' | 'display' | 'toScalar'>;
const input: Base = {
  isInput: true,
  isStep: true,
  optionKinds: [],
  settingsKeys: [],
  validationKeys: [],
  defaultSettings: {},
  defaultLabel: 'Untitled question',
  display: asText,
  toScalar: (_f, v) => (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : null),
};

function textType(type: 'SHORT_ANSWER' | 'PARAGRAPH', label: string, estimateSeconds: number): QuestionTypeDef {
  return {
    ...input,
    type,
    category: 'basic',
    label,
    settingsKeys: ['showCharCount'],
    validationKeys: ['minLength', 'maxLength', 'pattern', 'patternMessage'],
    storage: 'text',
    operators: TEXT_OPS,
    analyticsKind: 'text',
    estimateSeconds,
    validate: (f, v) => (typeof v === 'string' ? textIssue(f, v) : issue('type', 'Expected text')),
  };
}

function stringCheck(test: (s: string) => boolean, code: string, message: string) {
  return (_f: EngineField, v: AnswerValue) => (typeof v === 'string' && test(v.trim()) ? null : issue(code, message));
}

export const BASIC_TYPES: QuestionTypeDef[] = [
  textType('SHORT_ANSWER', 'Short answer', 15),
  textType('PARAGRAPH', 'Long answer', 45),
  {
    ...input,
    type: 'EMAIL',
    category: 'basic',
    label: 'Email',
    storage: 'text',
    operators: TEXT_OPS,
    analyticsKind: 'text',
    estimateSeconds: 10,
    validate: stringCheck(isValidEmail, 'email', 'Enter a valid email address'),
  },
  {
    ...input,
    type: 'NUMBER',
    category: 'basic',
    label: 'Number',
    settingsKeys: ['prefix', 'suffix'],
    validationKeys: ['min', 'max', 'integer'],
    storage: 'number',
    operators: NUMBER_OPS,
    analyticsKind: 'numeric',
    estimateSeconds: 8,
    validate: (f, v) => {
      const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
      if (!Number.isFinite(n)) return issue('number', 'Enter a number');
      return numberIssue(f, n);
    },
    toScalar: (_f, v) => (typeof v === 'number' ? v : Number(v)),
  },
  {
    ...input,
    type: 'PHONE',
    category: 'basic',
    label: 'Phone number',
    storage: 'text',
    operators: TEXT_OPS,
    analyticsKind: 'text',
    estimateSeconds: 10,
    validate: stringCheck(isValidPhone, 'phone', 'Enter a valid phone number'),
  },
  {
    ...input,
    type: 'URL',
    category: 'basic',
    label: 'Website',
    storage: 'text',
    operators: TEXT_OPS,
    analyticsKind: 'text',
    estimateSeconds: 10,
    validate: stringCheck(isValidHttpUrl, 'url', 'Enter a link starting with http:// or https://'),
  },
  {
    ...input,
    type: 'DATE',
    category: 'basic',
    label: 'Date',
    validationKeys: ['minDate', 'maxDate'],
    storage: 'date',
    operators: NUMBER_OPS,
    analyticsKind: 'date',
    estimateSeconds: 8,
    validate: (f, v) => (typeof v === 'string' && isValidDate(v) ? dateRangeIssue(f, v) : issue('date', 'Enter a valid date')),
  },
  {
    ...input,
    type: 'TIME',
    category: 'basic',
    label: 'Time',
    storage: 'text',
    operators: NUMBER_OPS,
    analyticsKind: 'text',
    estimateSeconds: 8,
    validate: stringCheck((s) => TIME_RE.test(s), 'time', 'Enter a valid time'),
  },
  {
    ...input,
    type: 'DATETIME',
    category: 'basic',
    label: 'Date & time',
    validationKeys: ['minDate', 'maxDate'],
    storage: 'text',
    operators: NUMBER_OPS,
    analyticsKind: 'text',
    estimateSeconds: 10,
    validate: (f, v) => (typeof v === 'string' && isValidDateTime(v) ? dateRangeIssue(f, v) : issue('datetime', 'Enter a valid date and time')),
  },
  {
    ...input,
    type: 'HIDDEN',
    category: 'advanced',
    label: 'Hidden field',
    isStep: false,
    defaultLabel: 'Hidden field',
    storage: 'text',
    operators: TEXT_OPS,
    analyticsKind: 'text',
    estimateSeconds: 0,
    validate: (_f, v) => (typeof v === 'string' && v.length <= 2000 ? null : issue('hidden', 'Hidden value is too long')),
  },
];
