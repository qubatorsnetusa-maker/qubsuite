import type { Condition } from '@qub/shared';
import { describe, expect, it } from 'vitest';
import { fromEditor, toEditor } from './condition-editor';

const leaf = (id: string, op: 'eq' | 'gt' | 'answered', value?: string | number) => ({ subject: { type: 'field' as const, id }, op, ...(value !== undefined ? { value } : {}) });

describe('condition editor model', () => {
  it.each<[string, Condition]>([
    ['single leaf', { all: [leaf('a', 'eq', 'x')] }],
    ['AND', { all: [leaf('a', 'eq', 'x'), leaf('b', 'gt', 3)] }],
    ['OR', { any: [leaf('a', 'eq', 'x'), leaf('b', 'answered')] }],
    ['NOT leaf', { all: [{ not: leaf('a', 'eq', 'x') }] }],
    ['A and (B or C)', { all: [leaf('a', 'eq', 'x'), { any: [leaf('b', 'gt', 3), leaf('c', 'answered')] }] }],
    ['always', { all: [] }],
  ])('round-trips %s', (_n, c) => expect(fromEditor(toEditor(c)!)).toEqual(c));

  it('wraps a bare leaf in an all-group', () => {
    expect(toEditor(leaf('a', 'eq', 'x'))).toEqual({ mode: 'all', items: [{ negate: false, leaf: leaf('a', 'eq', 'x') }] });
  });

  it('refuses shapes deeper than the editor supports', () => {
    expect(toEditor({ all: [{ any: [{ all: [leaf('a', 'answered')] }] }] })).toBeNull();
  });
});
