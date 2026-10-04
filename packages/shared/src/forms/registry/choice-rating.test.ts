import { describe, expect, it } from 'vitest';
import type { FormFieldType } from '../../enums';
import type { AnswerValue } from '../../schemas/forms';
import { scoreField } from '../scoring';
import type { EngineField } from '../types';
import { validateFieldAnswer } from '../validation';
import { baseField, opt } from './fixtures';
import { QUESTION_TYPES, scaleBounds } from './index';

const choiceOpts = [opt('a', 'Apple'), opt('b', 'Banana'), opt('c', 'Cherry')];
const matrixOpts = [opt('r1', 'Speed', { kind: 'row' }), opt('r2', 'Price', { kind: 'row' }), opt('c1', 'Bad', { kind: 'column' }), opt('c2', 'Good', { kind: 'column' })];
const check = (type: FormFieldType, value: AnswerValue | undefined, extra: Partial<EngineField> = {}) => validateFieldAnswer(baseField(type, extra), value)?.message ?? null;

describe('choice validation', () => {
  it.each<[FormFieldType, AnswerValue, Partial<EngineField>, RegExp | null]>([
    ['MULTIPLE_CHOICE', 'a', { options: choiceOpts }, null],
    ['MULTIPLE_CHOICE', 'zzz', { options: choiceOpts }, /Choose one of the options/],
    ['DROPDOWN', 'b', { options: choiceOpts }, null],
    ['DROPDOWN', ['b'], { options: choiceOpts }, /Choose one of the options/],
    ['CHECKBOXES', ['a', 'c'], { options: choiceOpts }, null],
    ['CHECKBOXES', ['a', 'zzz'], { options: choiceOpts }, /options/],
    ['CHECKBOXES', ['a', 'a'], { options: choiceOpts }, /Duplicate/],
    ['CHECKBOXES', ['a', 'b'], { options: choiceOpts, validation: { maxSelected: 1 } }, /at most 1/],
    ['CHECKBOXES', ['a'], { options: choiceOpts, validation: { minSelected: 2 } }, /at least 2/],
    ['IMAGE_CHOICE', ['a'], { options: choiceOpts }, null],
    ['IMAGE_CHOICE', ['a', 'b'], { options: choiceOpts }, /one picture/],
    ['IMAGE_CHOICE', ['a', 'b'], { options: choiceOpts, settings: { allowMultiple: true } }, null],
    ['RANKING', ['c', 'a', 'b'], { options: choiceOpts }, null],
    ['RANKING', ['c', 'a'], { options: choiceOpts }, /Rank every option/],
    ['RANKING', ['c', 'a', 'a'], { options: choiceOpts }, /Rank every option/],
    ['MATRIX', { r1: 'c2', r2: 'c1' }, { options: matrixOpts }, null],
    ['MATRIX', { r1: 'c2' }, { options: matrixOpts }, null],
    ['MATRIX', { r1: 'c2' }, { options: matrixOpts, required: true }, /every row/],
    ['MATRIX', { r1: 'zz' }, { options: matrixOpts }, /grid/],
    ['MATRIX', ['c1'], { options: matrixOpts }, /grid/],
    ['YES_NO', true, {}, null],
    ['YES_NO', false, { required: true }, null],
    ['YES_NO', 'yes', {}, /yes or no/],
  ])('%s %j', (type, value, extra, expected) => {
    const m = check(type, value, extra);
    if (expected === null) expect(m).toBeNull();
    else expect(m).toMatch(expected);
  });
});

