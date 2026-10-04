import { describe, expect, it } from 'vitest';
import { fieldSettingsSchema, fieldValidationSchema } from '../schemas/forms';
import { makeField, uid } from './__fixtures__/form-dto';
import { fieldStateProblem } from './ops-validate';
import { QUESTION_TYPES } from './registry';
import { baseField, opt } from './registry/fixtures';
import { validateFieldAnswer } from './validation';

describe('custom error messages', () => {
  it('uses the required message and falls back when blank', () => {
    expect(validateFieldAnswer(baseField('SHORT_ANSWER', { required: true, validation: { requiredMessage: 'Tell us your name' } }), '')).toEqual({ code: 'required', message: 'Tell us your name' });
    expect(validateFieldAnswer(baseField('SHORT_ANSWER', { required: true, validation: { requiredMessage: '   ' } }), '')?.message).toBe('This question is required');
  });

  it('uses the length message for too short and too long', () => {
    const f = baseField('SHORT_ANSWER', { validation: { minLength: 3, maxLength: 5, lengthMessage: 'Between 3 and 5 letters' } });
    expect(validateFieldAnswer(f, 'ab')).toEqual({ code: 'min_length', message: 'Between 3 and 5 letters' });
    expect(validateFieldAnswer(f, 'abcdef')).toEqual({ code: 'max_length', message: 'Between 3 and 5 letters' });
  });

  it('uses the range message for numbers, dates, selections and sliders', () => {
    expect(validateFieldAnswer(baseField('NUMBER', { validation: { min: 1, max: 10, rangeMessage: '1 to 10 please' } }), 11)?.message).toBe('1 to 10 please');
    expect(validateFieldAnswer(baseField('DATE', { validation: { minDate: '2026-01-01', rangeMessage: '2026 only' } }), '2025-12-31')?.message).toBe('2026 only');
    const boxes = baseField('CHECKBOXES', { options: [opt('a'), opt('b'), opt('c')], validation: { minSelected: 2, rangeMessage: 'Pick two' } });
    expect(validateFieldAnswer(boxes, ['a'])?.message).toBe('Pick two');
    expect(validateFieldAnswer(baseField('SLIDER', { settings: { rangeMin: 0, rangeMax: 10 }, validation: { rangeMessage: 'Pick 0–10' } }), 11)?.message).toBe('Pick 0–10');
  });

  it('keeps built-in messages for codes without a custom message', () => {
    expect(validateFieldAnswer(baseField('NUMBER', { validation: { integer: true, rangeMessage: 'x' } }), 1.5)?.message).toBe('Enter a whole number');
    const f = baseField('SHORT_ANSWER', { validation: { pattern: '^a$', patternMessage: 'Only a', lengthMessage: 'len' } });
    expect(validateFieldAnswer(f, 'b')).toEqual({ code: 'pattern', message: 'Only a' });
  });

  it('declares message keys only where they apply', () => {
    expect(QUESTION_TYPES.SHORT_ANSWER.validationKeys).toEqual(expect.arrayContaining(['requiredMessage', 'lengthMessage']));
    expect(QUESTION_TYPES.SHORT_ANSWER.validationKeys).not.toContain('rangeMessage');
    for (const t of ['NUMBER', 'DATE', 'DATETIME', 'CHECKBOXES', 'IMAGE_CHOICE', 'SLIDER'] as const) expect(QUESTION_TYPES[t].validationKeys, t).toContain('rangeMessage');
    expect(QUESTION_TYPES.EMAIL.validationKeys).toEqual(['requiredMessage']);
    expect(QUESTION_TYPES.HIDDEN.validationKeys).toEqual([]);
    expect(QUESTION_TYPES.STATEMENT.validationKeys).toEqual([]);
  });
});

describe('display and ending settings', () => {
  it('accepts the new keys within their limits and rejects outside them', () => {
    expect(fieldSettingsSchema.safeParse({ prefix: '$', suffix: 'kg', yesLabel: 'Count me in', noLabel: 'No thanks', showCharCount: true }).success).toBe(true);
    expect(fieldSettingsSchema.safeParse({ prefix: 'x'.repeat(13) }).success).toBe(false);
    expect(fieldSettingsSchema.safeParse({ redirectDelay: 61 }).success).toBe(false);
    expect(fieldSettingsSchema.safeParse({ redirectDelay: 1.5 }).success).toBe(false);
    expect(fieldSettingsSchema.safeParse({ badgeIcon: 'star' }).success).toBe(false);
    expect(fieldSettingsSchema.safeParse({ badgeIcon: 'thumbs_up', buttonUrl: 'https://x.test/?n={{q1}}', redirectUrl: 'https://x.test', showSubmitAnother: false }).success).toBe(true);
    expect(fieldValidationSchema.safeParse({ requiredMessage: 'x'.repeat(201) }).success).toBe(false);
  });

  it('allows each new setting only on its own question types', () => {
    expect(fieldStateProblem(makeField(uid(1), 'NUMBER', 0, { settings: { prefix: '$' } }))).toBeNull();
    expect(fieldStateProblem(makeField(uid(1), 'YES_NO', 0, { settings: { prefix: '$' } }))).toMatch(/prefix/);
    expect(fieldStateProblem(makeField(uid(1), 'YES_NO', 0, { settings: { yesLabel: 'Yep' } }))).toBeNull();
    expect(fieldStateProblem(makeField(uid(1), 'PARAGRAPH', 0, { settings: { showCharCount: true } }))).toBeNull();
    expect(fieldStateProblem(makeField(uid(1), 'ENDING', 0, { settings: { badgeIcon: 'rocket', redirectDelay: 5, redirectUrl: 'https://x.test' } }))).toBeNull();
    expect(fieldStateProblem(makeField(uid(1), 'WELCOME', 0, { settings: { redirectUrl: 'https://x.test' } }))).toMatch(/redirectUrl/);
    expect(fieldStateProblem(makeField(uid(1), 'EMAIL', 0, { validation: { requiredMessage: 'Need it' } }))).toBeNull();
    expect(fieldStateProblem(makeField(uid(1), 'EMAIL', 0, { validation: { rangeMessage: 'no' } }))).toMatch(/rangeMessage/);
  });
});
