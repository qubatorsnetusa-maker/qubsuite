import { describe, expect, it } from 'vitest';
import { freshRef, remapCondition } from './remap';

describe('remap', () => {
  it('finds the first free ref', () => {
    expect(freshRef([])).toBe('q1');
    expect(freshRef(['q1', 'Q2', 'q4'])).toBe('q3');
  });
  it('remaps field, variable and option ids in nested conditions', () => {
    const c = { all: [{ subject: { type: 'field' as const, id: 'f1' }, op: 'eq' as const, value: 'o1' }, { not: { subject: { type: 'variable' as const, id: 'v1' }, op: 'answered' as const } }, { subject: { type: 'score' as const }, op: 'gt' as const, value: 1 }] };
    expect(remapCondition(c, { fields: new Map([['f1', 'F1']]), options: new Map([['o1', 'O1']]), variables: new Map([['v1', 'V1']]) })).toEqual({
      all: [{ subject: { type: 'field', id: 'F1' }, op: 'eq', value: 'O1' }, { not: { subject: { type: 'variable', id: 'V1' }, op: 'answered' } }, { subject: { type: 'score' }, op: 'gt', value: 1 }],
    });
  });
});
