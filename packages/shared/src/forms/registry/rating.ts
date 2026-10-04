import type { FormFieldType } from '../../enums';
import type { AnswerValue } from '../../schemas/forms';
import { issue } from '../validation';
import type { EngineField } from '../types';
import { NUMBER_OPS } from './basic';
import type { QuestionTypeDef } from './types';

/** Inclusive bounds of discrete scale questions (for validation and analytics); null for non-scale types. */
export function scaleBounds(f: EngineField): [number, number] | null {
  switch (f.type) {
    case 'RATING':
      return [1, f.settings.scaleMax ?? 5];
    case 'LINEAR_SCALE':
    case 'OPINION_SCALE':
      return [f.settings.scaleMin ?? 1, f.settings.scaleMax ?? 5];
    case 'NPS':
      return [0, 10];
    case 'EMOJI_RATING':
      return [1, f.settings.scaleMax === 3 ? 3 : 5];
    default:
      return null;
  }
}

const numeric = (v: AnswerValue) => (typeof v === 'number' ? v : NaN);

function scaleType(type: FormFieldType, label: string, settingsKeys: QuestionTypeDef['settingsKeys'], defaultSettings: QuestionTypeDef['defaultSettings'], starWording = false): QuestionTypeDef {
  return {
    type,
    category: 'rating',
    label,
    isInput: true,
    isStep: true,
    optionKinds: [],
    settingsKeys,
    validationKeys: [],
    defaultSettings,
    defaultLabel: 'Untitled question',
    storage: 'number',
    operators: NUMBER_OPS,
    analyticsKind: 'scale',
    estimateSeconds: 4,
    validate: (f, v) => {
      const [lo, hi] = scaleBounds(f)!;
      const n = numeric(v);
      if (Number.isInteger(n) && n >= lo && n <= hi) return null;
      return issue('scale', starWording ? `Choose a rating from ${lo} to ${hi}` : `Choose a value from ${lo} to ${hi}`);
    },
    display: (_f, v) => (typeof v === 'number' ? String(v) : ''),
    toScalar: (_f, v) => (typeof v === 'number' ? v : null),
  };
}

export const RATING_TYPES: QuestionTypeDef[] = [
  scaleType('RATING', 'Rating', ['scaleMax'], { scaleMax: 5 }, true),
  scaleType('LINEAR_SCALE', 'Linear scale', ['scaleMin', 'scaleMax', 'minLabel', 'maxLabel'], { scaleMin: 1, scaleMax: 5 }),
  scaleType('OPINION_SCALE', 'Opinion scale', ['scaleMin', 'scaleMax', 'minLabel', 'maxLabel'], { scaleMin: 1, scaleMax: 5 }),
  scaleType('NPS', 'Net Promoter Score', ['minLabel', 'maxLabel'], { minLabel: 'Not likely', maxLabel: 'Extremely likely' }),
  scaleType('EMOJI_RATING', 'Emoji rating', ['scaleMax'], { scaleMax: 5 }, true),
  {
    type: 'SLIDER',
    category: 'rating',
    label: 'Slider',
    isInput: true,
    isStep: true,
    optionKinds: [],
    settingsKeys: ['rangeMin', 'rangeMax', 'step', 'minLabel', 'maxLabel', 'prefix', 'suffix'],
    validationKeys: [],
    defaultSettings: { rangeMin: 0, rangeMax: 100, step: 1 },
    defaultLabel: 'Untitled question',
    storage: 'number',
    operators: NUMBER_OPS,
    analyticsKind: 'numeric',
    estimateSeconds: 5,
    validate: (f, v) => {
      const min = f.settings.rangeMin ?? 0;
      const max = f.settings.rangeMax ?? 100;
      const step = f.settings.step ?? 1;
      const n = numeric(v);
      if (!Number.isFinite(n) || n < min || n > max) return issue('range', `Choose a value from ${min} to ${max}`);
      const steps = (n - min) / step;
      return Math.abs(steps - Math.round(steps)) < 1e-9 ? null : issue('step', `Use steps of ${step}`);
    },
    display: (_f, v) => (typeof v === 'number' ? String(v) : ''),
    toScalar: (_f, v) => (typeof v === 'number' ? v : null),
  },
];
