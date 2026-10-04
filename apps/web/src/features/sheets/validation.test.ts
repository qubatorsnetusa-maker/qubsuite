import type { CellDto } from '@qub/shared';
import { describe, expect, it } from 'vitest';
import { parseListItems, validationIssue } from './validation';

const cell = (value: CellDto['value'], formattedValue: string, validation: NonNullable<CellDto['style']>['validation']): CellDto => ({
  row: 0,
  col: 0,
  input: String(value ?? ''),
  value,
  formattedValue,
  dataType: 'STRING',
  style: { validation },
});

describe('validationIssue', () => {
  it('flags values outside the list (case-sensitive) but not empty cells', () => {
    const v = { kind: 'list' as const, values: ['Open', 'Done'] };
    expect(validationIssue(cell('Open', 'Open', v))).toBeNull();
    expect(validationIssue(cell('open', 'open', v))).toBe('Invalid: value must be one of the listed items');
    expect(validationIssue(cell(null, '', v))).toBeNull();
  });
  it('flags non-boolean checkbox values', () => {
    const v = { kind: 'checkbox' as const };
    expect(validationIssue(cell(true, 'TRUE', v))).toBeNull();
    expect(validationIssue(cell('yes', 'yes', v))).toBe('Invalid: value must be TRUE or FALSE');
  });
  it('ignores cells without validation', () => {
    expect(validationIssue(undefined)).toBeNull();
    expect(validationIssue({ ...cell('x', 'x', null), style: null })).toBeNull();
  });
});

describe('parseListItems', () => {
  it('trims, drops blanks, rejects duplicates and oversize lists', () => {
    expect(parseListItems(' a \n\nb\n')).toEqual({ values: ['a', 'b'] });
    expect(parseListItems('a\na')).toEqual({ error: 'Each item must be unique ("a" appears twice).' });
    expect(parseListItems('')).toEqual({ error: 'Add at least one item.' });
    expect(parseListItems(Array.from({ length: 501 }, (_, i) => `x${i}`).join('\n'))).toEqual({ error: 'A list can have at most 500 items.' });
  });
});

describe('listPickInput', () => {
  it('stores picked items as literal text so they stay equal to the list item', async () => {
    const { listPickInput } = await import('./validation');
    expect(listPickInput('Done')).toBe('Done');
    expect(listPickInput('01')).toBe("'01");
    expect(listPickInput('10%')).toBe("'10%");
    expect(listPickInput('1/2/26')).toBe("'1/2/26");
    expect(listPickInput('=SUM(1)')).toBe("'=SUM(1)");
    expect(listPickInput('TRUE')).toBe("'TRUE");
  });
});
