import type { OptionKind } from '../../enums';
import type { AnswerValue } from '../../schemas/forms';
import { issue } from '../validation';
import type { EngineField, EngineOption } from '../types';
import { BOOL_OPS, CHOICE_OPS, MULTI_OPS, PRESENCE_OPS } from './basic';
import type { QuestionTypeDef, ValidationIssue } from './types';

export const optionsOfKind = (f: EngineField, kind: OptionKind = 'option'): EngineOption[] => f.options.filter((o) => (o.kind ?? 'option') === kind);
export const optionLabel = (f: EngineField, id: string) => f.options.find((o) => o.id === id)?.label ?? id;
const optionScalar = (f: EngineField, id: string) => {
  const o = f.options.find((x) => x.id === id);
  return o ? (o.value ?? o.label) : id;
};
const isRecord = (v: AnswerValue): v is Record<string, string> => typeof v === 'object' && v !== null && !Array.isArray(v) && !('label' in v);

function selectionIssue(f: EngineField, v: AnswerValue): ValidationIssue | null {
  const ids = new Set(optionsOfKind(f).map((o) => o.id));
  if (!Array.isArray(v) || v.some((x) => !ids.has(x))) return issue('option', 'Choose from the options');
  if (new Set(v).size !== v.length) return issue('duplicate', 'Duplicate selection');
  const { minSelected, maxSelected } = f.validation;
  if (minSelected != null && v.length < minSelected) return issue('min_selected', `Select at least ${minSelected}`);
  if (maxSelected != null && v.length > maxSelected) return issue('max_selected', `Select at most ${maxSelected}`);
  return null;
}

const single = (type: 'MULTIPLE_CHOICE' | 'DROPDOWN', label: string, settingsKeys: QuestionTypeDef['settingsKeys']): QuestionTypeDef => ({
  type,
  category: 'choice',
  label,
  isInput: true,
  isStep: true,
  optionKinds: ['option'],
  settingsKeys,
  validationKeys: [],
  defaultSettings: {},
  defaultLabel: 'Untitled question',
  storage: 'text',
  operators: CHOICE_OPS,
  analyticsKind: 'choice',
  estimateSeconds: 6,
  validate: (f, v) => (typeof v === 'string' && optionsOfKind(f).some((o) => o.id === v) ? null : issue('option', 'Choose one of the options')),
  display: (f, v) => (typeof v === 'string' ? optionLabel(f, v) : ''),
  toScalar: (f, v) => (typeof v === 'string' ? optionScalar(f, v) : null),
});

const multiDisplay = (f: EngineField, v: AnswerValue) => (Array.isArray(v) ? v.map((id) => optionLabel(f, id)).join('; ') : '');
const multiScalar = (f: EngineField, v: AnswerValue) => (Array.isArray(v) ? v.map((id) => optionScalar(f, id)).join(', ') : null);

export const CHOICE_TYPES: QuestionTypeDef[] = [
  single('MULTIPLE_CHOICE', 'Multiple choice', ['shuffleOptions']),
  single('DROPDOWN', 'Dropdown', ['shuffleOptions', 'searchable']),
  {
    type: 'CHECKBOXES',
    category: 'choice',
    label: 'Checkboxes',
    isInput: true,
    isStep: true,
    optionKinds: ['option'],
    settingsKeys: ['shuffleOptions'],
    validationKeys: ['minSelected', 'maxSelected'],
    defaultSettings: {},
    defaultLabel: 'Untitled question',
    storage: 'json',
    operators: MULTI_OPS,
    analyticsKind: 'multi',
    estimateSeconds: 8,
    validate: selectionIssue,
    display: multiDisplay,
    toScalar: multiScalar,
  },
  {
    type: 'IMAGE_CHOICE',
    category: 'choice',
    label: 'Picture choice',
    isInput: true,
    isStep: true,
    optionKinds: ['option'],
    settingsKeys: ['allowMultiple', 'shuffleOptions'],
    validationKeys: ['minSelected', 'maxSelected'],
    defaultSettings: {},
    defaultLabel: 'Untitled question',
    storage: 'json',
    operators: MULTI_OPS,
    analyticsKind: 'multi',
    estimateSeconds: 8,
    validate: (f, v) => {
      const base = selectionIssue(f, v);
      if (base) return base;
      return !f.settings.allowMultiple && (v as string[]).length > 1 ? issue('single', 'Choose one picture') : null;
    },
    display: multiDisplay,
    toScalar: multiScalar,
  },
  {
    type: 'RANKING',
    category: 'choice',
    label: 'Ranking',
    isInput: true,
    isStep: true,
    optionKinds: ['option'],
    settingsKeys: ['shuffleOptions'],
    validationKeys: [],
    defaultSettings: {},
    defaultLabel: 'Untitled question',
    storage: 'json',
    operators: PRESENCE_OPS,
    analyticsKind: 'ranking',
    estimateSeconds: 15,
    validate: (f, v) => {
      const ids = optionsOfKind(f).map((o) => o.id);
      const ok = Array.isArray(v) && v.length === ids.length && new Set(v).size === v.length && v.every((x) => ids.includes(x));
      return ok ? null : issue('ranking', 'Rank every option');
    },
    display: (f, v) => (Array.isArray(v) ? v.map((id, i) => `${i + 1}. ${optionLabel(f, id)}`).join('; ') : ''),
    toScalar: (f, v) => (Array.isArray(v) && v[0] ? optionScalar(f, v[0]) : null),
  },
  {
    type: 'MATRIX',
    category: 'choice',
    label: 'Matrix',
    isInput: true,
    isStep: true,
    optionKinds: ['row', 'column'],
    settingsKeys: [],
    validationKeys: [],
    defaultSettings: {},
    defaultLabel: 'Untitled question',
    storage: 'json',
    operators: PRESENCE_OPS,
    analyticsKind: 'matrix',
    estimateSeconds: 5,
    validate: (f, v) => {
      if (!isRecord(v)) return issue('matrix', 'Choose from the grid');
      const rows = new Set(optionsOfKind(f, 'row').map((o) => o.id));
      const cols = new Set(optionsOfKind(f, 'column').map((o) => o.id));
      if (Object.entries(v).some(([r, c]) => !rows.has(r) || !cols.has(c))) return issue('matrix', 'Choose from the grid');
      if (f.required && [...rows].some((r) => !v[r])) return issue('matrix_rows', 'Answer every row');
      return null;
    },
    display: (f, v) =>
      isRecord(v)
        ? optionsOfKind(f, 'row')
            .filter((r) => v[r.id])
            .map((r) => `${r.label}: ${optionLabel(f, v[r.id]!)}`)
            .join('; ')
        : '',
    toScalar: (f, v) => (isRecord(v) ? Object.keys(v).length : null),
  },
  {
    type: 'YES_NO',
    category: 'choice',
    label: 'Yes / No',
    isInput: true,
    isStep: true,
    optionKinds: [],
    settingsKeys: ['yesLabel', 'noLabel'],
    validationKeys: [],
    defaultSettings: {},
    defaultLabel: 'Untitled question',
    storage: 'json',
    operators: BOOL_OPS,
    analyticsKind: 'boolean',
    estimateSeconds: 4,
    validate: (_f, v) => (typeof v === 'boolean' ? null : issue('boolean', 'Choose yes or no')),
    display: (_f, v) => (v === true ? 'Yes' : v === false ? 'No' : ''),
    toScalar: (_f, v) => (typeof v === 'boolean' ? v : null),
  },
];
