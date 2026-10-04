import { describe, expect, it } from 'vitest';
import type { AnswerValue } from '../../schemas/forms';
import { isSafePattern, PATTERN_INPUT_CAP, validateFieldAnswer } from '../validation';
import { baseField } from './fixtures';
import type { FormFieldType } from '../../enums';

const check = (type: FormFieldType, value: AnswerValue | undefined, extra = {}) => validateFieldAnswer(baseField(type, extra), value)?.message ?? null;

describe('basic type validation', () => {
  it.each<[FormFieldType, AnswerValue | undefined, object, RegExp | null]>([
    ['SHORT_ANSWER', 'hi', {}, null],
    ['SHORT_ANSWER', 5, {}, /Expected text/],
    ['SHORT_ANSWER', 'ab', { validation: { minLength: 3 } }, /at least 3 characters/],
    ['SHORT_ANSWER', 'abcd', { validation: { maxLength: 3 } }, /at most 3 characters/],
    ['SHORT_ANSWER', 'ABC-12', { validation: { pattern: '^[A-Z]{3}-\\d+$' } }, null],
    ['SHORT_ANSWER', 'abc-12', { validation: { pattern: '^[A-Z]{3}-\\d+$', patternMessage: 'Use ABC-123' } }, /Use ABC-123/],
    ['SHORT_ANSWER', '  ', { required: true }, /required/],
    ['SHORT_ANSWER', undefined, {}, null],
    ['PARAGRAPH', 'long\ntext', {}, null],
    ['EMAIL', 'a@b.co', {}, null],
    ['EMAIL', 'nope', {}, /email/],
    ['EMAIL', `${'a'.repeat(250)}@b.co`, {}, /email/],
    ['NUMBER', 5, { validation: { min: 1, max: 10 } }, null],
    ['NUMBER', '7', {}, null],
    ['NUMBER', 'seven', {}, /Enter a number/],
    ['NUMBER', 11, { validation: { max: 10 } }, /most 10/],
    ['NUMBER', 0, { validation: { min: 1 } }, /least 1/],
    ['NUMBER', 2.5, { validation: { integer: true } }, /whole/],
    ['PHONE', '+256 772 123456', {}, null],
    ['PHONE', '(555) 010-9999', {}, null],
    ['PHONE', '12', {}, /phone/],
    ['PHONE', '+1-800-FLOWERS', {}, /phone/],
    ['URL', 'https://qub.app/x?y=1', {}, null],
    ['URL', 'javascript:alert(1)', {}, /http/],
    ['URL', 'qub.app', {}, /http/],
    ['DATE', '2026-02-28', {}, null],
    ['DATE', '2026-02-30x', {}, /date/],
    ['DATE', '2026-01-01', { validation: { minDate: '2026-06-01' } }, /on or after 2026-06-01/],
    ['DATE', '2026-12-01', { validation: { maxDate: '2026-06-01' } }, /on or before 2026-06-01/],
    ['TIME', '23:59', {}, null],
    ['TIME', '24:00', {}, /time/],
    ['DATETIME', '2026-09-26T14:30', {}, null],
    ['DATETIME', '2026-09-26 14:30', {}, /date and time/],
    ['DATETIME', '2026-09-26T09:00', { validation: { minDate: '2026-09-26T10:00' } }, /on or after/],
    ['HIDDEN', 'newsletter', {}, null],
    ['HIDDEN', 'x'.repeat(2001), {}, /too long/],
  ])('%s %j %j', (type, value, extra, expected) => {
    const m = check(type, value, extra);
    if (expected === null) expect(m).toBeNull();
    else expect(m).toMatch(expected);
  });
});

describe('isSafePattern', () => {
  it.each([
    ['^[A-Z]{3}-\\d+$', true],
    ['^(a+)+$', false],
    ['(x*)*y', false],
    ['(\\w+\\s?)+$', false],
    ['[', false],
    ['^\\d{5}(-\\d{4})?$', true],
    // Nested groups: the inner quantifier counts at any depth.
    ['^((a+))+$', false],
    ['^(x(y(z*)))+$', false],
    // Alternation inside a repeated group.
    ['^(a|aa)+$', false],
    ['^(a|a)*$', false],
    ['^(?:a|b){2,}$', false],
    // Alternation or quantifiers inside an unrepeated or optional group stay allowed.
    ['^(red|green|blue)$', true],
    ['^(a|b)?c$', true],
    ['^[(+*|)]+$', true],
    ['^\\(\\d+\\)+$', true],
  ])('%s → %s', (p, ok) => expect(isSafePattern(p)).toBe(ok));
});

describe('pattern checks on long answers', () => {
  it('reports max_length before running the pattern', () => {
    const f = baseField('PARAGRAPH', { validation: { maxLength: 10, pattern: '^b+$' } });
    expect(validateFieldAnswer(f, 'a'.repeat(50))?.code).toBe('max_length');
  });

  it('tests the pattern against the first 1000 characters only', () => {
    const f = baseField('PARAGRAPH', { validation: { pattern: 'z' } });
    // The only `z` sits past the cap, so the capped input does not match.
    expect(validateFieldAnswer(f, `${'a'.repeat(PATTERN_INPUT_CAP)}z`)?.code).toBe('pattern');
    expect(validateFieldAnswer(f, `${'a'.repeat(PATTERN_INPUT_CAP - 1)}z`)).toBeNull();
  });

  it('stays fast on a 100k-character answer', () => {
    const f = baseField('PARAGRAPH', { validation: { pattern: '^[a-z ]+$' } });
    const started = performance.now();
    validateFieldAnswer(f, 'ab '.repeat(34_000));
    expect(performance.now() - started).toBeLessThan(200);
  });
});
