import { describe, expect, it } from 'vitest';
import type { ConditionOp } from '../enums';
import type { AnswerValue, Condition, ConditionValue } from '../schemas/forms';
import { compareLeaf, evaluateCondition, isAnswered, type ConditionContext } from './conditions';

describe('isAnswered', () => {
  it.each<[AnswerValue | undefined, boolean]>([
    [undefined, false],
    [null, false],
    ['', false],
    ['   ', false],
    ['x', true],
    [0, true],
    [false, true],
    [[], false],
    [['a'], true],
    [{ line1: '', city: '' }, false],
    [{ line1: '1 Main St' }, true],
    [{ label: '' }, false],
    [{ label: 'Kampala' }, true],
  ])('%j → %s', (v, expected) => expect(isAnswered(v)).toBe(expected));
});

describe('compareLeaf', () => {
  it.each<[ConditionOp, AnswerValue | undefined, ConditionValue, boolean]>([
    ['eq', 'yes', 'yes', true],
    ['eq', 'Yes', 'yes', false],
    ['neq', 'yes', 'no', true],
    ['neq', undefined, 'no', true],
    ['eq', undefined, 'no', false],
    ['contains', 'Hello World', 'world', true],
    ['not_contains', 'Hello', 'bye', true],
    ['not_contains', undefined, 'bye', true],
    ['starts_with', 'Uganda', 'ug', true],
    ['ends_with', 'Uganda', 'DA', true],
    ['starts_with', 'Kenya', 'ug', false],
    ['gt', 20, 18, true],
    ['gt', 18, 18, false],
    ['gte', 18, 18, true],
    ['lt', 17, 18, true],
    ['lte', 19, 18, false],
    ['gt', '20', 18, true],
    ['lt', 5, '10', true],
    ['gt', 'abc', 1, false],
    ['gt', '2026-10-01', '2026-09-30', true],
    ['lt', '2026-10-01T09:00', '2026-10-01T10:00', true],
    ['eq', 4, '4', true],
    ['eq', 4, 4, true],
    ['eq', true, true, true],
    ['eq', true, 'true', true],
    ['eq', false, true, false],
    ['neq', false, true, true],
    ['eq', ['a'], 'a', true],
    ['eq', ['a', 'b'], 'a', false],
    ['contains', ['a', 'b'], 'b', true],
    ['not_contains', ['a', 'b'], 'c', true],
    ['gt', ['a'], 'a', false],
    ['contains', { line1: '1 Main St', city: 'Kampala' }, 'kampala', true],
    ['eq', { line1: 'x' }, 'x', false],
    ['answered', 'x', null, true],
    ['unanswered', '', null, true],
    ['answered', false, null, true],
  ])('%s(%j, %j) → %s', (op, actual, expected, result) => expect(compareLeaf(op, actual, expected)).toBe(result));
});

describe('evaluateCondition', () => {
  const answers: Record<string, AnswerValue> = { country: 'Uganda', type: 'Business', age: 17 };
  const ctx: ConditionContext = {
    fieldValue: (id) => answers[id],
    variableValue: (id) => (id === 'total' ? 120 : undefined),
    score: () => 81,
  };
  const f = (id: string, op: ConditionOp, value?: ConditionValue): Condition => ({ subject: { type: 'field', id }, op, value });

  it('AND of two leaves (country = Uganda AND applicantType = Business)', () => {
    expect(evaluateCondition({ all: [f('country', 'eq', 'Uganda'), f('type', 'eq', 'Business')] }, ctx)).toBe(true);
    expect(evaluateCondition({ all: [f('country', 'eq', 'Uganda'), f('type', 'eq', 'Personal')] }, ctx)).toBe(false);
  });
  it('OR and NOT', () => {
    expect(evaluateCondition({ any: [f('country', 'eq', 'Kenya'), f('age', 'lt', 18)] }, ctx)).toBe(true);
    expect(evaluateCondition({ not: f('age', 'lt', 18) }, ctx)).toBe(false);
  });
  it('nested groups', () => {
    const c: Condition = { all: [f('country', 'eq', 'Uganda'), { any: [f('age', 'gte', 18), { not: f('type', 'eq', 'Business') }] }] };
    expect(evaluateCondition(c, ctx)).toBe(false);
  });
  it('empty all is true, empty any is false', () => {
    expect(evaluateCondition({ all: [] }, ctx)).toBe(true);
    expect(evaluateCondition({ any: [] }, ctx)).toBe(false);
  });
  it('variables and score', () => {
    expect(evaluateCondition({ subject: { type: 'variable', id: 'total' }, op: 'gt', value: 100 }, ctx)).toBe(true);
    expect(evaluateCondition({ subject: { type: 'score' }, op: 'gt', value: 80 }, ctx)).toBe(true);
  });
  it('a subject that no longer exists evaluates as unanswered', () => {
    expect(evaluateCondition(f('deleted', 'eq', 'x'), ctx)).toBe(false);
    expect(evaluateCondition(f('deleted', 'unanswered'), ctx)).toBe(true);
    expect(evaluateCondition({ subject: { type: 'variable', id: 'gone' }, op: 'eq', value: 1 }, ctx)).toBe(false);
  });
});
