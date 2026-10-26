import type { CellDto, CellRange } from '@qub/shared';
import { describe, expect, it } from 'vitest';
import {
  evaluateConditionalRule,
  getConditionalStyle,
  type ConditionalFormatRule,
} from './conditional-format';

const range: CellRange = { startRow: 0, endRow: 5, startCol: 0, endCol: 5 };

const makeCell = (value: string | number | boolean | null, formattedValue?: string): CellDto => ({
  row: 0,
  col: 0,
  value,
  formattedValue: formattedValue ?? String(value ?? ''),
  input: String(value ?? ''),
  dataType: typeof value === 'number' ? 'NUMBER' : 'STRING',
  style: null,
});

describe('evaluateConditionalRule', () => {
  it('evaluates greaterThan and lessThan on numeric cells', () => {
    const ruleGt: ConditionalFormatRule = {
      id: '1',
      sheetId: 's1',
      range,
      type: 'greaterThan',
      values: [100],
      style: { background: '#dcfce7' },
    };

    expect(evaluateConditionalRule(makeCell(150), 1, 1, ruleGt)).toBe(true);
    expect(evaluateConditionalRule(makeCell(50), 1, 1, ruleGt)).toBe(false);
    expect(evaluateConditionalRule(makeCell(100), 1, 1, ruleGt)).toBe(false);

    const ruleLt: ConditionalFormatRule = {
      ...ruleGt,
      type: 'lessThan',
      values: [100],
    };
    expect(evaluateConditionalRule(makeCell(50), 1, 1, ruleLt)).toBe(true);
    expect(evaluateConditionalRule(makeCell(150), 1, 1, ruleLt)).toBe(false);
  });

  it('evaluates between and notBetween', () => {
    const ruleBetween: ConditionalFormatRule = {
      id: '2',
      sheetId: 's1',
      range,
      type: 'between',
      values: [10, 50],
      style: { background: '#fef3c7' },
    };

    expect(evaluateConditionalRule(makeCell(25), 0, 0, ruleBetween)).toBe(true);
    expect(evaluateConditionalRule(makeCell(10), 0, 0, ruleBetween)).toBe(true);
    expect(evaluateConditionalRule(makeCell(50), 0, 0, ruleBetween)).toBe(true);
    expect(evaluateConditionalRule(makeCell(5), 0, 0, ruleBetween)).toBe(false);
    expect(evaluateConditionalRule(makeCell(55), 0, 0, ruleBetween)).toBe(false);
  });

  it('evaluates textContains case-insensitively', () => {
    const ruleText: ConditionalFormatRule = {
      id: '3',
      sheetId: 's1',
      range,
      type: 'textContains',
      values: ['pass'],
      style: { color: '#166534' },
    };

    expect(evaluateConditionalRule(makeCell('PASSED'), 2, 2, ruleText)).toBe(true);
    expect(evaluateConditionalRule(makeCell('Fail'), 2, 2, ruleText)).toBe(false);
  });

  it('evaluates empty and notEmpty', () => {
    const ruleEmpty: ConditionalFormatRule = {
      id: '4',
      sheetId: 's1',
      range,
      type: 'empty',
      values: [],
      style: { background: '#fee2e2' },
    };

    expect(evaluateConditionalRule(undefined, 0, 0, ruleEmpty)).toBe(true);
    expect(evaluateConditionalRule(makeCell('', ''), 0, 0, ruleEmpty)).toBe(true);
    expect(evaluateConditionalRule(makeCell('Hello'), 0, 0, ruleEmpty)).toBe(false);
  });

  it('respects rule cell range bounds', () => {
    const rule: ConditionalFormatRule = {
      id: '5',
      sheetId: 's1',
      range: { startRow: 2, endRow: 4, startCol: 2, endCol: 4 },
      type: 'greaterThan',
      values: [0],
      style: { bold: true },
    };

    // Inside range
    expect(evaluateConditionalRule(makeCell(10), 3, 3, rule)).toBe(true);
    // Outside range
    expect(evaluateConditionalRule(makeCell(10), 0, 0, rule)).toBe(false);
    expect(evaluateConditionalRule(makeCell(10), 5, 5, rule)).toBe(false);
  });
});

describe('getConditionalStyle', () => {
  it('combines matching rule styles in order', () => {
    const rules: ConditionalFormatRule[] = [
      {
        id: '1',
        sheetId: 's1',
        range,
        type: 'greaterThan',
        values: [10],
        style: { background: '#dcfce7', color: '#166534' },
      },
      {
        id: '2',
        sheetId: 's1',
        range,
        type: 'greaterThan',
        values: [100],
        style: { bold: true },
      },
    ];

    const style1 = getConditionalStyle(makeCell(50), 1, 1, 's1', rules);
    expect(style1).toEqual({
      background: '#dcfce7',
      color: '#166534',
      fontWeight: undefined,
      fontStyle: undefined,
      textDecoration: undefined,
    });

    const style2 = getConditionalStyle(makeCell(200), 1, 1, 's1', rules);
    expect(style2).toEqual({
      background: '#dcfce7',
      color: '#166534',
      fontWeight: 600,
      fontStyle: undefined,
      textDecoration: undefined,
    });
  });
});