describe('rating validation', () => {
  it.each<[FormFieldType, AnswerValue, Partial<EngineField>, RegExp | null]>([
    ['RATING', 5, { settings: { scaleMax: 5 } }, null],
    ['RATING', 6, { settings: { scaleMax: 5 } }, /1 to 5/],
    ['RATING', 2.5, {}, /1 to 5/],
    ['LINEAR_SCALE', 0, { settings: { scaleMin: 0, scaleMax: 10 } }, null],
    ['LINEAR_SCALE', 0, { settings: { scaleMin: 1, scaleMax: 5 } }, /1 to 5/],
    ['OPINION_SCALE', 10, { settings: { scaleMin: 0, scaleMax: 10 } }, null],
    ['NPS', 0, {}, null],
    ['NPS', 10, {}, null],
    ['NPS', 11, {}, /0 to 10/],
    ['EMOJI_RATING', 3, { settings: { scaleMax: 3 } }, null],
    ['EMOJI_RATING', 4, { settings: { scaleMax: 3 } }, /1 to 3/],
    ['SLIDER', 50, {}, null],
    ['SLIDER', 101, {}, /0 to 100/],
    ['SLIDER', 2.5, { settings: { rangeMin: 0, rangeMax: 10, step: 0.5 } }, null],
    ['SLIDER', 2.3, { settings: { rangeMin: 0, rangeMax: 10, step: 0.5 } }, /steps of 0.5/],
  ])('%s %j', (type, value, extra, expected) => {
    const m = check(type, value, extra);
    if (expected === null) expect(m).toBeNull();
    else expect(m).toMatch(expected);
  });

  it('reports scale bounds for analytics', () => {
    expect(scaleBounds(baseField('NPS'))).toEqual([0, 10]);
    expect(scaleBounds(baseField('RATING', { settings: { scaleMax: 7 } }))).toEqual([1, 7]);
    expect(scaleBounds(baseField('LINEAR_SCALE'))).toEqual([1, 5]);
    expect(scaleBounds(baseField('SLIDER'))).toBeNull();
  });
});

describe('display and formula values', () => {
  it('uses labels for display and option values for formulas', () => {
    const f = baseField('MULTIPLE_CHOICE', { options: [opt('a', 'Small', { value: '10' }), opt('b', 'Large')] });
    expect(QUESTION_TYPES.MULTIPLE_CHOICE.display(f, 'a')).toBe('Small');
    expect(QUESTION_TYPES.MULTIPLE_CHOICE.toScalar(f, 'a')).toBe('10');
    expect(QUESTION_TYPES.MULTIPLE_CHOICE.toScalar(f, 'b')).toBe('Large');
    const m = baseField('MATRIX', { options: matrixOpts });
    expect(QUESTION_TYPES.MATRIX.display(m, { r1: 'c2', r2: 'c1' })).toBe('Speed: Good; Price: Bad');
    expect(QUESTION_TYPES.YES_NO.display(baseField('YES_NO'), false)).toBe('No');
    expect(QUESTION_TYPES.RANKING.display(baseField('RANKING', { options: choiceOpts }), ['b', 'a', 'c'])).toBe('1. Banana; 2. Apple; 3. Cherry');
  });
});

describe('scoring', () => {
  it('adds option points', () => {
    const f = baseField('CHECKBOXES', { options: choiceOpts, scoreConfig: { optionPoints: { a: 2, c: 3 } } });
    expect(scoreField(f, ['a', 'c'])).toBe(5);
    expect(scoreField(f, ['b'])).toBe(0);
    expect(scoreField(f, undefined)).toBe(0);
  });
  it('awards points for the correct answer', () => {
    expect(scoreField(baseField('MULTIPLE_CHOICE', { scoreConfig: { correct: 'b', points: 1 } }), 'b')).toBe(1);
    expect(scoreField(baseField('SHORT_ANSWER', { scoreConfig: { correct: 'Paris', points: 2 } }), ' paris ')).toBe(2);
    expect(scoreField(baseField('NUMBER', { scoreConfig: { correct: 42, points: 1 } }), '42')).toBe(1);
    expect(scoreField(baseField('YES_NO', { scoreConfig: { correct: false, points: 1 } }), false)).toBe(1);
    expect(scoreField(baseField('CHECKBOXES', { scoreConfig: { correct: ['a', 'c'], points: 3 } }), ['c', 'a'])).toBe(3);
    expect(scoreField(baseField('RANKING', { scoreConfig: { correct: ['a', 'b'], points: 3 } }), ['b', 'a'])).toBe(0);
  });
});
