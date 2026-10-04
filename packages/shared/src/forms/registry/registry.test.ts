import { describe, expect, it } from 'vitest';
import { FORM_FIELD_TYPES, type FormFieldType } from '../../enums';
import { answerValueSchema, fieldSettingsSchema, fieldValidationSchema, type AnswerValue } from '../../schemas/forms';
import { estimateMinutes } from '../estimate';
import type { EngineField } from '../types';
import { validateFieldAnswer } from '../validation';
import { baseField, opt } from './fixtures';
import { displayAnswer, QUESTION_TYPE_LIST, QUESTION_TYPES } from './index';

const options = [opt('a', 'A'), opt('b', 'B')];
const matrix = [opt('r', 'Row', { kind: 'row' }), opt('c', 'Col', { kind: 'column' })];

/** One valid and one invalid answer for every input type — the per-type lifecycle fixture. */
const SAMPLES: Partial<Record<FormFieldType, { extra?: Partial<EngineField>; valid: AnswerValue; invalid: AnswerValue }>> = {
  SHORT_ANSWER: { valid: 'hi', invalid: 3 },
  PARAGRAPH: { valid: 'hello\nthere', invalid: 3 },
  EMAIL: { valid: 'a@b.co', invalid: 'x' },
  NUMBER: { valid: 3, invalid: 'x' },
  PHONE: { valid: '+256772000000', invalid: '12' },
  URL: { valid: 'https://qub.app', invalid: 'ftp://x' },
  DATE: { valid: '2026-01-31', invalid: '2026-02-31' },
  TIME: { valid: '08:15', invalid: '8:15pm' },
  DATETIME: { valid: '2026-01-31T08:15', invalid: '2026-01-31' },
  HIDDEN: { valid: 'x', invalid: 'y'.repeat(2001) },
  MULTIPLE_CHOICE: { extra: { options }, valid: 'a', invalid: 'z' },
  DROPDOWN: { extra: { options }, valid: 'b', invalid: 'z' },
  CHECKBOXES: { extra: { options }, valid: ['a'], invalid: ['z'] },
  IMAGE_CHOICE: { extra: { options }, valid: ['a'], invalid: ['a', 'b'] },
  RANKING: { extra: { options }, valid: ['b', 'a'], invalid: ['a'] },
  MATRIX: { extra: { options: matrix }, valid: { r: 'c' }, invalid: { r: 'nope' } },
  YES_NO: { valid: true, invalid: 'maybe' },
  RATING: { valid: 4, invalid: 9 },
  LINEAR_SCALE: { valid: 3, invalid: 9 },
  OPINION_SCALE: { valid: 3, invalid: 9 },
  NPS: { valid: 9, invalid: -1 },
  EMOJI_RATING: { valid: 5, invalid: 6 },
  SLIDER: { valid: 40, invalid: 400 },
  FILE_UPLOAD: { valid: ['u1'], invalid: ['u1', 'u2'] },
  SIGNATURE: { valid: ['u1'], invalid: ['u1', 'u2'] },
  ADDRESS: { extra: { required: true }, valid: { line1: '1 Main St', city: 'Kampala', country: 'Uganda' }, invalid: { line1: '1 Main St' } },
  LOCATION: { valid: { label: 'Kampala', lat: 0.3, lng: 32.6 }, invalid: { label: '' , lat: 1 } },
  CONSENT: { extra: { required: true }, valid: true, invalid: false },
};

describe('registry completeness', () => {
  it('defines every field type exactly once', () => {
    for (const t of FORM_FIELD_TYPES) expect(QUESTION_TYPES[t]?.type).toBe(t);
    expect(QUESTION_TYPE_LIST).toHaveLength(FORM_FIELD_TYPES.length);
  });
  it('has a lifecycle sample for every input type', () => {
    for (const d of QUESTION_TYPE_LIST) if (d.isInput) expect(SAMPLES[d.type], d.type).toBeDefined();
  });
  it('declares only real settings and validation keys, with valid defaults', () => {
    const settingKeys = Object.keys(fieldSettingsSchema.shape);
    const validationKeys = Object.keys(fieldValidationSchema.shape);
    for (const d of QUESTION_TYPE_LIST) {
      for (const k of d.settingsKeys) expect(settingKeys, `${d.type}.${k}`).toContain(k);
      for (const k of d.validationKeys) expect(validationKeys, `${d.type}.${k}`).toContain(k);
      expect(fieldSettingsSchema.safeParse(d.defaultSettings).success, d.type).toBe(true);
      for (const k of Object.keys(d.defaultSettings)) expect(d.settingsKeys, `${d.type} default ${k}`).toContain(k);
    }
  });
  it('content types collect nothing', () => {
    for (const d of QUESTION_TYPE_LIST.filter((x) => !x.isInput)) {
      expect(d.storage, d.type).toBeNull();
      expect(d.operators, d.type).toEqual([]);
    }
  });
});

describe.each(Object.entries(SAMPLES))('lifecycle: %s', (type, sample) => {
  const field = baseField(type as FormFieldType, sample!.extra);
  const def = QUESTION_TYPES[type as FormFieldType];
  it('accepts a valid answer', () => expect(validateFieldAnswer(field, sample!.valid)).toBeNull());
  it('rejects an invalid answer', () => expect(validateFieldAnswer(field, sample!.invalid)).not.toBeNull());
  it('stores in a typed column', () => expect(def.storage).not.toBeNull());
  it('the answer shape passes the API schema', () => expect(answerValueSchema.safeParse(sample!.valid).success).toBe(true));
  it('displays as non-empty text', () => expect(displayAnswer(field, sample!.valid).length).toBeGreaterThan(0));
  it('supports answered/unanswered in logic', () => expect(def.operators).toEqual(expect.arrayContaining(['answered', 'unanswered'])));
  it('is required-aware', () => expect(validateFieldAnswer({ ...field, required: true }, undefined)?.code).toBe('required'));
});

describe('estimate', () => {
  it('rounds to whole minutes, at least one', () => {
    expect(estimateMinutes([baseField('YES_NO')])).toBe(1);
    expect(estimateMinutes(Array.from({ length: 8 }, () => baseField('PARAGRAPH')))).toBe(6);
  });
});
